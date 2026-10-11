//! Converts cost assessments to the API's shapes and totals them for the session.

use super::{Billing, CostAssessment, CostKind, CostRule, PriceTable, StartBasis};
use crate::api;

impl CostKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Recorded => "recorded",
            Self::Estimated => "estimated",
            Self::ApiEquivalent => "apiEquivalent",
            Self::Free => "free",
            Self::Unknown => "unknown",
        }
    }
}

impl CostRule {
    fn as_str(self) -> &'static str {
        match self {
            Self::RecordedCost => "recordedCost",
            Self::BillingModeTable => "billingModeTable",
            Self::OpencodeZeroWithListedPrice => "opencodeZeroWithListedPrice",
            Self::PerTokenDefault => "perTokenDefault",
            Self::FailedAttempt => "failedAttempt",
            Self::MissingTime => "missingTime",
            Self::NoPrice => "noPrice",
            Self::MissingUsage => "missingUsage",
        }
    }
}

impl StartBasis {
    fn as_str(self) -> &'static str {
        match self {
            Self::ModelsDevCommit => "modelsDevCommit",
            Self::Documented => "documented",
            Self::FirstObserved => "firstObserved",
        }
    }
}

fn instant(ms: i64) -> Option<String> {
    chrono::DateTime::from_timestamp_millis(ms)
        .map(|time| time.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
}

impl CostAssessment {
    pub(crate) fn to_api(&self) -> api::CostAssessment {
        api::CostAssessment {
            kind: self.kind.as_str(),
            amount: self.amount,
            amount_high: self.amount_high,
            recorded_by_harness: self.recorded_by_harness,
            billing_mode: self.billing.map(|billing| match billing {
                Billing::PerToken => "perToken",
                Billing::Subscription => "subscription",
            }),
            classification_rule: self.rule.as_str(),
            rate: self.rate.as_ref().map(|rate| api::CostRate {
                provider: rate.provider.clone(),
                model: rate.model.clone(),
                lab_equivalent: rate.lab_equivalent,
                valid_from: rate.valid_from_ms.and_then(instant),
                start_basis: rate.basis.as_str(),
                source: rate.source.clone(),
            }),
        }
    }
}

fn add(subtotal: &mut api::CostSubtotal, assessment: &CostAssessment) {
    let Some(low) = assessment.amount else {
        return;
    };
    let high = assessment.amount_high.unwrap_or(low);
    subtotal.calls += 1;
    subtotal.low = Some(subtotal.low.unwrap_or(0.0) + low);
    subtotal.high = Some(subtotal.high.unwrap_or(0.0) + high);
}

/// A non-finite sum is not a total anyone can use; it is reported as unknown.
fn finite(mut subtotal: api::CostSubtotal) -> api::CostSubtotal {
    if !subtotal.low.is_some_and(f64::is_finite) || !subtotal.high.is_some_and(f64::is_finite) {
        subtotal.low = None;
        subtotal.high = None;
    }
    subtotal
}

pub(crate) fn summarize(assessments: &[CostAssessment], table: &PriceTable) -> api::CostSummary {
    let mut billed = api::CostSubtotal::default();
    let mut api_equivalent = api::CostSubtotal::default();
    let (mut unknown_calls, mut failed_attempt_calls) = (0, 0);
    for assessment in assessments {
        match assessment.kind {
            CostKind::Recorded | CostKind::Estimated | CostKind::Free => {
                add(&mut billed, assessment)
            }
            CostKind::ApiEquivalent => add(&mut api_equivalent, assessment),
            CostKind::Unknown if assessment.rule == CostRule::FailedAttempt => {
                failed_attempt_calls += 1
            }
            CostKind::Unknown => unknown_calls += 1,
        }
    }
    api::CostSummary {
        billed: finite(billed),
        api_equivalent: finite(api_equivalent),
        unknown_calls,
        failed_attempt_calls,
        price_data: api::PriceDataSummary {
            models_dev_commit: table.data.models_dev_commit.clone(),
            models_dev_committed_at: table.data.models_dev_committed_at.clone(),
            amendments_imported_from: table.data.amendments_imported_from.clone(),
        },
    }
}
