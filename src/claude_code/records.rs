//! One JSON record per transcript line, with accessors for the fields the
//! reader uses. Unknown fields and record types are kept, not rejected.

use crate::domain::SourceError;
use serde_json::Value;
use std::io::BufRead;

#[derive(Debug, Clone)]
pub(super) struct Record {
    pub value: Value,
    /// Bytes in the source line, excluding its line terminator.
    pub source_bytes: u64,
}

impl Record {
    fn text(&self, key: &str) -> Option<&str> {
        self.value.get(key).and_then(Value::as_str)
    }

    pub fn kind(&self) -> &str {
        self.text("type").unwrap_or("")
    }

    pub fn uuid(&self) -> Option<&str> {
        self.text("uuid").filter(|uuid| !uuid.is_empty())
    }

    pub fn parent(&self) -> Option<&str> {
        self.text("parentUuid").filter(|uuid| !uuid.is_empty())
    }

    pub fn logical_parent(&self) -> Option<&str> {
        self.text("logicalParentUuid")
            .filter(|uuid| !uuid.is_empty())
    }

    pub fn subtype(&self) -> Option<&str> {
        self.text("subtype")
    }

    pub fn flag(&self, key: &str) -> bool {
        self.value.get(key).and_then(Value::as_bool) == Some(true)
    }

    pub fn is_message(&self) -> bool {
        matches!(self.kind(), "user" | "assistant")
    }

    pub fn is_compact_boundary(&self) -> bool {
        self.kind() == "system" && self.subtype() == Some("compact_boundary")
    }

    pub fn message(&self) -> Option<&Value> {
        self.value.get("message")
    }

    /// The API response ID, shared by every record of one response.
    pub fn message_id(&self) -> Option<&str> {
        (self.kind() == "assistant")
            .then(|| self.message()?.get("id")?.as_str())
            .flatten()
            .filter(|id| !id.is_empty())
    }

    /// Content blocks; a plain string is returned as `None` here.
    pub fn blocks(&self) -> &[Value] {
        self.message()
            .and_then(|message| message.get("content"))
            .and_then(Value::as_array)
            .map_or(&[], Vec::as_slice)
    }

    pub fn tool_result_ids(&self) -> impl Iterator<Item = &str> {
        let blocks = if self.kind() == "user" {
            self.blocks()
        } else {
            &[]
        };
        blocks
            .iter()
            .filter(|block| block.get("type").and_then(Value::as_str) == Some("tool_result"))
            .filter_map(|block| block.get("tool_use_id").and_then(Value::as_str))
    }

    pub fn tool_use_ids(&self) -> impl Iterator<Item = &str> {
        let blocks = if self.kind() == "assistant" {
            self.blocks()
        } else {
            &[]
        };
        blocks
            .iter()
            .filter(|block| block.get("type").and_then(Value::as_str) == Some("tool_use"))
            .filter_map(|block| block.get("id").and_then(Value::as_str))
    }
}

/// Claude Code appends one record per line while a session runs, so an
/// unterminated final line that is not yet valid JSON is still being written and
/// is skipped. Every newline-terminated line must be valid JSON.
pub(super) fn parse(mut reader: impl BufRead) -> Result<Vec<Record>, SourceError> {
    let mut records = Vec::new();
    let mut raw = Vec::new();
    let mut line = 0_usize;
    loop {
        raw.clear();
        if reader
            .read_until(b'\n', &mut raw)
            .map_err(SourceError::Io)?
            == 0
        {
            break;
        }
        line += 1;
        let terminated = raw.last() == Some(&b'\n');
        let parsed = std::str::from_utf8(&raw)
            .map_err(|error| {
                SourceError::Io(std::io::Error::new(std::io::ErrorKind::InvalidData, error))
            })
            .and_then(|text| {
                let text = text.trim_end_matches(['\n', '\r']);
                if text.trim().is_empty() {
                    return Ok(None);
                }
                serde_json::from_str::<Value>(text)
                    .map(|value| Some((text.len(), value)))
                    .map_err(|source| SourceError::Json { line, source })
            });
        match parsed {
            Ok(Some((length, value))) => records.push(Record {
                value,
                source_bytes: u64::try_from(length).unwrap_or(u64::MAX),
            }),
            Ok(None) => {}
            Err(_) if !terminated => break,
            Err(error) => return Err(error),
        }
    }
    Ok(records)
}
