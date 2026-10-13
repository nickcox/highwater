//! Request content a source does not record, inferred from reported usage.
//!
//! Claude Code and OpenCode do not record the system prompt or tool definitions they send.
//! At the first call of a segment that reports its input, that content is the reported
//! input less the estimates of the call's recorded items, because the call has little else
//! in context. A segment starts at the first call, at each compaction and at each change of
//! model, since each can change the unrecorded content. A failed attempt (such as Claude
//! Code's `<synthetic>` error message) never reached a model, so its model is ignored. The
//! item stays in context to the end of its segment. Pi records its system context, so it is left out (see
//! docs/data-semantics.md, "Pi system context").

use super::reconciliation::{reported_prompt_tokens, UsageCompleteness};
use super::tokenization::{ProfileRegistry, TokenCoverage, TokenizationPolicy};
use crate::domain::{
    ContextItemKind, NormalizedContextItem, NormalizedModelCall, NormalizedSession, PresenceRange,
    TokenizationPayload,
};
use std::collections::{BTreeMap, HashMap};

const SOURCES: [&str; 2] = ["claude-code", "opencode"];

/// Estimates go into `registry`, which the analysis keeps, so it does not tokenize these items again.
pub(super) fn add_unrecorded_context(
    session: &mut NormalizedSession,
    registry: &mut ProfileRegistry,
    policy: TokenizationPolicy,
) {
    if policy == TokenizationPolicy::Off || !SOURCES.contains(&session.source.kind.as_str()) {
        return;
    }
    let calls = &session.model_calls;
    let mut added = Vec::new();
    let mut start = 0;
    while start < calls.len() {
        let mut model = reached_model(&calls[start]);
        let mut end = start + 1;
        while end < calls.len() && !starts_segment(model, &calls[end]) {
            model = model.or(reached_model(&calls[end]));
            end += 1;
        }
        let measured = calls[start..end].iter().find_map(|call| {
            measure(session, registry, policy, call).map(|measure| (call.index, measure))
        });
        if let Some((anchor, Some(item))) = measured {
            added.push((item, anchor, calls[end - 1].index));
        }
        start = end;
    }
    for (mut item, first, last) in added.into_iter().rev() {
        item.presence = vec![PresenceRange {
            start_call: first,
            end_call: last,
        }];
        item.first_model_call = first;
        item.last_model_call = last;
        for call in &mut session.model_calls {
            if (first..=last).contains(&call.index) {
                call.context_item_ids.insert(0, item.id.clone());
            }
        }
        session.context_items.insert(0, item);
    }
}

/// The model a call was sent to, or `None` for a failed attempt, which did not reach one.
fn reached_model(call: &NormalizedModelCall) -> Option<&Option<String>> {
    super::reached_a_model(call).then_some(&call.target.model)
}

/// `model` is the segment's model so far, from its first call that reached one.
fn starts_segment(model: Option<&Option<String>>, call: &NormalizedModelCall) -> bool {
    call.compaction_before.is_some()
        || reached_model(call).is_some_and(|reached| model.is_some_and(|model| model != reached))
}

/// `None` when the call cannot measure (no complete reported input, or an item without an
/// estimate), so the next call is tried; `Some(None)` when it measures no unrecorded content.
fn measure(
    session: &NormalizedSession,
    registry: &mut ProfileRegistry,
    policy: TokenizationPolicy,
    call: &NormalizedModelCall,
) -> Option<Option<NormalizedContextItem>> {
    if call.stop_reason.as_deref() == Some("compaction-aggregate") {
        return None;
    }
    let (Some(reported), UsageCompleteness::Complete) =
        reported_prompt_tokens(&call.reported_usage)
    else {
        return None;
    };
    let items: HashMap<&str, &NormalizedContextItem> = session
        .context_items
        .iter()
        .map(|item| (item.id.as_str(), item))
        .collect();
    let profile = registry.profile_index(&call.target, policy);
    let (mut recorded, mut approximate) = (0_u64, false);
    for id in &call.context_item_ids {
        let item = items.get(id.as_str())?;
        let fingerprint = registry.fingerprint_item(item);
        let index = registry.estimate_index_at_profile(item, fingerprint, profile);
        let estimate = registry.estimate_at(index);
        recorded = recorded.checked_add(estimate.tokens?)?;
        approximate |= estimate.coverage != TokenCoverage::Complete;
    }
    let tokens = reported.saturating_sub(recorded);
    Some((tokens > 0).then(|| unrecorded_context(call, tokens, approximate)))
}

fn unrecorded_context(
    call: &NormalizedModelCall,
    tokens: u64,
    approximate: bool,
) -> NormalizedContextItem {
    NormalizedContextItem {
        id: format!("unrecorded-context:{}", call.index),
        kind: ContextItemKind::UnrecordedContext,
        label: format!(
            "Unrecorded request context · {} tokens{}",
            crate::domain::grouped(tokens),
            if approximate { ", approximate" } else { "" }
        ),
        source_record_id: Some(call.source_record_id.clone()),
        source_tool_call_id: None,
        metadata: BTreeMap::from([("measuredAtCall".into(), call.index.to_string())]),
        serialized_size_bytes: 0,
        payload: TokenizationPayload::UnrecordedContext {
            tokens,
            approximate,
        },
        presence: Vec::new(),
        first_model_call: 0,
        last_model_call: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::{load, SessionLocator};
    use std::path::PathBuf;

    fn claude_code(name: &str) -> NormalizedSession {
        let path = PathBuf::from(format!(
            "fixtures/claude-code/projects/-synthetic-project/{name}.jsonl"
        ));
        let locator = SessionLocator::ClaudeCodeFile {
            path,
            kind: crate::claude_code::FileKind::Main,
        };
        load(&locator, None).expect("fixture").normalized
    }

    fn unrecorded(session: &NormalizedSession) -> Vec<&NormalizedContextItem> {
        session
            .context_items
            .iter()
            .filter(|item| item.kind == ContextItemKind::UnrecordedContext)
            .collect()
    }

    #[test]
    fn each_segment_measures_its_unrecorded_content_at_its_first_reported_call() {
        let mut session = claude_code("compaction");
        add_unrecorded_context(
            &mut session,
            &mut ProfileRegistry::default(),
            TokenizationPolicy::Auto,
        );
        let items = unrecorded(&session);
        let spans: Vec<_> = items
            .iter()
            .map(|item| (item.first_model_call, item.last_model_call))
            .collect();
        // One before the compaction and one measured again at the call after it.
        assert_eq!(spans, [(1, 3), (4, 4)]);
        for call in &session.model_calls {
            assert_eq!(
                call.context_item_ids
                    .iter()
                    .filter(|id| id.starts_with("unrecorded-context:"))
                    .count(),
                1,
                "call {}",
                call.index
            );
            assert!(call.context_item_ids[0].starts_with("unrecorded-context:"));
        }
        // The first item is the first call's reported input less its recorded items.
        let first = &session.model_calls[0];
        let (reported, _) = reported_prompt_tokens(&first.reported_usage);
        let mut registry = ProfileRegistry::default();
        let profile = registry.profile_index(&first.target, TokenizationPolicy::Auto);
        let recorded: u64 = first.context_item_ids[1..]
            .iter()
            .map(|id| {
                let item = session
                    .context_items
                    .iter()
                    .find(|item| &item.id == id)
                    .expect("item");
                let fingerprint = registry.fingerprint_item(item);
                let index = registry.estimate_index_at_profile(item, fingerprint, profile);
                registry.estimate_at(index).tokens.expect("estimate")
            })
            .sum();
        assert!(matches!(
            items[0].payload,
            TokenizationPayload::UnrecordedContext { tokens, approximate: false }
                if tokens == reported.expect("reported") - recorded
        ));
        assert!(crate::analysis::validate_normalized_session(&session).is_ok());
    }

    #[test]
    fn a_failed_first_call_moves_the_measurement_to_the_next_call() {
        let mut session = claude_code("api-error");
        add_unrecorded_context(
            &mut session,
            &mut ProfileRegistry::default(),
            TokenizationPolicy::Auto,
        );
        let items = unrecorded(&session);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].first_model_call, 2);
    }

    #[test]
    fn a_failed_attempt_does_not_split_its_segment() {
        let failed = claude_code("api-error").model_calls.remove(0);
        let mut session = claude_code("parallel-tools");
        let middle = &mut session.model_calls[1];
        middle.target = failed.target;
        middle.reported_usage = failed.reported_usage;
        let config = super::super::AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
        };
        let analysis = super::super::analyze(session, config).expect("analysis");
        let spans: Vec<_> = analysis
            .context_items
            .iter()
            .filter(|item| item.kind == "unrecordedContext")
            .map(|item| (item.first_model_call, item.last_model_call))
            .collect();
        assert_eq!(spans, [(1, 3)]);
    }

    #[test]
    fn nothing_is_inferred_without_estimates_or_for_pi() {
        let mut session = claude_code("simple");
        add_unrecorded_context(
            &mut session,
            &mut ProfileRegistry::default(),
            TokenizationPolicy::Off,
        );
        assert!(unrecorded(&session).is_empty());
        let mut pi = load(
            &SessionLocator::PiFile(PathBuf::from("fixtures/pi/simple.jsonl")),
            None,
        )
        .expect("pi fixture")
        .normalized;
        add_unrecorded_context(
            &mut pi,
            &mut ProfileRegistry::default(),
            TokenizationPolicy::Auto,
        );
        assert!(unrecorded(&pi).is_empty());
    }
}
