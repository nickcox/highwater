//! Mixed local source discovery with per-source last-good catalogue retention.

use super::{
    catalog::{canonical_root, discover, ScanError},
    watcher::WatchSignals,
    AppError, SessionFile,
};
use crate::{
    claude_code::{
        discovery::{self, DiscoveryError, Listing, ListingCache, TranscriptFile},
        FileKind,
    },
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
    pub claude_roots: Vec<PathBuf>,
}

impl SourceSet {
    /// An explicit `--session-root` is Pi only: it turns off the OpenCode and
    /// Claude Code defaults unless their own flags are also given.
    pub fn configured(
        pi: Option<PathBuf>,
        databases: Vec<PathBuf>,
        claude_roots: Vec<PathBuf>,
        home: &Path,
        data_home: &Path,
        claude_config_dir: Option<&Path>,
    ) -> Result<Self, AppError> {
        let explicit_pi = pi.is_some();
        let default_databases = databases.is_empty() && !explicit_pi;
        let default_claude = claude_roots.is_empty() && !explicit_pi;
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
        let claude_candidates = if default_claude {
            let default = claude_config_dir
                .map_or_else(|| home.join(".claude"), Path::to_path_buf)
                .join("projects");
            if default.exists() {
                vec![default]
            } else {
                Vec::new()
            }
        } else {
            claude_roots
        };
        let mut claude_roots = Vec::new();
        for root in claude_candidates {
            let root = canonical_root(&root)?;
            if !claude_roots.contains(&root) {
                claude_roots.push(root);
            }
        }
        if pi_root.is_none() && databases.is_empty() && claude_roots.is_empty() {
            return Err(AppError::Message(
                "no local sessions found; configure --session-root, --opencode-db or --claude-root"
                    .into(),
            ));
        }
        Ok(Self {
            pi_root,
            databases,
            claude_roots,
        })
    }
}

pub(super) fn reference(native_id: &str) -> String {
    let mut hash = blake3::Hasher::new_derive_key("TokenPlume OpenCode session reference v1");
    hash.update(b"id\0");
    hash.update(native_id.as_bytes());
    format!("opencode-{}", &hash.finalize().to_hex()[..12])
}

/// Main sessions and subagents get different references, because a subagent's
/// records carry its parent's session ID.
pub(super) fn claude_code_reference(session_id: &str, agent_id: Option<&str>) -> String {
    let mut hash = blake3::Hasher::new_derive_key("TokenPlume Claude Code session reference v1");
    hash.update(b"id\0");
    hash.update(session_id.as_bytes());
    if let Some(agent_id) = agent_id {
        hash.update(b"\0agent\0");
        hash.update(agent_id.as_bytes());
    }
    format!("claude-code-{}", &hash.finalize().to_hex()[..12])
}

/// A transcript without a session ID (for example one whose first record is
/// still being written) is listed under a reference derived from its file name.
fn claude_code_fallback_reference(file: &TranscriptFile) -> String {
    let mut hash = blake3::Hasher::new_derive_key("TokenPlume Claude Code session reference v1");
    hash.update(b"file\0");
    hash.update(file.path.file_name().unwrap_or_default().as_encoded_bytes());
    format!("claude-code-{}", &hash.finalize().to_hex()[..12])
}

fn claude_code_entry(file: TranscriptFile, listing: Listing) -> SessionFile {
    let file_name = file
        .path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let session_id = listing.session_id.as_deref();
    let subagent = file.kind == FileKind::Subagent;
    let agent_id = listing.agent_id.as_deref().filter(|_| subagent);
    let id = session_id.map_or_else(
        || claude_code_fallback_reference(&file),
        |session_id| claude_code_reference(session_id, agent_id),
    );
    let short_id = session_id.map(|id| id.chars().take(8).collect::<String>());
    let project = listing
        .working_directory
        .as_deref()
        .and_then(|directory| Path::new(directory).file_name())
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty());
    let fallback = || match (project, short_id.as_deref()) {
        (Some(project), Some(short_id)) => format!("{project} · {short_id}"),
        (Some(project), None) => project.to_owned(),
        (None, Some(short_id)) => short_id.to_owned(),
        (None, None) => file_name
            .trim_end_matches(".jsonl")
            .chars()
            .take(48)
            .collect(),
    };
    let display_name = if subagent {
        listing
            .subagent
            .as_ref()
            .and_then(|subagent| subagent.description.clone())
            .or_else(|| listing.title.clone())
            .or_else(|| agent_id.map(|agent_id| format!("Subagent · {agent_id}")))
            .unwrap_or_else(fallback)
    } else {
        listing.title.clone().unwrap_or_else(fallback)
    };
    SessionFile {
        id,
        path: String::new(),
        file_name,
        display_name: display_name.chars().take(160).collect(),
        working_directory: listing.working_directory,
        started_at: listing
            .started_at
            .as_deref()
            .and_then(|timestamp| timestamp.parse::<DateTime<Utc>>().ok()),
        byte_size: Some(file.stamp.byte_size),
        modified_at: file.modified.map(DateTime::<Utc>::from),
        modified_nanos: file.stamp.modified_nanos,
        harness: "claude-code".into(),
        parent_reference: session_id
            .filter(|_| subagent)
            .map(|session_id| claude_code_reference(session_id, None)),
        subagent_type: listing
            .subagent
            .as_ref()
            .and_then(|subagent| subagent.agent_type.as_deref())
            .map(|agent_type| agent_type.chars().take(80).collect()),
        locator: Some(SessionLocator::ClaudeCodeFile {
            path: file.path,
            kind: file.kind,
        }),
        source_revision: None,
    }
}

struct ClaudeCodeSource {
    root: PathBuf,
    listings: ListingCache,
    last_good: Vec<SessionFile>,
}

impl ClaudeCodeSource {
    fn discover(&mut self, cancelled: &AtomicBool) -> Result<Vec<SessionFile>, DiscoveryError> {
        let files = discovery::find_files(&self.root, Some(cancelled))?;
        self.listings.retain(&files);
        let mut entries = Vec::with_capacity(files.len());
        for file in files {
            if cancelled.load(Ordering::Acquire) {
                return Err(DiscoveryError::Cancelled);
            }
            if let Some(listing) = self.listings.listing(&file)? {
                entries.push(claude_code_entry(file, listing));
            }
        }
        Ok(entries)
    }
}

struct DatabaseSource {
    path: PathBuf,
    tracker: Option<CatalogTracker>,
    last_good: Vec<SessionFile>,
}
struct DiscoveryState {
    pi_last_good: Vec<SessionFile>,
    databases: Vec<DatabaseSource>,
    claude_code: Vec<ClaudeCodeSource>,
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
                claude_code: sources
                    .claude_roots
                    .iter()
                    .map(|root| ClaudeCodeSource {
                        root: root.clone(),
                        listings: ListingCache::default(),
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
                            subagent_type: None,
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
        for source in &mut state.claude_code {
            if cancelled.load(Ordering::Acquire) {
                return Err(ScanError::Cancelled);
            }
            match fs::metadata(&source.root) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    source.last_good.clear();
                    continue;
                }
                Err(_) => {
                    failed = true;
                    continue;
                }
                Ok(_) => {}
            }
            match source.discover(&cancelled) {
                Ok(entries) => source.last_good = entries,
                Err(DiscoveryError::Cancelled) => return Err(ScanError::Cancelled),
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
        // Nested or repeated roots can find the same transcript twice.
        let mut claude_code_paths = HashSet::new();
        for source in &state.claude_code {
            entries.extend(
                source
                    .last_good
                    .iter()
                    .filter(|entry| match &entry.locator {
                        Some(SessionLocator::ClaudeCodeFile { path, .. }) => {
                            claude_code_paths.insert(path.clone())
                        }
                        _ => true,
                    })
                    .cloned(),
            );
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
