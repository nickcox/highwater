//! Read-only VS Code Copilot Chat sessions. See plans/vscode-copilot-implementation-plan.md.

mod change_log;
pub(crate) mod discovery;
mod reconstruct;

#[cfg(test)]
mod tests;

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
    let reconstruction = reconstruct::reconstruct(&replayed.session, working_directory)?;
    Ok(Loaded {
        session: reconstruction.session,
        limitations: reconstruction.limitations,
        records: replayed.changes,
    })
}
