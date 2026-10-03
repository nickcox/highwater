use super::metrics::*;
use crate::domain::*;
use std::collections::{BTreeMap, HashMap};

fn calculate_transition(
    added: &[String],
    retained: &[String],
    dropped: &[String],
    previous: &[String],
    current: &[String],
    tokens: &BTreeMap<&str, Option<u64>>,
) -> TransitionMetrics {
    super::metrics::calculate_transition(
        &added.iter().map(String::as_str).collect::<Vec<_>>(),
        &retained.iter().map(String::as_str).collect::<Vec<_>>(),
        &dropped.iter().map(String::as_str).collect::<Vec<_>>(),
        previous,
        current,
        tokens,
    )
}

fn item(id: &str, first: usize) -> NormalizedContextItem {
    NormalizedContextItem {
        id: id.into(),
        kind: ContextItemKind::UserMessage,
        label: id.into(),
        source_record_id: None,
        source_tool_call_id: None,
        metadata: BTreeMap::new(),
        serialized_size_bytes: 0,
        payload: TokenizationPayload::UserMessage(MessageContent::text("")),
        presence: vec![PresenceRange {
            start_call: first,
            end_call: first,
        }],
        first_model_call: first,
        last_model_call: first,
    }
}

#[test]
fn age_first_call_medians_thresholds_and_zero_weight() {
    let a = item("a", 1);
    let b = item("b", 11);
    let c = item("c", 16);
    let items = HashMap::from([("a", &a), ("b", &b), ("c", &c)]);
    let tokens = BTreeMap::from([("a", Some(2)), ("b", Some(3)), ("c", Some(5))]);
    let first = calculate_age(&["a".into()], &items, &tokens, 1);
    assert_eq!(first.oldest_live_item_age_calls, Some(0));
    assert_eq!(first.token_weighted_mean_age_calls, Some(0.0));
    let age = calculate_age(&["a".into(), "b".into(), "c".into()], &items, &tokens, 21);
    assert_eq!(age.median_live_item_age_calls, Some(10.0));
    assert_eq!(age.token_weighted_mean_age_calls, Some(9.5));
    assert_eq!(age.tokens_at_least_5_calls_old, Some(10));
    assert_eq!(age.tokens_at_least_10_calls_old, Some(5));
    assert_eq!(age.tokens_at_least_20_calls_old, Some(2));
    let even = calculate_age(&["a".into(), "b".into()], &items, &tokens, 21);
    assert_eq!(even.median_live_item_age_calls, Some(15.0));
    let zero = calculate_age(&["a".into()], &items, &BTreeMap::from([("a", Some(0))]), 21);
    assert_eq!(zero.token_weighted_mean_age_calls, None);
}

#[test]
fn no_presence_never_creates_an_age_from_the_wire_zero_sentinel() {
    let mut terminal = item("terminal", 0);
    terminal.presence.clear();
    let age = calculate_age(
        &["terminal".into()],
        &HashMap::from([("terminal", &terminal)]),
        &BTreeMap::from([("terminal", Some(7))]),
        21,
    );
    assert_eq!(age.oldest_live_item_age_calls, None);
    assert_eq!(age.median_live_item_age_calls, None);
    assert_eq!(age.token_weighted_mean_age_calls, None);
    assert_eq!(age.tokens_at_least_5_calls_old, None);
    assert_eq!(age.items_at_least_5_calls_old, 0);
}

#[test]
fn age_incomplete_estimates_and_range_failure_do_not_create_numeric_totals() {
    let a = item("a", 1);
    let b = item("b", 1);
    let items = HashMap::from([("a", &a), ("b", &b)]);
    let ids = ["a".into(), "b".into()];
    let unavailable = calculate_age(
        &ids,
        &items,
        &BTreeMap::from([("a", Some(5)), ("b", None)]),
        21,
    );
    assert_eq!(unavailable.token_weighted_mean_age_calls, None);
    assert_eq!(unavailable.tokens_at_least_5_calls_old, None);
    assert_eq!(unavailable.items_at_least_20_calls_old, 2);
    let overflow = calculate_age(
        &ids,
        &items,
        &BTreeMap::from([("a", Some(MAX_SAFE_JSON_INTEGER)), ("b", Some(1))]),
        21,
    );
    assert_eq!(overflow.tokens_at_least_20_calls_old, None);
}

#[test]
fn transitions_handle_retention_empty_context_and_zero_denominator() {
    let a = vec!["a".into()];
    let b = vec!["b".into()];
    let both = vec!["a".into(), "b".into()];
    let tokens = BTreeMap::from([("a", Some(3)), ("b", Some(7))]);
    let changed = calculate_transition(&b, &[], &a, &a, &b, &tokens);
    assert_eq!(
        (changed.added, changed.dropped, changed.churn),
        (Some(7), Some(3), Some(1.0))
    );
    let unchanged = calculate_transition(&[], &both, &[], &both, &both, &tokens);
    assert_eq!((unchanged.churn, unchanged.reuse), (Some(0.0), Some(1.0)));
    let empty = calculate_transition(&[], &[], &[], &[], &[], &tokens);
    assert_eq!(empty.added, Some(0));
    assert_eq!(empty.churn, None);
    let zero = calculate_transition(&a, &[], &[], &[], &a, &BTreeMap::from([("a", Some(0))]));
    assert_eq!(zero.addition_share, None);
}

#[test]
fn transitions_preserve_unavailability_and_safe_range_exhaustion() {
    let a = vec!["a".into()];
    let b = vec!["b".into()];
    let partial = calculate_transition(
        &a,
        &[],
        &b,
        &b,
        &a,
        &BTreeMap::from([("a", Some(3)), ("b", None)]),
    );
    assert_eq!(partial.added, Some(3));
    assert_eq!(partial.dropped, None);
    assert_eq!(partial.churn, None);
    let overflow = calculate_transition(
        &a,
        &[],
        &b,
        &b,
        &a,
        &BTreeMap::from([("a", Some(MAX_SAFE_JSON_INTEGER)), ("b", Some(1))]),
    );
    assert_eq!(overflow.churn, None);
    assert_eq!(overflow.reuse, None);
}
