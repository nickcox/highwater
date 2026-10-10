//! Snapshot-based reads of legacy and modern OpenCode SQLite session layouts.
//!
//! No auth, account, permission, event payload, or credential tables are read.
//! Connections are reopened for each read, so database replacement cannot leave
//! a persistent connection pointing at an old inode.

use crate::domain::MAX_SAFE_JSON_INTEGER;
use rusqlite::{limits::Limit, Connection, ErrorCode, OpenFlags, Transaction};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use thiserror::Error;

mod modern;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Generation {
    Legacy,
    Modern,
}

#[derive(Clone, Copy)]
enum Layout {
    Legacy,
    Modern,
    Mixed,
}

const BUSY_TIMEOUT: Duration = Duration::from_millis(250);
const MAX_SQLITE_VALUE_BYTES: i32 = 32 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES: usize = 256 * 1024 * 1024;
const MAX_ROWS: usize = 200_000;
const MAX_SESSIONS: usize = 50_000;

#[derive(Debug, Error)]
pub(crate) enum StorageError {
    #[error("opencode database is busy")]
    Busy,
    #[error("opencode database is corrupt")]
    Corrupt,
    #[error("opencode database cannot be read")]
    Database(#[source] rusqlite::Error),
    #[error("opencode database metadata cannot be read")]
    Io(#[source] std::io::Error),
    #[error("opencode storage layout is unsupported")]
    UnsupportedLayout,
    #[error("opencode session was not found")]
    NotFound,
    #[error("opencode session contains invalid records")]
    InvalidRecords,
    #[error("opencode storage read exceeds its budget")]
    BudgetExceeded,
    #[error("opencode storage read was cancelled")]
    Cancelled,
}

impl From<rusqlite::Error> for StorageError {
    fn from(error: rusqlite::Error) -> Self {
        match &error {
            rusqlite::Error::SqliteFailure(code, _) => match code.code {
                ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked => Self::Busy,
                ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase => Self::Corrupt,
                ErrorCode::TooBig => Self::BudgetExceeded,
                ErrorCode::OperationInterrupted => Self::Cancelled,
                _ => Self::Database(error),
            },
            _ => Self::Database(error),
        }
    }
}

/// Stored session metadata, never a provider request or aggregate usage authority.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SessionMetadata {
    pub id: String,
    pub parent_id: Option<String>,
    pub directory: String,
    pub title: String,
    pub version: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
    pub archived_at_ms: Option<i64>,
    pub revert: Option<Value>,
}

#[derive(Debug)]
pub(crate) struct MessageRecord {
    pub id: String,
    /// Modern row type and sequence are storage authority, not JSON fields.
    pub native_kind: Option<String>,
    pub sequence: Option<i64>,
    // Retain storage timestamps for audits; they are not model timing evidence.
    #[cfg_attr(not(test), expect(dead_code))]
    pub created_at_ms: i64,
    #[cfg_attr(not(test), expect(dead_code))]
    pub updated_at_ms: i64,
    /// Row IDs/relationships are authoritative; they need not be repeated here.
    pub data: Value,
    /// Parts are in source serializer order (ID), not modification time order.
    pub parts: Vec<PartRecord>,
}

#[derive(Debug)]
pub(crate) struct PartRecord {
    pub id: String,
    // Retain storage timestamps for audits; they are not model timing evidence.
    #[cfg_attr(not(test), expect(dead_code))]
    pub created_at_ms: i64,
    #[cfg_attr(not(test), expect(dead_code))]
    pub updated_at_ms: i64,
    pub data: Value,
}

#[derive(Debug)]
pub(crate) struct SessionSnapshot {
    pub metadata: SessionMetadata,
    pub generation: Generation,
    pub mixed_layout: bool,
    /// Legacy creation time/ID order, or modern native sequence order.
    pub messages: Vec<MessageRecord>,
    /// Digest of allowlisted metadata and raw rows in this same read transaction.
    /// It detects same-length edits and WAL-only commits, unlike file mtime.
    pub revision: blake3::Hash,
    pub source_bytes: usize,
}

fn cancelled(signal: Option<&AtomicBool>) -> Result<(), StorageError> {
    if signal.is_some_and(|signal| signal.load(Ordering::Acquire)) {
        return Err(StorageError::Cancelled);
    }
    Ok(())
}

fn open(path: &Path, signal: Option<Arc<AtomicBool>>) -> Result<Connection, StorageError> {
    cancelled(signal.as_deref())?;
    // Deliberately do not enable SQLITE_OPEN_URI: a filename must never opt into
    // immutable=1 (which would ignore active WAL commits) or writable URI flags.
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    connection.busy_timeout(BUSY_TIMEOUT)?;
    connection.set_limit(Limit::SQLITE_LIMIT_LENGTH, MAX_SQLITE_VALUE_BYTES)?;
    if let Some(signal) = signal {
        connection.progress_handler(1_000, Some(move || signal.load(Ordering::Acquire)))?;
    }
    Ok(connection)
}

fn table_columns(tx: &Transaction<'_>, table: &str) -> Result<HashSet<String>, StorageError> {
    // All callers pass compile-time allowlisted names. Reject views: these are
    // stored rows, not arbitrary expressions masquerading as the expected schema.
    let mut statement = tx.prepare("SELECT type FROM sqlite_schema WHERE name = ?1")?;
    let mut rows = statement.query([table])?;
    let Some(row) = rows.next()? else {
        return Err(StorageError::UnsupportedLayout);
    };
    if row.get::<_, String>(0)? != "table" {
        return Err(StorageError::UnsupportedLayout);
    }
    let mut statement = tx.prepare("SELECT name FROM pragma_table_info(?1)")?;
    let names = statement.query_map([table], |row| row.get::<_, String>(0))?;
    names.collect::<Result<HashSet<_>, _>>().map_err(Into::into)
}

fn exists(tx: &Transaction<'_>, table: &str) -> Result<bool, StorageError> {
    Ok(tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name = ?1)",
        [table],
        |row| row.get(0),
    )?)
}

fn validate_layout(tx: &Transaction<'_>) -> Result<Layout, StorageError> {
    let legacy = exists(tx, "session")?;
    let modern = exists(tx, "session_v2")?;
    if !legacy && !modern {
        return Err(StorageError::UnsupportedLayout);
    }
    if legacy {
        for (table, required) in [
            (
                "session",
                &[
                    "id",
                    "parent_id",
                    "directory",
                    "title",
                    "version",
                    "time_created",
                    "time_updated",
                    "time_archived",
                    "revert",
                ][..],
            ),
            (
                "message",
                &["id", "session_id", "time_created", "time_updated", "data"][..],
            ),
            (
                "part",
                &[
                    "id",
                    "message_id",
                    "session_id",
                    "time_created",
                    "time_updated",
                    "data",
                ][..],
            ),
        ] {
            let columns = table_columns(tx, table)?;
            if required.iter().any(|column| !columns.contains(*column)) {
                return Err(StorageError::UnsupportedLayout);
            }
        }
    }
    if modern {
        for (table, required) in [
            (
                "session_v2",
                &[
                    "id",
                    "parent_id",
                    "directory",
                    "title",
                    "version",
                    "time_created",
                    "time_updated",
                    "time_archived",
                    "revert",
                ][..],
            ),
            (
                "session_message",
                &[
                    "id",
                    "session_id",
                    "type",
                    "seq",
                    "time_created",
                    "time_updated",
                    "data",
                ][..],
            ),
        ] {
            let columns = table_columns(tx, table)?;
            if required.iter().any(|column| !columns.contains(*column)) {
                return Err(StorageError::UnsupportedLayout);
            }
        }
    }
    // Experimental pre-v2 layouts still aren't a supported context authority.
    let unsupported = if modern {
        &["session_context_epoch", "session_input"][..]
    } else {
        &["session_message", "session_context_epoch", "session_input"][..]
    };
    for table in unsupported {
        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name = ?1)",
            [table],
            |row| row.get(0),
        )?;
        if exists {
            // An unsupported stored table may be empty; a view must never
            // execute arbitrary expressions merely to inspect population.
            table_columns(tx, table)?;
            // Constant allowlisted table name, never user-supplied SQL.
            let populated: bool = tx.query_row(
                &format!("SELECT EXISTS(SELECT 1 FROM \"{table}\" LIMIT 1)"),
                [],
                |row| row.get(0),
            )?;
            if populated {
                return Err(StorageError::UnsupportedLayout);
            }
        }
    }
    Ok(match (legacy, modern) {
        (true, true) => Layout::Mixed,
        (false, true) => Layout::Modern,
        _ => Layout::Legacy,
    })
}

// Migration copies timestamps and IDs. A strictly newer legacy row wins; ties
// favor a modern projection. If the projection is absent, fall back to legacy
// only on a tie, not when v2 is newer (that could resurrect obsolete history).
const MODERN_SELECTED: &str = "SELECT s.id FROM session_v2 s WHERE
    NOT EXISTS (SELECT 1 FROM session o WHERE o.id = s.id AND o.time_updated > s.time_updated)
    AND (EXISTS (SELECT 1 FROM session_message m WHERE m.session_id = s.id)
         OR NOT EXISTS (SELECT 1 FROM session o JOIN message m ON m.session_id = o.id
                        WHERE o.id = s.id AND o.time_updated = s.time_updated))";

fn sessions_query(layout: Layout) -> String {
    let legacy = format!("SELECT {METADATA_COLUMNS}, 0 AS generation FROM session");
    let modern = format!("SELECT {METADATA_COLUMNS}, 1 AS generation FROM session_v2");
    match layout {
        Layout::Legacy => legacy,
        Layout::Modern => modern,
        Layout::Mixed => format!("{modern} WHERE id IN ({MODERN_SELECTED}) UNION ALL {legacy} WHERE id NOT IN ({MODERN_SELECTED})"),
    }
}

fn generation(row: &rusqlite::Row<'_>) -> Result<Generation, StorageError> {
    match row.get::<_, i64>(9)? {
        0 => Ok(Generation::Legacy),
        1 => Ok(Generation::Modern),
        _ => Err(StorageError::InvalidRecords),
    }
}

const METADATA_COLUMNS: &str =
    "id, parent_id, directory, title, version, time_created, time_updated, time_archived, revert";

fn metadata(row: &rusqlite::Row<'_>) -> Result<SessionMetadata, StorageError> {
    let revert = row.get::<_, Option<String>>(8)?;
    let result = SessionMetadata {
        id: row.get(0)?,
        parent_id: row.get(1)?,
        directory: row.get(2)?,
        title: row
            .get::<_, Option<String>>(3)?
            .unwrap_or_else(|| "Untitled session".into()),
        version: row.get(4)?,
        created_at_ms: row.get(5)?,
        updated_at_ms: row.get(6)?,
        archived_at_ms: row.get(7)?,
        revert: revert.as_deref().map(object).transpose()?,
    };
    if result.id.is_empty() || result.version.is_empty() || result.parent_id.as_deref() == Some("")
    {
        return Err(StorageError::InvalidRecords);
    }
    for instant in [
        Some(result.created_at_ms),
        Some(result.updated_at_ms),
        result.archived_at_ms,
    ]
    .into_iter()
    .flatten()
    {
        safe_instant(instant)?;
    }
    Ok(result)
}

fn safe_instant(value: i64) -> Result<(), StorageError> {
    if value.unsigned_abs() > MAX_SAFE_JSON_INTEGER {
        return Err(StorageError::InvalidRecords);
    }
    Ok(())
}

fn object(raw: &str) -> Result<Value, StorageError> {
    let value: Value = serde_json::from_str(raw).map_err(|_| StorageError::InvalidRecords)?;
    if !value.is_object() {
        return Err(StorageError::InvalidRecords);
    }
    Ok(value)
}

fn field(hasher: &mut blake3::Hasher, bytes: &[u8]) {
    // Length framing makes adjacent fields unambiguous, including embedded NUL.
    hasher.update(&(bytes.len() as u64).to_le_bytes());
    hasher.update(bytes);
}

fn optional_field(hasher: &mut blake3::Hasher, value: Option<&str>) {
    match value {
        Some(value) => {
            hasher.update(&[1]);
            field(hasher, value.as_bytes());
        }
        None => {
            hasher.update(&[0]);
        }
    }
}

fn charge(bytes: &mut usize, amount: usize, limit: usize) -> Result<(), StorageError> {
    *bytes = bytes
        .checked_add(amount)
        .filter(|bytes| *bytes <= limit)
        .ok_or(StorageError::BudgetExceeded)?;
    Ok(())
}

#[derive(PartialEq, Eq)]
struct FileIdentity {
    #[cfg(unix)]
    device: u64,
    #[cfg(unix)]
    inode: u64,
    #[cfg(not(unix))]
    created: Option<std::time::SystemTime>,
    #[cfg(not(unix))]
    modified: Option<std::time::SystemTime>,
    #[cfg(not(unix))]
    length: u64,
}

fn file_identity(path: &Path) -> Result<FileIdentity, StorageError> {
    let metadata = std::fs::metadata(path).map_err(StorageError::Io)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        Ok(FileIdentity {
            device: metadata.dev(),
            inode: metadata.ino(),
        })
    }
    #[cfg(not(unix))]
    {
        Ok(FileIdentity {
            created: metadata.created().ok(),
            modified: metadata.modified().ok(),
            length: metadata.len(),
        })
    }
}

/// A persistent read-only connection observes SQLite commits via data_version,
/// including WAL-only and same-timestamp writes. No read transaction is held
/// between polls. Database replacement reopens the reader and advances revision.
pub(crate) struct CatalogTracker {
    connection: Connection,
    identity: FileIdentity,
    data_version: i64,
    revision: u64,
}

impl CatalogTracker {
    pub(crate) fn new(path: &Path) -> Result<Self, StorageError> {
        let connection = open(path, None)?;
        let data_version = connection.query_row("PRAGMA data_version", [], |row| row.get(0))?;
        Ok(Self {
            connection,
            identity: file_identity(path)?,
            data_version,
            revision: 1,
        })
    }

    pub(crate) fn observe(&mut self, path: &Path) -> Result<u64, StorageError> {
        let identity = file_identity(path)?;
        let replaced = identity != self.identity;
        if replaced {
            self.connection = open(path, None)?;
        }
        let version = self
            .connection
            .query_row("PRAGMA data_version", [], |row| row.get(0))?;
        if replaced || version != self.data_version {
            self.revision = self
                .revision
                .checked_add(1)
                .ok_or(StorageError::InvalidRecords)?;
            self.identity = identity;
            self.data_version = version;
        }
        Ok(self.revision)
    }
}

/// Enumerates metadata only; it never hydrates or hashes the full database.
/// Call from a blocking worker. Each successful return is one committed snapshot.
pub(crate) fn discover(
    path: &Path,
    signal: Option<Arc<AtomicBool>>,
) -> Result<Vec<SessionMetadata>, StorageError> {
    let mut connection = open(path, signal.clone())?;
    let tx = connection.transaction()?;
    let layout = validate_layout(&tx)?;
    let mut statement = tx.prepare(&format!(
        "SELECT * FROM ({}) ORDER BY time_updated DESC, id",
        sessions_query(layout)
    ))?;
    let mut rows = statement.query([])?;
    let mut sessions = Vec::new();
    let mut ids = HashSet::new();
    let mut bytes = 0;
    while let Some(row) = rows.next()? {
        cancelled(signal.as_deref())?;
        if sessions.len() >= MAX_SESSIONS {
            return Err(StorageError::BudgetExceeded);
        }
        let session = metadata(row)?;
        if !ids.insert(session.id.clone()) {
            return Err(StorageError::InvalidRecords);
        }
        for index in [0, 1, 2, 3, 4, 8] {
            charge(
                &mut bytes,
                row.get_ref(index)?
                    .as_bytes_or_null()
                    .map_err(|_| StorageError::InvalidRecords)?
                    .map_or(0, <[u8]>::len),
                MAX_SNAPSHOT_BYTES,
            )?;
        }
        sessions.push(session);
    }
    Ok(sessions)
}

/// Materializes just one session in a read transaction, released before analysis.
/// `native_id` is always a bound parameter, not SQL or a filesystem locator.
pub(crate) fn load_session(
    path: &Path,
    native_id: &str,
    signal: Option<Arc<AtomicBool>>,
) -> Result<SessionSnapshot, StorageError> {
    load_with_limits(path, native_id, signal, MAX_ROWS, MAX_SNAPSHOT_BYTES)
}

fn load_with_limits(
    path: &Path,
    native_id: &str,
    signal: Option<Arc<AtomicBool>>,
    max_rows: usize,
    max_bytes: usize,
) -> Result<SessionSnapshot, StorageError> {
    let mut connection = open(path, signal.clone())?;
    let tx = connection.transaction()?;
    let layout = validate_layout(&tx)?;
    let mut hasher = blake3::Hasher::new_derive_key("TokenPlume OpenCode snapshot v2");
    // Layout contributes qualifications even if the selected raw rows haven't
    // changed (e.g. an unused generation is introduced beside a live session).
    field(
        &mut hasher,
        if matches!(layout, Layout::Mixed) {
            b"mixed"
        } else {
            b"single"
        },
    );
    let mut bytes = 0;
    let (session, generation) = {
        let mut statement = tx.prepare(&format!(
            "SELECT * FROM ({}) WHERE id = ?1",
            sessions_query(layout)
        ))?;
        let mut rows = statement.query([native_id])?;
        let row = rows.next()?.ok_or(StorageError::NotFound)?;
        let session = metadata(row)?;
        let generation = generation(row)?;
        field(
            &mut hasher,
            match generation {
                Generation::Legacy => b"legacy",
                Generation::Modern => b"modern",
            },
        );
        for index in [0, 1, 2, 3, 4, 8] {
            let value = row
                .get_ref(index)?
                .as_str_or_null()
                .map_err(|_| StorageError::InvalidRecords)?;
            optional_field(&mut hasher, value);
            charge(&mut bytes, value.map_or(0, str::len), max_bytes)?;
        }
        for instant in [
            Some(session.created_at_ms),
            Some(session.updated_at_ms),
            session.archived_at_ms,
        ] {
            optional_field(
                &mut hasher,
                instant.map(|value| value.to_string()).as_deref(),
            );
        }
        if rows.next()?.is_some() {
            return Err(StorageError::InvalidRecords);
        }
        (session, generation)
    };
    if generation == Generation::Modern {
        let messages = modern::load_messages(
            &tx,
            native_id,
            signal.as_deref(),
            (max_rows, max_bytes),
            &mut hasher,
            &mut bytes,
        )?;
        return Ok(SessionSnapshot {
            metadata: session,
            generation,
            mixed_layout: matches!(layout, Layout::Mixed),
            messages,
            revision: hasher.finalize(),
            source_bytes: bytes,
        });
    }
    let mut messages = Vec::new();
    let mut positions = HashMap::new();
    let mut statement = tx.prepare("SELECT id, time_created, time_updated, data FROM message WHERE session_id = ?1 ORDER BY time_created, id")?;
    let mut rows = statement.query([native_id])?;
    while let Some(row) = rows.next()? {
        cancelled(signal.as_deref())?;
        if messages.len() >= max_rows {
            return Err(StorageError::BudgetExceeded);
        }
        let id: String = row.get(0)?;
        let created_at_ms = row.get(1)?;
        let updated_at_ms = row.get(2)?;
        let raw: String = row.get(3)?;
        charge(&mut bytes, id.len(), max_bytes)?;
        charge(&mut bytes, raw.len(), max_bytes)?;
        safe_instant(created_at_ms)?;
        safe_instant(updated_at_ms)?;
        if id.is_empty() || positions.insert(id.clone(), messages.len()).is_some() {
            return Err(StorageError::InvalidRecords);
        }
        hasher.update(b"message\0");
        for value in [
            id.as_bytes(),
            &created_at_ms.to_le_bytes(),
            &updated_at_ms.to_le_bytes(),
            raw.as_bytes(),
        ] {
            field(&mut hasher, value);
        }
        messages.push(MessageRecord {
            id,
            native_kind: None,
            sequence: None,
            created_at_ms,
            updated_at_ms,
            data: object(&raw)?,
            parts: Vec::new(),
        });
    }
    // Include parts claiming this session OR referring to one of its messages.
    // This detects both orphan parts and cross-session relationship mismatches.
    let mut statement = tx.prepare("SELECT p.id, p.message_id, p.session_id, p.time_created, p.time_updated, p.data FROM part p WHERE p.session_id = ?1 OR p.message_id IN (SELECT id FROM message WHERE session_id = ?1) ORDER BY p.id")?;
    let mut rows = statement.query([native_id])?;
    let mut ids = HashSet::new();
    let mut row_count = messages.len();
    while let Some(row) = rows.next()? {
        cancelled(signal.as_deref())?;
        charge(&mut row_count, 1, max_rows)?;
        let id: String = row.get(0)?;
        let message_id: String = row.get(1)?;
        let session_id: String = row.get(2)?;
        let created_at_ms = row.get(3)?;
        let updated_at_ms = row.get(4)?;
        let raw: String = row.get(5)?;
        for value in [&id, &message_id, &session_id, &raw] {
            charge(&mut bytes, value.len(), max_bytes)?;
        }
        safe_instant(created_at_ms)?;
        safe_instant(updated_at_ms)?;
        if id.is_empty() || !ids.insert(id.clone()) || session_id != native_id {
            return Err(StorageError::InvalidRecords);
        }
        let position = *positions
            .get(&message_id)
            .ok_or(StorageError::InvalidRecords)?;
        hasher.update(b"part\0");
        for value in [
            id.as_bytes(),
            message_id.as_bytes(),
            session_id.as_bytes(),
            &created_at_ms.to_le_bytes(),
            &updated_at_ms.to_le_bytes(),
            raw.as_bytes(),
        ] {
            field(&mut hasher, value);
        }
        messages[position].parts.push(PartRecord {
            id,
            created_at_ms,
            updated_at_ms,
            data: object(&raw)?,
        });
    }
    // All statements and the read transaction are dropped on return; no DB lock
    // survives into tokenization, cache publication, or response serialization.
    Ok(SessionSnapshot {
        metadata: session,
        generation,
        mixed_layout: matches!(layout, Layout::Mixed),
        messages,
        revision: hasher.finalize(),
        source_bytes: bytes,
    })
}

#[cfg(test)]
pub(super) fn load_with_budget(
    path: &Path,
    native_id: &str,
    rows: usize,
    bytes: usize,
) -> Result<SessionSnapshot, StorageError> {
    load_with_limits(path, native_id, None, rows, bytes)
}
