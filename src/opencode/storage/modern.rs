//! Lossless allowlisted v2 rows, ordered by native sequence, in the caller's
//! read transaction. Inline content remains JSON until logical replay.
use super::{cancelled, charge, field, object, safe_instant, MessageRecord, StorageError};
use rusqlite::Transaction;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    sync::atomic::AtomicBool,
};

pub(super) fn load_messages(
    tx: &Transaction<'_>,
    native_id: &str,
    signal: Option<&AtomicBool>,
    limits: (usize, usize),
    hasher: &mut blake3::Hasher,
    bytes: &mut usize,
) -> Result<Vec<MessageRecord>, StorageError> {
    let (max_rows, max_bytes) = limits;
    let mut statement = tx.prepare("SELECT id, type, seq, time_created, time_updated, data FROM session_message WHERE session_id = ?1 ORDER BY seq, id")?;
    let mut rows = statement.query([native_id])?;
    let mut messages = Vec::new();
    let mut ids = HashSet::new();
    let mut previous = None;
    while let Some(row) = rows.next()? {
        cancelled(signal)?;
        if messages.len() >= max_rows {
            return Err(StorageError::BudgetExceeded);
        }
        let id: String = row.get(0)?;
        let kind: String = row.get(1)?;
        let seq: i64 = row.get(2)?;
        let created_at_ms: i64 = row.get(3)?;
        let updated_at_ms: i64 = row.get(4)?;
        let raw: String = row.get(5)?;
        for value in [&id, &kind, &raw] {
            charge(bytes, value.len(), max_bytes)?;
        }
        safe_instant(seq)?;
        safe_instant(created_at_ms)?;
        safe_instant(updated_at_ms)?;
        // Gaps are legal (fork/revert), but repeated or negative sequence is not.
        if id.is_empty()
            || kind.is_empty()
            || !ids.insert(id.clone())
            || seq < 0
            || previous.is_some_and(|previous| seq <= previous)
        {
            return Err(StorageError::InvalidRecords);
        }
        previous = Some(seq);
        hasher.update(b"session_message\0");
        for value in [
            id.as_bytes(),
            kind.as_bytes(),
            &seq.to_le_bytes(),
            &created_at_ms.to_le_bytes(),
            &updated_at_ms.to_le_bytes(),
            raw.as_bytes(),
        ] {
            field(hasher, value);
        }
        messages.push(MessageRecord {
            id,
            native_kind: Some(kind),
            sequence: Some(seq),
            created_at_ms,
            updated_at_ms,
            data: object(&raw)?,
            legacy_step_tokens: None,
            parts: Vec::new(),
        });
    }
    Ok(messages)
}

/// Adds each modern record's legacy step-finish token counters, when the record
/// has exactly one such step. OpenCode writes both layouts for the same message
/// ID; the legacy step keeps the provider total the modern record lacks. Only the
/// `tokens` object is read, so large tool parts are never loaded.
pub(super) fn attach_legacy_step_tokens(
    tx: &Transaction<'_>,
    native_id: &str,
    messages: &mut [MessageRecord],
    signal: Option<&AtomicBool>,
    limits: (usize, usize),
    hasher: &mut blake3::Hasher,
    bytes: &mut usize,
) -> Result<(), StorageError> {
    let (max_rows, max_bytes) = limits;
    let mut statement = tx.prepare(
        "SELECT p.id, p.message_id, json_extract(p.data, '$.tokens') FROM part p \
         WHERE p.session_id = ?1 AND json_extract(p.data, '$.type') = 'step-finish' \
         ORDER BY p.id",
    )?;
    let mut rows = statement.query([native_id])?;
    let mut steps: HashMap<String, Option<String>> = HashMap::new();
    let mut row_count = messages.len();
    while let Some(row) = rows.next()? {
        cancelled(signal)?;
        charge(&mut row_count, 1, max_rows)?;
        let id: String = row.get(0)?;
        let message_id: String = row.get(1)?;
        let tokens: Option<String> = row.get(2)?;
        for value in [&id, &message_id] {
            charge(bytes, value.len(), max_bytes)?;
        }
        charge(bytes, tokens.as_ref().map_or(0, String::len), max_bytes)?;
        hasher.update(b"legacy_step_tokens\0");
        for value in [id.as_bytes(), message_id.as_bytes()] {
            field(hasher, value);
        }
        field(hasher, tokens.as_deref().unwrap_or("").as_bytes());
        // A message with more than one step has no single counterpart.
        steps
            .entry(message_id)
            .and_modify(|existing| *existing = None)
            .or_insert(tokens);
    }
    for message in messages {
        message.legacy_step_tokens = steps
            .remove(&message.id)
            .flatten()
            .and_then(|tokens| serde_json::from_str::<Value>(&tokens).ok())
            .filter(Value::is_object);
    }
    Ok(())
}
