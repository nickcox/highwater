//! Reported usage and cost rollups: per-call cumulative series and session subtotals.

use super::*;

#[derive(Debug, Clone, Copy)]
pub(super) struct UsageSnapshot {
    pub(super) prompt: Option<u64>,
    pub(super) completion: Option<u64>,
    pub(super) reasoning: Option<u64>,
    pub(super) completeness: UsageCompleteness,
}

#[derive(Debug, Clone, Copy)]
pub(super) struct CumulativeUsage {
    prompt_sum: u64,
    prompt_overflow: bool,
    prompt_complete: bool,
    prompt_known: bool,
    output_sum: u64,
    output_complete: bool,
    reasoning_sum: u64,
    reasoning_complete: bool,
}

impl Default for CumulativeUsage {
    fn default() -> Self {
        Self {
            prompt_sum: 0,
            prompt_overflow: false,
            prompt_complete: true,
            prompt_known: false,
            output_sum: 0,
            output_complete: true,
            reasoning_sum: 0,
            reasoning_complete: true,
        }
    }
}

impl CumulativeUsage {
    fn update(&mut self, call: &NormalizedModelCall) {
        let (prompt, completeness) = reported_prompt_tokens(&call.reported_usage);
        match completeness {
            UsageCompleteness::Complete => {
                self.prompt_known = true;
                if let Some(value) = prompt {
                    if let Some(total) = self
                        .prompt_sum
                        .checked_add(value)
                        .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
                    {
                        self.prompt_sum = total;
                    } else {
                        self.prompt_overflow = true;
                        self.prompt_complete = false;
                    }
                } else {
                    self.prompt_overflow = true;
                }
            }
            UsageCompleteness::Partial => {
                self.prompt_complete = false;
                self.prompt_known = true;
            }
            UsageCompleteness::Missing => self.prompt_complete = false,
        }
        if let Some(value) = call.reported_usage.output {
            if let Some(total) = self
                .output_sum
                .checked_add(value)
                .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
            {
                self.output_sum = total;
            } else {
                self.output_complete = false;
            }
        } else {
            self.output_complete = false;
        }
        if let Some(value) = call.reported_usage.reasoning {
            if let Some(total) = self
                .reasoning_sum
                .checked_add(value)
                .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
            {
                self.reasoning_sum = total;
            } else {
                self.reasoning_complete = false;
            }
        } else {
            self.reasoning_complete = false;
        }
    }

    fn finish(self) -> UsageSnapshot {
        let prompt_complete = self.prompt_complete && !self.prompt_overflow && self.prompt_known;
        let completeness = if prompt_complete {
            UsageCompleteness::Complete
        } else if self.prompt_known {
            UsageCompleteness::Partial
        } else {
            UsageCompleteness::Missing
        };
        UsageSnapshot {
            prompt: prompt_complete.then_some(self.prompt_sum),
            completion: self.output_complete.then_some(self.output_sum),
            reasoning: self.reasoning_complete.then_some(self.reasoning_sum),
            completeness,
        }
    }
}

pub(super) fn usage_rollup(calls: &[NormalizedModelCall]) -> (Vec<UsageSnapshot>, UsageSnapshot) {
    let mut accumulator = CumulativeUsage::default();
    let snapshots = calls
        .iter()
        .map(|call| {
            accumulator.update(call);
            accumulator.finish()
        })
        .collect();
    let final_snapshot = if calls.is_empty() {
        UsageSnapshot {
            prompt: None,
            completion: None,
            reasoning: None,
            completeness: UsageCompleteness::Missing,
        }
    } else {
        accumulator.finish()
    };
    (snapshots, final_snapshot)
}
/// Session subtotals over calls that recorded a value. Unlike the per-call
/// cumulative series, one unknown call does not hide what was recorded; the
/// coverage says how many calls each subtotal includes.
#[derive(Debug, Clone, Copy, Default)]
pub(super) struct SessionUsageSubtotals {
    pub(super) prompt: Option<u64>,
    pub(super) completion: Option<u64>,
    pub(super) reasoning: Option<u64>,
    pub(super) usage_coverage: RecordedCallCoverage,
    pub(super) cost: Option<f64>,
    pub(super) cost_coverage: RecordedCallCoverage,
}

/// A recorded token subtotal with per-field coverage. Overflow remains unavailable
/// even if later calls record values that would fit on their own.
#[derive(Debug, Default)]
pub(crate) struct RecordedTokenSubtotal {
    pub(crate) value: Option<u64>,
    pub(crate) coverage: RecordedCallCoverage,
    overflowed: bool,
}

impl RecordedTokenSubtotal {
    pub(crate) fn record(&mut self, value: Option<u64>, failed_attempt: bool) {
        if failed_attempt {
            self.coverage.failed_attempt_calls += 1;
        } else if value.is_some() {
            self.coverage.recorded_calls += 1;
            add_recorded(&mut self.value, &mut self.overflowed, value);
        } else {
            self.coverage.missing_calls += 1;
        }
    }
}

fn add_recorded(total: &mut Option<u64>, overflowed: &mut bool, value: Option<u64>) {
    let Some(value) = value.filter(|_| !*overflowed) else {
        return;
    };
    let next = total
        .unwrap_or(0)
        .checked_add(value)
        .filter(|next| *next <= MAX_SAFE_JSON_INTEGER);
    *overflowed |= next.is_none();
    *total = next;
}

/// Token subtotals over a session's calls, each with its own coverage. The report and the
/// session summary both read these, so they count calls the same way.
#[derive(Debug, Default)]
pub(crate) struct ReportedTokenSubtotals {
    pub(crate) prompt: RecordedTokenSubtotal,
    pub(crate) fresh_input: RecordedTokenSubtotal,
    pub(crate) cache_read: RecordedTokenSubtotal,
    pub(crate) cache_write: RecordedTokenSubtotal,
    pub(crate) output: RecordedTokenSubtotal,
    pub(crate) reasoning: RecordedTokenSubtotal,
}

pub(crate) fn reported_token_subtotals(calls: &[NormalizedModelCall]) -> ReportedTokenSubtotals {
    let mut subtotals = ReportedTokenSubtotals::default();
    for usage in calls.iter().map(|call| &call.reported_usage) {
        let failed_attempt = usage.placeholder.is_some();
        // A prompt total is returned only when it is complete.
        let (prompt, _) = reported_prompt_tokens(usage);
        subtotals.prompt.record(prompt, failed_attempt);
        subtotals.fresh_input.record(usage.input, failed_attempt);
        subtotals
            .cache_read
            .record(usage.cache_read, failed_attempt);
        subtotals
            .cache_write
            .record(usage.cache_write, failed_attempt);
        subtotals.output.record(usage.output, failed_attempt);
        subtotals.reasoning.record(usage.reasoning, failed_attempt);
    }
    subtotals
}

pub(super) fn session_usage_subtotals(calls: &[NormalizedModelCall]) -> SessionUsageSubtotals {
    let tokens = reported_token_subtotals(calls);
    let mut subtotals = SessionUsageSubtotals {
        prompt: tokens.prompt.value,
        completion: tokens.output.value,
        reasoning: tokens.reasoning.value,
        usage_coverage: tokens.prompt.coverage,
        ..SessionUsageSubtotals::default()
    };
    for usage in calls.iter().map(|call| &call.reported_usage) {
        match usage
            .cost
            .total
            .filter(|value| value.is_finite() && *value >= 0.0)
        {
            Some(value) => {
                subtotals.cost_coverage.recorded_calls += 1;
                let next = subtotals.cost.unwrap_or(0.0) + value;
                subtotals.cost = Some(next).filter(|next| next.is_finite());
            }
            None if usage.placeholder.is_some() => {
                subtotals.cost_coverage.failed_attempt_calls += 1
            }
            None => subtotals.cost_coverage.missing_calls += 1,
        }
    }
    subtotals
}
