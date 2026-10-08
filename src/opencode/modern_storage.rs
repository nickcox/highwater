//! Lossless allowlisted v2 rows, ordered by native sequence, in the caller's
//! read transaction. Inline content remains JSON until logical replay.
use super::{cancelled, charge, field, object, safe_instant, MessageRecord, StorageError};
use rusqlite::Transaction;
use std::{collections::HashSet, sync::atomic::AtomicBool};

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
            parts: Vec::new(),
        });
    }
    Ok(messages)
}
