//! Finds transcripts under a Claude Code projects directory and reads the few
//! fields the catalogue shows, without reconstructing the conversation.

use super::FileKind;
use crate::discovery::{DiscoveryError, FileStamp, ListedFile};
use serde_json::Value;
use std::{
    fs::{self, DirEntry},
    io::{self, BufRead, BufReader, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::SystemTime,
};

/// Subagent metadata files are a few hundred bytes; anything larger is not one.
const MAX_METADATA_BYTES: u64 = 64 * 1024;

pub(super) const ACTIVITY_CHUNK_BYTES: usize = 64 * 1024;

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
    pub first_prompt: Option<String>,
    pub fork_parent: Option<String>,
    pub git_branch: Option<String>,
    pub git_branches: Vec<String>,
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    /// The latest custom title, otherwise the latest generated title.
    pub title: Option<String>,
    /// The first `cwd` on a conversation record. The project directory's name is
    /// not used, because it is wrong after the session has been relocated.
    pub working_directory: Option<String>,
    /// The first conversation record's timestamp, as written.
    pub started_at: Option<String>,
    /// The last conversation record's timestamp, as written.
    pub last_activity_at: Option<String>,
    pub subagent: Option<SubagentMetadata>,
    /// Whether any assistant record appears. A transcript without one, such as a session
    /// closed before its first prompt was sent, has nothing to chart.
    pub has_responses: bool,
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
    let mut pending_command: Option<String> = None;
    let mut raw = Vec::new();
    loop {
        raw.clear();
        if reader.read_until(b'\n', &mut raw)? == 0 {
            break;
        }
        let Ok(line) = std::str::from_utf8(&raw) else {
            continue;
        };
        let inherited = line.contains("\"forkedFrom\"")
            && (listing.fork_parent.is_some()
                || serde_json::from_str::<Value>(line)
                    .ok()
                    .is_some_and(|value| {
                        if let Some(parent) = value["forkedFrom"]["sessionId"].as_str() {
                            listing.fork_parent.get_or_insert_with(|| parent.to_owned());
                            true
                        } else {
                            false
                        }
                    }));
        // A copied record's branch is the one the original session used.
        if let Some(branch) = git_branch(line).filter(|branch| !inherited && branch != "HEAD") {
            if !listing.git_branches.contains(&branch) {
                listing.git_branches.push(branch.clone());
            }
            listing.git_branch = Some(branch);
        }
        if !inherited && !listing.has_responses && line.contains("\"type\":\"assistant\"") {
            listing.has_responses = true;
        }
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
        if !inherited && listing.first_prompt.is_none() && line.contains("\"type\":\"user\"") {
            if let Ok(value) = serde_json::from_str::<Value>(line) {
                let content = &value["message"]["content"];
                let text = content.as_str().map(str::to_owned).unwrap_or_else(|| {
                    content
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter(|part| part["type"] == "text")
                        .filter_map(|part| part["text"].as_str())
                        .collect::<Vec<_>>()
                        .join(" ")
                });
                let is_meta = value.get("isMeta").and_then(Value::as_bool) == Some(true);
                // A skill run as a command is a command record followed by the skill's
                // instructions; the prompt is the command as typed.
                if let Some(command) = pending_command.take() {
                    if is_meta && text.starts_with("Base directory for this skill:") {
                        listing.first_prompt = crate::discovery::compact_prompt(&command);
                    }
                }
                if listing.first_prompt.is_none()
                    && !is_meta
                    && value.get("isCompactSummary").and_then(Value::as_bool) != Some(true)
                {
                    if !text.trim_start().starts_with('<') {
                        listing.first_prompt = crate::discovery::compact_prompt(&text);
                    } else {
                        pending_command = typed_command(&text);
                    }
                }
            }
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
    listing.last_activity_at = last_activity(&file.path)?;
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

/// Read backwards, retaining at most one complete line and a fixed-size chunk.
fn last_activity(path: &Path) -> io::Result<Option<String>> {
    let mut file = fs::File::open(path)?;
    let mut position = file.seek(SeekFrom::End(0))?;
    let mut chunk = [0; ACTIVITY_CHUNK_BYTES];
    // Store the partial line backwards so long records need no repeated copying.
    let mut line = Vec::new();
    while position > 0 {
        let length = position.min(ACTIVITY_CHUNK_BYTES as u64) as usize;
        position -= length as u64;
        file.seek(SeekFrom::Start(position))?;
        file.read_exact(&mut chunk[..length])?;
        for byte in chunk[..length].iter().rev() {
            if *byte == b'\n' {
                line.reverse();
                if let Some(timestamp) = activity_timestamp(&line) {
                    return Ok(Some(timestamp));
                }
                line.clear();
            } else {
                line.push(*byte);
            }
        }
    }
    line.reverse();
    Ok(activity_timestamp(&line))
}

fn activity_timestamp(line: &[u8]) -> Option<String> {
    let text = std::str::from_utf8(line).ok()?;
    let value: Value = serde_json::from_str(text).ok()?;
    value.get("uuid")?.as_str()?;
    value.get("timestamp")?.as_str().map(str::to_owned)
}

/// `/name args` from a command record's `<command-name>` and `<command-args>` tags.
fn typed_command(text: &str) -> Option<String> {
    let tag = |name: &str| {
        let start = text.find(&format!("<{name}>"))? + name.len() + 2;
        let end = start + text[start..].find(&format!("</{name}>"))?;
        Some(text[start..end].trim())
    };
    let name = tag("command-name").filter(|name| name.starts_with('/'))?;
    Some(match tag("command-args").filter(|args| !args.is_empty()) {
        Some(args) => format!("{name} {args}"),
        None => name.to_owned(),
    })
}

/// Nearly every record has `gitBranch`, and records can hold large tool output, so the
/// value is read from the text. A value with an escape is parsed with the whole record.
fn git_branch(line: &str) -> Option<String> {
    const KEY: &str = "\"gitBranch\":\"";
    let value = &line[line.find(KEY)? + KEY.len()..];
    let value = &value[..value.find('"')?];
    if value.contains('\\') {
        return string_field(line, "gitBranch");
    }
    Some(value.trim().to_owned()).filter(|value| !value.is_empty())
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

pub(crate) type ListingCache = crate::discovery::ListingCache<TranscriptFile, Listing>;

impl ListedFile for TranscriptFile {
    type Key = (FileStamp, Option<FileStamp>);

    fn path(&self) -> &Path {
        &self.path
    }

    fn key(&self) -> Self::Key {
        (self.stamp, self.metadata_stamp)
    }

    fn stamp(&self) -> FileStamp {
        self.stamp
    }
}
