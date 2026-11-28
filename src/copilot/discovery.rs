//! Finds sessions under a Copilot home folder and reads the few fields the catalogue shows,
//! without reconstructing the conversation.

use super::reconstruct::{origin, Origin};
use crate::discovery::{DiscoveryError, FileStamp, ListedFile};
use serde_json::Value;
use std::{
    fs,
    io::{self, BufRead, BufReader},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::SystemTime,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SessionFile {
    /// Canonical path of the session's `events.jsonl`, inside the Copilot home folder.
    pub path: PathBuf,
    pub stamp: FileStamp,
    /// The `workspace.yaml` beside it, which holds the title. `None` when it is missing.
    pub workspace_stamp: Option<FileStamp>,
    pub modified: Option<SystemTime>,
}

/// The fields of `workspace.yaml` that Highwater uses.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct Workspace {
    pub id: Option<String>,
    pub cwd: Option<String>,
    /// The session's title, named by the user or by Copilot.
    pub name: Option<String>,
    /// `github/autopilot` for the Copilot app, `github/cli` for the CLI.
    pub client_name: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct Listing {
    pub first_prompt: Option<String>,
    pub workspace: Workspace,
    /// Whether the main agent recorded the usage of any call. A session without one has
    /// nothing to chart; most are sessions Copilot opened for its own use.
    pub has_responses: bool,
}

/// Sessions are `session-state/<session ID>/events.jsonl`. Symbolic links are not followed.
pub(crate) fn find_files(
    home: &Path,
    cancelled: Option<&AtomicBool>,
) -> Result<Vec<SessionFile>, DiscoveryError> {
    let folder = home.join("session-state");
    let entries = match fs::read_dir(&folder) {
        Ok(entries) => entries.collect::<Result<Vec<_>, _>>()?,
        Err(error) if error.kind() == io::ErrorKind::NotFound => Vec::new(),
        Err(error) => return Err(error.into()),
    };
    let mut files = Vec::new();
    for entry in entries {
        if cancelled.is_some_and(|flag| flag.load(Ordering::Acquire)) {
            return Err(DiscoveryError::Cancelled);
        }
        if !entry.file_type()?.is_dir() {
            continue;
        }
        files.extend(session_file(home, &entry.path())?);
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

/// A folder without `events.jsonl` (a session that never started, or one removed while it
/// is being read) is skipped.
fn session_file(home: &Path, folder: &Path) -> Result<Option<SessionFile>, DiscoveryError> {
    let path = folder.join("events.jsonl");
    match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.is_file() => {}
        Ok(_) => return Ok(None),
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    }
    let canonical = match fs::canonicalize(&path) {
        Ok(canonical) => canonical,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    if !canonical.starts_with(home) {
        return Err(DiscoveryError::OutsideRoot);
    }
    let metadata = fs::metadata(&canonical)?;
    let workspace_stamp = fs::symlink_metadata(folder.join("workspace.yaml"))
        .ok()
        .filter(fs::Metadata::is_file)
        .map(|metadata| FileStamp::of(&metadata));
    Ok(Some(SessionFile {
        path: canonical,
        stamp: FileStamp::of(&metadata),
        workspace_stamp,
        modified: metadata.modified().ok(),
    }))
}

/// Reads `workspace.yaml` from a session folder. A missing or unreadable file, or one that
/// is not a regular file (such as a symbolic link), gives no fields.
pub(crate) fn read_workspace(folder: &Path) -> Workspace {
    let path = folder.join("workspace.yaml");
    if !fs::symlink_metadata(&path).is_ok_and(|metadata| metadata.is_file()) {
        return Workspace::default();
    }
    fs::read_to_string(path)
        .map(|contents| parse_workspace(&contents))
        .unwrap_or_default()
}

/// Identifies the version of the `workspace.yaml` beside a session's `events.jsonl`, so an
/// analysis is made again when the session is renamed.
pub(crate) fn workspace_fingerprint(events: &Path) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    let path = events.with_file_name("workspace.yaml");
    match fs::symlink_metadata(&path)
        .ok()
        .filter(fs::Metadata::is_file)
    {
        Some(metadata) => {
            let stamp = FileStamp::of(&metadata);
            hasher.update(&stamp.byte_size.to_le_bytes());
            hasher.update(&stamp.modified_nanos.unwrap_or(0).to_le_bytes());
        }
        None => {
            hasher.update(b"missing");
        }
    }
    *hasher.finalize().as_bytes()
}

/// `workspace.yaml` is a flat list of `key: value` lines. Only plain and quoted scalar
/// values are read; anything else is ignored.
pub(crate) fn parse_workspace(contents: &str) -> Workspace {
    let mut workspace = Workspace::default();
    for line in contents.lines() {
        if line.starts_with([' ', '\t', '#', '-']) {
            continue;
        }
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let Some(value) = scalar(value.trim()) else {
            continue;
        };
        let field = match key {
            "id" => &mut workspace.id,
            "cwd" => &mut workspace.cwd,
            "name" => &mut workspace.name,
            "client_name" => &mut workspace.client_name,
            "created_at" => &mut workspace.created_at,
            _ => continue,
        };
        *field = Some(value);
    }
    workspace
}

/// A YAML scalar: plain, single-quoted (`''` is a quote) or double-quoted (JSON escapes).
fn scalar(value: &str) -> Option<String> {
    let value = if let Some(inner) = value
        .strip_prefix('"')
        .and_then(|rest| rest.strip_suffix('"'))
    {
        serde_json::from_str::<String>(&format!("\"{inner}\"")).ok()?
    } else if let Some(inner) = value
        .strip_prefix('\'')
        .and_then(|rest| rest.strip_suffix('\''))
    {
        inner.replace("''", "'")
    } else if value.starts_with(['|', '>', '[', '{', '&', '*', '!']) || value == "null" {
        return None;
    } else {
        value.to_owned()
    };
    Some(value.trim().to_owned()).filter(|value| !value.is_empty())
}

/// Reads on only until the main agent's first usage record inside an assistant turn, which
/// is what the reader counts as a call. Only lines that can matter are parsed.
pub(crate) fn read_listing(file: &SessionFile) -> io::Result<Listing> {
    let folder = file.path.parent().unwrap_or(&file.path);
    let mut listing = Listing {
        workspace: read_workspace(folder),
        first_prompt: None,
        has_responses: false,
    };
    let mut reader = BufReader::new(fs::File::open(&file.path)?);
    let mut raw = Vec::new();
    let mut in_turn = false;
    loop {
        raw.clear();
        if reader.read_until(b'\n', &mut raw)? == 0 {
            break;
        }
        let Ok(line) = std::str::from_utf8(&raw) else {
            continue;
        };
        if ![
            "\"assistant.turn_",
            "\"user.message\"",
            "\"type\":\"abort\"",
            "\"session.usage_record\"",
        ]
        .iter()
        .any(|marker| line.contains(marker))
        {
            continue;
        }
        let Ok(record) = serde_json::from_str::<Value>(line.trim_end()) else {
            continue;
        };
        if origin(&record) != Origin::Main {
            continue;
        }
        match record.get("type").and_then(Value::as_str) {
            Some("user.message") if listing.first_prompt.is_none() => {
                listing.first_prompt = record["data"]["content"]
                    .as_str()
                    .and_then(crate::discovery::compact_prompt);
            }
            Some("assistant.turn_start") => in_turn = true,
            Some("assistant.turn_end" | "abort") => in_turn = false,
            Some("session.usage_record") if in_turn => {
                listing.has_responses = true;
                break;
            }
            _ => {}
        }
    }
    Ok(listing)
}

/// Listings keyed by path and file stamps, so an unchanged session is not read again on
/// every catalogue refresh.
pub(crate) type ListingCache = crate::discovery::ListingCache<SessionFile, Listing>;

impl ListedFile for SessionFile {
    type Key = (FileStamp, Option<FileStamp>);

    fn path(&self) -> &Path {
        &self.path
    }

    fn key(&self) -> Self::Key {
        (self.stamp, self.workspace_stamp)
    }

    fn stamp(&self) -> FileStamp {
        self.stamp
    }
}
