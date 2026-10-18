//! Assesses each model call's cost: the harness's recorded cost when the call was billed
//! per token and one was recorded, otherwise an estimate from the embedded price table.
//! Calls covered by a subscription get an API-equivalent cost at the lab's API rate,
//! which is never added to billed cost. See docs/data-semantics.md, "Cost assessment".

mod calculate;
mod report;
mod table;
#[cfg(test)]
mod tests;

pub(crate) use calculate::TokenCounts;
use calculate::{cost, Amount};
pub(crate) use report::summarize;
use std::sync::OnceLock;
pub(crate) use table::{Billing, PriceTable, StartBasis};
use table::{PricePeriod, Rates};

use crate::domain::ReportedUsage;

const EMBEDDED: &str = include_str!("../../data/prices/prices.json");

/// The embedded table, parsed on first use. It is generated and checked by tests, so a
/// parse failure is a build defect rather than a runtime condition.
pub(crate) fn embedded() -> &'static PriceTable {
    static TABLE: OnceLock<PriceTable> = OnceLock::new();
    TABLE.get_or_init(|| PriceTable::parse(EMBEDDED).expect("embedded price table is valid"))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CostKind {
    /// Billed per token; the harness recorded a cost above zero.
    Recorded,
    /// Billed per token; no cost (or zero) was recorded, so the provider's rate was used.
    Estimated,
    /// Covered by a subscription; priced at the lab's API rate. Not a charge.
    ApiEquivalent,
    /// Listed at zero by the provider at the time.
    Free,
    Unknown,
}

/// Why a call was classified as it was, for the call details to explain.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CostRule {
    /// The harness recorded a cost above zero on a per-token provider.
    RecordedCost,
    /// The billing-mode table says how this provider billed at the time.
    BillingModeTable,
    /// An OpenCode `openai` call recorded at $0 while a price was listed: OpenCode's
    /// ChatGPT-plan login removes prices, so this is treated as a subscription.
    OpencodeZeroWithListedPrice,
    /// No billing-mode entry applies, so the call is treated as billed per token.
    PerTokenDefault,
    /// The attempt failed; its default-zero usage is not a measurement.
    FailedAttempt,
    /// The call has no usable time to choose a price by.
    MissingTime,
    /// The price table has no price for the model at the time.
    NoPrice,
    /// Token counts needed for the calculation were not recorded.
    MissingUsage,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct RateUsed {
    pub provider: String,
    pub model: String,
    /// A lab's API rate used for a call on another provider (subscriptions only).
    pub lab_equivalent: bool,
    pub valid_from_ms: Option<i64>,
    pub basis: StartBasis,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct CostAssessment {
    pub kind: CostKind,
    /// The low end when a range applies.
    pub amount: Option<f64>,
    /// Set only when the amount is a range.
    pub amount_high: Option<f64>,
    pub recorded_by_harness: Option<f64>,
    pub billing: Option<Billing>,
    pub rule: CostRule,
    pub rate: Option<RateUsed>,
}

impl CostAssessment {
    fn unknown(rule: CostRule, recorded: Option<f64>, billing: Option<Billing>) -> Self {
        Self {
            kind: CostKind::Unknown,
            amount: None,
            amount_high: None,
            recorded_by_harness: recorded,
            billing,
            rule,
            rate: None,
        }
    }
}

/// What the pricing module needs to know about one call.
#[derive(Debug, Clone, Copy)]
pub(crate) struct CallToPrice<'a> {
    /// The source kind, such as "pi" or "opencode".
    pub harness: &'a str,
    pub provider: Option<&'a str>,
    pub model: Option<&'a str>,
    /// The call's completion time, or its start when that is all there is.
    pub at_ms: Option<i64>,
    pub usage: &'a ReportedUsage,
}

/// A range is shown only when its ends differ by at least this fraction of the low end.
const RANGE_THRESHOLD: f64 = 0.01;

/// Token counts for pricing, or `None` when a needed counter was not recorded.
/// Output must include reasoning exactly once. When the source did not record whether
/// it does, the counts span both readings.
pub(crate) fn token_counts(usage: &ReportedUsage) -> Option<TokenCounts> {
    let (output_low, output_high) = match usage.output {
        Some(output) => (output, output),
        None => {
            let recorded = usage.recorded_output?;
            (recorded, recorded.checked_add(usage.reasoning?)?)
        }
    };
    Some(TokenCounts {
        input: usage.input?,
        cache_read: usage.cache_read?,
        cache_write: usage.cache_write?,
        cache_write_1h: usage.cache_write_1h.unwrap_or(0),
        output_low,
        output_high,
    })
}

fn listed_price(period: Option<&PricePeriod>) -> Option<&Rates> {
    period.and_then(|period| period.rates.as_ref())
}

fn rate_used(provider: &str, model: &str, lab_equivalent: bool, period: &PricePeriod) -> RateUsed {
    RateUsed {
        provider: provider.to_owned(),
        model: model.to_owned(),
        lab_equivalent,
        valid_from_ms: period.start_ms,
        basis: period.basis,
        source: period.source.clone(),
    }
}

fn amounts(amount: Amount) -> (Option<f64>, Option<f64>) {
    let high =
        (amount.high - amount.low > amount.low.abs() * RANGE_THRESHOLD).then_some(amount.high);
    (Some(amount.low), high)
}

pub(crate) fn assess(table: &PriceTable, call: CallToPrice<'_>) -> CostAssessment {
    let usage = call.usage;
    let recorded = usage
        .cost
        .total
        .filter(|value| value.is_finite() && *value >= 0.0);
    if usage.placeholder.is_some() {
        return CostAssessment::unknown(CostRule::FailedAttempt, None, None);
    }
    let (Some(provider), Some(model)) = (call.provider, call.model) else {
        return CostAssessment::unknown(CostRule::NoPrice, recorded, None);
    };
    let Some(at_ms) = call.at_ms else {
        return CostAssessment::unknown(CostRule::MissingTime, recorded, None);
    };

    let mode = table.billing_mode(call.harness, provider, at_ms);
    let price_provider = mode
        .and_then(|mode| mode.price_provider.as_deref())
        .unwrap_or(provider);
    let listed = table.period_at(price_provider, model, at_ms);
    let listed_rates = listed_price(listed);

    let (billing, rule) = match mode {
        Some(mode) => (mode.billing, CostRule::BillingModeTable),
        None if call.harness == "opencode"
            && provider == "openai"
            && recorded == Some(0.0)
            && listed_rates.is_some_and(|rates| !rates.is_free()) =>
        {
            (Billing::Subscription, CostRule::OpencodeZeroWithListedPrice)
        }
        None => (Billing::PerToken, CostRule::PerTokenDefault),
    };

    if billing == Billing::PerToken {
        if let Some(value) = recorded.filter(|value| *value > 0.0) {
            return CostAssessment {
                kind: CostKind::Recorded,
                amount: Some(value),
                amount_high: None,
                recorded_by_harness: Some(value),
                billing: Some(billing),
                rule: CostRule::RecordedCost,
                rate: None,
            };
        }
        let (Some(period), Some(rates)) = (listed, listed_rates) else {
            return CostAssessment::unknown(CostRule::NoPrice, recorded, Some(billing));
        };
        let rate = rate_used(price_provider, model, false, period);
        if rates.is_free() {
            return CostAssessment {
                kind: CostKind::Free,
                amount: Some(0.0),
                amount_high: None,
                recorded_by_harness: recorded,
                billing: Some(billing),
                rule,
                rate: Some(rate),
            };
        }
        return priced(
            CostKind::Estimated,
            rates,
            rate,
            usage,
            recorded,
            billing,
            rule,
        );
    }

    // A subscription: price at the lab's own API rate. A listing that names its lab
    // model is followed; an entry without one is the lab's own (as for `openai-codex`).
    let (lab_provider, lab_model) = table
        .model(price_provider, model)
        .and_then(|prices| prices.lab_equivalent.clone())
        .unwrap_or_else(|| (price_provider.to_owned(), model.to_owned()));
    let lab_period = table.period_at(&lab_provider, &lab_model, at_ms);
    match (lab_period, listed_price(lab_period)) {
        (Some(period), Some(rates)) if !rates.is_free() => {
            let rate = rate_used(&lab_provider, &lab_model, lab_provider != provider, period);
            priced(
                CostKind::ApiEquivalent,
                rates,
                rate,
                usage,
                recorded,
                billing,
                rule,
            )
        }
        _ => CostAssessment::unknown(CostRule::NoPrice, recorded, Some(billing)),
    }
}

/// A call's input prices, at the rates `assess` uses: the provider's listed rate for
/// per-token billing, or the lab's API rate for a subscription. Rates are US dollars per
/// token; a missing cache rate falls back to the input rate, as for OpenAI models.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct InputPrice {
    pub input: f64,
    pub cache_read: f64,
    pub cache_write: f64,
    /// The call's whole input at these rates, from its reported usage, with long-prompt
    /// tiers applied.
    pub prompt_cost: Option<f64>,
}

/// `None` when the call has no model or time, or no price is listed for it.
pub(crate) fn input_price(table: &PriceTable, call: CallToPrice<'_>) -> Option<InputPrice> {
    let (provider, model, at_ms) = (call.provider?, call.model?, call.at_ms?);
    let mode = table.billing_mode(call.harness, provider, at_ms);
    let price_provider = mode
        .and_then(|mode| mode.price_provider.as_deref())
        .unwrap_or(provider);
    let subscription = mode.is_some_and(|mode| mode.billing == Billing::Subscription);
    let (provider, model) = if subscription {
        table
            .model(price_provider, model)
            .and_then(|prices| prices.lab_equivalent.clone())
            .unwrap_or_else(|| (price_provider.to_owned(), model.to_owned()))
    } else {
        (price_provider.to_owned(), model.to_owned())
    };
    let rates = listed_price(table.period_at(&provider, &model, at_ms))?;
    let per_token = |rate: f64| rate / 1_000_000.0;
    let prompt_cost = token_counts(call.usage)
        .and_then(|tokens| {
            cost(
                rates,
                TokenCounts {
                    output_low: 0,
                    output_high: 0,
                    ..tokens
                },
            )
        })
        .map(|amount| amount.low);
    Some(InputPrice {
        input: per_token(rates.input),
        cache_read: per_token(rates.cache_read.unwrap_or(rates.input)),
        cache_write: per_token(rates.cache_write.unwrap_or(rates.input)),
        prompt_cost,
    })
}

fn priced(
    kind: CostKind,
    rates: &Rates,
    rate: RateUsed,
    usage: &ReportedUsage,
    recorded: Option<f64>,
    billing: Billing,
    rule: CostRule,
) -> CostAssessment {
    let Some(amount) = token_counts(usage).and_then(|tokens| cost(rates, tokens)) else {
        return CostAssessment::unknown(CostRule::MissingUsage, recorded, Some(billing));
    };
    let (amount, amount_high) = amounts(amount);
    CostAssessment {
        kind,
        amount,
        amount_high,
        recorded_by_harness: recorded,
        billing: Some(billing),
        rule,
        rate: Some(rate),
    }
}
