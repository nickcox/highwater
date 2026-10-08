//! Mixed local source discovery with per-source last-good catalogue retention.

use super::{
    catalog::{canonical_root, discover, ScanError},
    watcher::WatchSignals,
    AppError, SessionFile,
};
use crate::{
    opencode::storage::{self, CatalogTracker},
    source::SessionLocator,
};
use chrono::{DateTime, Utc};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

pub(super) struct SourceSet {
    pub pi_root: Option<PathBuf>,
    pub databases: Vec<PathBuf>,
}

impl SourceSet {
    pub fn configured(
        pi: Option<PathBuf>,
        databases: Vec<PathBuf>,
        home: &Path,
        data_home: &Path,
    ) -> Result<Self, AppError> {
        let explicit_pi = pi.is_some();
        let default_databases = databases.is_empty() && !explicit_pi;
        let pi = pi.unwrap_or_else(|| home.join(".pi/agent/sessions"));
        let pi_root = if explicit_pi || pi.exists() {
            Some(canonical_root(&pi)?)
        } else {
            None
        };
        let candidates = if default_databases {
            ["opencode.db", "opencode-stable.db"]
                .into_iter()
                .map(|name| data_home.join("opencode").join(name))
                .filter(|path| path.exists())
                .collect()
        } else {
            databases
        };
        let mut identities = HashSet::new();
        let mut databases = Vec::new();
        for path in candidates {
            let path = fs::canonicalize(path).map_err(|_| {
                AppError::Message("configured opencode database cannot be read".into())
            })?;
            if !fs::metadata(&path)?.is_file() {
                return Err(AppError::Message(
                    "configured opencode database is not a file".into(),
                ));
            }
            if identities.insert(path.clone()) {
                databases.push(path);
            }
        }
        if pi_root.is_none() && databases.is_empty() {
            return Err(AppError::Message(
                "no local sessions found; configure --session-root or --opencode-db".into(),
            ));
        }
        Ok(Self { pi_root, databases })
    }
}

pub(super) fn reference(native_id: &str) -> String {
    let mut hash = blake3::Hasher::new_derive_key("TokenPlume OpenCode session reference v1");
    hash.update(b"id\0");
    hash.update(native_id.as_bytes());
    format!("opencode-{}", &hash.finalize().to_hex()[..12])
}

struct DatabaseSource {
    path: PathBuf,
    tracker: Option<CatalogTracker>,
    last_good: Vec<SessionFile>,
}
struct DiscoveryState {
    pi_last_good: Vec<SessionFile>,
    databases: Vec<DatabaseSource>,
}

pub(super) struct MixedScanner {
    pi_root: Option<PathBuf>,
    state: Mutex<DiscoveryState>,
    signals: Arc<WatchSignals>,
}

impl MixedScanner {
    pub fn new(sources: &SourceSet, signals: Arc<WatchSignals>) -> Self {
        Self {
            pi_root: sources.pi_root.clone(),
            signals,
            state: Mutex::new(DiscoveryState {
                pi_last_good: Vec::new(),
                databases: sources
                    .databases
                    .iter()
                    .map(|path| DatabaseSource {
                        path: path.clone(),
                        tracker: None,
                        last_good: Vec::new(),
                    })
                    .collect(),
            }),
        }
    }

    /// One scanner runs at a time. Its mutex never crosses an await; source work
    /// runs on the scan coordinator's blocking worker, not an async executor.
    pub fn scan(&self, cancelled: Arc<AtomicBool>) -> Result<Vec<SessionFile>, ScanError> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| ScanError::Transient("source catalogue unavailable".into()))?;
        let mut failed = false;
        if let Some(root) = &self.pi_root {
            match fs::metadata(root) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    state.pi_last_good.clear()
                }
                _ => match discover(root, Some(&cancelled)) {
                    Ok(entries) => state.pi_last_good = entries,
                    Err(ScanError::Cancelled) => return Err(ScanError::Cancelled),
                    Err(_) => failed = true,
                },
            }
        }
        for source in &mut state.databases {
            if cancelled.load(Ordering::Acquire) {
                return Err(ScanError::Cancelled);
            }
            match fs::metadata(&source.path) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    source.last_good.clear();
                    // Retain the tracker revision across deletion/recreation.
                    continue;
                }
                Err(_) => {
                    failed = true;
                    continue;
                }
                Ok(_) => {}
            }
            let result = (|| {
                if source.tracker.is_none() {
                    source.tracker = Some(CatalogTracker::new(&source.path)?);
                }
                let revision = source
                    .tracker
                    .as_mut()
                    .ok_or(storage::StorageError::InvalidRecords)?
                    .observe(&source.path)?;
                let sessions = storage::discover(&source.path, Some(Arc::clone(&cancelled)))?;
                Ok::<_, storage::StorageError>(
                    sessions
                        .into_iter()
                        .map(|session| SessionFile {
                            id: reference(&session.id),
                            path: String::new(),
                            file_name: String::new(),
                            display_name: session.title.chars().take(160).collect(),
                            working_directory: Some(session.directory),
                            started_at: DateTime::<Utc>::from_timestamp_millis(
                                session.created_at_ms,
                            ),
                            byte_size: None,
                            modified_at: DateTime::<Utc>::from_timestamp_millis(
                                session.updated_at_ms,
                            ),
                            modified_nanos: None,
                            harness: "opencode".into(),
                            parent_reference: session.parent_id.as_deref().map(reference),
                            locator: Some(SessionLocator::OpenCode {
                                database: source.path.clone(),
                                native_id: session.id,
                            }),
                            source_revision: Some(revision),
                        })
                        .collect::<Vec<_>>(),
                )
            })();
            match result {
                Ok(entries) => source.last_good = entries,
                Err(storage::StorageError::Cancelled) => return Err(ScanError::Cancelled),
                Err(_) => failed = true,
            }
        }
        // A transient source read failure must not permanently disable healthy
        // filesystem watchers. A subsequent successful scan clears this state.
        self.signals
            .sources_degraded
            .store(failed, Ordering::Release);
        let mut entries = state.pi_last_good.clone();
        for source in &state.databases {
            entries.extend(source.last_good.iter().cloned());
        }
        entries.sort_by(|left, right| {
            right
                .modified_at
                .cmp(&left.modified_at)
                .then_with(|| left.id.cmp(&right.id))
        });
        Ok(entries)
    }
}
