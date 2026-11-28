//! One session's report: totals from the analysis, each item's cost over its lifetime, and
//! the tool runs that findings are made from.

use super::{
    distinct, findings,
    types::{
        CarriedContext, CompactionCalls, FamilyTotal, FindingCost, FixedOverhead, FixedPart,
        KindTotal, Reconstruction, SessionCost, SessionReport, Thresholds, TokenStats, TokenTotals,
        TokenTotalsCoverage, ToolRun, ToolTotal, UsdRange,
    },
};
use crate::{
    analysis::reported_token_subtotals,
    api::{Analysis, ContextItem, CostSubtotal, ModelCall},
    domain::NormalizedSession,
    pricing::InputPrice,
    server::SessionFile,
};
use std::collections::{BTreeMap, HashMap, HashSet};

pub(super) use super::shared::*;

pub(super) fn session_report(
    session: &SessionFile,
    normalized: &NormalizedSession,
    analysis: &Analysis,
    thresholds: &Thresholds,
    limit: usize,
) -> SessionReport {
    let costs = item_costs(analysis, normalized);
    let runs = tool_runs(session, normalized, analysis, &costs);
    let summary = &analysis.session;
    let tokens = token_totals(normalized);
    let calls = analysis.model_calls.len();
    let average_context_tokens = tokens
        .prompt
        .and_then(|total| total.checked_div(tokens.coverage.prompt.recorded_calls as u64));
    let turns = user_turns(analysis).last().copied().unwrap_or(0);
    let carried = carried_context(&costs);
    let prices = call_prices(analysis, normalized);
    let fixed = fixed_overhead(analysis, &costs, &prices);
    let findings = findings::session_findings(
        &findings::SessionFacts {
            analysis,
            prices: &prices,
            costs: &costs,
            runs: &runs,
            carried: &carried,
            turns,
            average_context_tokens,
            average_context_recorded_calls: tokens.coverage.prompt.recorded_calls,
        },
        thresholds,
        limit,
    );
    let (turns_by_starter, expensive_turns) = super::figures::turns(analysis);
    SessionReport {
        turns_by_starter,
        expensive_turns,
        reference: session.id.clone(),
        harness: session.harness.as_str().into(),
        title: session.display_name.clone(),
        working_directory: session.working_directory.clone(),
        parent: session.parent_reference.clone(),
        started_at: session.started_at.map(|at| at.to_rfc3339()),
        updated_at: session.modified_at.map(|at| at.to_rfc3339()),
        models: distinct(
            analysis
                .model_calls
                .iter()
                .filter_map(|call| call.model.clone())
                // Claude Code's model name for messages it wrote itself, such as an error.
                .filter(|model| model != "<synthetic>"),
        ),
        calls,
        cost_by_input: super::figures::input(analysis, normalized, &prices),
        cost_by_context_size: super::figures::bands(analysis),
        cache_rewrites: super::figures::rewrites(analysis),
        largest_items: super::figures::items(analysis, &costs),
        average_context_tokens,
        tokens,
        cost: SessionCost {
            billed: usd_range(&summary.cost_summary.billed),
            api_equivalent: usd_range(&summary.cost_summary.api_equivalent),
            unknown_calls: summary.cost_summary.unknown_calls,
        },
        reconstruction: Reconstruction {
            median_absolute_gap_percent: summary.median_absolute_residual_percent,
            limitation_codes: analysis
                .reconstruction
                .as_ref()
                .map(|coverage| coverage.explanation_codes.clone())
                .unwrap_or_default(),
        },
        peak_context_tokens: summary.peak_calculated_visible_tokens,
        compactions: analysis.compactions.len(),
        compaction_calls: compaction_calls(analysis),
        user_turns: turns,
        turns: report_turns(analysis).len(),
        carried_context: carried,
        context_by_kind: context_by_kind(analysis, &costs),
        tools: tool_totals(analysis, &costs, &runs),
        command_families: family_totals(&runs, FAMILY_LIMIT),
        child_sessions: Vec::new(),
        findings,
        runs,
        fixed,
    }
}

fn usd_range(subtotal: &CostSubtotal) -> Option<UsdRange> {
    let low = subtotal.low?;
    Some(UsdRange {
        low,
        high: subtotal.high.unwrap_or(low),
    })
}

pub(super) fn token_totals(session: &NormalizedSession) -> TokenTotals {
    let subtotals = reported_token_subtotals(&session.model_calls);
    TokenTotals {
        prompt: subtotals.prompt.value,
        fresh_input: subtotals.fresh_input.value,
        cache_read: subtotals.cache_read.value,
        cache_write: subtotals.cache_write.value,
        output: subtotals.output.value,
        reasoning: subtotals.reasoning.value,
        coverage: TokenTotalsCoverage {
            prompt: subtotals.prompt.coverage,
            fresh_input: subtotals.fresh_input.coverage,
            cache_read: subtotals.cache_read.coverage,
            cache_write: subtotals.cache_write.coverage,
            output: subtotals.output.coverage,
            reasoning: subtotals.reasoning.coverage,
        },
    }
}

/// The item's tokens under the call's tokenization profile, or its first estimate.
fn context_by_kind(analysis: &Analysis, costs: &[ItemCost]) -> Vec<KindTotal> {
    let mut kinds: BTreeMap<&str, (usize, FindingCost)> = BTreeMap::new();
    for (item, cost) in analysis.context_items.iter().zip(costs) {
        let entry = kinds.entry(item.kind.as_str()).or_default();
        entry.0 += 1;
        entry.1.add(cost.cost);
    }
    let total: u64 = kinds.values().map(|(_, cost)| cost.token_turns).sum();
    let mut kinds: Vec<KindTotal> = kinds
        .into_iter()
        .filter(|(_, (_, cost))| total > 0 && cost.token_turns * 100 >= total)
        .map(|(kind, (items, cost))| KindTotal {
            kind: kind.to_owned(),
            items,
            token_turns: cost.token_turns,
            share: if total == 0 {
                0.0
            } else {
                cost.token_turns as f64 / total as f64
            },
            estimated_cost: cost.usd,
        })
        .collect();
    kinds.sort_by_key(|kind| std::cmp::Reverse(kind.token_turns));
    kinds
}

fn carried_context(costs: &[ItemCost]) -> CarriedContext {
    let mut all = FindingCost::default();
    let mut carried = FindingCost::default();
    for cost in costs {
        all.add(cost.cost);
        carried.add(cost.carried);
    }
    CarriedContext {
        older_than_turns: CARRIED_AFTER_TURNS,
        token_turns: carried.token_turns,
        estimated_cost: carried.usd,
        share: if all.token_turns == 0 {
            0.0
        } else {
            carried.token_turns as f64 / all.token_turns as f64
        },
    }
}

/// What the session sent before any work. An item counts when it was not copied from a
/// parent session and is:
///
/// - a system prompt or tool definition, or a later version of one
/// - unrecorded request context measured at the first call, at the first call after a
///   compaction, or at a change of model
/// - a harness message (`customMessage`) sent at the first call, or sent again after a
///   compaction with the label of one the compaction removed
///
/// These follow the viewer's rules for an item that takes the place of an earlier one
/// (`web/src/lib/analysis-ordering.ts`).
pub(super) fn fixed_overhead(
    analysis: &Analysis,
    costs: &[ItemCost],
    prices: &[Option<InputPrice>],
) -> FixedOverhead {
    let calls = &analysis.model_calls;
    let Some(first) = calls.first() else {
        return FixedOverhead::default();
    };
    let compactions: HashSet<usize> = analysis
        .compactions
        .iter()
        .map(|compaction| compaction.before_model_call)
        .collect();
    let model_changes: HashSet<usize> = calls
        .windows(2)
        .filter(|pair| pair[0].model != pair[1].model)
        .map(|pair| pair[1].index)
        .collect();
    let items: HashMap<&str, &ContextItem> = analysis
        .context_items
        .iter()
        .map(|item| (item.id.as_str(), item))
        .collect();
    // The labels of harness messages each compaction removed, by the call after it.
    let mut removed: HashMap<usize, HashSet<&str>> = HashMap::new();
    for compaction in &analysis.compactions {
        let retained: HashSet<&str> = compaction
            .retained_item_ids
            .iter()
            .map(String::as_str)
            .collect();
        removed
            .entry(compaction.before_model_call)
            .or_default()
            .extend(
                compaction
                    .source_item_ids
                    .iter()
                    .filter(|id| !retained.contains(id.as_str()))
                    .filter_map(|id| items.get(id.as_str()))
                    .filter(|item| item.kind == "customMessage")
                    .map(|item| item.label.as_str()),
            );
    }
    let counts = |item: &ContextItem| {
        let at = item.first_model_call;
        match item.kind.as_str() {
            "system" | "toolDefinition" => true,
            // A compaction call's input is the conversation it summarised, not overhead.
            "unrecordedContext" if item.metadata.contains_key("compactionInput") => false,
            "unrecordedContext" => {
                at == first.index || compactions.contains(&at) || model_changes.contains(&at)
            }
            "customMessage" => {
                at == first.index
                    || removed
                        .get(&at)
                        .is_some_and(|labels| labels.contains(item.label.as_str()))
            }
            _ => false,
        }
    };
    let parts = analysis
        .context_items
        .iter()
        .zip(costs)
        .filter(|(item, _)| !inherited(item) && !item.presence.is_empty() && counts(item))
        .map(|(item, cost)| FixedPart {
            kind: item.kind.clone(),
            label: part_label(item),
            tokens: cost.tokens.unwrap_or(0),
            cost: cost.cost,
            item_id: item.id.clone(),
        })
        .collect();
    let sum = |values: Vec<Option<f64>>| {
        values
            .iter()
            .any(Option::is_some)
            .then(|| values.iter().flatten().sum())
    };
    // A fork's first call also sends the history it copied from its parent.
    let forked = analysis.context_items.iter().any(inherited);
    FixedOverhead {
        first_call_tokens: first.economics.prompt_tokens.filter(|_| !forked),
        parts,
        input_usd: sum(costs.iter().map(|cost| cost.cost.usd).collect()),
        output_usd: sum(prices
            .iter()
            .map(|price| price.and_then(|price| price.output_cost))
            .collect()),
    }
}

/// A fixed item's name for grouping it with the same item in other sessions: a tool
/// definition's tool name, or the label without a measured token count.
fn part_label(item: &ContextItem) -> String {
    if item.kind == "toolDefinition" {
        if let Some(name) = item.metadata.get("toolName") {
            return name.clone();
        }
        if let Some(name) = item.label.strip_suffix(" definition") {
            return name.to_owned();
        }
    }
    if item.kind == "unrecordedContext" {
        if let Some((name, _)) = item.label.split_once(" · ") {
            return name.to_owned();
        }
    }
    item.label.clone()
}

/// Command families listed for each session.
const FAMILY_LIMIT: usize = 6;

/// Shell runs by family, most expensive first. `sessions` is counted when the runs come
/// from more than one session.
pub(super) fn family_totals<'a>(
    runs: impl IntoIterator<Item = &'a ToolRun>,
    limit: usize,
) -> Vec<FamilyTotal> {
    #[derive(Default)]
    struct Totals<'a> {
        runs: usize,
        failed: usize,
        tokens: u64,
        cost: FindingCost,
        sessions: std::collections::BTreeSet<&'a str>,
    }
    let mut families: BTreeMap<&str, Totals<'_>> = BTreeMap::new();
    for run in runs {
        let Some(family) = run.family.as_deref().filter(|family| !family.is_empty()) else {
            continue;
        };
        let totals = families.entry(family).or_default();
        totals.runs += 1;
        totals.failed += usize::from(run.failed);
        totals.tokens += run.tokens.unwrap_or(0);
        totals.cost.add(run.cost);
        totals.sessions.insert(&run.reference);
    }
    let several = families
        .values()
        .flat_map(|totals| totals.sessions.iter())
        .collect::<std::collections::BTreeSet<_>>()
        .len()
        > 1;
    let mut families: Vec<(FindingCost, FamilyTotal)> = families
        .into_iter()
        .map(|(family, totals)| {
            (
                totals.cost,
                FamilyTotal {
                    family: family.to_owned(),
                    runs: totals.runs,
                    failed: totals.failed,
                    sessions: several.then_some(totals.sessions.len()),
                    result_tokens: totals.tokens,
                    result_token_turns: totals.cost.token_turns,
                    result_estimated_cost: totals.cost.usd,
                },
            )
        })
        .collect();
    families.sort_by(|(a, _), (b, _)| b.rank().total_cmp(&a.rank()));
    families
        .into_iter()
        .take(limit)
        .map(|(_, family)| family)
        .collect()
}

/// Tools listed for each session.
const TOOL_LIMIT: usize = 6;

/// The tools whose results or definitions cost the most, most expensive first.
fn tool_totals(analysis: &Analysis, costs: &[ItemCost], runs: &[ToolRun]) -> Vec<ToolTotal> {
    #[derive(Default)]
    struct Totals {
        results: Vec<u64>,
        failed: usize,
        result_cost: FindingCost,
        definition_tokens: Option<u64>,
        definition_cost: FindingCost,
    }
    let mut tools: BTreeMap<String, Totals> = BTreeMap::new();
    for run in runs {
        let totals = tools.entry(run.tool.clone()).or_default();
        totals.results.push(run.tokens.unwrap_or(0));
        totals.failed += usize::from(run.failed);
        totals.result_cost.add(run.cost);
    }
    for (item, cost) in analysis.context_items.iter().zip(costs) {
        if item.kind != "toolDefinition" {
            continue;
        }
        let name = item
            .metadata
            .get("toolName")
            .cloned()
            .unwrap_or_else(|| item.label.trim_end_matches(" definition").to_owned());
        let totals = tools.entry(name).or_default();
        totals.definition_tokens = totals.definition_tokens.max(cost.tokens);
        totals.definition_cost.add(cost.cost);
    }
    let mut tools: Vec<(FindingCost, ToolTotal)> = tools
        .into_iter()
        .map(|(name, mut totals)| {
            totals.results.sort_unstable();
            let mut all = totals.result_cost;
            all.add(totals.definition_cost);
            let tool = ToolTotal {
                name,
                calls: totals.results.len(),
                failed: totals.failed,
                result_tokens: TokenStats {
                    total: totals.results.iter().sum(),
                    max: totals.results.last().copied().unwrap_or(0),
                },
                result_token_turns: totals.result_cost.token_turns,
                result_estimated_cost: totals.result_cost.usd,
                definition_tokens: totals.definition_tokens,
                definition_estimated_cost: totals.definition_cost.usd,
            };
            (all, tool)
        })
        .collect();
    tools.sort_by(|(a, _), (b, _)| b.rank().total_cmp(&a.rank()));
    tools
        .into_iter()
        .take(TOOL_LIMIT)
        .map(|(_, tool)| tool)
        .collect()
}

/// The calls that wrote compaction summaries: those a compaction names as its own, and those
/// marked by their stop reason.
fn compaction_calls(analysis: &Analysis) -> CompactionCalls {
    let named: HashSet<usize> = analysis
        .compactions
        .iter()
        .filter_map(|compaction| compaction.details.summary_call)
        .collect();
    let calls: Vec<&ModelCall> = analysis
        .model_calls
        .iter()
        .filter(|call| {
            named.contains(&call.index)
                || matches!(
                    call.stop_reason.as_deref(),
                    Some("compaction-call" | "compaction-aggregate")
                )
        })
        .collect();
    let amounts: Vec<f64> = calls
        .iter()
        .filter_map(|call| call.cost_assessment.amount)
        .collect();
    CompactionCalls {
        calls: calls.len(),
        usd: (!amounts.is_empty()).then(|| amounts.iter().sum()),
    }
}
