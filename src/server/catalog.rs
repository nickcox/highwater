use super::{AppError, SessionFile};
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::{
    collections::HashSet,
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
#[path = "catalog_tests.rs"]
mod tests;

#[derive(Debug, Clone)]
pub(super) struct CatalogSnapshot {
    pub(super) generation: String,
    pub(super) revision: u64,
    pub(super) sessions: Arc<[SessionFile]>,
}

#[derive(Debug)]
pub(super) struct SessionCatalog {
    pub(super) snapshot: RwLock<CatalogSnapshot>,
}

impl SessionCatalog {
    pub(super) fn new(generation: String, sessions: Vec<SessionFile>) -> Self {
        Self {
            snapshot: RwLock::new(CatalogSnapshot {
                generation,
                revision: 0,
                sessions: Arc::from(sessions.into_boxed_slice()),
            }),
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
        snapshot.sessions = sessions;
        Ok(true)
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

struct ListingMetadata {
    reference: String,
    display_name: String,
    working_directory: Option<String>,
    started_at: Option<DateTime<Utc>>,
}

fn session_listing_metadata(path: &Path, file_name: &str) -> std::io::Result<ListingMetadata> {
    let first_line = BufReader::new(File::open(path)?)
        .lines()
        .next()
        .transpose()?;
    let header = first_line
        .as_deref()
        .and_then(|line| serde_json::from_str::<Value>(line).ok());
    let native_id = header
        .as_ref()
        .filter(|value| value.get("type").and_then(Value::as_str) == Some("session"))
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty());
    let mut hasher = blake3::Hasher::new_derive_key("TokenPlume Pi session reference v1");
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
    let timestamp_label = started_at.map(|timestamp| timestamp.format("%b %d %H:%M").to_string());
    let display_name = match (project, timestamp_label, suffix) {
        (Some(project), Some(timestamp), Some(suffix)) => {
            format!("{project} · {timestamp} · {suffix}")
        }
        (Some(project), Some(timestamp), None) => format!("{project} · {timestamp}"),
        (Some(project), None, Some(suffix)) => format!("{project} · {suffix}"),
        _ => stem.chars().take(48).collect(),
    };
    Ok(ListingMetadata {
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

pub(super) fn discover(
    root: &Path,
    cancelled: Option<&AtomicBool>,
) -> Result<Vec<SessionFile>, ScanError> {
    let mut output = Vec::new();
    let mut identities = HashSet::new();
    fn walk(
        root: &Path,
        path: &Path,
        output: &mut Vec<SessionFile>,
        identities: &mut HashSet<PathBuf>,
        cancelled: Option<&AtomicBool>,
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
                walk(root, &candidate, output, identities, cancelled)?;
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
            let listing = session_listing_metadata(&canonical, &file_name)
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            let modified_nanos = metadata
                .modified()
                .ok()
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_nanos());
            output.push(SessionFile {
                id: listing.reference,
                path: canonical.to_string_lossy().into_owned(),
                file_name,
                display_name: listing.display_name,
                working_directory: listing.working_directory,
                started_at: listing.started_at,
                byte_size: metadata.len(),
                modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
                modified_nanos,
            });
        }
        Ok(())
    }
    walk(root, root, &mut output, &mut identities, cancelled)?;
    output.sort_by(|left, right| {
        right
            .modified_nanos
            .cmp(&left.modified_nanos)
            .then_with(|| left.id.cmp(&right.id))
    });
    Ok(output)
}
