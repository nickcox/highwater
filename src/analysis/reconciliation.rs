use super::CoverageSummary;
use crate::domain::{ReportedUsage, MAX_SAFE_JSON_INTEGER};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum UsageCompleteness {
    Complete,
    Partial,
    Missing,
}

impl UsageCompleteness {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Complete => "complete",
            Self::Partial => "partial",
            Self::Missing => "missing",
        }
    }
}

pub(crate) fn reported_prompt_tokens(usage: &ReportedUsage) -> (Option<u64>, UsageCompleteness) {
    let fields = [usage.input, usage.cache_read, usage.cache_write];
    let known = fields.iter().filter(|value| value.is_some()).count();
    let completeness = match known {
        3 => UsageCompleteness::Complete,
        0 => UsageCompleteness::Missing,
        _ => UsageCompleteness::Partial,
    };
    let total = fields.into_iter().try_fold(0_u64, |sum, value| {
        sum.checked_add(value?)
            .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
    });
    let completeness = if known == 3 && total.is_none() {
        UsageCompleteness::Partial
    } else {
        completeness
    };
    (total, completeness)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ReconciliationStatus {
    Unavailable,
    Partial,
    Close,
    Notable,
    Large,
}

impl ReconciliationStatus {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Unavailable => "unavailable",
            Self::Partial => "partial",
            Self::Close => "close",
            Self::Notable => "notable",
            Self::Large => "large",
        }
    }
}

pub(super) fn reconciliation_status(
    reported_prompt: Option<u64>,
    calculated_request: Option<u64>,
    residual_percent: Option<f64>,
    coverage: &CoverageSummary,
    usage: UsageCompleteness,
) -> ReconciliationStatus {
    if reported_prompt.is_none() || calculated_request.is_none() {
        return ReconciliationStatus::Unavailable;
    }
    if usage != UsageCompleteness::Complete
        || coverage.partial_items > 0
        || coverage.unavailable_items > 0
    {
        return ReconciliationStatus::Partial;
    }
    let Some(percent) = residual_percent else {
        return ReconciliationStatus::Unavailable;
    };
    if percent <= 0.05 {
        ReconciliationStatus::Close
    } else if percent <= 0.20 {
        ReconciliationStatus::Notable
    } else {
        ReconciliationStatus::Large
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reconciliation_thresholds_and_wire_spellings_are_stable() {
        let coverage = CoverageSummary::default();
        for (residual, status) in [
            (0.0, "close"),
            (0.05, "close"),
            (0.05001, "notable"),
            (0.20, "notable"),
            (0.20001, "large"),
        ] {
            assert_eq!(
                reconciliation_status(
                    Some(10),
                    Some(10),
                    Some(residual),
                    &coverage,
                    UsageCompleteness::Complete
                )
                .as_str(),
                status
            );
        }
        for (reported, calculated, residual) in [
            (None, Some(10), Some(0.0)),
            (Some(10), None, Some(0.0)),
            (Some(0), Some(0), None),
        ] {
            assert_eq!(
                reconciliation_status(
                    reported,
                    calculated,
                    residual,
                    &coverage,
                    UsageCompleteness::Complete
                )
                .as_str(),
                "unavailable"
            );
        }
        assert_eq!(
            reconciliation_status(
                Some(10),
                Some(10),
                Some(0.0),
                &coverage,
                UsageCompleteness::Partial
            )
            .as_str(),
            "partial"
        );
        let partial = CoverageSummary {
            partial_items: 1,
            ..coverage
        };
        assert_eq!(
            reconciliation_status(
                Some(10),
                Some(10),
                Some(0.0),
                &partial,
                UsageCompleteness::Complete
            )
            .as_str(),
            "partial"
        );
        assert_eq!(
            [
                UsageCompleteness::Complete,
                UsageCompleteness::Partial,
                UsageCompleteness::Missing
            ]
            .map(UsageCompleteness::as_str),
            ["complete", "partial", "missing"]
        );
    }

    #[test]
    fn prompt_usage_distinguishes_complete_partial_missing_and_overflow() {
        let complete = ReportedUsage {
            input: Some(1),
            cache_read: Some(2),
            cache_write: Some(3),
            ..ReportedUsage::default()
        };
        assert_eq!(
            reported_prompt_tokens(&complete),
            (Some(6), UsageCompleteness::Complete)
        );
        let partial = ReportedUsage {
            input: Some(1),
            ..ReportedUsage::default()
        };
        assert_eq!(
            reported_prompt_tokens(&partial),
            (None, UsageCompleteness::Partial)
        );
        assert_eq!(
            reported_prompt_tokens(&ReportedUsage::default()),
            (None, UsageCompleteness::Missing)
        );
        let overflow = ReportedUsage {
            input: Some(u64::MAX),
            cache_read: Some(1),
            cache_write: Some(0),
            ..ReportedUsage::default()
        };
        assert_eq!(
            reported_prompt_tokens(&overflow),
            (None, UsageCompleteness::Partial)
        );
    }
}
