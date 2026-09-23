use notify::{
    event::{MetadataKind, ModifyKind},
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
                if !relevant_event(&event, &callback_root) {
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
    watcher.watch(&root, RecursiveMode::Recursive)?;
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
    event.paths.iter().any(|path| {
        path.starts_with(root)
            && path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_none_or(|extension| extension == "jsonl")
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
    fn accepts_directory_and_jsonl_events() {
        let root = PathBuf::from("/tmp/sessions");
        for path in [root.join("nested"), root.join("nested/session.jsonl")] {
            assert!(relevant_event(
                &notify::Event {
                    kind: EventKind::Create(notify::event::CreateKind::Any),
                    paths: vec![path],
                    attrs: Default::default(),
                },
                &root,
            ));
        }
    }
}
