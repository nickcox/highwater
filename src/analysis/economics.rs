use crate::{
    api::{
        CacheRatioChangeMagnitude, CacheRatioDirection, CacheRatioDiscontinuity, CacheWriteStatus,
        CallEconomics, EconomicsCompleteness, EconomicsCostBasis, EconomicsSummary,
    },
    domain::{
        CostBasis, ModelTarget, NormalizedModelCall, ReportedCost, ReportedUsage,
        MAX_SAFE_JSON_INTEGER,
    },
};
use std::collections::BTreeSet;

const COST_SUM_TOLERANCE_USD: f64 = 1.0e-9;
const CACHE_RATIO_CHANGE_THRESHOLD: f64 = 0.25;
const CACHE_RATIO_LARGE_THRESHOLD: f64 = 0.50;
const CACHE_RATIO_CHANGE_METHOD: &str = "adjacent-cache-read-share-v1";
const MIN_CACHE_RATIO_PROMPT_TOKENS: u64 = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Policy {
    AnthropicMessages,
    OpenAiCompletions,
    OpenAiResponses,
    OpenAiCodexResponses,
    GithubCopilotResponses,
}

impl From<CostBasis> for EconomicsCostBasis {
    fn from(value: CostBasis) -> Self {
        match value {
            CostBasis::PiModelRates => Self::PiModelRates,
            CostBasis::SourceModelRates => Self::SourceModelRates,
            CostBasis::ProviderReported => Self::ProviderReported,
            CostBasis::Unknown => Self::Unknown,
        }
    }
}

impl Policy {
    fn identify(target: &ModelTarget) -> Option<Self> {
        match (target.provider.as_deref(), target.api.as_deref()) {
            (Some("anthropic"), Some("anthropic-messages")) => Some(Self::AnthropicMessages),
            (Some("openai"), Some("openai-completions")) => Some(Self::OpenAiCompletions),
            (Some("openai"), Some("openai-responses")) => Some(Self::OpenAiResponses),
            (Some("openai-codex"), Some("openai-codex-responses")) => {
                Some(Self::OpenAiCodexResponses)
            }
            (Some("github-copilot"), Some("openai-responses")) => {
                Some(Self::GithubCopilotResponses)
            }
            _ => None,
        }
    }

    fn id(self) -> &'static str {
        match self {
            Self::AnthropicMessages => "anthropic-messages-cache-v1",
            Self::OpenAiCompletions => "openai-completions-cache-v1",
            Self::OpenAiResponses => "openai-responses-cache-read-v1",
            Self::OpenAiCodexResponses => "openai-codex-responses-cache-read-v1",
            Self::GithubCopilotResponses => "github-copilot-responses-cache-v1",
        }
    }

    fn cache_write_status(self) -> CacheWriteStatus {
        match self {
            Self::AnthropicMessages | Self::GithubCopilotResponses => CacheWriteStatus::Reported,
            Self::OpenAiCompletions => CacheWriteStatus::NotReported,
            Self::OpenAiResponses | Self::OpenAiCodexResponses => CacheWriteStatus::NotRetainedByPi,
        }
    }

    fn prompt_fields(self, usage: &ReportedUsage) -> [Option<u64>; 3] {
        match self {
            Self::AnthropicMessages | Self::GithubCopilotResponses => {
                [usage.input, usage.cache_read, usage.cache_write]
            }
            Self::OpenAiCompletions | Self::OpenAiResponses | Self::OpenAiCodexResponses => {
                [usage.input, usage.cache_read, None]
            }
        }
    }

    fn prompt_field_count(self) -> usize {
        match self {
            Self::AnthropicMessages | Self::GithubCopilotResponses => 3,
            Self::OpenAiCompletions | Self::OpenAiResponses | Self::OpenAiCodexResponses => 2,
        }
    }

    fn cost_fields(self, cost: &ReportedCost) -> [Option<f64>; 5] {
        match self {
            Self::AnthropicMessages | Self::GithubCopilotResponses => [
                cost.input,
                cost.output,
                cost.cache_read,
                cost.cache_write,
                cost.total,
            ],
            Self::OpenAiCompletions | Self::OpenAiResponses | Self::OpenAiCodexResponses => {
                [cost.input, cost.output, cost.cache_read, cost.total, None]
            }
        }
    }

    fn cost_field_count(self) -> usize {
        match self {
            Self::AnthropicMessages | Self::GithubCopilotResponses => 5,
            Self::OpenAiCompletions | Self::OpenAiResponses | Self::OpenAiCodexResponses => 4,
        }
    }

    fn prompt_cost_fields(self, cost: &ReportedCost) -> Option<[f64; 3]> {
        match self {
            Self::AnthropicMessages | Self::GithubCopilotResponses => {
                Some([cost.input?, cost.cache_read?, cost.cache_write?])
            }
            Self::OpenAiCompletions => Some([cost.input?, cost.cache_read?, 0.0]),
            Self::OpenAiResponses | Self::OpenAiCodexResponses => None,
        }
    }
}

/// Derive reported-call economics from audited provider/API shapes.
/// Unknown targets remain unsupported even when their raw usage fields are present.
#[cfg(test)]
pub(crate) fn derive(calls: &[NormalizedModelCall]) -> (Vec<CallEconomics>, EconomicsSummary) {
    derive_with_cost_basis(calls, CostBasis::PiModelRates)
}

pub(crate) fn derive_with_cost_basis(
    calls: &[NormalizedModelCall],
    cost_basis: CostBasis,
) -> (Vec<CallEconomics>, EconomicsSummary) {
    derive_calls(calls, cost_basis, |call| {
        if cost_basis == CostBasis::PiModelRates {
            derive_call(call)
        } else {
            let mut unsupported = CallEconomics::unsupported();
            unsupported
                .explanation_codes
                .push("unsupportedDerivedEconomicsCostBasis".into());
            unsupported
        }
    })
}

/// Cache figures for a source that records usage but no cost (Claude Code). The
/// audited provider/API policies still decide which buckets make up the prompt;
/// the cost interpretation, which is about Pi's recorded cost components, is
/// left out.
pub(crate) fn derive_usage_only(
    calls: &[NormalizedModelCall],
) -> (Vec<CallEconomics>, EconomicsSummary) {
    derive_calls(calls, CostBasis::Unknown, |call| {
        let mut derived = derive_call(call);
        derived.cost_completeness = EconomicsCompleteness::Missing;
        derived.pi_prompt_cost = None;
        derived.explanation_codes.retain(|code| {
            !matches!(
                code.as_str(),
                "cacheWriteTtlNotRetained"
                    | "piCostComponentsIncomplete"
                    | "piCostMissing"
                    | "piCostTotalDiffersFromComponents"
                    | "piModelRateCostBasis"
            )
        });
        derived
    })
}

fn derive_calls(
    calls: &[NormalizedModelCall],
    cost_basis: CostBasis,
    derive: impl Fn(&NormalizedModelCall) -> CallEconomics,
) -> (Vec<CallEconomics>, EconomicsSummary) {
    let mut derived_calls = Vec::with_capacity(calls.len());
    let mut summary = EconomicsSummary {
        cost_basis: cost_basis.into(),
        ..EconomicsSummary::default()
    };
    let mut policy_ids = BTreeSet::new();
    let mut prompt_sum = Some(0_u64);
    let mut read_sum = Some(0_u64);

    for call in calls {
        let derived = derive(call);
        count_status(&mut summary.usage_completeness, derived.usage_completeness);
        count_status(&mut summary.cost_completeness, derived.cost_completeness);

        if let Some(policy_id) = derived.policy_id.as_deref() {
            policy_ids.insert(policy_id.to_owned());
        }

        if derived.usage_completeness == EconomicsCompleteness::Complete {
            if let (Some(prompt), Some(read)) =
                (derived.prompt_tokens, call.reported_usage.cache_read)
            {
                summary.cache_read_eligible_calls += 1;
                prompt_sum = checked_safe_add(prompt_sum, prompt);
                read_sum = checked_safe_add(read_sum, read);
            }
        }

        derived_calls.push(derived);
    }

    add_cache_ratio_discontinuities(calls, &mut derived_calls);
    summary.supported_policy_ids = policy_ids.into_iter().collect();
    if summary.cache_read_eligible_calls == 0 {
        prompt_sum = None;
        read_sum = None;
    } else if prompt_sum.is_none() || read_sum.is_none() {
        prompt_sum = None;
        read_sum = None;
        summary
            .explanation_codes
            .push("cacheReadAggregateOutOfRange".into());
    }
    summary.cache_read_prompt_tokens = prompt_sum;
    summary.cache_read_tokens = read_sum;
    summary.cache_read_ratio = match (prompt_sum, read_sum) {
        (Some(prompt), Some(read)) => ratio(read, prompt),
        _ => None,
    };
    if summary.usage_completeness.partial > 0 {
        summary
            .explanation_codes
            .push("partialUsageCoverage".into());
    }
    if summary.usage_completeness.unsupported > 0 {
        summary
            .explanation_codes
            .push("unsupportedEconomicsPolicy".into());
    }
    if summary.cost_completeness.partial > 0 {
        summary
            .explanation_codes
            .push("partialPiCostCoverage".into());
    }
    if !calls.is_empty() {
        summary.explanation_codes.push(
            match cost_basis {
                CostBasis::PiModelRates => "piModelRateCostBasis",
                CostBasis::SourceModelRates => "sourceModelRateCostBasis",
                CostBasis::ProviderReported => "providerReportedCostBasis",
                CostBasis::Unknown => "unknownCostBasis",
            }
            .into(),
        );
    }
    for call in &mut derived_calls {
        call.explanation_codes.sort();
        call.explanation_codes.dedup();
    }
    summary.explanation_codes.sort();
    summary.explanation_codes.dedup();

    (derived_calls, summary)
}

fn derive_call(call: &NormalizedModelCall) -> CallEconomics {
    let Some(policy) = Policy::identify(&call.target) else {
        return CallEconomics::unsupported();
    };

    let usage = &call.reported_usage;
    if matches!(
        policy,
        Policy::OpenAiCompletions | Policy::OpenAiResponses | Policy::OpenAiCodexResponses
    ) && usage.cache_write.is_some_and(|write| write > 0)
    {
        let mut unsupported = CallEconomics::unsupported();
        unsupported
            .explanation_codes
            .push("unexpectedCacheWriteBucket".into());
        return unsupported;
    }
    let prompt_fields = policy.prompt_fields(usage);
    let prompt_known = prompt_fields[..policy.prompt_field_count()]
        .iter()
        .filter(|value| value.is_some())
        .count();
    let mut explanation_codes = Vec::new();
    let (prompt_tokens, usage_completeness) = match prompt_known {
        0 => (None, EconomicsCompleteness::Missing),
        known if known < policy.prompt_field_count() => (None, EconomicsCompleteness::Partial),
        _ => match checked_sum_u64(
            prompt_fields[..policy.prompt_field_count()]
                .iter()
                .flatten()
                .copied(),
        ) {
            Some(prompt_tokens) if prompt_tokens <= MAX_SAFE_JSON_INTEGER => {
                (Some(prompt_tokens), EconomicsCompleteness::Complete)
            }
            _ => (None, EconomicsCompleteness::Partial),
        },
    };
    if usage_completeness == EconomicsCompleteness::Partial {
        explanation_codes.push("providerUsageIncomplete".into());
    } else if usage_completeness == EconomicsCompleteness::Missing {
        explanation_codes.push("providerUsageMissing".into());
    }

    let cache_write_status = policy.cache_write_status();
    match cache_write_status {
        CacheWriteStatus::Reported => {}
        CacheWriteStatus::NotReported => {
            explanation_codes.push("cacheWriteNotReported".into());
        }
        CacheWriteStatus::NotRetainedByPi => {
            explanation_codes.push("cacheWriteNotRetainedByPi".into());
        }
        CacheWriteStatus::Unsupported => unreachable!("identified policies are supported"),
    }

    let cache_read_ratio = if usage_completeness == EconomicsCompleteness::Complete {
        usage
            .cache_read
            .zip(prompt_tokens)
            .and_then(|(read, prompt)| ratio(read, prompt))
    } else {
        None
    };
    let cache_write_ratio = if matches!(
        policy,
        Policy::AnthropicMessages | Policy::GithubCopilotResponses
    ) && usage_completeness == EconomicsCompleteness::Complete
    {
        usage
            .cache_write
            .zip(prompt_tokens)
            .and_then(|(write, prompt)| ratio(write, prompt))
    } else {
        None
    };
    let fresh_ratio = if matches!(
        policy,
        Policy::AnthropicMessages | Policy::OpenAiCompletions | Policy::GithubCopilotResponses
    ) && usage_completeness == EconomicsCompleteness::Complete
    {
        usage
            .input
            .zip(prompt_tokens)
            .and_then(|(input, prompt)| ratio(input, prompt))
    } else {
        None
    };

    let mut cost_completeness = cost_completeness(policy, &usage.cost);
    if policy == Policy::AnthropicMessages
        && (usage.cache_write.is_some_and(|write| write > 0)
            || usage.cache_write_1h.is_some_and(|write| write > 0))
    {
        cost_completeness = EconomicsCompleteness::Partial;
        explanation_codes.push("cacheWriteTtlNotRetained".into());
    }
    if matches!(
        policy,
        Policy::OpenAiResponses | Policy::OpenAiCodexResponses
    ) && cost_completeness != EconomicsCompleteness::Missing
    {
        cost_completeness = EconomicsCompleteness::Partial;
    }
    if cost_completeness == EconomicsCompleteness::Partial {
        explanation_codes.push("piCostComponentsIncomplete".into());
    }
    if cost_completeness == EconomicsCompleteness::Missing {
        explanation_codes.push("piCostMissing".into());
    }

    if has_cost_total_mismatch(&usage.cost) {
        explanation_codes.push("piCostTotalDiffersFromComponents".into());
    }
    if !matches!(cost_completeness, EconomicsCompleteness::Missing) {
        explanation_codes.push("piModelRateCostBasis".into());
    }

    let pi_prompt_cost = if cost_completeness == EconomicsCompleteness::Complete
        && usage_completeness == EconomicsCompleteness::Complete
    {
        policy
            .prompt_cost_fields(&usage.cost)
            .and_then(checked_sum_f64)
    } else {
        None
    };

    CallEconomics {
        policy_id: Some(policy.id().into()),
        usage_completeness,
        cost_completeness,
        cache_write_status,
        prompt_tokens,
        cache_read_ratio,
        cache_write_ratio,
        fresh_ratio,
        pi_prompt_cost,
        cache_ratio_discontinuity: None,
        explanation_codes,
    }
}

fn add_cache_ratio_discontinuities(
    calls: &[NormalizedModelCall],
    derived_calls: &mut [CallEconomics],
) {
    for (position, adjacent_calls) in calls.windows(2).enumerate() {
        let [previous, current] = adjacent_calls else {
            continue;
        };
        let previous_economics = &derived_calls[position];
        let current_economics = &derived_calls[position + 1];
        if !is_eligible_discontinuity_pair(previous, current, previous_economics, current_economics)
        {
            continue;
        }

        let (Some(previous_ratio), Some(current_ratio)) = (
            previous_economics.cache_read_ratio,
            current_economics.cache_read_ratio,
        ) else {
            continue;
        };
        let signed_delta = current_ratio - previous_ratio;
        let delta = signed_delta.abs();
        if delta < CACHE_RATIO_CHANGE_THRESHOLD {
            continue;
        }
        let (Some(previous_prompt_tokens), Some(current_prompt_tokens)) = (
            previous_economics.prompt_tokens,
            current_economics.prompt_tokens,
        ) else {
            continue;
        };

        derived_calls[position + 1].cache_ratio_discontinuity = Some(CacheRatioDiscontinuity {
            previous_call_index: previous.index,
            direction: if signed_delta.is_sign_negative() {
                CacheRatioDirection::Drop
            } else {
                CacheRatioDirection::Rise
            },
            previous_ratio,
            current_ratio,
            delta,
            magnitude: if delta >= CACHE_RATIO_LARGE_THRESHOLD {
                CacheRatioChangeMagnitude::Large
            } else {
                CacheRatioChangeMagnitude::Notable
            },
            method: CACHE_RATIO_CHANGE_METHOD,
            previous_prompt_tokens,
            current_prompt_tokens,
            compaction_before: current.compaction_before.clone(),
        });
    }
}

fn is_eligible_discontinuity_pair(
    previous: &NormalizedModelCall,
    current: &NormalizedModelCall,
    previous_economics: &CallEconomics,
    current_economics: &CallEconomics,
) -> bool {
    previous.index.checked_add(1) == Some(current.index)
        && previous.target.provider == current.target.provider
        && previous.target.model == current.target.model
        && previous.target.api == current.target.api
        && previous_economics.policy_id.is_some()
        && previous_economics.policy_id == current_economics.policy_id
        && previous_economics.usage_completeness == EconomicsCompleteness::Complete
        && current_economics.usage_completeness == EconomicsCompleteness::Complete
        && previous_economics.cache_read_ratio.is_some()
        && current_economics.cache_read_ratio.is_some()
        && previous_economics
            .prompt_tokens
            .is_some_and(|tokens| tokens >= MIN_CACHE_RATIO_PROMPT_TOKENS)
        && current_economics
            .prompt_tokens
            .is_some_and(|tokens| tokens >= MIN_CACHE_RATIO_PROMPT_TOKENS)
}

fn cost_completeness(policy: Policy, cost: &ReportedCost) -> EconomicsCompleteness {
    let fields = policy.cost_fields(cost);
    let field_count = policy.cost_field_count();
    let known = fields[..field_count]
        .iter()
        .filter(|value| value.is_some())
        .count();
    if known == 0 {
        return EconomicsCompleteness::Missing;
    }
    if known < field_count
        || fields[..field_count]
            .iter()
            .flatten()
            .any(|value| !value.is_finite() || *value < 0.0)
    {
        EconomicsCompleteness::Partial
    } else {
        EconomicsCompleteness::Complete
    }
}

fn has_cost_total_mismatch(cost: &ReportedCost) -> bool {
    let (Some(input), Some(output), Some(cache_read), Some(cache_write)) =
        (cost.input, cost.output, cost.cache_read, cost.cache_write)
    else {
        return false;
    };
    let values = [input, output, cache_read, cache_write];
    let Some(total) = cost
        .total
        .filter(|value| value.is_finite() && *value >= 0.0)
    else {
        return false;
    };
    if values
        .iter()
        .any(|value| !value.is_finite() || *value < 0.0)
    {
        return false;
    }
    let Some(sum) = checked_sum_f64(values) else {
        return true;
    };
    (sum - total).abs() > COST_SUM_TOLERANCE_USD
}

fn checked_safe_add(total: Option<u64>, value: u64) -> Option<u64> {
    total?
        .checked_add(value)
        .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
}

fn checked_sum_u64(values: impl IntoIterator<Item = u64>) -> Option<u64> {
    values.into_iter().try_fold(0_u64, |sum, value| {
        sum.checked_add(value)
            .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
    })
}

fn checked_sum_f64(values: impl IntoIterator<Item = f64>) -> Option<f64> {
    values.into_iter().try_fold(0.0_f64, |sum, value| {
        if !value.is_finite() || value < 0.0 {
            return None;
        }
        let total = sum + value;
        total.is_finite().then_some(total)
    })
}

fn ratio(numerator: u64, denominator: u64) -> Option<f64> {
    if denominator == 0
        || numerator > denominator
        || denominator > MAX_SAFE_JSON_INTEGER
        || numerator > MAX_SAFE_JSON_INTEGER
    {
        return None;
    }
    // The public metric is a bounded proportion; conversion can lose token precision above 2^53.
    let value = numerator as f64 / denominator as f64;
    (value.is_finite() && (0.0..=1.0).contains(&value)).then_some(value)
}

fn count_status(counts: &mut crate::api::EconomicsStatusCounts, status: EconomicsCompleteness) {
    match status {
        EconomicsCompleteness::Complete => counts.complete += 1,
        EconomicsCompleteness::Partial => counts.partial += 1,
        EconomicsCompleteness::Missing => counts.missing += 1,
        EconomicsCompleteness::Unsupported => counts.unsupported += 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{domain::SessionSourceAdapter, pi::PiSourceAdapter};
    use std::io::Cursor;

    fn fixture_calls() -> Vec<NormalizedModelCall> {
        let fixture = include_str!("../../fixtures/pi/economics-policies.jsonl");
        let session = PiSourceAdapter
            .parse(&mut Cursor::new(fixture))
            .expect("economics policy fixture parses");
        session.model_calls
    }

    #[test]
    fn copilot_responses_preserves_three_buckets_and_qualified_model_rate_costs() {
        let calls = PiSourceAdapter
            .parse(&mut Cursor::new(include_str!(
                "../../fixtures/pi/copilot-economics.jsonl"
            )))
            .unwrap()
            .model_calls;
        let (derived, summary) = derive(&calls);
        let fill = &derived[1];
        assert_eq!(
            fill.policy_id.as_deref(),
            Some("github-copilot-responses-cache-v1")
        );
        assert_eq!(fill.cache_write_status, CacheWriteStatus::Reported);
        assert_eq!(fill.prompt_tokens, Some(55485));
        assert_eq!(fill.cache_read_ratio, Some(0.0));
        assert_eq!(fill.cache_write_ratio, Some(55482.0 / 55485.0));
        assert_eq!(fill.fresh_ratio, Some(3.0 / 55485.0));
        assert_eq!(fill.cost_completeness, EconomicsCompleteness::Complete);
        assert!((fill.pi_prompt_cost.unwrap() - 0.138711).abs() < 1e-12);
        assert!(fill
            .explanation_codes
            .contains(&"piModelRateCostBasis".into()));
        assert!(
            fill.cache_ratio_discontinuity.is_none(),
            "provider switches are not cache discontinuities"
        );
        assert_eq!(derived[2].prompt_tokens, Some(55893));
        assert_eq!(derived[2].cache_read_ratio, Some(55482.0 / 55893.0));
        assert!(derived[2].cache_ratio_discontinuity.is_some());
        assert_eq!(derived[3].prompt_tokens, Some(0));
        assert_eq!(derived[3].cache_write_ratio, None);
        assert_eq!(derived[3].pi_prompt_cost, Some(0.0));
        assert_eq!(
            derived[4].usage_completeness,
            EconomicsCompleteness::Partial
        );
        assert_eq!(derived[4].prompt_tokens, None);
        assert_eq!(
            derived[5].usage_completeness,
            EconomicsCompleteness::Missing
        );
        assert_eq!(
            derived[6].usage_completeness,
            EconomicsCompleteness::Unsupported
        );
        assert_eq!(summary.cache_read_eligible_calls, 4);
        assert_eq!(summary.cache_read_prompt_tokens, Some(113378));
        assert_eq!(summary.cache_read_tokens, Some(56482));
        assert_eq!(summary.cache_read_ratio, Some(56482.0 / 113378.0));
        let mut incomplete = calls[1].clone();
        incomplete.reported_usage.cost.cache_write = None;
        assert_eq!(
            derive_call(&incomplete).cost_completeness,
            EconomicsCompleteness::Partial
        );
        assert_eq!(derive_call(&incomplete).pi_prompt_cost, None);
        incomplete.reported_usage.input = Some(MAX_SAFE_JSON_INTEGER);
        assert_eq!(derive_call(&incomplete).prompt_tokens, None);
        incomplete.target.provider = Some("openai".into());
        assert_eq!(
            derive_call(&incomplete).usage_completeness,
            EconomicsCompleteness::Unsupported
        );
    }

    #[test]
    fn claude_code_usage_gets_cache_figures_without_cost_interpretation() {
        let calls = crate::claude_code::load(
            std::path::Path::new(
                "fixtures/claude-code/projects/-synthetic-project/compaction.jsonl",
            ),
            crate::claude_code::FileKind::Main,
        )
        .unwrap()
        .session
        .model_calls;
        let (derived, summary) = derive_usage_only(&calls);
        // msg_s6_2: 1 uncached, 400 read, 30 written.
        let second = &derived[1];
        assert_eq!(
            second.policy_id.as_deref(),
            Some("anthropic-messages-cache-v1")
        );
        assert_eq!(second.usage_completeness, EconomicsCompleteness::Complete);
        assert_eq!(second.prompt_tokens, Some(431));
        assert_eq!(second.cache_read_ratio, Some(400.0 / 431.0));
        assert_eq!(second.cache_write_ratio, Some(30.0 / 431.0));
        assert_eq!(second.cost_completeness, EconomicsCompleteness::Missing);
        assert_eq!(second.pi_prompt_cost, None);
        for call in &derived {
            assert!(call
                .explanation_codes
                .iter()
                .all(|code| !code.starts_with("piCost")
                    && code != "piModelRateCostBasis"
                    && code != "cacheWriteTtlNotRetained"));
        }
        assert_eq!(summary.cost_basis, EconomicsCostBasis::Unknown);
        assert_eq!(summary.cache_read_eligible_calls, 4);
        assert!(summary
            .explanation_codes
            .contains(&"unknownCostBasis".into()));
        assert!(!summary
            .explanation_codes
            .contains(&"partialPiCostCoverage".into()));
    }

    #[test]
    fn audited_provider_policies_keep_only_supported_disjoint_buckets() {
        let calls = fixture_calls();
        let (derived, summary) = derive(&calls);

        let anthropic = &derived[0];
        assert_eq!(
            anthropic.policy_id.as_deref(),
            Some("anthropic-messages-cache-v1")
        );
        assert_eq!(anthropic.prompt_tokens, Some(60));
        assert_eq!(anthropic.cache_write_status, CacheWriteStatus::Reported);
        assert_eq!(anthropic.cache_read_ratio, Some(1.0 / 3.0));
        assert_eq!(anthropic.cache_write_ratio, Some(0.5));
        assert_eq!(anthropic.fresh_ratio, Some(1.0 / 6.0));
        assert_eq!(
            serde_json::to_value(anthropic).expect("call economics JSON")["cacheWriteStatus"],
            "reported"
        );
        assert_eq!(calls[0].reported_usage.cache_write_1h, Some(7));
        assert_eq!(anthropic.pi_prompt_cost, None);
        assert!(anthropic
            .explanation_codes
            .contains(&"cacheWriteTtlNotRetained".into()));
        assert_eq!(
            derived[1].cost_completeness,
            EconomicsCompleteness::Complete
        );
        assert_eq!(derived[1].pi_prompt_cost, Some(0.0));

        let openai_chat = &derived[2];
        assert_eq!(openai_chat.prompt_tokens, Some(1000));
        assert_eq!(openai_chat.cache_read_ratio, Some(0.1));
        assert_eq!(openai_chat.cache_write_ratio, None);
        assert_eq!(openai_chat.fresh_ratio, Some(0.9));
        assert!((openai_chat.pi_prompt_cost.expect("prompt cost") - 0.00091).abs() < 1.0e-15);
        assert_eq!(
            openai_chat.cache_write_status,
            CacheWriteStatus::NotReported
        );

        let openai_responses = &derived[3];
        assert_eq!(openai_responses.prompt_tokens, Some(1000));
        assert_eq!(openai_responses.cache_read_ratio, Some(0.1));
        assert_eq!(openai_responses.cache_write_ratio, None);
        assert_eq!(openai_responses.fresh_ratio, None);
        assert_eq!(
            openai_responses.cache_write_status,
            CacheWriteStatus::NotRetainedByPi
        );
        assert_eq!(openai_responses.pi_prompt_cost, None);
        let response_json = serde_json::to_value(openai_responses).expect("call economics JSON");
        assert_eq!(response_json["cacheWriteStatus"], "notRetainedByPi");
        assert_eq!(response_json["costCompleteness"], "partial");

        let codex = &derived[4];
        assert_eq!(codex.prompt_tokens, Some(1000));
        assert_eq!(codex.cache_read_ratio, Some(0.2));
        assert_eq!(codex.cache_write_status, CacheWriteStatus::NotRetainedByPi);

        let unsupported = &derived[5];
        assert_eq!(
            unsupported.usage_completeness,
            EconomicsCompleteness::Unsupported
        );
        assert_eq!(
            unsupported.cost_completeness,
            EconomicsCompleteness::Unsupported
        );
        assert_eq!(unsupported.cache_read_ratio, None);
        assert_eq!(unsupported.prompt_tokens, None);

        let mut unexpected_write = calls[2].clone();
        unexpected_write.reported_usage.cache_write = Some(1);
        let unexpected_write = derive_call(&unexpected_write);
        assert_eq!(unexpected_write.policy_id, None);
        assert_eq!(
            unexpected_write.usage_completeness,
            EconomicsCompleteness::Unsupported
        );
        assert!(unexpected_write
            .explanation_codes
            .contains(&"unexpectedCacheWriteBucket".into()));

        assert_eq!(
            derived[6].usage_completeness,
            EconomicsCompleteness::Missing
        );
        assert_eq!(
            derived[7].usage_completeness,
            EconomicsCompleteness::Partial
        );
        assert_eq!(summary.cache_read_eligible_calls, 5);
        assert_eq!(summary.cache_read_prompt_tokens, Some(3060));
        assert_eq!(summary.cache_read_tokens, Some(420));
        assert_eq!(summary.cache_read_ratio, Some(420.0 / 3060.0));
        assert_eq!(summary.usage_completeness.complete, 5);
        assert_eq!(summary.usage_completeness.partial, 1);
        assert_eq!(summary.usage_completeness.missing, 1);
        assert_eq!(summary.usage_completeness.unsupported, 1);
    }

    #[test]
    fn adjacent_cache_ratio_changes_follow_named_thresholds_and_record_context() {
        let calls = fixture_calls();
        let mut previous = calls[2].clone();
        previous.index = 10;
        previous.reported_usage.input = Some(5_000);
        previous.reported_usage.cache_read = Some(5_000);

        let mut current = previous.clone();
        current.index = 11;
        current.reported_usage.input = Some(7_500);
        current.reported_usage.cache_read = Some(2_500);
        current.compaction_before = Some("compact-1".into());

        let (derived, _) = derive(&[previous.clone(), current.clone()]);
        let discontinuity = derived[1]
            .cache_ratio_discontinuity
            .as_ref()
            .expect("25-point adjacent change is recorded");
        assert_eq!(discontinuity.previous_call_index, 10);
        assert_eq!(discontinuity.direction, CacheRatioDirection::Drop);
        assert_eq!(discontinuity.previous_ratio, 0.5);
        assert_eq!(discontinuity.current_ratio, 0.25);
        assert_eq!(discontinuity.delta, CACHE_RATIO_CHANGE_THRESHOLD);
        assert_eq!(discontinuity.magnitude, CacheRatioChangeMagnitude::Notable);
        assert_eq!(discontinuity.method, CACHE_RATIO_CHANGE_METHOD);
        assert_eq!(discontinuity.previous_prompt_tokens, 10_000);
        assert_eq!(discontinuity.current_prompt_tokens, 10_000);
        assert_eq!(
            discontinuity.compaction_before.as_deref(),
            Some("compact-1")
        );

        let json = serde_json::to_value(discontinuity).expect("discontinuity JSON");
        assert_eq!(json["direction"], "drop");
        assert_eq!(json["magnitude"], "notable");
        assert_eq!(json["method"], "adjacent-cache-read-share-v1");
        assert_eq!(json["compactionBefore"], "compact-1");

        let mut large_current = current.clone();
        large_current.reported_usage.input = Some(10_000);
        large_current.reported_usage.cache_read = Some(0);
        let (derived, _) = derive(&[previous.clone(), large_current]);
        assert_eq!(
            derived[1]
                .cache_ratio_discontinuity
                .as_ref()
                .expect("50-point change is recorded")
                .magnitude,
            CacheRatioChangeMagnitude::Large
        );

        let mut rise_previous = previous.clone();
        rise_previous.reported_usage.input = Some(7_500);
        rise_previous.reported_usage.cache_read = Some(2_500);
        let mut rise_current = current.clone();
        rise_current.reported_usage.input = Some(5_000);
        rise_current.reported_usage.cache_read = Some(5_000);
        let (derived, _) = derive(&[rise_previous, rise_current]);
        let rise = derived[1]
            .cache_ratio_discontinuity
            .as_ref()
            .expect("25-point rise is recorded");
        assert_eq!(rise.direction, CacheRatioDirection::Rise);
        assert_eq!(rise.magnitude, CacheRatioChangeMagnitude::Notable);
    }

    #[test]
    fn cache_ratio_changes_reject_small_prompts_target_switches_and_gaps() {
        let calls = fixture_calls();
        let mut previous = calls[2].clone();
        previous.index = 10;
        previous.reported_usage.input = Some(5_000);
        previous.reported_usage.cache_read = Some(5_000);

        let mut below_threshold = previous.clone();
        below_threshold.index = 11;
        below_threshold.reported_usage.input = Some(7_499);
        below_threshold.reported_usage.cache_read = Some(2_501);
        let (derived, _) = derive(&[previous.clone(), below_threshold]);
        assert!(derived[1].cache_ratio_discontinuity.is_none());

        let mut small_prompt = previous.clone();
        small_prompt.reported_usage.input = Some(499);
        small_prompt.reported_usage.cache_read = Some(500);
        let mut changed = previous.clone();
        changed.index = 11;
        changed.reported_usage.input = Some(1_000);
        changed.reported_usage.cache_read = Some(0);
        let (derived, _) = derive(&[small_prompt, changed.clone()]);
        assert!(derived[1].cache_ratio_discontinuity.is_none());

        let mut switched_target = previous.clone();
        switched_target.index = 11;
        switched_target.target.model = Some("different-model".into());
        switched_target.reported_usage.input = Some(10_000);
        switched_target.reported_usage.cache_read = Some(0);
        let (derived, _) = derive(&[previous.clone(), switched_target]);
        assert!(derived[1].cache_ratio_discontinuity.is_none());

        let mut before_gap = previous.clone();
        before_gap.index = 10;
        let mut unsupported = previous.clone();
        unsupported.index = 11;
        unsupported.target = ModelTarget::default();
        let mut after_gap = previous;
        after_gap.index = 12;
        after_gap.reported_usage.input = Some(10_000);
        after_gap.reported_usage.cache_read = Some(0);
        let (derived, _) = derive(&[before_gap, unsupported, after_gap]);
        assert!(derived
            .iter()
            .all(|call| call.cache_ratio_discontinuity.is_none()));
    }

    #[test]
    fn zero_prompt_has_no_ratio_and_overflow_is_partial() {
        let calls = fixture_calls();
        let (derived, _) = derive(&calls);
        assert_eq!(derived[1].prompt_tokens, Some(0));
        assert_eq!(
            derived[1].usage_completeness,
            EconomicsCompleteness::Complete
        );
        assert_eq!(derived[1].cache_read_ratio, None);

        let mut overflow = calls[0].clone();
        overflow.reported_usage.input = Some(u64::MAX);
        overflow.reported_usage.cache_read = Some(1);
        overflow.reported_usage.cache_write = Some(0);
        let derived = derive_call(&overflow);
        assert_eq!(derived.prompt_tokens, None);
        assert_eq!(derived.usage_completeness, EconomicsCompleteness::Partial);

        let mut out_of_range = calls[2].clone();
        out_of_range.reported_usage.input = Some(MAX_SAFE_JSON_INTEGER + 1);
        out_of_range.reported_usage.cache_read = Some(0);
        let derived = derive_call(&out_of_range);
        assert_eq!(derived.prompt_tokens, None);
        assert_eq!(derived.usage_completeness, EconomicsCompleteness::Partial);

        let mut large_a = calls[2].clone();
        large_a.reported_usage.input = Some(MAX_SAFE_JSON_INTEGER);
        large_a.reported_usage.cache_read = Some(0);
        let large_b = large_a.clone();
        let (_, summary) = derive(&[large_a, large_b]);
        assert_eq!(summary.cache_read_eligible_calls, 2);
        assert_eq!(summary.cache_read_prompt_tokens, None);
        assert_eq!(summary.cache_read_tokens, None);
        assert_eq!(summary.cache_read_ratio, None);
        assert!(summary
            .explanation_codes
            .contains(&"cacheReadAggregateOutOfRange".into()));
    }

    #[test]
    fn cache_aggregates_distinguish_no_eligible_from_measured_zero() {
        let unsupported = fixture_calls()
            .into_iter()
            .nth(5)
            .expect("unsupported call");
        let (_, no_eligible) = derive(&[unsupported]);
        assert_eq!(no_eligible.cache_read_eligible_calls, 0);
        assert_eq!(no_eligible.cache_read_prompt_tokens, None);
        assert_eq!(no_eligible.cache_read_tokens, None);
        assert_eq!(no_eligible.cache_read_ratio, None);

        let mut zero = fixture_calls().into_iter().nth(2).expect("OpenAI call");
        zero.reported_usage.input = Some(0);
        zero.reported_usage.cache_read = Some(0);
        let (_, measured_zero) = derive(&[zero]);
        assert_eq!(measured_zero.cache_read_eligible_calls, 1);
        assert_eq!(measured_zero.cache_read_prompt_tokens, Some(0));
        assert_eq!(measured_zero.cache_read_tokens, Some(0));
        assert_eq!(measured_zero.cache_read_ratio, None);
    }

    #[test]
    fn non_pi_cost_basis_does_not_claim_pi_derived_economics() {
        let calls = fixture_calls();
        let (derived, summary) = derive_with_cost_basis(&calls, CostBasis::SourceModelRates);
        assert_eq!(summary.cost_basis, EconomicsCostBasis::SourceModelRates);
        assert!(derived.iter().all(|call| {
            call.policy_id.is_none()
                && call.pi_prompt_cost.is_none()
                && call
                    .explanation_codes
                    .contains(&"unsupportedDerivedEconomicsCostBasis".into())
                && !call
                    .explanation_codes
                    .contains(&"piModelRateCostBasis".into())
        }));
        assert!(summary.supported_policy_ids.is_empty());
    }

    #[test]
    fn invalid_cost_components_are_partial_not_used_as_prompt_cost() {
        let mut call = fixture_calls().remove(2);
        call.reported_usage.cost.input = Some(f64::INFINITY);
        let derived = derive_call(&call);
        assert_eq!(derived.cost_completeness, EconomicsCompleteness::Partial);
        assert_eq!(derived.pi_prompt_cost, None);
    }

    #[test]
    fn inconsistent_cost_total_is_diagnostic_not_rebalanced() {
        let mut call = fixture_calls().remove(0);
        call.reported_usage.cost.total = Some(10.0);
        let derived = derive_call(&call);
        assert_eq!(derived.pi_prompt_cost, None);
        assert!(derived
            .explanation_codes
            .contains(&"piCostTotalDiffersFromComponents".into()));

        call.reported_usage.cost.total = Some(0.000094 + COST_SUM_TOLERANCE_USD / 2.0);
        let within_tolerance = derive_call(&call);
        assert!(!within_tolerance
            .explanation_codes
            .contains(&"piCostTotalDiffersFromComponents".into()));
    }
}
