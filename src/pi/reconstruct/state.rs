use super::interpret::AssistantCall;
use super::*;

#[derive(Debug, Clone, Copy, Eq, Hash, PartialEq)]
struct ItemIndex(usize);

/// What a compaction entry records besides its summary.
pub(super) struct CompactionRecord {
    pub first_kept_position: Option<usize>,
    pub tokens_before: Option<u64>,
    /// The usage of the call that wrote the summary.
    pub usage: Option<ReportedUsage>,
    pub recorded_at_ms: Option<i64>,
}

fn insert_item(
    items: &mut Vec<NormalizedContextItem>,
    item_indices: &mut HashMap<String, ItemIndex>,
    item_id: String,
    item: NormalizedContextItem,
) -> ItemIndex {
    if let Some(index) = item_indices.get(&item_id).copied() {
        return index;
    }
    let index = ItemIndex(items.len());
    item_indices.insert(item_id, index);
    items.push(item);
    index
}

struct TurnStart {
    first_call: usize,
    prompt: Option<String>,
    recorded_at_ms: Option<i64>,
}

/// Authoritative stable-index storage. Nothing is filtered or reordered until
/// `finish`; compaction only changes active membership, never stored indexes.
pub(super) struct ReconstructionState {
    pub(super) id: String,
    source: SourceDescriptor,
    pub(super) working_directory: Option<String>,
    items: Vec<NormalizedContextItem>,
    item_indices: HashMap<String, ItemIndex>,
    calls: Vec<NormalizedModelCall>,
    pending_turn: Option<TurnStart>,
    turns: Vec<RecordedTurn>,
    active: Vec<ItemIndex>,
    system: system_context::SystemReplay,
    global: Vec<ItemIndex>,
    legacy_tools: Vec<ItemIndex>,
    /// Thinking items that leave the context at the next user message.
    turn_thinking: Vec<ItemIndex>,
    compactions: Vec<NormalizedCompaction>,
    last_compaction: Option<String>,
}

impl ReconstructionState {
    pub(super) fn new(
        id: String,
        working_directory: Option<String>,
        source: SourceDescriptor,
    ) -> Self {
        Self {
            id,
            source,
            working_directory,
            items: Vec::new(),
            item_indices: HashMap::new(),
            calls: Vec::new(),
            pending_turn: None,
            turns: Vec::new(),
            active: Vec::new(),
            system: system_context::SystemReplay::default(),
            global: Vec::new(),
            legacy_tools: Vec::new(),
            turn_thinking: Vec::new(),
            compactions: Vec::new(),
            last_compaction: None,
        }
    }

    pub(super) fn start_turn(
        &mut self,
        item: &NormalizedContextItem,
        recorded_at: Option<chrono::DateTime<chrono::FixedOffset>>,
    ) {
        self.finish_turn();
        self.pending_turn = Some(TurnStart {
            first_call: self.calls.len() + 1,
            prompt: item.label.strip_prefix("User · ").map(str::to_owned),
            recorded_at_ms: recorded_at.map(|time| time.timestamp_millis()),
        });
    }

    fn finish_turn(&mut self) {
        let Some(turn) = self.pending_turn.take() else {
            return;
        };
        // A compaction after the last reply is not part of that reply's turn.
        let Some(last) = self.calls[turn.first_call - 1..]
            .iter()
            .rev()
            .find(|call| call.stop_reason.as_deref() != Some("compaction-call"))
        else {
            return;
        };
        if last.stop_reason.as_deref() != Some("stop") {
            return;
        }
        let duration_ms = last
            .timestamps
            .recorded_at_ms
            .zip(turn.recorded_at_ms)
            .and_then(|(end, start)| end.checked_sub(start))
            .and_then(|duration| u64::try_from(duration).ok())
            .and_then(turn_duration_ms);
        self.turns.push(RecordedTurn {
            starter: None,
            first_call: turn.first_call,
            last_call: last.index,
            prompt: turn.prompt,
            duration_ms,
            duration_estimated: true,
            status: Some(TurnStatus::Completed),
            combined_calls: false,
        });
    }

    pub(super) fn apply_system(&mut self, update: system_context::SystemUpdate, entry: &PiEntry) {
        let items = self.system.apply(update, entry, &self.id);
        if self.system.loadout_known {
            self.legacy_tools.clear();
        }
        self.global = items
            .into_iter()
            .map(|item| {
                insert_item(
                    &mut self.items,
                    &mut self.item_indices,
                    item.id.clone(),
                    item,
                )
            })
            .collect();
    }

    /// Add the thinking of a response that has just been applied. Only a response that
    /// joined the context gets one.
    pub(super) fn apply_reported_thinking(
        &mut self,
        response_id: &str,
        tokens: u64,
        model: String,
    ) {
        let Some(keeps) = crate::analysis::claude_keeps_prior_thinking(&model) else {
            return;
        };
        let Some(response) = self.item_indices.get(response_id).copied() else {
            return;
        };
        let Some(position) = self.active.iter().position(|index| *index == response) else {
            return;
        };
        if let TokenizationPayload::AssistantMessage {
            thinking_reported, ..
        } = &mut self.items[response.0].payload
        {
            *thinking_reported = true;
        }
        let item = NormalizedContextItem::reported_thinking(
            format!("{response_id}:thinking"),
            self.items[response.0].source_record_id.clone(),
            tokens,
            model,
        );
        let index = insert_item(
            &mut self.items,
            &mut self.item_indices,
            item.id.clone(),
            item,
        );
        // Thinking comes before the response's text and tool calls.
        self.active.insert(position, index);
        if !keeps {
            self.turn_thinking.push(index);
        }
    }

    pub(super) fn apply_message(
        &mut self,
        item: NormalizedContextItem,
        call: Option<Box<AssistantCall>>,
    ) {
        if call.is_none() && item.kind == ContextItemKind::ToolDefinition {
            // Legacy declaration records have no verified delta identity. Keep them
            // out of summary lineage; an authoritative modern loadout supersedes them.
            let index = insert_item(
                &mut self.items,
                &mut self.item_indices,
                item.id.clone(),
                item,
            );
            if !self.system.loadout_known {
                self.legacy_tools.push(index);
            }
            return;
        }
        if call.is_none() && item.kind == ContextItemKind::UserMessage {
            let ending: HashSet<ItemIndex> = self.turn_thinking.drain(..).collect();
            self.active.retain(|index| !ending.contains(index));
        }
        let contextual = if let Some(call) = call {
            let index = self.calls.len() + 1;
            let context_item_ids = self
                .global
                .iter()
                .chain(&self.legacy_tools)
                .chain(&self.active)
                .map(|index| self.items[index.0].id.clone())
                .collect();
            for item_index in self
                .global
                .iter()
                .chain(&self.legacy_tools)
                .chain(&self.active)
            {
                let item = &mut self.items[item_index.0];
                item.extend_presence(index);
            }
            let contextual = assistant_response_is_contextual(call.stop_reason.as_deref());
            self.calls.push(NormalizedModelCall {
                retried: false,
                tool_loadout_known: self.system.loadout_known,
                index,
                source_record_id: item
                    .source_record_id
                    .clone()
                    .expect("interpreted message has a source record"),
                target: call.target,
                reported_usage: call.usage,
                stop_reason: call.stop_reason,
                timestamps: call.timestamps,
                context_item_ids,
                tool_calls_after: call.tools,
                compaction_before: self.last_compaction.take(),
            });
            contextual
        } else {
            true
        };
        let index = insert_item(
            &mut self.items,
            &mut self.item_indices,
            item.id.clone(),
            item,
        );
        if contextual {
            self.active.push(index);
        }
    }

    /// A response a fork copied from its parent: an item in the context, not a call.
    pub(super) fn apply_inherited_response(
        &mut self,
        mut item: NormalizedContextItem,
        stop_reason: Option<&str>,
    ) {
        item.metadata.insert("inherited".into(), "true".into());
        let index = insert_item(
            &mut self.items,
            &mut self.item_indices,
            item.id.clone(),
            item,
        );
        if assistant_response_is_contextual(stop_reason) {
            self.active.push(index);
        }
    }

    /// `record` is false for a compaction a fork copied from its parent, which only shapes
    /// the context the fork starts with.
    pub(super) fn apply_compaction(
        &mut self,
        item: NormalizedContextItem,
        record: CompactionRecord,
        branch_positions: &HashMap<&str, usize>,
        entry: &PiEntry,
        own: bool,
    ) {
        let CompactionRecord {
            first_kept_position,
            tokens_before,
            usage,
            recorded_at_ms,
        } = record;
        let previous_globals: HashSet<ItemIndex> = self
            .global
            .iter()
            .chain(&self.legacy_tools)
            .copied()
            .collect();
        if entry.value.get("systemMessage").is_some() {
            self.apply_system(system_context::SystemUpdate::parse(entry, true), entry);
        }
        let summary_id = item.id.clone();
        let record_id = item
            .source_record_id
            .clone()
            .expect("interpreted compaction has a source record");
        let summary_index = insert_item(
            &mut self.items,
            &mut self.item_indices,
            summary_id.clone(),
            item,
        );
        let (old, retained): (Vec<ItemIndex>, Vec<ItemIndex>) =
            self.active.iter().copied().partition(|index| {
                let Some(boundary) = first_kept_position else {
                    return true;
                };
                self.items[index.0]
                    .source_record_id
                    .as_deref()
                    .and_then(|id| branch_positions.get(id).copied())
                    .is_none_or(|position| position < boundary)
            });
        let source_item_ids = old
            .iter()
            .map(|index| self.items[index.0].id.clone())
            .collect();
        let retained_item_ids = self
            .global
            .iter()
            .chain(&self.legacy_tools)
            .filter(|index| previous_globals.contains(index))
            .chain(retained.iter())
            .map(|index| self.items[index.0].id.clone())
            .collect();
        // The call that wrote the summary read a shortened form of the removed items (about
        // half their size, measured on local sessions) and Pi's summarising prompt.
        let summary_call = match usage.filter(|_| own) {
            Some(usage) => {
                let input_id = format!("{summary_id}:input");
                let input = insert_item(
                    &mut self.items,
                    &mut self.item_indices,
                    input_id.clone(),
                    NormalizedContextItem::compaction_input(
                        input_id,
                        Some(record_id.clone()),
                        &usage,
                    ),
                );
                Some(self.push_compaction_call(&[input], usage, recorded_at_ms, &record_id))
            }
            None => None,
        };
        self.active.clear();
        self.active.push(summary_index);
        self.active.extend(retained);
        if !own {
            self.items[summary_index.0]
                .metadata
                .insert("inherited".into(), "true".into());
            return;
        }
        self.last_compaction = Some(summary_id.clone());
        self.compactions.push(NormalizedCompaction {
            id: summary_id.clone(),
            summary_item_id: summary_id,
            source_item_ids,
            retained_item_ids,
            before_model_call: self.calls.len() + 1,
            tokens_before,
            details: CompactionDetails {
                rule: Some(CompactionRule::KeptFromEntry),
                summary_call,
                ..CompactionDetails::default()
            },
        });
    }

    /// A compaction's own call, made with the previous call's model. Returns its index.
    fn push_compaction_call(
        &mut self,
        members: &[ItemIndex],
        usage: ReportedUsage,
        recorded_at_ms: Option<i64>,
        record_id: &str,
    ) -> usize {
        let index = self.calls.len() + 1;
        for member in members {
            self.items[member.0].extend_presence(index);
        }
        let target = self
            .calls
            .last()
            .map(|call| call.target.clone())
            .unwrap_or_default();
        self.calls.push(NormalizedModelCall {
            retried: false,
            tool_loadout_known: false,
            index,
            source_record_id: record_id.to_owned(),
            target,
            reported_usage: usage,
            stop_reason: Some("compaction-call".into()),
            timestamps: CallTimestamps {
                started_at_ms: None,
                recorded_at_ms,
            },
            context_item_ids: members
                .iter()
                .map(|member| self.items[member.0].id.clone())
                .collect(),
            tool_calls_after: Vec::new(),
            compaction_before: self.last_compaction.take(),
        });
        index
    }

    /// Visibility filtering, pruning, and output ordering happen only here.
    pub(super) fn finish(mut self) -> NormalizedSession {
        self.finish_turn();
        NormalizedSession {
            harness_session_cost: None,
            turns: self.turns,
            id: self.id,
            source: self.source,
            title: None,
            working_directory: self.working_directory,
            context_items: self.items,
            model_calls: self.calls,
            compactions: self.compactions,
            lineage: Vec::new(),
        }
        .finish_reconstruction()
    }
}
