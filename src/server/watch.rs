use notify::{
    event::{CreateKind, MetadataKind, ModifyKind, RemoveKind},
    EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc,
};
use tokio::sync::{mpsc, Notify};

/// A filesystem callback is deliberately reduced to a source-neutral hint before
/// it crosses into the asynchronous application.
#[derive(Debug, Clone, Copy)]
pub(crate) enum WatchHint {
    Filesystem,
}

#[derive(Debug, Default)]
pub(crate) struct WatchSignals {
    pub received: AtomicU64,
    pub dropped: AtomicU64,
    pub overflow: AtomicBool,
    pub watcher_failed: AtomicBool,
    /// Latest aggregate source-read health, separate from permanent watch loss.
    pub sources_degraded: AtomicBool,
    pub wake: Notify,
}

pub(crate) struct WatcherHandle {
    _watcher: RecommendedWatcher,
}

impl std::fmt::Debug for WatcherHandle {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("WatcherHandle")
            .finish_non_exhaustive()
    }
}

pub(crate) fn start(
    root: &Path,
    sender: mpsc::Sender<WatchHint>,
    signals: Arc<WatchSignals>,
) -> notify::Result<WatcherHandle> {
    start_target(root, sender, signals, None)
}

pub(crate) fn start_database(
    database: &Path,
    sender: mpsc::Sender<WatchHint>,
    signals: Arc<WatchSignals>,
) -> notify::Result<WatcherHandle> {
    let root = database.parent().unwrap_or_else(|| Path::new("."));
    start_target(root, sender, signals, Some(database.to_path_buf()))
}

fn start_target(
    root: &Path,
    sender: mpsc::Sender<WatchHint>,
    signals: Arc<WatchSignals>,
    database: Option<PathBuf>,
) -> notify::Result<WatcherHandle> {
    let recursive = database.is_none();
    let root = root.to_path_buf();
    let callback_root = root.clone();
    let callback_signals = Arc::clone(&signals);
    let disabled = Arc::new(AtomicBool::new(false));
    let callback_disabled = Arc::clone(&disabled);
    let watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        if callback_disabled.load(Ordering::Acquire) {
            return;
        }
        let hint = match result {
            Ok(event) => {
                let relevant = match &database {
                    Some(database) => relevant_database_event(&event, database),
                    None => relevant_event(&event, &callback_root),
                };
                if !relevant {
                    return;
                }
                callback_signals.received.fetch_add(1, Ordering::Relaxed);
                WatchHint::Filesystem
            }
            Err(_) => {
                callback_signals
                    .watcher_failed
                    .store(true, Ordering::Release);
                callback_disabled.store(true, Ordering::Release);
                callback_signals.wake.notify_one();
                return;
            }
        };

        if sender.try_send(hint).is_err() {
            callback_signals.dropped.fetch_add(1, Ordering::Relaxed);
            callback_signals.overflow.store(true, Ordering::Release);
            callback_signals.wake.notify_one();
        }
    })?;
    let mut watcher = watcher;
    watcher.watch(
        &root,
        if recursive {
            RecursiveMode::Recursive
        } else {
            RecursiveMode::NonRecursive
        },
    )?;
    Ok(WatcherHandle { _watcher: watcher })
}

fn relevant_event(event: &notify::Event, root: &PathBuf) -> bool {
    if matches!(event.kind, EventKind::Access(_))
        || matches!(
            event.kind,
            EventKind::Modify(ModifyKind::Metadata(MetadataKind::AccessTime))
        )
    {
        return false;
    }
    if event.paths.is_empty() {
        return true;
    }
    let directory_or_rename = matches!(
        event.kind,
        EventKind::Create(CreateKind::Folder)
            | EventKind::Remove(RemoveKind::Folder)
            | EventKind::Modify(ModifyKind::Name(_))
    );
    event.paths.iter().any(|path| {
        path.starts_with(root)
            && (directory_or_rename
                || path
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .is_none_or(|extension| extension == "jsonl"))
    })
}

fn relevant_database_event(event: &notify::Event, database: &Path) -> bool {
    if matches!(
        event.kind,
        EventKind::Access(_) | EventKind::Modify(ModifyKind::Metadata(MetadataKind::AccessTime))
    ) {
        return false;
    }
    if event.paths.is_empty() {
        return true;
    }
    let mut wal = database.as_os_str().to_os_string();
    wal.push("-wal");
    let mut shm = database.as_os_str().to_os_string();
    shm.push("-shm");
    let shm_lifecycle = matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(ModifyKind::Name(_))
    );
    event.paths.iter().any(|path| {
        path == database
            || path.as_os_str() == wal
            || (shm_lifecycle && path.as_os_str() == shm)
            || Some(path.as_path()) == database.parent()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::AccessKind;

    #[test]
    fn ignores_access_events_and_unrelated_files() {
        let root = PathBuf::from("/tmp/sessions");
        assert!(!relevant_event(
            &notify::Event {
                kind: EventKind::Access(AccessKind::Any),
                paths: vec![root.join("session.jsonl")],
                attrs: Default::default(),
            },
            &root,
        ));
        assert!(!relevant_event(
            &notify::Event {
                kind: EventKind::Modify(notify::event::ModifyKind::Any),
                paths: vec![root.join("session.tmp")],
                attrs: Default::default(),
            },
            &root,
        ));
    }

    #[test]
    fn database_hints_include_wal_and_replacement_but_ignore_read_activity() {
        let database = PathBuf::from("/tmp/opencode.db");
        for (path, kind, expected) in [
            (
                "/tmp/opencode.db-wal",
                EventKind::Modify(ModifyKind::Data(notify::event::DataChange::Any)),
                true,
            ),
            (
                "/tmp/opencode.db",
                EventKind::Modify(ModifyKind::Name(notify::event::RenameMode::To)),
                true,
            ),
            (
                "/tmp/opencode.db-shm",
                EventKind::Create(CreateKind::File),
                true,
            ),
            (
                "/tmp/opencode.db-shm",
                EventKind::Modify(ModifyKind::Data(notify::event::DataChange::Any)),
                false,
            ),
            (
                "/tmp/another.db-wal",
                EventKind::Modify(ModifyKind::Any),
                false,
            ),
            (
                "/tmp/opencode.db-wal",
                EventKind::Access(AccessKind::Any),
                false,
            ),
        ] {
            let event = notify::Event {
                kind,
                paths: vec![PathBuf::from(path)],
                attrs: Default::default(),
            };
            assert_eq!(
                relevant_database_event(&event, &database),
                expected,
                "{path}"
            );
        }
    }

    #[test]
    fn accepts_directory_and_jsonl_events() {
        let root = PathBuf::from("/tmp/sessions");
        for (path, kind) in [
            (
                root.join("nested"),
                EventKind::Create(notify::event::CreateKind::Any),
            ),
            (
                root.join("nested.dir"),
                EventKind::Create(notify::event::CreateKind::Folder),
            ),
            (
                root.join("nested/session.jsonl"),
                EventKind::Create(notify::event::CreateKind::Any),
            ),
            (
                root.join("renamed.tmp"),
                EventKind::Modify(notify::event::ModifyKind::Name(
                    notify::event::RenameMode::To,
                )),
            ),
        ] {
            assert!(relevant_event(
                &notify::Event {
                    kind,
                    paths: vec![path],
                    attrs: Default::default(),
                },
                &root,
            ));
        }
    }
}
