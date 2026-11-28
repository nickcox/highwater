use super::{
    totals::{SessionTotal, TotalKey},
    AppError, Harness, SessionFile,
};
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs::{self, File},
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, RwLock,
    },
    time::UNIX_EPOCH,
};

#[cfg(test)]
mod tests;

#[derive(Debug, Clone)]
pub(super) struct CatalogSnapshot {
    pub(super) generation: String,
    pub(super) revision: u64,
    pub(super) sessions: Arc<[SessionFile]>,
    pub(super) total_keys: Arc<HashSet<TotalKey>>,
    /// An entry with no total means the worker checked this stamp and found no figure.
    pub(super) totals: Arc<HashMap<TotalKey, Option<SessionTotal>>>,
}

#[derive(Debug)]
pub(super) struct SessionCatalog {
    pub(super) snapshot: RwLock<CatalogSnapshot>,
    pub(super) sessions_changed: tokio::sync::Notify,
}

impl SessionCatalog {
    pub(super) fn new(generation: String, sessions: Vec<SessionFile>) -> Self {
        Self {
            snapshot: RwLock::new(CatalogSnapshot {
                generation,
                revision: 0,
                total_keys: Arc::new(sessions.iter().filter_map(TotalKey::of).collect()),
                totals: Arc::default(),
                sessions: Arc::from(sessions.into_boxed_slice()),
            }),
            sessions_changed: tokio::sync::Notify::new(),
        }
    }

    pub(super) fn snapshot(&self) -> Result<CatalogSnapshot, AppError> {
        self.snapshot
            .read()
            .map(|snapshot| snapshot.clone())
            .map_err(|_| AppError::Message("session catalogue is unavailable".into()))
    }

    pub(super) fn install(&self, sessions: Vec<SessionFile>) -> Result<bool, AppError> {
        let sessions: Arc<[SessionFile]> = Arc::from(sessions.into_boxed_slice());
        let mut snapshot = self
            .snapshot
            .write()
            .map_err(|_| AppError::Message("session catalogue is unavailable".into()))?;
        if snapshot.sessions.as_ref() == sessions.as_ref() {
            return Ok(false);
        }
        snapshot.revision = snapshot
            .revision
            .checked_add(1)
            .ok_or_else(|| AppError::Message("session catalogue revision exhausted".into()))?;
        let keys: HashSet<_> = sessions.iter().filter_map(TotalKey::of).collect();
        Arc::make_mut(&mut snapshot.totals).retain(|key, _| keys.contains(key));
        snapshot.total_keys = Arc::new(keys);
        snapshot.sessions = sessions;
        self.sessions_changed.notify_one();
        Ok(true)
    }

    pub(super) fn install_totals(
        &self,
        mut totals: Vec<(TotalKey, Option<SessionTotal>)>,
    ) -> Result<Option<u64>, AppError> {
        if totals.is_empty() {
            return Ok(None);
        }
        let mut snapshot = self
            .snapshot
            .write()
            .map_err(|_| AppError::Message("session catalogue is unavailable".into()))?;
        totals.retain(|(key, total)| {
            snapshot.total_keys.contains(key) && snapshot.totals.get(key) != Some(total)
        });
        if totals.is_empty() {
            return Ok(None);
        }
        snapshot.revision = snapshot
            .revision
            .checked_add(1)
            .ok_or_else(|| AppError::Message("session catalogue revision exhausted".into()))?;
        Arc::make_mut(&mut snapshot.totals).extend(totals);
        Ok(Some(snapshot.revision))
    }
}

pub(super) fn canonical_root(root: &Path) -> Result<PathBuf, AppError> {
    let canonical = fs::canonicalize(root).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            AppError::Message("session root does not exist".into())
        } else {
            AppError::Io(error)
        }
    })?;
    if !fs::metadata(&canonical)?.is_dir() {
        return Err(AppError::Message("session root is not a directory".into()));
    }
    Ok(canonical)
}

#[derive(Clone)]
pub(super) struct ListingMetadata {
    first_prompt: Option<String>,
    has_responses: bool,
    reference: String,
    display_name: String,
    working_directory: Option<String>,
    started_at: Option<DateTime<Utc>>,
}

fn session_listing_metadata(path: &Path, file_name: &str) -> std::io::Result<ListingMetadata> {
    const MAX_LISTING_BYTES: u64 = 1024 * 1024;
    let mut reader = BufReader::new(File::open(path)?);
    let mut raw = Vec::new();
    let mut bytes = 0_u64;
    let mut line_number = 0;
    let mut first_line = None;
    let mut header = None;
    let mut first_prompt = None;
    let mut prompt_seen = false;
    let mut has_responses = false;
    let mut name = None;
    loop {
        raw.clear();
        if reader.read_until(b'\n', &mut raw)? == 0 {
            break;
        }
        bytes = bytes.saturating_add(raw.len() as u64);
        line_number += 1;
        let Ok(line) = std::str::from_utf8(&raw) else {
            continue;
        };
        if line_number == 1 {
            first_line = Some(line.trim_end_matches(['\n', '\r']).to_owned());
        }
        let needs_header = line_number <= 5 && header.is_none();
        let needs_messages = bytes <= MAX_LISTING_BYTES && (!prompt_seen || !has_responses);
        // Names can occur anywhere. Beyond the bounded message search, only lines
        // containing this record type are parsed, not large assistant/tool records.
        let needs_name = line.contains("\"session_info\"");
        if !needs_header && !needs_messages && !needs_name {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        match value.get("type").and_then(Value::as_str) {
            Some("session") if needs_header => header = Some(value),
            Some("session_info") => {
                if let Some(text) = value
                    .get("name")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|text| !text.is_empty())
                {
                    name = Some(text.chars().take(160).collect::<String>());
                }
            }
            Some("message") if needs_messages => {
                has_responses |= value["message"]["role"] == "assistant";
                if !prompt_seen {
                    if let Some(content) = crate::pi::reconstruct::typed_user_message(&value) {
                        prompt_seen = true;
                        let text = content
                            .parts
                            .iter()
                            .filter_map(|part| match part {
                                crate::domain::ContentPart::Text(text) => Some(text.as_str()),
                                _ => None,
                            })
                            .collect::<Vec<_>>()
                            .join(" ");
                        first_prompt = crate::discovery::compact_prompt(&text);
                    }
                }
            }
            _ => {}
        }
    }
    // Keep metadata from old untyped headers, but never use a title record as a header.
    let header = header.or_else(|| {
        first_line
            .as_deref()
            .and_then(|line| serde_json::from_str::<Value>(line).ok())
            .filter(|value| value.get("type").is_none())
    });
    let native_id = header
        .as_ref()
        .filter(|value| value.get("type").and_then(Value::as_str) == Some("session"))
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty());
    let mut hasher = blake3::Hasher::new_derive_key("Highwater Pi session reference v1");
    if let Some(id) = native_id {
        hasher.update(b"id\0");
        hasher.update(id.as_bytes());
    } else {
        // Incomplete/invalid files remain discoverable without exposing a path.
        // Their fallback is header-based, not a portable native session identity.
        hasher.update(b"header\0");
        hasher.update(first_line.as_deref().unwrap_or_default().as_bytes());
    }
    let digest = hasher.finalize().to_hex();
    let reference = format!("pi-{}", &digest.as_str()[..12]);
    let working_directory = header
        .as_ref()
        .and_then(|value| value.get("cwd"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    let started_at = header
        .as_ref()
        .and_then(|value| value.get("timestamp"))
        .and_then(Value::as_str)
        .and_then(|timestamp| timestamp.parse::<DateTime<Utc>>().ok());
    let stem = file_name.strip_suffix(".jsonl").unwrap_or(file_name);
    let suffix = stem
        .rsplit_once('_')
        .map(|(_, suffix)| suffix)
        .filter(|suffix| !suffix.is_empty())
        .map(|suffix| suffix.chars().take(8).collect::<String>());
    let project = working_directory
        .as_deref()
        .and_then(|directory| Path::new(directory).file_name())
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty());
    // The browser adds the start time in the viewer's own time zone.
    let display_name = name.unwrap_or_else(|| match (project, suffix) {
        (Some(project), Some(suffix)) => format!("{project} · {suffix}"),
        (Some(project), None) => project.to_owned(),
        _ => stem.chars().take(48).collect(),
    });
    Ok(ListingMetadata {
        first_prompt,
        has_responses,
        reference,
        display_name,
        working_directory,
        started_at,
    })
}

#[derive(Debug, thiserror::Error)]
pub(super) enum ScanError {
    #[error("transient catalogue discovery failure: {0}")]
    Transient(String),
    #[error("catalogue discovery cancelled")]
    Cancelled,
}

pub(super) struct PiFile {
    path: PathBuf,
    stamp: crate::discovery::FileStamp,
}
impl crate::discovery::ListedFile for PiFile {
    type Key = crate::discovery::FileStamp;
    fn path(&self) -> &Path {
        &self.path
    }
    fn key(&self) -> Self::Key {
        self.stamp
    }
    fn stamp(&self) -> Self::Key {
        self.stamp
    }
}
pub(super) type PiListingCache = crate::discovery::ListingCache<PiFile, ListingMetadata>;

#[cfg(test)]
pub(super) fn discover(
    root: &Path,
    cancelled: Option<&AtomicBool>,
) -> Result<Vec<SessionFile>, ScanError> {
    discover_cached(root, cancelled, &mut PiListingCache::default())
}

pub(super) fn discover_cached(
    root: &Path,
    cancelled: Option<&AtomicBool>,
    cache: &mut PiListingCache,
) -> Result<Vec<SessionFile>, ScanError> {
    let mut output = Vec::new();
    let mut identities = HashSet::new();
    let mut files = Vec::new();
    fn walk(
        root: &Path,
        path: &Path,
        output: &mut Vec<SessionFile>,
        identities: &mut HashSet<PathBuf>,
        cancelled: Option<&AtomicBool>,
        cache: &mut PiListingCache,
        files: &mut Vec<PiFile>,
    ) -> Result<(), ScanError> {
        if cancelled.is_some_and(|value| value.load(Ordering::Acquire)) {
            return Err(ScanError::Cancelled);
        }
        let entries =
            fs::read_dir(path).map_err(|error| ScanError::Transient(error.to_string()))?;
        for entry in entries {
            if cancelled.is_some_and(|value| value.load(Ordering::Acquire)) {
                return Err(ScanError::Cancelled);
            }
            let entry = entry.map_err(|error| ScanError::Transient(error.to_string()))?;
            let candidate = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                walk(
                    root, &candidate, output, identities, cancelled, cache, files,
                )?;
                continue;
            }
            if !file_type.is_file()
                || candidate
                    .extension()
                    .and_then(|extension| extension.to_str())
                    != Some("jsonl")
            {
                continue;
            }
            let metadata = entry
                .metadata()
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            let before = fs::symlink_metadata(&candidate)
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            if !before.file_type().is_file() {
                return Err(ScanError::Transient(
                    "session entry changed type during discovery".into(),
                ));
            }
            let canonical = fs::canonicalize(&candidate)
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            if !canonical.starts_with(root) {
                return Err(ScanError::Transient(
                    "session entry escaped the watched root".into(),
                ));
            }
            let after = fs::symlink_metadata(&candidate)
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            if !after.file_type().is_file() {
                return Err(ScanError::Transient(
                    "session entry changed type during discovery".into(),
                ));
            }
            if !identities.insert(canonical.clone()) {
                continue;
            }
            let file_name = canonical
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default()
                .to_owned();
            let file = PiFile {
                path: canonical.clone(),
                stamp: crate::discovery::FileStamp::of(&after),
            };
            let listing = cache
                .listing(&file, |file| {
                    session_listing_metadata(&file.path, &file_name)
                })
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            files.push(file);
            let Some(listing) = listing.filter(|listing| listing.has_responses) else {
                continue;
            };
            let modified_nanos = metadata
                .modified()
                .ok()
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_nanos());
            output.push(SessionFile {
                first_prompt: listing.first_prompt,
                id: listing.reference,
                path: canonical.to_string_lossy().into_owned(),
                file_name,
                display_name: listing.display_name,
                working_directory: listing.working_directory,
                started_at: listing.started_at,
                byte_size: Some(metadata.len()),
                modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
                modified_nanos,
                harness: Harness::Pi,
                parent_reference: None,
                forked_from_reference: None,
                subagent_type: None,
                locator: None,
                source_revision: None,
            });
        }
        Ok(())
    }
    walk(
        root,
        root,
        &mut output,
        &mut identities,
        cancelled,
        cache,
        &mut files,
    )?;
    cache.retain(&files);
    output.sort_by(|left, right| {
        right
            .modified_nanos
            .cmp(&left.modified_nanos)
            .then_with(|| left.id.cmp(&right.id))
    });
    Ok(output)
}
