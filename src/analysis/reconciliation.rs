use super::CoverageSummary;
use crate::domain::ReportedUsage;

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
    let total = fields
        .into_iter()
        .try_fold(0_u64, |sum, value| sum.checked_add(value?));
    let completeness = if known == 3 && total.is_none() {
        UsageCompleteness::Partial
    } else {
        completeness
    };
    (total, completeness)
}

pub(crate) fn reconciliation_status(
    reported_prompt: Option<u64>,
    calculated_request: Option<u64>,
    residual_percent: Option<f64>,
    coverage: &CoverageSummary,
    usage: UsageCompleteness,
) -> String {
    if reported_prompt.is_none() || calculated_request.is_none() {
        return "unavailable".into();
    }
    if usage != UsageCompleteness::Complete
        || coverage.partial_items > 0
        || coverage.unavailable_items > 0
    {
        return "partial".into();
    }
    let Some(percent) = residual_percent else {
        return "unavailable".into();
    };
    if percent <= 0.05 {
        "close".into()
    } else if percent <= 0.20 {
        "notable".into()
    } else {
        "large".into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
