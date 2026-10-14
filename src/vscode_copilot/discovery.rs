//! Finds Copilot Chat session files under a VS Code user data folder and reads the few
//! fields the catalogue shows. Section 4 of plans/archive/vscode-copilot-implementation-plan.md
//! describes the layout.

use super::change_log;
use crate::claude_code::discovery::{DiscoveryError, FileStamp};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs::{self, DirEntry},
    io::{self, BufReader, Read},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::SystemTime,
};

/// `workspace.json` files are a few hundred bytes; anything larger is not one.
const MAX_WORKSPACE_BYTES: u64 = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SessionFile {
    /// Canonical path inside the user data folder.
    pub path: PathBuf,
    /// The workspace folder holding the session, or `None` for a session opened with no
    /// folder (`emptyWindowChatSessions`).
    pub workspace: Option<PathBuf>,
    pub stamp: FileStamp,
    pub modified: Option<SystemTime>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct Listing {
    pub session_id: Option<String>,
    /// `customTitle`, otherwise the first request's message.
    pub title: Option<String>,
    pub working_directory: Option<String>,
    pub created_at_ms: Option<i64>,
    pub requests: usize,
}

/// The folders under a user data folder that hold session files, for watching.
pub(crate) fn session_folders(user_dir: &Path) -> [PathBuf; 2] {
    [
        user_dir.join("workspaceStorage"),
        user_dir.join("globalStorage/emptyWindowChatSessions"),
    ]
}

/// `workspaceStorage/<workspace>/chatSessions/*.jsonl` and
/// `globalStorage/emptyWindowChatSessions/*.jsonl`. Symbolic links are ignored.
pub(crate) fn find_files(
    user_dir: &Path,
    cancelled: Option<&AtomicBool>,
) -> Result<Vec<SessionFile>, DiscoveryError> {
    let check = || {
        if cancelled.is_some_and(|flag| flag.load(Ordering::Acquire)) {
            Err(DiscoveryError::Cancelled)
        } else {
            Ok(())
        }
    };
    let [workspaces, empty_window] = session_folders(user_dir);
    let mut files = Vec::new();
    for workspace in directories(&workspaces)? {
        check()?;
        let sessions = workspace.join("chatSessions");
        if !fs::symlink_metadata(&sessions).is_ok_and(|metadata| metadata.is_dir()) {
            continue;
        }
        for entry in entries(&sessions)? {
            check()?;
            files.extend(session_file(user_dir, &entry, Some(&workspace))?);
        }
    }
    for entry in entries(&empty_window)? {
        check()?;
        files.extend(session_file(user_dir, &entry, None)?);
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

fn directories(path: &Path) -> Result<Vec<PathBuf>, DiscoveryError> {
    let mut output = Vec::new();
    for entry in entries(path)? {
        if entry.file_type()?.is_dir() {
            output.push(entry.path());
        }
    }
    Ok(output)
}

/// A folder that does not exist, or is removed while it is read, reads as empty.
fn entries(path: &Path) -> Result<Vec<DirEntry>, DiscoveryError> {
    match fs::read_dir(path) {
        Ok(entries) => Ok(entries.collect::<Result<_, _>>()?),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(error.into()),
    }
}

fn session_file(
    user_dir: &Path,
    entry: &DirEntry,
    workspace: Option<&Path>,
) -> Result<Option<SessionFile>, DiscoveryError> {
    let path = entry.path();
    if !entry.file_type()?.is_file()
        || path.extension().and_then(|extension| extension.to_str()) != Some("jsonl")
    {
        return Ok(None);
    }
    let canonical = match fs::canonicalize(&path) {
        Ok(canonical) => canonical,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    if !canonical.starts_with(user_dir) {
        return Err(DiscoveryError::OutsideRoot);
    }
    let metadata = match fs::metadata(&canonical) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    Ok(Some(SessionFile {
        workspace: workspace.map(Path::to_path_buf),
        path: canonical,
        stamp: FileStamp::of(&metadata),
        modified: metadata.modified().ok(),
    }))
}

/// Reads the catalogue fields by replaying the whole file. A file that cannot be
/// replayed lists with no requests, so it is not offered; opening it would fail too.
pub(crate) fn read_listing(file: &SessionFile) -> io::Result<Listing> {
    let reader = BufReader::new(fs::File::open(&file.path)?);
    let session = match change_log::replay(reader) {
        Ok(replayed) => replayed.session,
        Err(crate::domain::SourceError::Io(error)) => return Err(error),
        Err(_) => return Ok(Listing::default()),
    };
    let requests = session
        .get("requests")
        .and_then(Value::as_array)
        .map_or(&[][..], Vec::as_slice);
    let text = |value: Option<&Value>| {
        value
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_owned)
    };
    let first_message = requests.first().and_then(|request| {
        text(
            request
                .get("message")
                .and_then(|message| message.get("text")),
        )
    });
    Ok(Listing {
        session_id: text(session.get("sessionId")),
        title: text(session.get("customTitle")).or(first_message),
        working_directory: file.workspace.as_deref().and_then(workspace_folder),
        created_at_ms: session.get("creationDate").and_then(Value::as_i64),
        requests: requests.len(),
    })
}

/// The workspace's folder from its `workspace.json`: a path for a local `file://` URI,
/// otherwise the URI as recorded (a remote folder is on another machine).
pub(crate) fn workspace_folder(workspace: &Path) -> Option<String> {
    let mut bytes = Vec::new();
    fs::File::open(workspace.join("workspace.json"))
        .ok()?
        .take(MAX_WORKSPACE_BYTES + 1)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() as u64 > MAX_WORKSPACE_BYTES {
        return None;
    }
    let value: Value = serde_json::from_slice(&bytes).ok()?;
    let uri = value
        .get("folder")
        .or_else(|| value.get("workspace"))
        .and_then(Value::as_str)
        .filter(|uri| !uri.is_empty())?;
    Some(folder_from_uri(uri))
}

/// `file:///Users/me/project` is `/Users/me/project`, and `file:///c%3A/project` is
/// `c:/project`. Any other URI is kept as recorded.
pub(crate) fn folder_from_uri(uri: &str) -> String {
    let Some(path) = uri.strip_prefix("file://") else {
        return uri.to_owned();
    };
    let decoded = percent_encoding::percent_decode_str(path).decode_utf8_lossy();
    let bytes = decoded.as_bytes();
    // A Windows drive path is written `/c:/...`.
    if bytes.len() >= 3 && bytes[0] == b'/' && bytes[1].is_ascii_alphabetic() && bytes[2] == b':' {
        decoded[1..].to_owned()
    } else {
        decoded.into_owned()
    }
}

/// Listings keyed by path and file stamp, so an unchanged session is not replayed
/// again on every catalogue refresh.
#[derive(Debug, Default)]
pub(crate) struct ListingCache {
    entries: HashMap<PathBuf, (FileStamp, Listing)>,
    /// Session files replayed since the cache was created, for tests.
    pub(crate) reads: usize,
}

impl ListingCache {
    /// `Ok(None)` when the file was removed after it was found.
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

    /// Forget files that were not found by the latest discovery.
    pub(crate) fn retain(&mut self, files: &[SessionFile]) {
        let current: HashSet<&PathBuf> = files.iter().map(|file| &file.path).collect();
        self.entries.retain(|path, _| current.contains(path));
    }
}
