//! Closed analysis vocabularies; wire DTOs remain strings at explicit assembly boundaries.
//! Diagnostic ordering is lexical by wire spelling, not enum declaration order.

use std::cmp::Ordering;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DiagnosticCode {
    ExcludedFromContext,
    ModelSwitchTransformation,
    UnavailablePayload,
    UnsupportedImage,
    UnsupportedPayload,
    UnsupportedTokenizer,
    HeuristicTokenizer,
    TokenEstimateOutOfRange,
    ProviderUsageIncomplete,
    EstimatedProviderSerialization,
    KnownFramingOverheadAvailable,
    MissingSystemPrompt,
    MissingToolDefinitions,
    NegativeResidual,
    /// Thinking produced by another model, which the target model does not read.
    ThinkingNotReadByModel,
}

impl DiagnosticCode {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::ExcludedFromContext => "excludedFromContext",
            Self::ModelSwitchTransformation => "modelSwitchTransformation",
            Self::UnavailablePayload => "unavailablePayload",
            Self::UnsupportedImage => "unsupportedImage",
            Self::UnsupportedPayload => "unsupportedPayload",
            Self::UnsupportedTokenizer => "unsupportedTokenizer",
            Self::HeuristicTokenizer => "heuristicTokenizer",
            Self::TokenEstimateOutOfRange => "tokenEstimateOutOfRange",
            Self::ProviderUsageIncomplete => "providerUsageIncomplete",
            Self::EstimatedProviderSerialization => "estimatedProviderSerialization",
            Self::KnownFramingOverheadAvailable => "knownFramingOverheadAvailable",
            Self::MissingSystemPrompt => "missingSystemPrompt",
            Self::MissingToolDefinitions => "missingToolDefinitions",
            Self::NegativeResidual => "negativeResidual",
            Self::ThinkingNotReadByModel => "thinkingNotReadByModel",
        }
    }
}
impl Ord for DiagnosticCode {
    fn cmp(&self, other: &Self) -> Ordering {
        self.as_str().cmp(other.as_str())
    }
}
impl PartialOrd for DiagnosticCode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub(super) fn diagnostic_strings(codes: &[DiagnosticCode]) -> Vec<String> {
    codes.iter().map(|code| code.as_str().into()).collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ChartUnit {
    CalculatedTokens,
    EstimatedTokens,
    Unavailable,
}
impl ChartUnit {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::CalculatedTokens => "calculatedTokens",
            Self::EstimatedTokens => "estimatedTokens",
            Self::Unavailable => "unavailable",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ChartFallbackReason {
    PartialTokenCoverage,
    BestEffortTokenization,
    EstimatedTokenGeometry,
    TokenizationDisabled,
    ContextItemsUnavailable,
}
impl ChartFallbackReason {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::PartialTokenCoverage => "partial-token-coverage",
            Self::BestEffortTokenization => "best-effort-tokenization",
            Self::EstimatedTokenGeometry => "estimated-token-geometry",
            Self::TokenizationDisabled => "tokenizationDisabled",
            Self::ContextItemsUnavailable => "one-or-more-context-items-unavailable",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostic_spellings_and_lexical_order_are_stable() {
        use DiagnosticCode::*;
        let mut codes = vec![
            ExcludedFromContext,
            ModelSwitchTransformation,
            UnavailablePayload,
            UnsupportedImage,
            UnsupportedPayload,
            UnsupportedTokenizer,
            HeuristicTokenizer,
            TokenEstimateOutOfRange,
            ProviderUsageIncomplete,
            EstimatedProviderSerialization,
            KnownFramingOverheadAvailable,
            MissingSystemPrompt,
            MissingToolDefinitions,
            NegativeResidual,
        ];
        codes.sort();
        assert_eq!(
            diagnostic_strings(&codes),
            [
                "estimatedProviderSerialization",
                "excludedFromContext",
                "heuristicTokenizer",
                "knownFramingOverheadAvailable",
                "missingSystemPrompt",
                "missingToolDefinitions",
                "modelSwitchTransformation",
                "negativeResidual",
                "providerUsageIncomplete",
                "tokenEstimateOutOfRange",
                "unavailablePayload",
                "unsupportedImage",
                "unsupportedPayload",
                "unsupportedTokenizer"
            ]
        );
    }

    #[test]
    fn chart_spellings_preserve_mixed_case_and_kebab_case_contracts() {
        assert_eq!(
            [
                ChartUnit::CalculatedTokens,
                ChartUnit::EstimatedTokens,
                ChartUnit::Unavailable
            ]
            .map(ChartUnit::as_str),
            ["calculatedTokens", "estimatedTokens", "unavailable"]
        );
        use ChartFallbackReason::*;
        assert_eq!(
            [
                PartialTokenCoverage,
                BestEffortTokenization,
                EstimatedTokenGeometry,
                TokenizationDisabled,
                ContextItemsUnavailable
            ]
            .map(ChartFallbackReason::as_str),
            [
                "partial-token-coverage",
                "best-effort-tokenization",
                "estimated-token-geometry",
                "tokenizationDisabled",
                "one-or-more-context-items-unavailable"
            ]
        );
    }
}
