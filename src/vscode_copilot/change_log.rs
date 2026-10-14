//! A Copilot Chat session file is a log of changes to one JSON value, one change per
//! line. Replaying the lines in order gives the session. See
//! plans/archive/vscode-copilot-analysis-notes.md, "Session file format".

use crate::domain::SourceError;
use serde_json::Value;
use std::io::BufRead;

/// The replayed session and the number of change lines applied.
#[derive(Debug)]
pub(crate) struct Replayed {
    pub session: Value,
    pub changes: usize,
}

/// VS Code appends changes while a session runs, so an unterminated final line that is
/// not yet valid JSON is still being written and is skipped. Every newline-terminated
/// line must be valid JSON and must apply to the session as replayed so far.
pub(crate) fn replay(mut reader: impl BufRead) -> Result<Replayed, SourceError> {
    let mut session = None;
    let mut changes = 0_usize;
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
        let text = match std::str::from_utf8(&raw) {
            Ok(text) => text.trim_end_matches(['\n', '\r']),
            Err(_) if !terminated => break,
            Err(error) => {
                return Err(SourceError::Io(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    error,
                )))
            }
        };
        if text.trim().is_empty() {
            continue;
        }
        let change = match serde_json::from_str::<Value>(text) {
            Ok(change) => change,
            Err(_) if !terminated => break,
            Err(source) => return Err(SourceError::Json { line, source }),
        };
        apply(&mut session, change, line)?;
        changes += 1;
    }
    let session = session.ok_or_else(|| invalid(0, "the file has no starting state"))?;
    Ok(Replayed { session, changes })
}

fn invalid(line: usize, reason: &str) -> SourceError {
    SourceError::InvalidStructure(format!("change on line {line}: {reason}"))
}

fn apply(session: &mut Option<Value>, change: Value, line: usize) -> Result<(), SourceError> {
    let Value::Object(mut change) = change else {
        return Err(invalid(line, "not an object"));
    };
    let kind = change.get("kind").and_then(Value::as_u64);
    let value = change.remove("v");
    if kind == Some(0) {
        if session.is_some() {
            return Err(invalid(line, "a second starting state"));
        }
        *session = Some(value.ok_or_else(|| invalid(line, "no starting value"))?);
        return Ok(());
    }
    let session = session
        .as_mut()
        .ok_or_else(|| invalid(line, "a change before the starting state"))?;
    let path = match change.get("k") {
        Some(Value::Array(path)) if !path.is_empty() => path,
        _ => return Err(invalid(line, "no path")),
    };
    let (last, parents) = path.split_last().ok_or_else(|| invalid(line, "no path"))?;
    let mut parent = &mut *session;
    for key in parents {
        parent = child(parent, key).ok_or_else(|| invalid(line, "the path does not exist"))?;
    }
    match kind {
        Some(1) => set(
            parent,
            last,
            value.ok_or_else(|| invalid(line, "no value"))?,
        )
        .ok_or_else(|| invalid(line, "the value cannot be set")),
        Some(2) => {
            let Some(Value::Array(items)) = value else {
                return Err(invalid(line, "appended items are not an array"));
            };
            let target = child(parent, last)
                .and_then(Value::as_array_mut)
                .ok_or_else(|| invalid(line, "the appended-to value is not an array"))?;
            if let Some(start) = change.get("i") {
                let start = start
                    .as_u64()
                    .and_then(|start| usize::try_from(start).ok())
                    .filter(|start| *start <= target.len())
                    .ok_or_else(|| invalid(line, "the removal index is outside the array"))?;
                target.truncate(start);
            }
            target.extend(items);
            Ok(())
        }
        Some(3) => remove(parent, last).ok_or_else(|| invalid(line, "the value cannot be deleted")),
        _ => Err(invalid(line, "an unknown kind of change")),
    }
}

fn child<'a>(value: &'a mut Value, key: &Value) -> Option<&'a mut Value> {
    match (value, key) {
        (Value::Object(object), Value::String(key)) => object.get_mut(key),
        (Value::Array(array), Value::Number(index)) => {
            array.get_mut(usize::try_from(index.as_u64()?).ok()?)
        }
        _ => None,
    }
}

/// An object key is added or replaced. An array index replaces an item, or appends
/// when it is one past the end.
fn set(parent: &mut Value, key: &Value, value: Value) -> Option<()> {
    match (parent, key) {
        (Value::Object(object), Value::String(key)) => {
            object.insert(key.clone(), value);
            Some(())
        }
        (Value::Array(array), Value::Number(index)) => {
            let index = usize::try_from(index.as_u64()?).ok()?;
            if index < array.len() {
                array[index] = value;
            } else if index == array.len() {
                array.push(value);
            } else {
                return None;
            }
            Some(())
        }
        _ => None,
    }
}

fn remove(parent: &mut Value, key: &Value) -> Option<()> {
    match (parent, key) {
        (Value::Object(object), Value::String(key)) => {
            object.remove(key);
            Some(())
        }
        (Value::Array(array), Value::Number(index)) => {
            let index = usize::try_from(index.as_u64()?).ok()?;
            (index < array.len()).then(|| {
                array.remove(index);
            })
        }
        _ => None,
    }
}
