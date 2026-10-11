//! Normalized-session invariants checked before any metric is derived.

use super::*;

#[derive(Debug)]
pub(super) struct ValidatedSession<'a> {
    pub(super) item_indices: HashMap<&'a str, usize>,
    pub(super) compaction_indices: HashMap<&'a str, usize>,
}

pub(super) fn invalid_session(message: impl Into<String>) -> AnalysisError {
    AnalysisError::InvalidSession(message.into())
}

pub(super) fn require_safe_integer(value: u64, field: &str) -> Result<(), AnalysisError> {
    if value > MAX_SAFE_JSON_INTEGER {
        return Err(invalid_session(format!(
            "{field} exceeds the safe JSON integer range"
        )));
    }
    Ok(())
}

pub(super) fn validate_reported_usage(
    usage: &ReportedUsage,
    call_index: usize,
) -> Result<(), AnalysisError> {
    if let Some(raw) = &usage.placeholder {
        let counters_absent = [
            usage.input,
            usage.output,
            usage.recorded_output,
            usage.cache_read,
            usage.cache_write,
            usage.cache_write_1h,
            usage.reasoning,
            usage.total_tokens,
        ]
        .iter()
        .all(Option::is_none);
        let costs_absent = [
            usage.cost.input,
            usage.cost.output,
            usage.cost.cache_read,
            usage.cost.cache_write,
            usage.cost.total,
        ]
        .iter()
        .all(Option::is_none);
        let raw_breakdowns_zero = [raw.cache_write_1h, raw.reasoning]
            .iter()
            .all(|value| value.is_none_or(|value| value == 0));
        let raw_cost_zero = [
            raw.cost.input,
            raw.cost.output,
            raw.cost.cache_read,
            raw.cost.cache_write,
            raw.cost.total,
        ]
        .iter()
        .all(|value| value.is_none_or(|value| value == 0.0));
        if !(counters_absent && costs_absent && raw_breakdowns_zero && raw_cost_zero) {
            return Err(invalid_session(format!(
                "call {call_index} has inconsistent usage placeholder evidence"
            )));
        }
    }
    for (field, value) in [
        ("input", usage.input),
        ("output", usage.output),
        ("recordedOutput", usage.recorded_output),
        ("cacheRead", usage.cache_read),
        ("cacheWrite", usage.cache_write),
        ("cacheWrite1h", usage.cache_write_1h),
        ("reasoning", usage.reasoning),
        ("totalTokens", usage.total_tokens),
    ] {
        if let Some(value) = value {
            require_safe_integer(value, &format!("call {call_index} usage.{field}"))?;
        }
    }
    for (field, value) in [
        ("input", usage.cost.input),
        ("output", usage.cost.output),
        ("cacheRead", usage.cost.cache_read),
        ("cacheWrite", usage.cost.cache_write),
        ("total", usage.cost.total),
    ] {
        if let Some(value) = value {
            if !value.is_finite() {
                return Err(invalid_session(format!(
                    "call {call_index} cost.{field} is not finite"
                )));
            }
        }
    }
    Ok(())
}

pub(super) fn validate_payload_numbers(
    payload: &TokenizationPayload,
    item_id: &str,
) -> Result<(), AnalysisError> {
    let validate_image = |image: &ImageDescriptor| {
        image.encoded_data_length.map_or(Ok(()), |length| {
            require_safe_integer(length, &format!("item {item_id} encoded image data length"))
        })
    };
    match payload {
        TokenizationPayload::UserMessage(content) | TokenizationPayload::CustomMessage(content) => {
            for part in &content.parts {
                if let ContentPart::Image(image) = part {
                    validate_image(image)?;
                }
            }
        }
        TokenizationPayload::AssistantMessage { blocks, .. } => {
            for block in blocks {
                if let AssistantContentBlock::Image(image) = block {
                    validate_image(image)?;
                }
            }
        }
        TokenizationPayload::ToolResult { content, .. } => {
            for part in &content.parts {
                if let ContentPart::Image(image) = part {
                    validate_image(image)?;
                }
            }
        }
        TokenizationPayload::ReportedThinking { tokens, .. } => {
            require_safe_integer(*tokens, &format!("item {item_id} reported thinking tokens"))?;
        }
        TokenizationPayload::SystemPrompt { .. }
        | TokenizationPayload::ToolDefinition { .. }
        | TokenizationPayload::CompactionSummary(_)
        | TokenizationPayload::BranchSummary(_)
        | TokenizationPayload::CommandExecution { .. }
        | TokenizationPayload::Unavailable => {}
    }
    Ok(())
}

pub(super) fn validate_normalized_session(
    session: &NormalizedSession,
) -> Result<ValidatedSession<'_>, AnalysisError> {
    if let Some(cost) = session.harness_session_cost {
        if !cost.total_usd.is_finite() || cost.total_usd < 0.0 {
            return Err(invalid_session(
                "harness session cost is not a valid amount",
            ));
        }
    }
    let mut item_indices = HashMap::with_capacity(session.context_items.len());
    for (index, item) in session.context_items.iter().enumerate() {
        if item_indices.insert(item.id.as_str(), index).is_some() {
            return Err(invalid_session(format!(
                "duplicate context item ID {}",
                item.id
            )));
        }
        require_safe_integer(
            item.serialized_size_bytes,
            &format!("item {} serialized size bytes", item.id),
        )?;
        validate_payload_numbers(&item.payload, &item.id)?;
    }

    let call_count = session.model_calls.len();
    let terminal_boundary = call_count
        .checked_add(1)
        .ok_or_else(|| invalid_session("model-call boundary overflow"))?;
    let mut expected_presence: HashMap<&str, Vec<PresenceRange>> = HashMap::new();
    for (position, call) in session.model_calls.iter().enumerate() {
        let expected_index = position
            .checked_add(1)
            .ok_or_else(|| invalid_session("model-call index overflow"))?;
        if call.index != expected_index {
            return Err(invalid_session(format!(
                "model-call indexes must be contiguous one-based values; expected {expected_index}, got {}",
                call.index
            )));
        }
        require_safe_integer(
            u64::try_from(call.index).map_err(|_| invalid_session("model-call index overflow"))?,
            &format!("model-call {} index", call.index),
        )?;
        validate_reported_usage(&call.reported_usage, call.index)?;
        let mut membership = HashSet::with_capacity(call.context_item_ids.len());
        for item_id in &call.context_item_ids {
            if !membership.insert(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "model call {} contains duplicate item reference {}",
                    call.index, item_id
                )));
            }
            if !item_indices.contains_key(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "model call {} references unknown item {}",
                    call.index, item_id
                )));
            }
            let ranges = expected_presence.entry(item_id.as_str()).or_default();
            if ranges
                .last()
                .is_some_and(|range| range.end_call.checked_add(1) == Some(call.index))
            {
                ranges.last_mut().expect("checked last range").end_call = call.index;
            } else {
                ranges.push(PresenceRange {
                    start_call: call.index,
                    end_call: call.index,
                });
            }
        }
    }

    let mut compaction_indices = HashMap::with_capacity(session.compactions.len());
    let mut summary_ids = HashSet::with_capacity(session.compactions.len());
    let mut terminal_summary_ids = HashSet::new();
    for (compaction_index, compaction) in session.compactions.iter().enumerate() {
        if compaction_indices
            .insert(compaction.id.as_str(), compaction_index)
            .is_some()
        {
            return Err(invalid_session(format!(
                "duplicate compaction ID {}",
                compaction.id
            )));
        }
        if compaction.before_model_call == 0 || compaction.before_model_call > terminal_boundary {
            return Err(invalid_session(format!(
                "compaction {} has an invalid call boundary",
                compaction.id
            )));
        }
        require_safe_integer(
            u64::try_from(compaction.before_model_call)
                .map_err(|_| invalid_session("compaction boundary overflow"))?,
            &format!("compaction {} boundary", compaction.id),
        )?;
        if !summary_ids.insert(compaction.summary_item_id.as_str()) {
            return Err(invalid_session(format!(
                "duplicate compaction summary reference {}",
                compaction.summary_item_id
            )));
        }
        let Some(summary_index) = item_indices.get(compaction.summary_item_id.as_str()) else {
            return Err(invalid_session(format!(
                "compaction {} references unknown summary {}",
                compaction.id, compaction.summary_item_id
            )));
        };
        let summary = &session.context_items[*summary_index];
        if summary.kind != ContextItemKind::CompactionSummary {
            return Err(invalid_session(format!(
                "compaction {} summary {} has the wrong item kind",
                compaction.id, compaction.summary_item_id
            )));
        }
        if compaction.before_model_call == terminal_boundary {
            terminal_summary_ids.insert(compaction.summary_item_id.as_str());
        }
        require_safe_integer(
            compaction.tokens_before.unwrap_or(0),
            &format!("compaction {} tokensBefore", compaction.id),
        )?;
        let mut source_ids = HashSet::with_capacity(compaction.source_item_ids.len());
        for item_id in &compaction.source_item_ids {
            if !source_ids.insert(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "compaction {} contains duplicate source item {}",
                    compaction.id, item_id
                )));
            }
            if !item_indices.contains_key(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "compaction {} references unknown source item {}",
                    compaction.id, item_id
                )));
            }
        }
        let mut retained_ids = HashSet::with_capacity(compaction.retained_item_ids.len());
        for item_id in &compaction.retained_item_ids {
            if !retained_ids.insert(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "compaction {} contains duplicate retained item {}",
                    compaction.id, item_id
                )));
            }
            if source_ids.contains(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "compaction {} repeats item {} in source and retained lists",
                    compaction.id, item_id
                )));
            }
            if !item_indices.contains_key(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "compaction {} references unknown retained item {}",
                    compaction.id, item_id
                )));
            }
        }
    }

    for call in &session.model_calls {
        if let Some(compaction_id) = call.compaction_before.as_deref() {
            let Some(compaction_index) = compaction_indices.get(compaction_id) else {
                return Err(invalid_session(format!(
                    "model call {} references unknown compaction {}",
                    call.index, compaction_id
                )));
            };
            let compaction = &session.compactions[*compaction_index];
            if compaction.before_model_call != call.index {
                return Err(invalid_session(format!(
                    "model call {} has a mismatched compaction boundary {}",
                    call.index, compaction_id
                )));
            }
        }
    }

    for edge in &session.lineage {
        if !item_indices.contains_key(edge.from.as_str())
            || !item_indices.contains_key(edge.to.as_str())
        {
            return Err(invalid_session(format!(
                "lineage edge {} -> {} references an unknown item",
                edge.from, edge.to
            )));
        }
    }

    for item in &session.context_items {
        let expected = expected_presence
            .get(item.id.as_str())
            .map(Vec::as_slice)
            .unwrap_or_default();
        if item.presence.is_empty() {
            if !expected.is_empty()
                || item.first_model_call != 0
                || item.last_model_call != 0
                || !summary_ids.contains(item.id.as_str())
            {
                return Err(invalid_session(format!(
                    "item {} has no presence but is not a structural compaction summary",
                    item.id
                )));
            }
            continue;
        }
        if terminal_summary_ids.contains(item.id.as_str()) {
            return Err(invalid_session(format!(
                "terminal compaction summary {} has presence",
                item.id
            )));
        }
        let mut previous_end = 0;
        for range in &item.presence {
            if range.start_call == 0
                || range.start_call > range.end_call
                || range.end_call > call_count
                || range.start_call <= previous_end
                || range.checked_call_count().is_none()
            {
                return Err(invalid_session(format!(
                    "item {} has an invalid or overlapping presence range",
                    item.id
                )));
            }
            previous_end = range.end_call;
        }
        if item.presence.as_slice() != expected
            || item.first_model_call != item.presence[0].start_call
            || item.last_model_call != previous_end
        {
            return Err(invalid_session(format!(
                "item {} lifetime or presence does not match call membership",
                item.id
            )));
        }
    }

    Ok(ValidatedSession {
        item_indices,
        compaction_indices,
    })
}
