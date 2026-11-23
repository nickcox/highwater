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
fn finish_reconstruction_keeps_unread_compaction_summaries() {
    let summary = |id: &str, presence| NormalizedContextItem {
        id: id.into(),
        kind: ContextItemKind::CompactionSummary,
        ..item(presence)
    };
    let compaction =
        |id: &str, before_model_call, summary_id: &str, sources| NormalizedCompaction {
            id: id.into(),
            before_model_call,
            source_item_ids: sources,
            retained_item_ids: Vec::new(),
            summary_item_id: summary_id.into(),
            tokens_before: None,
            details: CompactionDetails::default(),
        };
    let session = NormalizedSession {
        id: "test".into(),
        source: SourceDescriptor {
            kind: Harness::Test("test"),
            version: "1".into(),
            cost_basis: CostBasis::Unknown,
        },
        title: None,
        working_directory: None,
        context_items: vec![
            summary("first-summary", Vec::new()),
            summary(
                "second-summary",
                vec![PresenceRange {
                    start_call: 1,
                    end_call: 1,
                }],
            ),
            summary("terminal-summary", Vec::new()),
        ],
        model_calls: vec![NormalizedModelCall {
            tool_loadout_known: false,
            retried: false,
            index: 1,
            source_record_id: "call".into(),
            target: ModelTarget::default(),
            reported_usage: ReportedUsage::default(),
            stop_reason: None,
            timestamps: CallTimestamps::default(),
            context_item_ids: vec!["second-summary".into()],
            tool_calls_after: Vec::new(),
            compaction_before: Some("second".into()),
        }],
        compactions: vec![
            compaction("first", 1, "first-summary", Vec::new()),
            compaction("second", 1, "second-summary", vec!["first-summary".into()]),
            compaction("terminal", 2, "terminal-summary", Vec::new()),
        ],
        lineage: Vec::new(),
        harness_session_cost: None,
        turns: Vec::new(),
    }
    .finish_reconstruction();

    assert_eq!(session.context_items.len(), 3);
    assert_eq!(session.compactions.len(), 3);
    assert_eq!(session.compactions[1].source_item_ids, ["first-summary"]);
    assert_eq!(session.lineage.len(), 1);
    assert_eq!(session.lineage[0].from, "first-summary");
    assert_eq!(session.lineage[0].to, "second-summary");
    assert_eq!(session.lineage[0].kind, "frameworkCompaction");
    assert_eq!(
        session.model_calls[0].compaction_before.as_deref(),
        Some("second")
    );
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
