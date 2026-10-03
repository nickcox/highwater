use super::{NormalizedSession, SourceDescriptor};
use std::{io, io::BufRead};
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
    #[error("cannot read source session: {0}")]
    Io(#[source] io::Error),
    #[error("invalid JSON on line {line}: {source}")]
    Json {
        line: usize,
        #[source]
        source: serde_json::Error,
    },
    #[error("source structure is invalid: {0}")]
    InvalidStructure(String),
    #[error("required source field is missing or invalid: {field}")]
    RequiredField { field: &'static str },
    #[error("source numeric field is outside the safe JSON integer range: {field}")]
    UnsafeInteger { field: &'static str },
}
