//! Finds transcripts under a Claude Code projects directory and reads the few
//! fields the catalogue shows, without reconstructing the conversation.

use super::FileKind;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs::{self, DirEntry},
    io::{self, BufRead, BufReader, Read},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};
use thiserror::Error;

/// Subagent metadata files are a few hundred bytes; anything larger is not one.
const MAX_METADATA_BYTES: u64 = 64 * 1024;

#[derive(Debug, Error)]
pub(crate) enum DiscoveryError {
    #[error("cannot read the transcript directory: {0}")]
    Io(#[from] io::Error),
    #[error("a transcript entry is outside the configured root")]
    OutsideRoot,
    #[error("discovery was cancelled")]
    Cancelled,
}

/// A size and modification time, used to tell whether a file changed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct FileStamp {
    pub byte_size: u64,
    pub modified_nanos: Option<u128>,
}

impl FileStamp {
    fn of(metadata: &fs::Metadata) -> Self {
        Self {
            byte_size: metadata.len(),
            modified_nanos: modified_nanos(metadata.modified().ok()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TranscriptFile {
    /// Canonical path inside the configured root.
    pub path: PathBuf,
    pub kind: FileKind,
    pub stamp: FileStamp,
    pub modified: Option<SystemTime>,
    /// The subagent's `.meta.json`, when there is one.
    pub metadata_stamp: Option<FileStamp>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct Listing {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    /// The latest custom title, otherwise the latest generated title.
    pub title: Option<String>,
    /// The first `cwd` on a conversation record. The project directory's name is
    /// not used, because it is wrong after the session has been relocated.
    pub working_directory: Option<String>,
    /// The first conversation record's timestamp, as written.
    pub started_at: Option<String>,
    pub subagent: Option<SubagentMetadata>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct SubagentMetadata {
    pub agent_type: Option<String>,
    pub description: Option<String>,
    pub parent_tool_use_id: Option<String>,
}

/// Main sessions are `.jsonl` files directly inside a project directory.
/// Subagents are `<project>/<session>/subagents/agent-*.jsonl`. Everything else,
/// including symbolic links, is ignored.
pub(crate) fn find_files(
    root: &Path,
    cancelled: Option<&AtomicBool>,
) -> Result<Vec<TranscriptFile>, DiscoveryError> {
    let check = || {
        if cancelled.is_some_and(|flag| flag.load(Ordering::Acquire)) {
            Err(DiscoveryError::Cancelled)
        } else {
            Ok(())
        }
    };
    let mut files = Vec::new();
    for project in directories(root)? {
        check()?;
        for entry in entries(&project)? {
            check()?;
            let file_type = entry.file_type()?;
            let path = entry.path();
            if file_type.is_file() && has_extension(&path, "jsonl") {
                files.extend(transcript(root, &path, FileKind::Main)?);
            } else if file_type.is_dir() {
                let subagents = path.join("subagents");
                if !fs::symlink_metadata(&subagents).is_ok_and(|metadata| metadata.is_dir()) {
                    continue;
                }
                for entry in entries(&subagents)? {
                    check()?;
                    let path = entry.path();
                    let name = entry.file_name();
                    let name = name.to_string_lossy();
                    if entry.file_type()?.is_file()
                        && name.starts_with("agent-")
                        && has_extension(&path, "jsonl")
                    {
                        files.extend(transcript(root, &path, FileKind::Subagent)?);
                    }
                }
            }
        }
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

/// The directories directly inside `path`, not following symbolic links.
fn directories(path: &Path) -> Result<Vec<PathBuf>, DiscoveryError> {
    let mut output = Vec::new();
    for entry in entries(path)? {
        if entry.file_type()?.is_dir() {
            output.push(entry.path());
        }
    }
    Ok(output)
}

/// A directory removed while a session is being deleted reads as empty.
fn entries(path: &Path) -> Result<Vec<DirEntry>, DiscoveryError> {
    match fs::read_dir(path) {
        Ok(entries) => Ok(entries.collect::<Result<_, _>>()?),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(error.into()),
    }
}

fn has_extension(path: &Path, extension: &str) -> bool {
    path.extension().and_then(|value| value.to_str()) == Some(extension)
}

fn transcript(
    root: &Path,
    path: &Path,
    kind: FileKind,
) -> Result<Option<TranscriptFile>, DiscoveryError> {
    let canonical = match fs::canonicalize(path) {
        Ok(canonical) => canonical,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    if !canonical.starts_with(root) {
        return Err(DiscoveryError::OutsideRoot);
    }
    let metadata = fs::metadata(&canonical)?;
    let metadata_stamp = match kind {
        FileKind::Main => None,
        FileKind::Subagent => fs::symlink_metadata(metadata_path(&canonical))
            .ok()
            .filter(fs::Metadata::is_file)
            .map(|metadata| FileStamp::of(&metadata)),
    };
    Ok(Some(TranscriptFile {
        path: canonical,
        kind,
        stamp: FileStamp::of(&metadata),
        modified: metadata.modified().ok(),
        metadata_stamp,
    }))
}

fn modified_nanos(modified: Option<SystemTime>) -> Option<u128> {
    modified
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
}

/// `agent-x.jsonl` has its metadata in `agent-x.meta.json`.
fn metadata_path(transcript: &Path) -> PathBuf {
    let stem = transcript
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_default();
    transcript.with_file_name(format!("{stem}.meta.json"))
}

/// Read the catalogue fields from one transcript. Lines are only parsed when a
/// cheap text check says they can hold a needed field. An unfinished or invalid
/// line is skipped: the full reader decides whether the transcript is valid.
pub(crate) fn read_listing(file: &TranscriptFile) -> io::Result<Listing> {
    let mut reader = BufReader::new(fs::File::open(&file.path)?);
    let mut listing = Listing::default();
    let mut custom_title = None;
    let mut generated_title = None;
    let mut raw = Vec::new();
    loop {
        raw.clear();
        if reader.read_until(b'\n', &mut raw)? == 0 {
            break;
        }
        let Ok(line) = std::str::from_utf8(&raw) else {
            continue;
        };
        if line.contains("\"type\":\"custom-title\"") {
            if let Some(title) = string_field(line, "customTitle") {
                custom_title = Some(title);
            }
            continue;
        }
        if line.contains("\"type\":\"ai-title\"") {
            if let Some(title) = string_field(line, "aiTitle") {
                generated_title = Some(title);
            }
            continue;
        }
        let needs_record = listing.working_directory.is_none() || listing.started_at.is_none();
        let needs_session = listing.session_id.is_none();
        if !(needs_record && line.contains("\"uuid\"")
            || needs_session && line.contains("\"sessionId\""))
        {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(line.trim_end()) else {
            continue;
        };
        let text = |key: &str| {
            value
                .get(key)
                .and_then(Value::as_str)
                .filter(|text| !text.is_empty())
                .map(str::to_owned)
        };
        if listing.session_id.is_none() {
            listing.session_id = text("sessionId");
        }
        if value.get("uuid").and_then(Value::as_str).is_some() {
            if listing.agent_id.is_none() {
                listing.agent_id = text("agentId");
            }
            if listing.working_directory.is_none() {
                listing.working_directory = text("cwd");
            }
            if listing.started_at.is_none() {
                listing.started_at = text("timestamp");
            }
        }
    }
    listing.title = custom_title.or(generated_title);
    if file.kind == FileKind::Subagent {
        if listing.agent_id.is_none() {
            listing.agent_id = file
                .path
                .file_stem()
                .and_then(|stem| stem.to_str())
                .and_then(|stem| stem.strip_prefix("agent-"))
                .filter(|id| !id.is_empty())
                .map(str::to_owned);
        }
        listing.subagent = Some(read_subagent_metadata(&metadata_path(&file.path)));
    }
    Ok(listing)
}

fn string_field(line: &str, key: &str) -> Option<String> {
    serde_json::from_str::<Value>(line.trim_end())
        .ok()?
        .get(key)?
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
}

/// A missing or unreadable metadata file leaves every field empty.
fn read_subagent_metadata(path: &Path) -> SubagentMetadata {
    let read = || -> Option<Value> {
        let mut bytes = Vec::new();
        fs::File::open(path)
            .ok()?
            .take(MAX_METADATA_BYTES + 1)
            .read_to_end(&mut bytes)
            .ok()?;
        if bytes.len() as u64 > MAX_METADATA_BYTES {
            return None;
        }
        serde_json::from_slice(&bytes).ok()
    };
    let Some(value) = read() else {
        return SubagentMetadata::default();
    };
    let text = |key: &str| {
        value
            .get(key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_owned)
    };
    SubagentMetadata {
        agent_type: text("agentType"),
        description: text("description"),
        parent_tool_use_id: text("toolUseId"),
    }
}

/// Listings keyed by path and file stamps, so an unchanged transcript is not
/// read again on every catalogue refresh.
#[derive(Debug, Default)]
pub(crate) struct ListingCache {
    entries: HashMap<PathBuf, (FileStamp, Option<FileStamp>, Listing)>,
    /// Transcripts read since the cache was created, for tests.
    pub(crate) reads: usize,
}

impl ListingCache {
    /// `Ok(None)` when the transcript was removed after it was found.
    pub(crate) fn listing(&mut self, file: &TranscriptFile) -> io::Result<Option<Listing>> {
        if let Some((stamp, metadata_stamp, listing)) = self.entries.get(&file.path) {
            if *stamp == file.stamp
                && stamp.modified_nanos.is_some()
                && *metadata_stamp == file.metadata_stamp
            {
                return Ok(Some(listing.clone()));
            }
        }
        self.reads += 1;
        let listing = match read_listing(file) {
            Ok(listing) => listing,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        };
        self.entries.insert(
            file.path.clone(),
            (file.stamp, file.metadata_stamp, listing.clone()),
        );
        Ok(Some(listing))
    }

    /// Forget transcripts that were not found by the latest discovery.
    pub(crate) fn retain(&mut self, files: &[TranscriptFile]) {
        let current: HashSet<&PathBuf> = files.iter().map(|file| &file.path).collect();
        self.entries.retain(|path, _| current.contains(path));
    }
}
