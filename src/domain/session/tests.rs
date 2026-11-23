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
    }
}

#[test]
fn lifetime_and_inclusive_counts_derive_from_presence() {
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
fn finish_reconstruction_clears_call_reference_to_dropped_compaction() {
    let mut summary = item(Vec::new());
    summary.id = "summary".into();
    summary.kind = ContextItemKind::CompactionSummary;
    let session = NormalizedSession {
        id: "test".into(),
        source: SourceDescriptor {
            kind: "test".into(),
            version: "1".into(),
            cost_basis: CostBasis::Unknown,
        },
        title: None,
        working_directory: None,
        context_items: vec![summary],
        model_calls: vec![NormalizedModelCall {
            tool_loadout_known: false,
            retried: false,
            index: 1,
            source_record_id: "call".into(),
            target: ModelTarget::default(),
            reported_usage: ReportedUsage::default(),
            stop_reason: None,
            timestamps: CallTimestamps::default(),
            context_item_ids: Vec::new(),
            tool_calls_after: Vec::new(),
            compaction_before: Some("compaction".into()),
        }],
        compactions: vec![NormalizedCompaction {
            id: "compaction".into(),
            before_model_call: 1,
            source_item_ids: Vec::new(),
            retained_item_ids: Vec::new(),
            summary_item_id: "summary".into(),
            tokens_before: None,
            details: CompactionDetails::default(),
        }],
        lineage: Vec::new(),
        harness_session_cost: None,
        turns: Vec::new(),
    }
    .finish_reconstruction(UnusedSummaries::Drop);

    assert!(session.context_items.is_empty());
    assert!(session.compactions.is_empty());
    assert_eq!(session.model_calls[0].compaction_before, None);
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
