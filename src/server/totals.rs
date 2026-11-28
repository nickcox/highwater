//! Reads the session table's costs and call figures off the request path and publishes them
//! in catalogue batches.

use super::{LiveState, SessionCatalog, SessionFile};
use crate::{
    discovery::FileStamp,
    session_totals::{claude_code_total, codex_total, copilot_total, pi_total, SessionCalls},
    source::SessionLocator,
};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    fs,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tokio::sync::watch;

const BATCH: Duration = Duration::from_millis(250);
const QUIET: Duration = Duration::from_secs(2);
/// Sessions read at once. Each holds one loaded session in memory while it is read.
const MAX_READERS: usize = 4;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SessionTotal {
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    includes_children: bool,
    usd: f64,
    kind: &'static str,
    partial: bool,
    since_ms: Option<i64>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    newer_usage: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    through_ms: Option<i64>,
}

/// What the worker found for one stamp. A missing figure means none is available.
#[derive(Debug, Clone, PartialEq)]
pub(super) struct SessionTotals {
    pub(super) cost: Option<SessionTotal>,
    pub(super) calls: Option<SessionCalls>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(super) struct TotalKey {
    locator: SessionLocator,
    size: Option<u64>,
    modified: Option<u128>,
    database_revision: Option<u64>,
    started_ms: Option<i64>,
}

impl TotalKey {
    pub(super) fn of(session: &SessionFile) -> Option<Self> {
        if session.byte_size.is_none() && session.source_revision.is_none() {
            return None;
        }
        Some(Self {
            locator: session.source_locator(),
            size: session.byte_size,
            modified: session.modified_nanos,
            database_revision: session.source_revision,
            started_ms: session.started_at.map(|time| time.timestamp_millis()),
        })
    }

    /// Absent when the file no longer matches the catalogue stamp.
    fn read(&self) -> Option<SessionTotals> {
        use SessionLocator::*;
        let path = match &self.locator {
            OpenCode {
                database,
                native_id,
            } => {
                let read = crate::opencode::storage::session_totals(database, native_id).ok();
                return Some(SessionTotals {
                    cost: read
                        .as_ref()
                        .and_then(|(usd, _)| *usd)
                        .map(SessionTotal::sum),
                    calls: read.map(|(_, calls)| calls),
                });
            }
            PiFile(path)
            | ClaudeCodeFile { path, .. }
            | CopilotFile { path }
            | VsCodeCopilotFile { path }
            | CodexFile { path } => path,
        };
        let matches = || {
            fs::metadata(path).is_ok_and(|metadata| {
                let stamp = FileStamp::of(&metadata);
                Some(stamp.byte_size) == self.size && stamp.modified_nanos == self.modified
            })
        };
        if !matches() {
            return None;
        }
        // The calls the session summary counts, so a full load of every file.
        let loaded = crate::source::load(&self.locator, None).ok();
        let calls = loaded
            .as_ref()
            .map(|loaded| SessionCalls::of(&loaded.normalized.model_calls));
        let cost = match &self.locator {
            OpenCode { .. } => unreachable!(),
            // Pi's cost includes calls on branches the loaded session leaves out.
            PiFile(_) => pi_total(path).ok().flatten().map(SessionTotal::sum),
            VsCodeCopilotFile { .. } => crate::vscode_copilot::session_total(path)
                .ok()
                .flatten()
                .map(SessionTotal::sum),
            CodexFile { .. } => loaded
                .as_ref()
                .and_then(|loaded| codex_total(&loaded.normalized))
                .map(|(usd, partial)| SessionTotal {
                    includes_children: false,
                    usd,
                    kind: "estimated",
                    partial,
                    since_ms: None,
                    newer_usage: false,
                    through_ms: None,
                }),
            ClaudeCodeFile { .. } | CopilotFile { .. } => {
                let cost = if matches!(self.locator, ClaudeCodeFile { .. }) {
                    claude_code_total(path)
                        .ok()
                        .flatten()
                        .map(|total| (total.cost, total.newer_usage, total.through_ms))
                } else {
                    copilot_total(path)
                        .ok()
                        .flatten()
                        .map(|cost| (cost, false, None))
                };
                cost.map(|(cost, newer_usage, through_ms)| SessionTotal {
                    includes_children: matches!(self.locator, ClaudeCodeFile { .. }),
                    usd: cost.total_usd,
                    kind: "recorded",
                    partial: newer_usage
                        || cost
                            .since_ms
                            .zip(self.started_ms)
                            .is_some_and(|(since, start)| since > start),
                    since_ms: cost.since_ms,
                    newer_usage,
                    through_ms,
                })
            }
        };
        matches().then_some(SessionTotals { cost, calls })
    }
}

impl SessionTotal {
    fn sum(usd: f64) -> Self {
        Self {
            includes_children: false,
            usd,
            kind: "sum",
            partial: false,
            since_ms: None,
            newer_usage: false,
            through_ms: None,
        }
    }
}

pub(super) async fn run(
    catalog: Arc<SessionCatalog>,
    live: watch::Sender<LiveState>,
    mut shutdown: watch::Receiver<bool>,
) {
    // Include missing figures in the cache so a log with no checkpoint is read only once per stamp.
    let mut checked = HashMap::<SessionLocator, TotalKey>::new();
    loop {
        if *shutdown.borrow() {
            break;
        }
        let Ok(snapshot) = catalog.snapshot() else {
            break;
        };
        let mut jobs = Vec::new();
        let mut retry_after: Option<Duration> = None;
        let locators: HashSet<_> = snapshot.total_keys.iter().map(|key| &key.locator).collect();
        checked.retain(|locator, _| locators.contains(locator));
        for session in snapshot.sessions.iter() {
            let Some(key) = TotalKey::of(session) else {
                continue;
            };
            if let Some(old) = checked.get(&key.locator) {
                if *old == key {
                    continue;
                }
                if let Some(wait) = session.modified_at.and_then(|modified| {
                    let age = (chrono::Utc::now() - modified).to_std().unwrap_or_default();
                    QUIET.checked_sub(age).filter(|wait| !wait.is_zero())
                }) {
                    retry_after = Some(retry_after.map_or(wait, |prior| prior.min(wait)));
                    continue;
                }
            }
            jobs.push((session.modified_at, key));
        }
        if jobs.is_empty() {
            tokio::select! {
                _ = shutdown.changed() => break,
                _ = catalog.sessions_changed.notified() => {},
                _ = async {
                    if let Some(wait) = retry_after { tokio::time::sleep(wait).await } else { std::future::pending().await }
                } => {},
            }
            continue;
        }
        // The table lists the most recently changed sessions first, so they are read first.
        jobs.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));
        let jobs: Vec<_> = jobs.into_iter().map(|(_, key)| key).collect();
        let stop = shutdown.clone();
        let Ok(batch) = tokio::task::spawn_blocking(move || {
            let started = Instant::now();
            let next = AtomicUsize::new(0);
            let batch = Mutex::new(Vec::new());
            let readers = std::thread::available_parallelism()
                .map_or(1, |cores| cores.get() / 2)
                .clamp(1, MAX_READERS)
                .min(jobs.len());
            std::thread::scope(|scope| {
                for _ in 0..readers {
                    scope.spawn(|| loop {
                        let published = batch.lock().map_or(true, |batch| !batch.is_empty());
                        if *stop.borrow() || (published && started.elapsed() >= BATCH) {
                            break;
                        }
                        let Some(key) = jobs.get(next.fetch_add(1, Ordering::Relaxed)) else {
                            break;
                        };
                        let total = key.read();
                        if let Ok(mut batch) = batch.lock() {
                            batch.push((key.clone(), total));
                        }
                    });
                }
            });
            batch.into_inner().unwrap_or_default()
        })
        .await
        else {
            break;
        };
        if *shutdown.borrow() {
            break;
        }
        let mut totals = Vec::new();
        for (key, read) in batch {
            checked.insert(key.locator.clone(), key.clone());
            if let Some(read) = read {
                totals.push((key, read));
            }
        }
        if let Ok(Some(revision)) = catalog.install_totals(totals) {
            // Leave availability to the scan worker and never move the revision backwards.
            live.send_if_modified(|state| {
                if state.revision >= revision {
                    return false;
                }
                state.revision = revision;
                true
            });
        }
    }
}

#[cfg(test)]
mod browser_tests {
    use super::*;
    #[test]
    fn child_inclusion_is_omitted_when_false() {
        let mut total = SessionTotal::sum(1.0);
        assert!(serde_json::to_value(&total)
            .unwrap()
            .get("includesChildren")
            .is_none());
        total.includes_children = true;
        assert_eq!(
            serde_json::to_value(&total).unwrap()["includesChildren"],
            true
        );
    }
}
