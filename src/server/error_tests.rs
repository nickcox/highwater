use super::*;

#[tokio::test]
async fn typed_causes_remain_inspectable_but_shared_http_and_diagnostics_are_redacted() {
    let errors = [
        (
            FlightError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "private /tmp/session",
            )),
            StatusCode::NOT_FOUND,
            "SESSION_NOT_FOUND",
        ),
        (
            FlightError::Io(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "private /tmp/session",
            )),
            StatusCode::INTERNAL_SERVER_ERROR,
            "SESSION_ANALYSIS_FAILED",
        ),
        (
            FlightError::Source(SourceError::InvalidStructure("private transcript".into())),
            StatusCode::UNPROCESSABLE_ENTITY,
            "SESSION_PARSE_FAILED",
        ),
        (
            FlightError::Analysis(AnalysisError::InvalidSession("private invariant".into())),
            StatusCode::INTERNAL_SERVER_ERROR,
            "SESSION_ANALYSIS_FAILED",
        ),
        (
            FlightError::Serialization(
                serde_json::from_str::<serde_json::Value>("private").expect_err("malformed JSON"),
            ),
            StatusCode::INTERNAL_SERVER_ERROR,
            "SESSION_ANALYSIS_FAILED",
        ),
        (
            FlightError::SourceChanged,
            StatusCode::CONFLICT,
            "SESSION_SOURCE_CHANGED",
        ),
        (
            FlightError::Unavailable,
            StatusCode::SERVICE_UNAVAILABLE,
            "SESSION_ANALYSIS_FAILED",
        ),
        (
            FlightError::from(crate::source::LoadError::Storage(
                crate::opencode::storage::StorageError::Busy,
            )),
            StatusCode::SERVICE_UNAVAILABLE,
            "SESSION_SOURCE_UNAVAILABLE",
        ),
        (
            FlightError::from(crate::source::LoadError::Storage(
                crate::opencode::storage::StorageError::UnsupportedLayout,
            )),
            StatusCode::UNPROCESSABLE_ENTITY,
            "SESSION_SOURCE_UNSUPPORTED",
        ),
        (
            FlightError::from(crate::source::LoadError::Storage(
                crate::opencode::storage::StorageError::BudgetExceeded,
            )),
            StatusCode::UNPROCESSABLE_ENTITY,
            "SESSION_SOURCE_TOO_LARGE",
        ),
        (
            FlightError::from(crate::source::LoadError::Replay(
                crate::opencode::replay::ReplayError::UnsupportedHistory,
            )),
            StatusCode::UNPROCESSABLE_ENTITY,
            "SESSION_REPLAY_UNSUPPORTED",
        ),
    ];
    for (error, status, code) in errors {
        let diagnostic = error.safe_diagnostic();
        assert!(!diagnostic.contains("private"));
        assert!(!diagnostic.contains("/tmp"));
        let shared = Arc::new(error);
        let response = AppError::Shared(Arc::clone(&shared)).into_response();
        assert_eq!(response.status(), status);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        let json: serde_json::Value = serde_json::from_slice(&body).expect("envelope");
        assert_eq!(json["error"]["code"], code);
        let body = String::from_utf8(body.to_vec()).expect("UTF-8");
        assert!(!body.contains("private"));
        assert!(!body.contains("/tmp"));
        if let FlightError::Io(error) = &*shared {
            assert!(error.to_string().contains("private"));
            assert!(std::error::Error::source(shared.as_ref())
                .expect("retained I/O cause")
                .downcast_ref::<std::io::Error>()
                .is_some());
        }
    }
}
