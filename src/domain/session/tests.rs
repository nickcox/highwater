use super::*;

fn item(presence: Vec<PresenceRange>) -> NormalizedContextItem {
    NormalizedContextItem {
        id: "test".into(),
        kind: ContextItemKind::UserMessage,
        label: "test".into(),
        source_record_id: None,
        source_tool_call_id: None,
        metadata: BTreeMap::new(),
        serialized_size_bytes: 0,
        payload: TokenizationPayload::Unavailable,
        presence,
        first_model_call: 0,
        last_model_call: 0,
    }
}

#[test]
fn lifetime_and_inclusive_counts_derive_from_presence_not_legacy_fields() {
    let terminal = item(Vec::new());
    let item = item(vec![
        PresenceRange {
            start_call: 1,
            end_call: 3,
        },
        PresenceRange {
            start_call: 5,
            end_call: 6,
        },
    ]);
    let lifetime = item.lifetime().expect("presence lifetime");
    assert_eq!(
        lifetime,
        ItemLifetime {
            first_call: 1,
            last_call: 6
        }
    );
    assert_eq!(lifetime.age_at(1), Some(0));
    assert_eq!(lifetime.age_at(0), None);
    assert_eq!(lifetime.age_at(7), Some(6));
    assert_eq!(item.checked_presence_call_count(), Some(5));
    assert_eq!(terminal.lifetime(), None);
    assert_eq!(terminal.checked_presence_call_count(), Some(0));
}

#[test]
fn checked_presence_rejects_zero_inverted_and_overflowed_ranges() {
    for range in [
        PresenceRange {
            start_call: 0,
            end_call: 0,
        },
        PresenceRange {
            start_call: 2,
            end_call: 1,
        },
    ] {
        assert_eq!(range.checked_call_count(), None);
        let item = item(vec![range]);
        assert_eq!(item.lifetime(), None);
        assert_eq!(item.checked_presence_call_count(), None);
    }
    let range = PresenceRange {
        start_call: 1,
        end_call: usize::MAX,
    };
    assert_eq!(range.checked_call_count(), Some(usize::MAX));
    assert_eq!(
        item(vec![range.clone(), range]).checked_presence_call_count(),
        None
    );
}
