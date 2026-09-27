use super::{NormalizedSession, SourceDescriptor};
use std::io::BufRead;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[allow(dead_code)]
pub(crate) enum CostBasis {
    #[default]
    Unknown,
    PiModelRates,
    SourceModelRates,
    ProviderReported,
}

/// Boundary implemented by each supported session-file source.
pub(crate) trait SessionSourceAdapter {
    fn source_descriptor(&self) -> SourceDescriptor;
    #[allow(dead_code)]
    fn parse(&self, input: &mut dyn BufRead) -> Result<NormalizedSession, SourceError>;
}

#[derive(Debug, Error)]
pub(crate) enum SourceError {
    #[error("source parse failed: {0}")]
    Parse(String),
    #[error("{0}")]
    Invalid(String),
}
