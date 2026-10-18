//! Read-only OpenAI Codex session files. See docs/sources/codex.md.

pub(crate) mod discovery;
mod reconstruct;

pub(crate) use reconstruct::Reconstruction as Loaded;

#[cfg(test)]
mod tests;

use crate::domain::SourceError;
use ruzstd::decoding::{FrameDecoder, StreamingDecoder};
use std::{
    fs::File,
    io::{self, BufRead, BufReader, Cursor, Read},
    path::Path,
};

/// Codex compresses finished sessions as `.jsonl.zst`.
pub(crate) fn is_compressed(path: &Path) -> bool {
    path.extension().and_then(|extension| extension.to_str()) == Some("zst")
}

/// The session file's text, decompressed when needed.
pub(crate) fn open_text(path: &Path) -> io::Result<Box<dyn BufRead>> {
    let mut file = File::open(path)?;
    if !is_compressed(path) {
        return Ok(Box::new(BufReader::new(file)));
    }
    // Compressed sessions are a few megabytes, so the whole file is read and its frames
    // decoded one after another.
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;
    Ok(Box::new(BufReader::new(Frames::Between(Cursor::new(
        bytes,
    )))))
}

/// Synchronous; intended for a bounded blocking worker. Never writes.
pub(crate) fn load(path: &Path) -> Result<Loaded, SourceError> {
    let mut text = String::new();
    open_text(path)
        .and_then(|mut reader| reader.read_to_string(&mut text))
        .map_err(SourceError::Io)?;
    // `rollout-<start time>-<thread ID>.jsonl`, for a session whose first line is unfinished.
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let stem = name.trim_end_matches(".zst").trim_end_matches(".jsonl");
    let fallback = stem.get(stem.len().saturating_sub(36)..).unwrap_or(stem);
    reconstruct::reconstruct(&text, fallback)
}

/// The decoded text of every zstd frame in turn. Skippable frames are passed over.
enum Frames {
    Between(Cursor<Vec<u8>>),
    InFrame(Box<StreamingDecoder<Cursor<Vec<u8>>, FrameDecoder>>),
    Done,
}

/// Skippable frames start with a magic number from 0x184D2A50 to 0x184D2A5F.
const SKIPPABLE_MAGIC: u32 = 0x184D_2A50;

impl Read for Frames {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        loop {
            match std::mem::replace(self, Self::Done) {
                Self::InFrame(mut frame) => {
                    let read = frame.read(buffer)?;
                    if read > 0 || buffer.is_empty() {
                        *self = Self::InFrame(frame);
                        return Ok(read);
                    }
                    *self = Self::Between(frame.into_inner());
                }
                Self::Between(mut input) => {
                    let position = usize::try_from(input.position()).unwrap_or(usize::MAX);
                    let rest = input.get_ref().get(position..).unwrap_or_default();
                    if rest.is_empty() {
                        return Ok(0);
                    }
                    let word = |offset: usize| {
                        rest.get(offset..offset + 4)
                            .map(|bytes| u32::from_le_bytes(bytes.try_into().unwrap_or_default()))
                    };
                    if let (Some(magic), Some(length)) = (word(0), word(4)) {
                        if magic & 0xFFFF_FFF0 == SKIPPABLE_MAGIC {
                            input.set_position(input.position() + 8 + u64::from(length));
                            *self = Self::Between(input);
                            continue;
                        }
                    }
                    let frame = StreamingDecoder::new(input)
                        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
                    *self = Self::InFrame(Box::new(frame));
                }
                Self::Done => return Ok(0),
            }
        }
    }
}
