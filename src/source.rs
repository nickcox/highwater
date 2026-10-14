//! Source-neutral local session loading. Catalogue authorization and caching
//! remain server responsibilities; never deserialize these locators from HTTP.

use crate::{
    domain::{NormalizedSession, SourceError},
    opencode::{
        replay::{self, ReplayError, ReplayLimitation},
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
    // Preserved for non-cache source consumers. HTTP revalidates the snapshot
    // before replay so a cache hit need not reconstruct the conversation again.
    #[allow(dead_code)]
    pub database_revision: Option<blake3::Hash>,
    #[allow(dead_code)]
    pub replay_limitations: BTreeSet<ReplayLimitation>,
    /// Coverage codes for a file source whose reconstruction is partial.
    /// OpenCode reports its own through `analyze_reconstructed`.
    pub coverage_codes: Option<Vec<String>>,
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
}

/// Synchronous, intended for a bounded blocking worker. No source mutation.
/// Pi's file revision is managed by its existing pre/post-read fingerprint;
/// OpenCode returns the revision of its committed SQLite transaction instead.
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
                database_revision: None,
                replay_limitations: BTreeSet::new(),
                coverage_codes: None,
            })
        }
        SessionLocator::OpenCode {
            database,
            native_id,
        } => {
            let snapshot = storage::load_session(database, native_id, cancelled)?;
            let revision = snapshot.revision;
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
                database_revision: Some(revision),
                replay_limitations: reconstructed.limitations,
                coverage_codes: None,
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
                database_revision: None,
                replay_limitations: BTreeSet::new(),
                coverage_codes: Some(
                    loaded
                        .limitations
                        .into_iter()
                        .map(|limitation| limitation.as_str().to_owned())
                        .collect(),
                ),
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
                database_revision: None,
                replay_limitations: BTreeSet::new(),
                coverage_codes: Some(
                    loaded
                        .limitations
                        .into_iter()
                        .map(|limitation| limitation.as_str().to_owned())
                        .collect(),
                ),
            })
        }
    }
}

/// Preserve source replay qualifications when assembling public analysis.
/// Callers must not serialize an OpenCode normalized session without this report.
pub(crate) fn analyze_reconstructed(
    reconstructed: replay::ReplayResult,
    config: crate::analysis::AnalysisConfig,
) -> Result<crate::api::Analysis, crate::analysis::AnalysisError> {
    let mut analysis = crate::analysis::analyze(reconstructed.session, config)?;
    analysis.reconstruction = Some(crate::api::ReconstructionCoverage {
        status: "partial",
        explanation_codes: reconstructed
            .limitations
            .into_iter()
            .map(|code| code.as_str().to_owned())
            .collect(),
    });
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
        assert!(loaded.database_revision.is_none());
        assert!(loaded.replay_limitations.is_empty());
    }
}
