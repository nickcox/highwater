use super::interpret::AssistantCall;
use super::*;

#[derive(Debug, Clone, Copy, Eq, Hash, PartialEq)]
struct ItemIndex(usize);

#[derive(Debug)]
struct PendingCompaction {
    record_id: String,
    source_item_ids: Vec<String>,
    retained_item_ids: Vec<String>,
    before_model_call: usize,
    tokens_before: Option<u64>,
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

/// Authoritative stable-index storage. Nothing is filtered or reordered until
/// `finish`; compaction only changes active membership, never stored indexes.
pub(super) struct ReconstructionState {
    pub(super) id: String,
    source: SourceDescriptor,
    pub(super) working_directory: Option<String>,
    items: Vec<NormalizedContextItem>,
    item_indices: HashMap<String, ItemIndex>,
    calls: Vec<NormalizedModelCall>,
    active: Vec<ItemIndex>,
    system: system_context::SystemReplay,
    global: Vec<ItemIndex>,
    legacy_tools: Vec<ItemIndex>,
    compactions: Vec<PendingCompaction>,
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
            active: Vec::new(),
            system: system_context::SystemReplay::default(),
            global: Vec::new(),
            legacy_tools: Vec::new(),
            compactions: Vec::new(),
            last_compaction: None,
        }
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
                extend_presence(item, index);
            }
            let contextual = assistant_response_is_contextual(call.stop_reason.as_deref());
            self.calls.push(NormalizedModelCall {
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

    pub(super) fn apply_compaction(
        &mut self,
        item: NormalizedContextItem,
        first_kept_position: Option<usize>,
        tokens_before: Option<u64>,
        branch_positions: &HashMap<&str, usize>,
        entry: &PiEntry,
    ) {
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
        self.active.clear();
        self.active.push(summary_index);
        self.active.extend(retained);
        self.last_compaction = Some(summary_id);
        self.compactions.push(PendingCompaction {
            record_id,
            source_item_ids,
            retained_item_ids,
            before_model_call: self.calls.len() + 1,
            tokens_before,
        });
    }

    /// Visibility filtering, pruning, and output ordering happen only here.
    pub(super) fn finish(self) -> NormalizedSession {
        let Self {
            id,
            source,
            working_directory,
            mut items,
            calls,
            compactions,
            ..
        } = self;
        for item in &mut items {
            // Materialize the legacy normalized lifetime fields only at finalization.
            let lifetime = item.lifetime();
            item.first_model_call = lifetime.map_or(0, |lifetime| lifetime.first_call);
            item.last_model_call = lifetime.map_or(0, |lifetime| lifetime.last_call);
        }
        let mut lineage = Vec::new();
        let mut compaction_dtos = Vec::new();
        for compaction in compactions {
            let summary_id = format!("pi:{id}:compaction:{}", compaction.record_id);
            for old_id in &compaction.source_item_ids {
                lineage.push(NormalizedLineageEdge {
                    from: old_id.clone(),
                    to: summary_id.clone(),
                    kind: "frameworkCompaction".into(),
                });
            }
            compaction_dtos.push(NormalizedCompaction {
                id: summary_id.clone(),
                before_model_call: compaction.before_model_call,
                source_item_ids: compaction.source_item_ids,
                retained_item_ids: compaction.retained_item_ids,
                summary_item_id: summary_id,
                tokens_before: compaction.tokens_before,
            });
        }
        let terminal_boundary = calls.len() + 1;
        let terminal_summary_ids: HashSet<String> = compaction_dtos
            .iter()
            .filter(|event| event.before_model_call == terminal_boundary)
            .map(|event| event.summary_item_id.clone())
            .collect();
        let mut context_items: Vec<_> = items
            .into_iter()
            .filter(|item| !item.presence.is_empty() || terminal_summary_ids.contains(&item.id))
            .collect();
        let visible_ids: HashSet<String> =
            context_items.iter().map(|item| item.id.clone()).collect();
        compaction_dtos.retain(|event| visible_ids.contains(&event.summary_item_id));
        for event in &mut compaction_dtos {
            event.source_item_ids.retain(|id| visible_ids.contains(id));
            event
                .retained_item_ids
                .retain(|id| visible_ids.contains(id));
        }
        lineage.retain(|edge| visible_ids.contains(&edge.from) && visible_ids.contains(&edge.to));
        context_items.sort_by(|left, right| {
            left.first_model_call
                .cmp(&right.first_model_call)
                .then_with(|| left.id.cmp(&right.id))
        });
        compaction_dtos.sort_by(|left, right| {
            left.before_model_call
                .cmp(&right.before_model_call)
                .then_with(|| left.id.cmp(&right.id))
        });
        lineage.sort_by(|left, right| {
            left.to
                .cmp(&right.to)
                .then_with(|| left.from.cmp(&right.from))
                .then_with(|| left.kind.cmp(&right.kind))
        });
        NormalizedSession {
            id,
            source,
            title: None,
            working_directory,
            context_items,
            model_calls: calls,
            compactions: compaction_dtos,
            lineage,
        }
    }
}
