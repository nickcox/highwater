//! Cost from token counts and per-million rates, choosing the long-prompt tier that applies.

use super::table::Rates;

/// Token counts for one call. `output_high` exceeds `output_low` only when the
/// source did not record whether its output counter already includes reasoning.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct TokenCounts {
    pub input: u64,
    pub cache_read: u64,
    pub cache_write: u64,
    /// The part of `cache_write` written with a one-hour lifetime.
    pub cache_write_1h: u64,
    pub output_low: u64,
    pub output_high: u64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Amount {
    pub low: f64,
    pub high: f64,
}

const PER_MILLION: f64 = 1_000_000.0;

/// A tier applies when the whole prompt (uncached input plus cache reads and writes)
/// exceeds its size; the largest such tier wins. A missing cache rate falls back to the
/// input rate. One-hour cache writes cost twice the input rate, as Anthropic charges;
/// only Anthropic models record them separately.
pub(crate) fn cost(rates: &Rates, tokens: TokenCounts) -> Option<Amount> {
    if tokens.cache_write_1h > tokens.cache_write || tokens.output_high < tokens.output_low {
        return None;
    }
    let prompt = tokens
        .input
        .checked_add(tokens.cache_read)?
        .checked_add(tokens.cache_write)?;
    let tier = rates
        .tiers
        .iter()
        .filter(|tier| prompt > tier.above)
        .max_by_key(|tier| tier.above);
    let input = tier.and_then(|tier| tier.input).unwrap_or(rates.input);
    let output = tier.and_then(|tier| tier.output).unwrap_or(rates.output);
    let cache_read = tier
        .and_then(|tier| tier.cache_read)
        .or(rates.cache_read)
        .unwrap_or(input);
    let cache_write = tier
        .and_then(|tier| tier.cache_write)
        .or(rates.cache_write)
        .unwrap_or(input);
    let short_write = tokens.cache_write - tokens.cache_write_1h;
    let prompt_cost = tokens.input as f64 * input
        + tokens.cache_read as f64 * cache_read
        + short_write as f64 * cache_write
        + tokens.cache_write_1h as f64 * input * 2.0;
    let low = (prompt_cost + tokens.output_low as f64 * output) / PER_MILLION;
    let high = (prompt_cost + tokens.output_high as f64 * output) / PER_MILLION;
    (low.is_finite() && high.is_finite()).then_some(Amount { low, high })
}
