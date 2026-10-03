use std::time::{Duration, Instant};

pub(crate) const DEBOUNCE_QUIET: Duration = Duration::from_millis(200);
pub(crate) const DEBOUNCE_MAX: Duration = Duration::from_secs(1);
pub(crate) const RETRY_DELAYS: [Duration; 3] = [
    Duration::from_millis(100),
    Duration::from_millis(250),
    Duration::from_millis(500),
];
pub(crate) const DEGRADED_SCAN_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum FailureDisposition {
    Retry { attempt: usize, delay: Duration },
    Exhausted,
}

/// Pure catalogue scheduling state. Filesystem work and waiter delivery stay
/// in the coordinator; this type only composes deadlines and transitions.
#[derive(Debug)]
pub(crate) struct ScanScheduler {
    pending_work: bool,
    quiet_deadline: Option<Instant>,
    maximum_deadline: Option<Instant>,
    retry_deadline: Option<Instant>,
    retry_index: usize,
    rate_deadline: Option<Instant>,
    last_scan_start: Option<Instant>,
    watcher_healthy: bool,
    degraded: bool,
    shutdown: bool,
}

impl ScanScheduler {
    pub(crate) fn new(watcher_healthy: bool) -> Self {
        Self {
            pending_work: false,
            quiet_deadline: None,
            maximum_deadline: None,
            retry_deadline: None,
            retry_index: 0,
            rate_deadline: None,
            last_scan_start: None,
            watcher_healthy,
            degraded: !watcher_healthy,
            shutdown: false,
        }
    }

    pub(crate) fn hint(&mut self, now: Instant) {
        if self.shutdown {
            return;
        }
        self.pending_work = true;
        self.quiet_deadline = Some(now + DEBOUNCE_QUIET);
        if self.maximum_deadline.is_none() {
            self.maximum_deadline = Some(now + DEBOUNCE_MAX);
        }
    }

    /// A request joins active or scheduled work without changing its deadlines
    /// or creating a request-only follow-up. Only idle requests start a refresh.
    pub(crate) fn request(&mut self, _now: Instant, active: bool) {
        if self.shutdown || active || self.pending_work {
            return;
        }
        self.pending_work = true;
        self.quiet_deadline = None;
        self.maximum_deadline = None;
    }

    pub(crate) fn watcher_failed(&mut self) -> bool {
        if self.shutdown {
            return false;
        }
        self.watcher_healthy = false;
        let changed = !self.degraded;
        self.degraded = true;
        changed
    }

    pub(crate) fn watcher_healthy(&self) -> bool {
        self.watcher_healthy
    }

    pub(crate) fn is_degraded(&self) -> bool {
        self.degraded
    }

    pub(crate) fn scan_started_at(&self) -> Option<Instant> {
        self.last_scan_start
    }

    pub(crate) fn try_start(&mut self, now: Instant, active: bool) -> bool {
        if self.shutdown
            || active
            || !self.pending_work
            || self.quiet_deadline.is_some()
            || self.retry_deadline.is_some()
            || self.rate_deadline.is_some()
        {
            return false;
        }
        if self.degraded {
            if let Some(last_start) = self.last_scan_start {
                let allowed_at = last_start + DEGRADED_SCAN_INTERVAL;
                if allowed_at > now {
                    self.rate_deadline = Some(allowed_at);
                    return false;
                }
            }
            self.rate_deadline = None;
        }
        self.pending_work = false;
        self.quiet_deadline = None;
        self.maximum_deadline = None;
        self.last_scan_start = Some(now);
        true
    }

    pub(crate) fn next_deadline(&self) -> Option<Instant> {
        [
            self.quiet_deadline,
            self.maximum_deadline,
            self.retry_deadline,
            self.rate_deadline,
        ]
        .into_iter()
        .flatten()
        .min()
    }

    pub(crate) fn timer(&mut self, now: Instant) {
        if self.shutdown {
            return;
        }
        if self.quiet_deadline.is_some_and(|deadline| deadline <= now)
            || self
                .maximum_deadline
                .is_some_and(|deadline| deadline <= now)
        {
            self.quiet_deadline = None;
            self.maximum_deadline = None;
        }
        if self.retry_deadline.is_some_and(|deadline| deadline <= now) {
            self.retry_deadline = None;
            self.pending_work = true;
        }
        if self.rate_deadline.is_some_and(|deadline| deadline <= now) {
            self.rate_deadline = None;
        }
    }

    pub(crate) fn scan_succeeded(&mut self, changed: bool) -> bool {
        let was_degraded = self.degraded;
        self.retry_index = 0;
        self.retry_deadline = None;
        if self.watcher_healthy {
            self.degraded = false;
        }
        changed || (was_degraded && !self.degraded)
    }

    pub(crate) fn scan_failed(&mut self, now: Instant) -> FailureDisposition {
        if self.retry_index < RETRY_DELAYS.len() {
            let attempt = self.retry_index + 1;
            let delay = RETRY_DELAYS[self.retry_index];
            self.retry_index += 1;
            self.retry_deadline = Some(now + delay);
            self.pending_work = true;
            FailureDisposition::Retry { attempt, delay }
        } else {
            // Consumed hints belong to the exhausted cycle. Only a new
            // external event may start another cycle after this transition.
            self.retry_index = 0;
            self.retry_deadline = None;
            self.pending_work = false;
            self.quiet_deadline = None;
            self.maximum_deadline = None;
            self.rate_deadline = None;
            self.degraded = true;
            FailureDisposition::Exhausted
        }
    }

    pub(crate) fn shutdown(&mut self) {
        self.shutdown = true;
        self.pending_work = false;
        self.quiet_deadline = None;
        self.maximum_deadline = None;
        self.retry_deadline = None;
        self.rate_deadline = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(milliseconds: u64) -> Instant {
        Instant::now() + Duration::from_millis(milliseconds)
    }

    #[test]
    fn hints_debounce_quietly_but_have_a_maximum_deadline() {
        let start = at(0);
        let mut scheduler = ScanScheduler::new(true);
        scheduler.hint(start);
        assert_eq!(scheduler.next_deadline(), Some(start + DEBOUNCE_QUIET));
        scheduler.hint(start + Duration::from_millis(100));
        assert_eq!(
            scheduler.next_deadline(),
            Some(start + Duration::from_millis(300))
        );
        assert!(!scheduler.try_start(start + DEBOUNCE_QUIET, false));
        scheduler.timer(start + Duration::from_millis(300));
        assert!(scheduler.try_start(start + Duration::from_millis(300), false));
    }

    #[test]
    fn continuous_hints_cannot_extend_the_maximum_deadline() {
        let start = at(0);
        let mut scheduler = ScanScheduler::new(true);
        for milliseconds in (0..=900).step_by(100) {
            scheduler.hint(start + Duration::from_millis(milliseconds));
        }
        assert_eq!(scheduler.next_deadline(), Some(start + DEBOUNCE_MAX));
        scheduler.timer(start + DEBOUNCE_MAX);
        assert!(scheduler.try_start(start + DEBOUNCE_MAX, false));
    }

    #[test]
    fn active_requests_join_without_scheduling_a_follow_up() {
        let start = at(0);
        let mut scheduler = ScanScheduler::new(true);
        scheduler.request(start, false);
        assert!(scheduler.try_start(start, false));
        scheduler.request(start + Duration::from_millis(1), true);
        assert!(!scheduler.scan_succeeded(false));
        assert!(!scheduler.try_start(start + Duration::from_millis(2), false));
    }

    #[test]
    fn active_hints_schedule_one_follow_up() {
        let start = at(0);
        let mut scheduler = ScanScheduler::new(true);
        scheduler.request(start, false);
        assert!(scheduler.try_start(start, false));
        scheduler.hint(start + Duration::from_millis(1));
        assert!(!scheduler.scan_succeeded(false));
        assert!(!scheduler.try_start(start + Duration::from_millis(2), false));
        scheduler.timer(start + Duration::from_millis(201));
        assert!(scheduler.try_start(start + Duration::from_millis(201), false));
        scheduler.hint(start + Duration::from_millis(202));
        scheduler.hint(start + Duration::from_millis(4));
        assert!(!scheduler.scan_succeeded(false));
    }

    #[test]
    fn retry_expiry_waits_for_a_newer_hint_to_quiet() {
        let start = at(0);
        for watcher_healthy in [true, false] {
            let mut scheduler = ScanScheduler::new(watcher_healthy);
            scheduler.request(start, false);
            assert!(scheduler.try_start(start, false));
            assert!(matches!(
                scheduler.scan_failed(start),
                FailureDisposition::Retry { .. }
            ));
            scheduler.hint(start + Duration::from_millis(50));
            scheduler.timer(start + RETRY_DELAYS[0]);
            assert!(!scheduler.try_start(start + RETRY_DELAYS[0], false));
            scheduler.timer(start + Duration::from_millis(250));
            if watcher_healthy {
                assert!(scheduler.try_start(start + Duration::from_millis(250), false));
            } else {
                assert!(!scheduler.try_start(start + Duration::from_millis(250), false));
                scheduler.timer(start + DEGRADED_SCAN_INTERVAL);
                assert!(scheduler.try_start(start + DEGRADED_SCAN_INTERVAL, false));
            }
        }
    }

    #[test]
    fn requests_joining_backoff_preserve_hint_deadlines() {
        let start = at(0);
        for healthy in [true, false] {
            let mut scheduler = ScanScheduler::new(healthy);
            scheduler.request(start, false);
            assert!(scheduler.try_start(start, false));
            scheduler.scan_failed(start + Duration::from_millis(900));
            scheduler.hint(start + Duration::from_millis(950));
            let deadline = scheduler.next_deadline();
            scheduler.request(start + Duration::from_millis(975), false);
            assert_eq!(scheduler.next_deadline(), deadline);
            scheduler.timer(start + Duration::from_millis(1000));
            assert!(!scheduler.try_start(start + Duration::from_millis(1000), false));
            assert_eq!(
                scheduler.next_deadline(),
                Some(start + Duration::from_millis(1150))
            );
            // Also join after retry expiry, while only debounce remains.
            scheduler.request(start + Duration::from_millis(1100), false);
            scheduler.timer(start + Duration::from_millis(1150));
            assert!(scheduler.try_start(start + Duration::from_millis(1150), false));
        }
    }

    #[test]
    fn exhaustion_discards_consumed_hints_until_a_new_external_trigger() {
        for trigger_is_hint in [true, false] {
            let mut now = at(0);
            let mut scheduler = ScanScheduler::new(true);
            scheduler.request(now, false);
            assert!(scheduler.try_start(now, false));
            for delay in RETRY_DELAYS {
                assert!(matches!(
                    scheduler.scan_failed(now),
                    FailureDisposition::Retry { .. }
                ));
                now += delay;
                scheduler.timer(now);
                assert!(scheduler.try_start(now, false));
            }
            scheduler.hint(now + Duration::from_millis(1));
            assert_eq!(
                scheduler.scan_failed(now + Duration::from_millis(2)),
                FailureDisposition::Exhausted
            );
            assert_eq!(scheduler.next_deadline(), None);
            now += Duration::from_secs(2);
            scheduler.timer(now);
            assert!(!scheduler.try_start(now, false));
            if trigger_is_hint {
                scheduler.hint(now);
                assert!(!scheduler.try_start(now, false));
                now += DEBOUNCE_QUIET;
                scheduler.timer(now);
            } else {
                scheduler.request(now, false);
            }
            assert!(scheduler.try_start(now, false));
            assert!(matches!(
                scheduler.scan_failed(now),
                FailureDisposition::Retry { attempt: 1, .. }
            ));
        }
    }

    #[test]
    fn retries_are_bounded_and_do_not_bypass_deadlines() {
        let start = at(0);
        let mut scheduler = ScanScheduler::new(true);
        scheduler.request(start, false);
        assert!(scheduler.try_start(start, false));
        assert_eq!(
            scheduler.scan_failed(start),
            FailureDisposition::Retry {
                attempt: 1,
                delay: RETRY_DELAYS[0]
            }
        );
        assert!(!scheduler.try_start(start + RETRY_DELAYS[0], false));
        let second_start = start + DEGRADED_SCAN_INTERVAL;
        scheduler.timer(second_start);
        assert!(scheduler.try_start(second_start, false));
        assert_eq!(
            scheduler.scan_failed(second_start),
            FailureDisposition::Retry {
                attempt: 2,
                delay: RETRY_DELAYS[1]
            }
        );
        let third_start = second_start + DEGRADED_SCAN_INTERVAL;
        scheduler.timer(third_start);
        assert!(scheduler.try_start(third_start, false));
        assert_eq!(
            scheduler.scan_failed(third_start),
            FailureDisposition::Retry {
                attempt: 3,
                delay: RETRY_DELAYS[2]
            }
        );
        let fourth_start = third_start + DEGRADED_SCAN_INTERVAL;
        scheduler.timer(fourth_start);
        assert!(scheduler.try_start(fourth_start, false));
        assert_eq!(
            scheduler.scan_failed(fourth_start),
            FailureDisposition::Exhausted
        );
    }

    #[test]
    fn degraded_scans_are_rate_limited_and_shutdown_is_terminal() {
        let start = at(0);
        let mut scheduler = ScanScheduler::new(false);
        scheduler.request(start, false);
        assert!(scheduler.try_start(start, false));
        assert!(!scheduler.watcher_failed());
        scheduler.scan_succeeded(false);
        scheduler.request(start + Duration::from_millis(1), false);
        assert!(!scheduler.try_start(start + Duration::from_millis(1), false));
        scheduler.timer(start + DEGRADED_SCAN_INTERVAL);
        assert!(scheduler.try_start(start + DEGRADED_SCAN_INTERVAL, false));
        scheduler.shutdown();
        assert!(!scheduler.try_start(start + Duration::from_secs(2), false));
    }
}
