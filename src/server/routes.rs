use super::{
    analysis::CachedResponse,
    assets,
    catalog::CatalogSnapshot,
    error::AppError,
    events::{self, LiveAvailability},
    AppState, SessionFile, DEGRADED_SCAN_DEADLINE,
};
use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use serde::Serialize;

pub(super) fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/sessions", get(sessions))
        .route("/api/events", get(events::handler))
        .route("/api/sessions/{id}/analysis", get(session_analysis))
        .fallback(assets::static_file)
        .with_state(state)
}
async fn sessions(State(state): State<AppState>, headers: HeaderMap) -> Result<Response, AppError> {
    if state.live_state.borrow().availability == LiveAvailability::Degraded {
        tokio::time::timeout(DEGRADED_SCAN_DEADLINE, state.coordinator.ensure_fresh())
            .await
            .map_err(|_| AppError::CatalogRefreshUnavailable)?
            .map_err(|_| AppError::CatalogRefreshUnavailable)?;
    }
    let snapshot = state.catalog.snapshot()?;
    let availability = state.live_state.borrow().availability;
    list_response(&snapshot, availability, &headers)
}
#[cfg(test)]
#[path = "routes_tests.rs"]
mod tests;

#[derive(Serialize)]
struct SessionList<'a> {
    sessions: &'a [SessionFile],
}

/// Preserve existing exact/comma-separated matching, without broadening ETag semantics.
fn etag_matches(headers: &HeaderMap, etag: &str) -> bool {
    headers
        .get(header::IF_NONE_MATCH)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.split(',').any(|candidate| candidate.trim() == etag))
}
fn list_response(
    snapshot: &CatalogSnapshot,
    availability: LiveAvailability,
    headers: &HeaderMap,
) -> Result<Response, AppError> {
    let etag = list_etag(snapshot);
    let mut builder = Response::builder()
        .header(header::ETAG, etag.as_str())
        .header(
            "X-TokenPlume-Server-Generation",
            snapshot.generation.as_str(),
        )
        .header(
            "X-TokenPlume-Catalog-Revision",
            snapshot.revision.to_string(),
        )
        .header(
            "X-TokenPlume-Live-Updates",
            match availability {
                LiveAvailability::Active => "active",
                LiveAvailability::Degraded => "degraded",
            },
        );
    if etag_matches(headers, &etag) {
        return builder
            .status(StatusCode::NOT_MODIFIED)
            .body(axum::body::Body::empty())
            .map_err(AppError::ResponseBuild);
    }
    let body = serde_json::to_vec(&SessionList {
        sessions: &snapshot.sessions,
    })
    .map_err(AppError::Serialization)?;
    builder = builder
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CONTENT_LENGTH, body.len());
    builder
        .status(StatusCode::OK)
        .body(axum::body::Body::from(body))
        .map_err(AppError::ResponseBuild)
}
fn list_etag(snapshot: &CatalogSnapshot) -> String {
    let mut hasher = blake3::Hasher::new();
    hasher.update(snapshot.generation.as_bytes());
    hasher.update(&snapshot.revision.to_le_bytes());
    format!("\"{}\"", hasher.finalize().to_hex())
}
async fn session_analysis(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let snapshot = state.catalog.snapshot()?;
    let session = snapshot
        .sessions
        .iter()
        .find(|session| session.id == id)
        .ok_or(AppError::NotFound)?;
    let response = state
        .analysis
        .response(std::path::PathBuf::from(&session.path), state.config)
        .await
        .map_err(AppError::Shared)?;
    response_for(&response, &headers)
}
fn response_for(response: &CachedResponse, headers: &HeaderMap) -> Result<Response, AppError> {
    let mut builder = Response::builder().header(header::ETAG, response.etag.as_str());
    if etag_matches(headers, &response.etag) {
        return builder
            .status(StatusCode::NOT_MODIFIED)
            .body(axum::body::Body::empty())
            .map_err(AppError::ResponseBuild);
    }
    builder = builder
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CONTENT_LENGTH, response.body.len());
    builder
        .status(StatusCode::OK)
        .body(axum::body::Body::from(response.body.clone()))
        .map_err(AppError::ResponseBuild)
}
