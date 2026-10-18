//! Finds session files under a Codex home folder and reads the few fields the catalogue
//! shows, without reconstructing the conversation.

use crate::claude_code::discovery::{DiscoveryError, FileStamp};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs::{self, DirEntry},
    io::{self, BufRead},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::SystemTime,
};

/// `sessions/<year>/<month>/<day>/` is three folders deep.
const SESSION_FOLDER_DEPTH: usize = 3;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SessionFile {
    /// Canonical path inside the Codex home folder.
    pub path: PathBuf,
    pub stamp: FileStamp,
    pub modified: Option<SystemTime>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct Listing {
    /// The thread ID from `session_meta`.
    pub thread_id: Option<String>,
    /// `session_meta.timestamp`, as written.
    pub started_at: Option<String>,
    pub working_directory: Option<String>,
    pub child: Option<ChildThread>,
    /// Whether any call reported its usage. A session without one has nothing to chart.
    pub has_responses: bool,
}

/// A thread started by another thread.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ChildThread {
    pub parent_thread_id: String,
    /// What started it: `guardian` for an automatic review, otherwise the spawned agent's
    /// role or the last part of its path.
    pub kind: Option<String>,
    /// A spawned agent's nickname.
    pub nickname: Option<String>,
}

/// Session files are `rollout-*.jsonl` or `rollout-*.jsonl.zst`, under `sessions/` (in
/// date folders) or directly in `archived_sessions/`. Symbolic links are not followed.
pub(crate) fn find_files(
    home: &Path,
    cancelled: Option<&AtomicBool>,
) -> Result<Vec<SessionFile>, DiscoveryError> {
    let mut files = Vec::new();
    collect(
        &home.join("sessions"),
        home,
        SESSION_FOLDER_DEPTH,
        cancelled,
        &mut files,
    )?;
    collect(
        &home.join("archived_sessions"),
        home,
        0,
        cancelled,
        &mut files,
    )?;
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

fn collect(
    folder: &Path,
    home: &Path,
    depth: usize,
    cancelled: Option<&AtomicBool>,
    files: &mut Vec<SessionFile>,
) -> Result<(), DiscoveryError> {
    for entry in entries(folder)? {
        if cancelled.is_some_and(|flag| flag.load(Ordering::Acquire)) {
            return Err(DiscoveryError::Cancelled);
        }
        let file_type = entry.file_type()?;
        let path = entry.path();
        if file_type.is_dir() && depth > 0 {
            collect(&path, home, depth - 1, cancelled, files)?;
        } else if file_type.is_file() && is_session_name(&entry.file_name().to_string_lossy()) {
            files.extend(session_file(home, &path)?);
        }
    }
    Ok(())
}

fn is_session_name(name: &str) -> bool {
    name.starts_with("rollout-") && (name.ends_with(".jsonl") || name.ends_with(".jsonl.zst"))
}

/// A folder removed while it is being read reads as empty.
fn entries(path: &Path) -> Result<Vec<DirEntry>, DiscoveryError> {
    match fs::read_dir(path) {
        Ok(entries) => Ok(entries.collect::<Result<_, _>>()?),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(error.into()),
    }
}

fn session_file(home: &Path, path: &Path) -> Result<Option<SessionFile>, DiscoveryError> {
    let canonical = match fs::canonicalize(path) {
        Ok(canonical) => canonical,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    if !canonical.starts_with(home) {
        return Err(DiscoveryError::OutsideRoot);
    }
    let metadata = fs::metadata(&canonical)?;
    Ok(Some(SessionFile {
        path: canonical,
        stamp: FileStamp::of(&metadata),
        modified: metadata.modified().ok(),
    }))
}

/// Reads `session_meta` from the first line, then reads on only until a call's usage
/// appears. An unfinished or invalid line is skipped: the full reader decides whether the
/// session is valid.
pub(crate) fn read_listing(file: &SessionFile) -> io::Result<Listing> {
    let mut reader = super::open_text(&file.path)?;
    let mut listing = Listing::default();
    let mut raw = Vec::new();
    let mut first = true;
    loop {
        raw.clear();
        // Records are separated only by `\n`; text inside them can hold U+2028.
        if reader.read_until(b'\n', &mut raw)? == 0 {
            break;
        }
        let Ok(line) = std::str::from_utf8(&raw) else {
            continue;
        };
        if first && !line.trim().is_empty() {
            first = false;
            if let Ok(value) = serde_json::from_str::<Value>(line.trim_end()) {
                if value.get("type").and_then(Value::as_str) == Some("session_meta") {
                    read_meta(value.get("payload").unwrap_or(&Value::Null), &mut listing);
                }
            }
            continue;
        }
        if line.contains("\"last_token_usage\"") {
            listing.has_responses = true;
            break;
        }
    }
    Ok(listing)
}

fn text(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
}

fn read_meta(meta: &Value, listing: &mut Listing) {
    listing.thread_id = text(meta, "id");
    listing.started_at = text(meta, "timestamp");
    listing.working_directory = text(meta, "cwd");
    let Some(subagent) = meta.get("source").and_then(|source| source.get("subagent")) else {
        return;
    };
    let spawn = subagent.get("thread_spawn");
    let parent = spawn
        .and_then(|spawn| text(spawn, "parent_thread_id"))
        .or_else(|| text(meta, "parent_thread_id"))
        .or_else(|| text(meta, "forked_from_id"));
    let Some(parent_thread_id) = parent else {
        return;
    };
    let kind = match spawn {
        Some(spawn) => text(spawn, "agent_role").or_else(|| {
            text(spawn, "agent_path")
                .and_then(|path| path.rsplit('/').next().map(str::to_owned))
                .filter(|name| !name.is_empty())
        }),
        None => text(subagent, "other"),
    };
    listing.child = Some(ChildThread {
        parent_thread_id,
        kind,
        nickname: spawn
            .and_then(|spawn| text(spawn, "agent_nickname"))
            .or_else(|| text(meta, "agent_nickname")),
    });
}

/// Listings keyed by path and file stamp, so an unchanged session is not read again on
/// every catalogue refresh.
#[derive(Debug, Default)]
pub(crate) struct ListingCache {
    entries: HashMap<PathBuf, (FileStamp, Listing)>,
    /// Sessions read since the cache was created, for tests.
    pub(crate) reads: usize,
}

impl ListingCache {
    /// `Ok(None)` when the session was removed after it was found.
    pub(crate) fn listing(&mut self, file: &SessionFile) -> io::Result<Option<Listing>> {
        if let Some((stamp, listing)) = self.entries.get(&file.path) {
            if *stamp == file.stamp && stamp.modified_nanos.is_some() {
                return Ok(Some(listing.clone()));
            }
        }
        self.reads += 1;
        let listing = match read_listing(file) {
            Ok(listing) => listing,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        };
        self.entries
            .insert(file.path.clone(), (file.stamp, listing.clone()));
        Ok(Some(listing))
    }

    /// Forget sessions that were not found by the latest discovery.
    pub(crate) fn retain(&mut self, files: &[SessionFile]) {
        let current: HashSet<&PathBuf> = files.iter().map(|file| &file.path).collect();
        self.entries.retain(|path, _| current.contains(path));
    }
}

/// Thread titles from `session_index.jsonl`, read again only when the file changes.
#[derive(Debug, Default)]
pub(crate) struct TitleIndex {
    stamp: Option<FileStamp>,
    titles: HashMap<String, String>,
}

impl TitleIndex {
    /// A missing or unreadable index leaves every thread without a title.
    pub(crate) fn refresh(&mut self, home: &Path) {
        let path = home.join("session_index.jsonl");
        let stamp = fs::symlink_metadata(&path)
            .ok()
            .filter(fs::Metadata::is_file)
            .map(|metadata| FileStamp::of(&metadata));
        if stamp.is_some() && stamp == self.stamp {
            return;
        }
        self.stamp = stamp;
        self.titles = stamp
            .and_then(|_| fs::read_to_string(&path).ok())
            .map(|contents| read_titles(&contents))
            .unwrap_or_default();
    }

    pub(crate) fn title(&self, thread_id: &str) -> Option<&str> {
        self.titles.get(thread_id).map(String::as_str)
    }
}

/// A thread renamed later has a later line, so the last line for a thread wins.
fn read_titles(contents: &str) -> HashMap<String, String> {
    let mut titles = HashMap::new();
    for line in contents.split('\n') {
        let Ok(value) = serde_json::from_str::<Value>(line.trim_end()) else {
            continue;
        };
        if let (Some(id), Some(title)) = (text(&value, "id"), text(&value, "thread_name")) {
            titles.insert(id, title);
        }
    }
    titles
}
