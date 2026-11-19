//! Bounded, read-only access to the totals recorded in session logs.

use crate::{claude_code, copilot, domain::HarnessSessionCost};
use std::{
    fs::File,
    io::{self, BufRead, BufReader, Read, Seek, SeekFrom},
    path::Path,
};

const TAIL_LIMIT: usize = 2 * 1024 * 1024;
const FIRST_BLOCK: usize = 8 * 1024;

fn last_record<T>(
    path: &Path,
    limit: usize,
    item: impl FnMut(&serde_json::Value) -> Option<T>,
) -> io::Result<Option<T>> {
    let file = File::open(path)?;
    let end = file.metadata()?.len();
    last_record_before(file, end, limit, item)
}

fn last_record_before<T>(
    mut file: File,
    mut end: u64,
    limit: usize,
    mut item: impl FnMut(&serde_json::Value) -> Option<T>,
) -> io::Result<Option<T>> {
    let lower_bound = end.saturating_sub(limit as u64);
    let mut block = FIRST_BLOCK;
    let mut prefix = Vec::new();
    // Even valid JSON can be the unfinished last record of an active log.
    let mut skip_unterminated = true;
    while end > lower_bound {
        let start = end.saturating_sub(block as u64).max(lower_bound);
        let len = (end - start) as usize;
        let mut bytes = vec![0; len];
        file.seek(SeekFrom::Start(start))?;
        file.read_exact(&mut bytes)?;
        end = start;
        block = block.saturating_mul(2);

        bytes.append(&mut prefix);
        let mut lines = bytes.rsplit(|byte| *byte == b'\n').peekable();
        if skip_unterminated {
            lines.next();
            if lines.peek().is_none() {
                continue;
            }
            skip_unterminated = false;
        }
        while let Some(line) = lines.next() {
            if start != 0 && lines.peek().is_none() {
                // There may be more of this line in the next block. If the limit cuts it
                // off, don't accept a JSON object that happens to be at its end.
                if start > lower_bound {
                    prefix.extend_from_slice(line);
                }
                break;
            }
            if let Ok(value) = serde_json::from_slice(line) {
                if let Some(matched) = item(&value) {
                    return Ok(Some(matched));
                }
            }
        }
    }
    Ok(None)
}

pub(crate) fn copilot_total(path: &Path) -> io::Result<Option<HarnessSessionCost>> {
    last_record(path, TAIL_LIMIT, copilot::usage_checkpoint_cost)
}

fn claude_cost_record(record: &serde_json::Value) -> Option<Option<HarnessSessionCost>> {
    // Match the latest cost-state even if its value is invalid, as in full analysis.
    (record.get("type").and_then(serde_json::Value::as_str) == Some("cost-state"))
        .then(|| claude_code::cost_state(record))
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct ClaudeCodeTotal {
    pub cost: HarnessSessionCost,
    pub newer_usage: bool,
    pub through_ms: Option<i64>,
}

fn claude_has_usage(record: &serde_json::Value) -> bool {
    use serde_json::Value;
    record.get("type").and_then(Value::as_str) == Some("assistant")
        && record.pointer("/message/model").and_then(Value::as_str) != Some("<synthetic>")
        && record.pointer("/message/usage").is_some_and(|usage| {
            [
                "input_tokens",
                "output_tokens",
                "cache_read_input_tokens",
                "cache_creation_input_tokens",
            ]
            .iter()
            .any(|key| {
                usage
                    .get(key)
                    .and_then(Value::as_u64)
                    .is_some_and(|tokens| tokens > 0)
            })
        })
}

fn claude_usage_time(record: &serde_json::Value, since_ms: Option<i64>) -> Option<i64> {
    if !claude_has_usage(record) {
        return None;
    }
    let at = chrono::DateTime::parse_from_rfc3339(record.get("timestamp")?.as_str()?)
        .ok()?
        .timestamp_millis();
    (at >= since_ms.unwrap_or(0)).then_some(at)
}

pub(crate) fn claude_code_total(path: &Path) -> io::Result<Option<ClaudeCodeTotal>> {
    let mut newer_usage = false;
    let mut found: Option<ClaudeCodeTotal> = None;
    let result = last_record(path, TAIL_LIMIT, |record| {
        if let Some(total) = &mut found {
            total.through_ms = claude_usage_time(record, total.cost.since_ms);
            return total.through_ms.map(|_| Some(*total));
        }
        if let Some(cost) = claude_cost_record(record) {
            let total = cost.map(|cost| ClaudeCodeTotal {
                cost,
                newer_usage,
                through_ms: None,
            });
            if newer_usage && total.is_some() {
                found = total;
                return None;
            }
            return Some(total);
        }
        newer_usage |= claude_has_usage(record);
        None
    })?;
    if let Some(total) = result {
        return Ok(total);
    }
    if found.is_some() {
        return Ok(found);
    }
    let file = File::open(path)?;
    let tail_start = file.metadata()?.len().saturating_sub(TAIL_LIMIT as u64);
    if tail_start == 0 {
        return Ok(None);
    }
    // The tail search only accepts whole lines. Read from the start through the
    // end of the line crossing the boundary, without parsing unrelated records.
    let mut reader = BufReader::new(file);
    let mut line = Vec::new();
    let mut offset = 0;
    let mut checkpoint_offset = 0;
    let mut total = None;
    while offset <= tail_start {
        line.clear();
        let bytes = reader.read_until(b'\n', &mut line)?;
        if bytes == 0 || !line.ends_with(b"\n") {
            break;
        }
        let line_start = offset;
        offset += bytes as u64;
        let Ok(text) = std::str::from_utf8(&line) else {
            continue;
        };
        if !(text.contains("\"cost-state\"")
            || !newer_usage
                && total
                    .as_ref()
                    .is_some_and(|total: &ClaudeCodeTotal| !total.newer_usage)
                && text.contains("\"usage\""))
        {
            continue;
        }
        let Ok(record) = serde_json::from_str(text) else {
            continue;
        };
        if let Some(cost) = claude_cost_record(&record) {
            checkpoint_offset = line_start;
            total = cost.map(|cost| ClaudeCodeTotal {
                cost,
                newer_usage: false,
                through_ms: None,
            });
        } else if let Some(total) = &mut total {
            total.newer_usage |= claude_has_usage(&record);
        }
    }
    if let Some(total) = &mut total {
        total.newer_usage |= newer_usage;
        if total.newer_usage {
            total.through_ms = last_record_before(
                reader.into_inner(),
                checkpoint_offset,
                TAIL_LIMIT,
                |record| claude_usage_time(record, total.cost.since_ms),
            )?;
        }
    }
    Ok(total)
}

pub(crate) fn pi_total(path: &Path) -> io::Result<Option<f64>> {
    let mut reader = BufReader::new(File::open(path)?);
    let mut raw = Vec::new();
    let mut totals = CostSum::default();
    loop {
        raw.clear();
        if reader.read_until(b'\n', &mut raw)? == 0 || !raw.ends_with(b"\n") {
            break;
        }
        let Ok(text) = std::str::from_utf8(&raw) else {
            continue;
        };
        if !text.contains("\"cost\"") {
            continue;
        }
        let Ok(record) = serde_json::from_str::<serde_json::Value>(text) else {
            continue;
        };
        let message = match record.get("type").and_then(serde_json::Value::as_str) {
            Some("compaction") => &record,
            Some("message") => match record.get("message") {
                Some(message)
                    if message.get("role").and_then(serde_json::Value::as_str)
                        == Some("assistant") =>
                {
                    message
                }
                _ => continue,
            },
            _ => continue,
        };
        if let Ok(usage) = crate::pi::reconstruct::parse_assistant_usage(message) {
            totals.add(usage.cost.total);
        }
    }
    Ok(totals.total())
}

#[derive(Default)]
pub(crate) struct CostSum {
    sum: Option<f64>,
}

impl CostSum {
    pub(crate) fn add(&mut self, amount: Option<f64>) {
        if let Some(amount) = amount.filter(|v| v.is_finite() && *v >= 0.0) {
            *self.sum.get_or_insert(0.0) += amount;
        }
    }

    pub(crate) fn total(self) -> Option<f64> {
        self.sum.filter(|value| value.is_finite())
    }
}

/// Price recorded calls without estimating context or running a tokenizer. A
/// subtotal remains useful if the source has some calls without a known price.
pub(crate) fn codex_total(path: &Path) -> Option<(f64, bool)> {
    let loaded = crate::codex::load(path).ok()?;
    let mut totals = CostSum::default();
    let mut partial = false;
    for call in &loaded.session.model_calls {
        let cost = crate::analysis::assess_cost(call, "codex");
        partial |= cost.amount.is_none();
        totals.add(cost.amount);
    }
    Some((totals.total()?, partial))
}

#[cfg(test)]
mod tests;
