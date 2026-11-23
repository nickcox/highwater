//! Read-only VS Code Copilot Chat sessions. See docs/sources/vscode-copilot.md.

mod change_log;
pub(crate) mod discovery;
mod reconstruct;
pub(crate) mod traces;

#[cfg(test)]
mod tests;
#[cfg(test)]
mod trace_tests;

use crate::domain::{Limitation, NormalizedSession, SourceError};
use std::{collections::BTreeSet, fs::File, io::BufReader, path::Path};

#[derive(Debug)]
pub(crate) struct Loaded {
    pub session: NormalizedSession,
    pub limitations: BTreeSet<Limitation>,
    /// Change lines applied.
    pub records: usize,
}

pub(crate) fn session_total(path: &Path) -> Result<Option<f64>, SourceError> {
    let file = File::open(path).map_err(SourceError::Io)?;
    let replayed = change_log::replay(BufReader::new(file))?;
    let mut credits = crate::session_totals::CostSum::default();
    for request in replayed
        .session
        .get("requests")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
    {
        credits.add(reconstruct::request_credits(request));
    }
    Ok(credits.total().map(|total| total * reconstruct::CREDIT_USD))
}

/// Synchronous; intended for a bounded blocking worker. Never writes.
pub(crate) fn load(path: &Path) -> Result<Loaded, SourceError> {
    let file = File::open(path).map_err(SourceError::Io)?;
    let replayed = change_log::replay(BufReader::new(file))?;
    // `<workspace>/chatSessions/<id>.jsonl`; empty-window sessions have no folder.
    let working_directory = path
        .parent()
        .filter(|folder| {
            folder
                .file_name()
                .is_some_and(|name| name == "chatSessions")
        })
        .and_then(Path::parent)
        .and_then(discovery::workspace_folder);
    let session_id = replayed
        .session
        .get("sessionId")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let (traces, unreadable) = match traces::database_for(path) {
        Some(database) => match traces::load(&database, &session_id) {
            Ok(traces) => (traces, false),
            Err(_) => (None, true),
        },
        None => (None, false),
    };
    let mut reconstruction =
        reconstruct::reconstruct(&replayed.session, working_directory, traces.as_ref())?;
    // Only matched traces supply the start timestamp; the session file supplies no start.
    let calls = &reconstruction.session.model_calls;
    let traced = calls
        .iter()
        .filter(|call| call.timestamps.started_at_ms.is_some())
        .count();
    let trace_limitation = if unreadable {
        Some(Limitation::TraceRecordsUnreadable)
    } else if calls.is_empty() || traced == calls.len() {
        None
    } else if traced == 0 {
        Some(Limitation::TraceRecordsUnavailable)
    } else {
        Some(Limitation::TraceRecordsIncomplete)
    };
    reconstruction.limitations.extend(trace_limitation);
    Ok(Loaded {
        session: reconstruction.session,
        limitations: reconstruction.limitations,
        records: replayed.changes,
    })
}
