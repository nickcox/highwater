//! Read-only VS Code Copilot Chat sessions. See docs/sources/vscode-copilot.md.

mod change_log;
pub(crate) mod discovery;
mod reconstruct;
pub(crate) mod traces;

#[cfg(test)]
mod tests;
#[cfg(test)]
mod trace_tests;

use crate::domain::{NormalizedSession, SourceError};
use std::{collections::BTreeSet, fs::File, io::BufReader, path::Path};

/// What the reconstruction could not establish from the session file. The strings are
/// shared with Claude Code and OpenCode where the meaning is the same.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum Limitation {
    MissingHistoricalSystemPrompt,
    MissingHistoricalToolDefinitions,
    /// Copilot's own calls (titles, progress messages, tool grouping) are not recorded.
    UnrecordedHarnessCalls,
    /// A request with attachments recorded without the message as sent, so only the
    /// typed text is known.
    UnrenderedAttachments,
    /// A request that made several model calls but recorded no rounds (one stopped or
    /// interrupted, for example) is shown as one call.
    UnrecordedRounds,
    /// Some calls have no trace records (deleted, never written, or not matching the
    /// session file), so they use the session file alone.
    TraceRecordsIncomplete,
    /// The trace database exists but could not be read.
    TraceRecordsUnreadable,
    UnsupportedContent,
}

impl Limitation {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::MissingHistoricalSystemPrompt => "missingHistoricalSystemPrompt",
            Self::MissingHistoricalToolDefinitions => "missingHistoricalToolDefinitions",
            Self::UnrecordedHarnessCalls => "unrecordedHarnessCalls",
            Self::UnrenderedAttachments => "unrenderedAttachments",
            Self::UnrecordedRounds => "unrecordedRounds",
            Self::TraceRecordsIncomplete => "traceRecordsIncomplete",
            Self::TraceRecordsUnreadable => "traceRecordsUnreadable",
            Self::UnsupportedContent => "unsupportedContent",
        }
    }
}

#[derive(Debug)]
pub(crate) struct Loaded {
    pub session: NormalizedSession,
    pub limitations: BTreeSet<Limitation>,
    /// Change lines applied.
    pub records: usize,
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
    if unreadable {
        reconstruction
            .limitations
            .insert(Limitation::TraceRecordsUnreadable);
    }
    // Calls without trace records in a session that has some are worth pointing out.
    let calls = &reconstruction.session.model_calls;
    if traces.is_some_and(|traces| !traces.calls.is_empty())
        && calls
            .iter()
            .any(|call| call.timestamps.started_at_ms.is_none())
    {
        reconstruction
            .limitations
            .insert(Limitation::TraceRecordsIncomplete);
    }
    Ok(Loaded {
        session: reconstruction.session,
        limitations: reconstruction.limitations,
        records: replayed.changes,
    })
}
