use crate::{analysis::AnalysisError, domain::SourceError};
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;
use thiserror::Error;

/// Non-cloneable causes are retained once and shared by flight subscribers.
#[derive(Debug, Error)]
pub(super) enum FlightError {
    #[error("source session is invalid")]
    Source(#[source] SourceError),
    #[error("source session cannot be loaded")]
    SourceLoad(#[source] crate::source::LoadError),
    #[error("cannot read session")]
    Io(#[source] std::io::Error),
    #[error("session changed while it was being analysed")]
    SourceChanged,
    #[error("cannot fingerprint session")]
    Fingerprint(#[source] std::time::SystemTimeError),
    #[error("analysis failed")]
    Analysis(#[source] AnalysisError),
    #[error("cannot serialize analysis")]
    Serialization(#[source] serde_json::Error),
    #[error("analysis task failed")]
    Task(#[source] tokio::task::JoinError),
    #[error("analysis service is unavailable")]
    Unavailable,
}

impl From<crate::source::LoadError> for FlightError {
    fn from(error: crate::source::LoadError) -> Self {
        match error {
            crate::source::LoadError::Pi(error) | crate::source::LoadError::ClaudeCode(error) => {
                Self::Source(error)
            }
            other => Self::SourceLoad(other),
        }
    }
}

#[cfg(test)]
mod tests;

type Details = (StatusCode, &'static str, &'static str);
const NOT_FOUND: Details = (
    StatusCode::NOT_FOUND,
    "SESSION_NOT_FOUND",
    "session not found",
);
const READ_FAILED: Details = (
    StatusCode::INTERNAL_SERVER_ERROR,
    "SESSION_ANALYSIS_FAILED",
    "cannot read session",
);
const INVALID_SOURCE: Details = (
    StatusCode::UNPROCESSABLE_ENTITY,
    "SESSION_PARSE_FAILED",
    "source session is invalid",
);
const INTERNAL: Details = (
    StatusCode::INTERNAL_SERVER_ERROR,
    "SESSION_ANALYSIS_FAILED",
    "internal server error",
);

fn io_details(error: &std::io::Error) -> Details {
    if error.kind() == std::io::ErrorKind::NotFound {
        NOT_FOUND
    } else {
        READ_FAILED
    }
}
fn source_details(error: &SourceError) -> Details {
    match error {
        SourceError::Io(error) => io_details(error),
        _ => INVALID_SOURCE,
    }
}

fn load_details(error: &crate::source::LoadError) -> Details {
    use crate::{opencode::storage::StorageError, source::LoadError};
    match error {
        LoadError::Pi(error) => source_details(error),
        LoadError::Replay(crate::opencode::replay::ReplayError::UnsupportedHistory) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            "SESSION_REPLAY_UNSUPPORTED",
            "source history uses unsupported replay semantics",
        ),
        LoadError::Replay(_) => INVALID_SOURCE,
        LoadError::ClaudeCode(error) | LoadError::VsCodeCopilot(error) => source_details(error),
        LoadError::Storage(error) => match error {
            StorageError::NotFound => NOT_FOUND,
            StorageError::Busy | StorageError::Cancelled => (
                StatusCode::SERVICE_UNAVAILABLE,
                "SESSION_SOURCE_UNAVAILABLE",
                "source session is temporarily unavailable",
            ),
            StorageError::UnsupportedLayout => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "SESSION_SOURCE_UNSUPPORTED",
                "source storage layout is unsupported",
            ),
            StorageError::BudgetExceeded => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "SESSION_SOURCE_TOO_LARGE",
                "source session exceeds the read budget",
            ),
            StorageError::Corrupt | StorageError::InvalidRecords => INVALID_SOURCE,
            StorageError::Database(_) | StorageError::Io(_) => READ_FAILED,
        },
    }
}

impl FlightError {
    /// Fixed category only: never includes a cause, path, ID, transcript, or panic.
    pub(super) fn safe_diagnostic(&self) -> &'static str {
        match self {
            Self::Source(SourceError::Io(_)) | Self::Io(_) => "analysis_failure category=io",
            Self::Source(_) => "analysis_failure category=source",
            Self::SourceLoad(_) => "analysis_failure category=source_load",
            Self::SourceChanged => "analysis_failure category=source_changed",
            Self::Fingerprint(_) => "analysis_failure category=fingerprint",
            Self::Analysis(_) => "analysis_failure category=invariant",
            Self::Serialization(_) => "analysis_failure category=serialization",
            Self::Task(_) => "analysis_failure category=task",
            Self::Unavailable => "analysis_failure category=unavailable",
        }
    }

    fn details(&self) -> Details {
        match self {
            Self::Source(error) => source_details(error),
            Self::SourceLoad(error) => load_details(error),
            Self::Io(error) => io_details(error),
            Self::SourceChanged => (
                StatusCode::CONFLICT,
                "SESSION_SOURCE_CHANGED",
                "session changed while it was being analysed",
            ),
            Self::Fingerprint(_) => READ_FAILED,
            Self::Analysis(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "SESSION_ANALYSIS_FAILED",
                "analysis failed",
            ),
            Self::Unavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "SESSION_ANALYSIS_FAILED",
                "analysis service is unavailable",
            ),
            Self::Serialization(_) | Self::Task(_) => INTERNAL,
        }
    }
}

#[derive(Debug, Error)]
pub(crate) enum AppError {
    #[error("cannot read session: {0}")]
    Io(#[from] std::io::Error),
    #[error("source session is invalid: {0}")]
    Source(#[from] SourceError),
    #[error("analysis failed: {0}")]
    Analysis(#[from] AnalysisError),
    #[error("{0}")]
    Shared(#[source] Arc<FlightError>),
    #[error("catalogue refresh is unavailable")]
    CatalogRefreshUnavailable,
    #[error("{0}")]
    Message(String),
    #[error("cannot serialize response")]
    Serialization(#[from] serde_json::Error),
    #[error("cannot build response")]
    ResponseBuild(#[from] axum::http::Error),
    #[error("unknown session")]
    NotFound,
    #[error("ambiguous session reference")]
    AmbiguousSession,
    #[error("request host or origin is not this local server")]
    ForeignOrigin,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            Self::NotFound => NOT_FOUND,
            Self::AmbiguousSession => (
                StatusCode::CONFLICT,
                "AMBIGUOUS_SESSION",
                "multiple sources share this session reference; remove duplicates or resolve the collision",
            ),
            Self::ForeignOrigin => (
                StatusCode::FORBIDDEN,
                "FOREIGN_ORIGIN",
                "requests must address this server as 127.0.0.1 or localhost on its own port",
            ),
            Self::Io(error) => io_details(error),
            Self::Source(error) => source_details(error),
            Self::Analysis(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "SESSION_ANALYSIS_FAILED",
                "analysis failed",
            ),
            Self::Shared(error) => error.details(),
            Self::CatalogRefreshUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "CATALOG_REFRESH_UNAVAILABLE",
                "catalogue refresh is unavailable",
            ),
            Self::Message(_) | Self::Serialization(_) | Self::ResponseBuild(_) => INTERNAL,
        };
        (
            status,
            Json(serde_json::json!({ "error": { "code": code, "message": message } })),
        )
            .into_response()
    }
}
