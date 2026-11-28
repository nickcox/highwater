//! Reads picker costs off the request path and publishes them in catalogue batches.

use super::{LiveState, SessionCatalog, SessionFile};
use crate::{
    discovery::FileStamp,
    session_totals::{claude_code_total, codex_total, copilot_total, pi_total},
    source::SessionLocator,
};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    fs,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::watch;

const BATCH: Duration = Duration::from_millis(250);
const QUIET: Duration = Duration::from_secs(2);

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

    /// The outer option is absent when the file no longer matches the catalogue stamp.
    fn read(&self) -> Option<Option<SessionTotal>> {
        use SessionLocator::*;
        let path = match &self.locator {
            OpenCode {
                database,
                native_id,
            } => {
                let usd = crate::opencode::storage::session_total(database, native_id)
                    .ok()
                    .flatten();
                return Some(usd.map(SessionTotal::sum));
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
        let total = match &self.locator {
            OpenCode { .. } => unreachable!(),
            PiFile(_) => pi_total(path).ok().flatten().map(SessionTotal::sum),
            VsCodeCopilotFile { .. } => crate::vscode_copilot::session_total(path)
                .ok()
                .flatten()
                .map(SessionTotal::sum),
            CodexFile { .. } => codex_total(path).map(|(usd, partial)| SessionTotal {
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
        matches().then_some(total)
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
    // Include missing totals in the cache so a log with no checkpoint is read only once per stamp.
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
            jobs.push(key);
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
        // Publish the inexpensive totals before processing transcripts that need a full read.
        jobs.sort_by_key(|key| {
            matches!(
                key.locator,
                SessionLocator::PiFile(_)
                    | SessionLocator::CodexFile { .. }
                    | SessionLocator::VsCodeCopilotFile { .. }
            )
        });
        let stop = shutdown.clone();
        let Ok(batch) = tokio::task::spawn_blocking(move || {
            let started = Instant::now();
            let mut batch = Vec::new();
            for key in jobs {
                if *stop.borrow() || (!batch.is_empty() && started.elapsed() >= BATCH) {
                    break;
                }
                let total = key.read();
                batch.push((key, total));
            }
            batch
        })
        .await
        else {
            break;
        };
        if *shutdown.borrow() {
            break;
        }
        let mut totals = Vec::new();
        for (key, total) in batch {
            checked.insert(key.locator.clone(), key.clone());
            if let Some(total) = total {
                totals.push((key, total));
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
