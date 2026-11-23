//! Source-neutral local session loading. Catalogue authorization and caching
//! remain server responsibilities; never deserialize these locators from HTTP.

use crate::{
    domain::{Harness, Limitation, NormalizedSession, SourceError},
    opencode::{
        replay::{self, ReplayError},
        storage::{self, StorageError},
        usage::OutputAccounting,
    },
    pi::PiSourceAdapter,
};
use std::{
    collections::BTreeSet,
    path::PathBuf,
    sync::{atomic::AtomicBool, Arc},
};
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) enum SessionLocator {
    PiFile(PathBuf),
    OpenCode {
        database: PathBuf,
        native_id: String,
    },
    ClaudeCodeFile {
        path: PathBuf,
        kind: crate::claude_code::FileKind,
    },
    VsCodeCopilotFile {
        path: PathBuf,
    },
    CodexFile {
        path: PathBuf,
    },
    /// A Copilot session's `events.jsonl`.
    CopilotFile {
        path: PathBuf,
    },
}

/// The portable reference an OpenCode session is listed under.
pub(crate) fn opencode_reference(native_id: &str) -> String {
    Harness::OpenCode.session_reference(|hash| {
        hash.update(b"id\0");
        hash.update(native_id.as_bytes());
    })
}

/// Main sessions and subagents get different references, because a subagent's
/// records carry its parent's session ID.
pub(crate) fn claude_code_reference(session_id: &str, agent_id: Option<&str>) -> String {
    Harness::ClaudeCode.session_reference(|hash| {
        hash.update(b"id\0");
        hash.update(session_id.as_bytes());
        if let Some(agent_id) = agent_id {
            hash.update(b"\0agent\0");
            hash.update(agent_id.as_bytes());
        }
    })
}

/// The portable reference a Copilot session is listed under.
pub(crate) fn copilot_reference(session_id: &str) -> String {
    Harness::Copilot.session_reference(|hash| {
        hash.update(b"id\0");
        hash.update(session_id.as_bytes());
    })
}

/// The portable reference a Codex thread is listed under.
pub(crate) fn codex_reference(thread_id: &str) -> String {
    Harness::Codex.session_reference(|hash| {
        hash.update(b"id\0");
        hash.update(thread_id.as_bytes());
    })
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct LoadStats {
    pub records: usize,
    pub selected_records: usize,
}

#[derive(Debug)]
pub(crate) struct LoadedSession {
    pub normalized: NormalizedSession,
    pub stats: LoadStats,
    /// None for Pi; other sources report partial coverage even with no limitations.
    pub limitations: Option<BTreeSet<Limitation>>,
}

#[derive(Debug, Error)]
pub(crate) enum LoadError {
    #[error("pi session cannot be loaded")]
    Pi(#[from] SourceError),
    #[error("opencode storage cannot be loaded")]
    Storage(#[from] StorageError),
    #[error("opencode conversation cannot be reconstructed")]
    Replay(#[from] ReplayError),
    #[error("claude code transcript cannot be loaded")]
    ClaudeCode(#[source] SourceError),
    #[error("vs code copilot session cannot be loaded")]
    VsCodeCopilot(#[source] SourceError),
    #[error("codex session cannot be loaded")]
    Codex(#[source] SourceError),
    #[error("copilot session cannot be loaded")]
    Copilot(#[source] SourceError),
}

/// Synchronous, intended for a bounded blocking worker. No source mutation.
pub(crate) fn load(
    locator: &SessionLocator,
    cancelled: Option<Arc<AtomicBool>>,
) -> Result<LoadedSession, LoadError> {
    match locator {
        SessionLocator::PiFile(path) => {
            let (normalized, stats) = PiSourceAdapter.parse_path_with_stats(path)?;
            Ok(LoadedSession {
                normalized,
                stats: LoadStats {
                    records: stats.entries,
                    selected_records: stats.selected_entries,
                },
                limitations: None,
            })
        }
        SessionLocator::OpenCode {
            database,
            native_id,
        } => {
            let snapshot = storage::load_session(database, native_id, cancelled)?;
            let records = snapshot
                .messages
                .iter()
                .map(|message| 1 + message.parts.len())
                .sum();
            // Session creation version is not enough to choose output accounting.
            // Keep ambiguous output unavailable instead of double-counting reasoning.
            let reconstructed = replay::reconstruct(snapshot, OutputAccounting::Unknown)?;
            Ok(LoadedSession {
                normalized: reconstructed.session,
                stats: LoadStats {
                    records,
                    selected_records: records,
                },
                limitations: Some(reconstructed.limitations),
            })
        }
        SessionLocator::ClaudeCodeFile { path, kind } => {
            let loaded = crate::claude_code::load(path, *kind).map_err(LoadError::ClaudeCode)?;
            Ok(LoadedSession {
                normalized: loaded.session,
                stats: LoadStats {
                    records: loaded.records,
                    selected_records: loaded.selected_records,
                },
                limitations: Some(loaded.limitations),
            })
        }
        SessionLocator::VsCodeCopilotFile { path } => {
            let loaded = crate::vscode_copilot::load(path).map_err(LoadError::VsCodeCopilot)?;
            Ok(LoadedSession {
                normalized: loaded.session,
                stats: LoadStats {
                    records: loaded.records,
                    selected_records: loaded.records,
                },
                limitations: Some(loaded.limitations),
            })
        }
        SessionLocator::CodexFile { path } => {
            let loaded = crate::codex::load(path).map_err(LoadError::Codex)?;
            Ok(LoadedSession {
                normalized: loaded.session,
                stats: LoadStats {
                    records: loaded.records,
                    selected_records: loaded.records,
                },
                limitations: Some(loaded.limitations),
            })
        }
        SessionLocator::CopilotFile { path } => {
            let loaded = crate::copilot::load(path).map_err(LoadError::Copilot)?;
            Ok(LoadedSession {
                normalized: loaded.session,
                stats: LoadStats {
                    records: loaded.records,
                    selected_records: loaded.records,
                },
                limitations: Some(loaded.limitations),
            })
        }
    }
}

/// Sets the analysis's reconstruction coverage: none for Pi (`None`), and partial, with the
/// limitations as explanation codes, for every other source, even when it has none.
pub(crate) fn add_reconstruction(
    analysis: &mut crate::api::Analysis,
    limitations: Option<BTreeSet<Limitation>>,
) {
    analysis.reconstruction = limitations.map(|limitations| crate::api::ReconstructionCoverage {
        status: "partial",
        explanation_codes: limitations
            .into_iter()
            .map(|code| code.as_str().to_owned())
            .collect(),
    });
}

/// Analyses an OpenCode replay and adds its limitations as reconstruction coverage.
pub(crate) fn analyze_reconstructed(
    reconstructed: replay::ReplayResult,
    config: crate::analysis::AnalysisConfig,
) -> Result<crate::api::Analysis, crate::analysis::AnalysisError> {
    let mut analysis = crate::analysis::analyze(reconstructed.session, config)?;
    add_reconstruction(&mut analysis, Some(reconstructed.limitations));
    Ok(analysis)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::SessionSourceAdapter;

    #[test]
    fn pi_loading_preserves_existing_normalization_and_stats() {
        let path = PathBuf::from("fixtures/pi/simple.jsonl");
        let loaded = load(&SessionLocator::PiFile(path.clone()), None).expect("source loading");
        let expected = PiSourceAdapter
            .parse(&mut std::io::BufReader::new(
                std::fs::File::open(path).expect("fixture"),
            ))
            .expect("Pi baseline");
        assert_eq!(loaded.normalized.id, expected.id);
        assert_eq!(
            loaded.normalized.model_calls.len(),
            expected.model_calls.len()
        );
        assert_eq!(
            loaded
                .normalized
                .context_items
                .iter()
                .map(|item| &item.id)
                .collect::<Vec<_>>(),
            expected
                .context_items
                .iter()
                .map(|item| &item.id)
                .collect::<Vec<_>>()
        );
        assert!(loaded.stats.records >= loaded.stats.selected_records);
        assert!(loaded.limitations.is_none());
    }
}
