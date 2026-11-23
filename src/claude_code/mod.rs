//! Read-only Claude Code CLI transcripts. See docs/sources/claude-code.md.

mod branch;
pub(crate) mod discovery;
pub(crate) mod reconstruct;
mod records;

#[cfg(test)]
mod tests;

use crate::domain::{
    HarnessSessionCost, Limitation, NormalizedSession, SourceError, MAX_SAFE_JSON_INTEGER,
};
use serde_json::Value;
use std::{collections::BTreeSet, fs::File, io::BufReader, path::Path};

/// Whether a transcript is a main session or a subagent's own transcript.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum FileKind {
    Main,
    Subagent,
}

#[derive(Debug)]
pub(crate) struct Loaded {
    pub session: NormalizedSession,
    pub limitations: BTreeSet<Limitation>,
    pub records: usize,
    pub selected_records: usize,
}

/// Synchronous; intended for a bounded blocking worker. Never writes.
pub(crate) fn load(path: &Path, kind: FileKind) -> Result<Loaded, SourceError> {
    let file = File::open(path).map_err(SourceError::Io)?;
    let records = records::parse(BufReader::new(file))?;
    let branch = branch::select(&records)?;
    let text = |key: &str| {
        records
            .iter()
            .find_map(|record| record.value.get(key).and_then(Value::as_str))
            .filter(|text| !text.is_empty())
    };
    let session_id = text("sessionId").ok_or(SourceError::RequiredField { field: "sessionId" })?;
    // A subagent's records carry its parent's session ID.
    let id = match (kind, text("agentId")) {
        (FileKind::Subagent, Some(agent_id)) => format!("{session_id}:{agent_id}"),
        _ => session_id.to_owned(),
    };
    let mut reconstruction = reconstruct::reconstruct(&records, &branch.indexes, id)?;
    if branch.repaired_compaction_link {
        reconstruction
            .limitations
            .insert(Limitation::RepairedCompactionLink);
    }
    reconstruction.session.harness_session_cost = harness_session_cost(&records);
    Ok(Loaded {
        session: reconstruction.session,
        limitations: reconstruction.limitations,
        records: records.len(),
        selected_records: branch.indexes.len(),
    })
}

/// The latest `cost-state` record: a running total since its `startTime`.
/// Repeated records carry the same or a higher total, so the latest one is used.
fn harness_session_cost(records: &[records::Record]) -> Option<HarnessSessionCost> {
    let record = records
        .iter()
        .rev()
        .find(|record| record.kind() == "cost-state")?;
    cost_state(&record.value)
}

pub(crate) fn cost_state(record: &Value) -> Option<HarnessSessionCost> {
    let total_usd = record
        .get("totalCostUSD")
        .and_then(Value::as_f64)
        .filter(|total| total.is_finite() && *total >= 0.0)?;
    let since_ms = record
        .get("startTime")
        .and_then(Value::as_i64)
        .filter(|start| (0..=MAX_SAFE_JSON_INTEGER as i64).contains(start));
    Some(HarnessSessionCost {
        total_usd,
        since_ms,
    })
}
