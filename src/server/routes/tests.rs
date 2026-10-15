use super::*;
use std::sync::Arc;

fn conditional(value: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(header::IF_NONE_MATCH, value.parse().expect("header"));
    headers
}
async fn body(response: Response) -> bytes::Bytes {
    axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body")
}

#[tokio::test]
async fn ambiguous_short_references_never_select_an_arbitrary_file() {
    use axum::response::IntoResponse;
    let first = SessionFile {
        id: "pi-123456789abc".into(),
        path: "/private/first.jsonl".into(),
        file_name: "first.jsonl".into(),
        display_name: "first".into(),
        working_directory: None,
        started_at: None,
        byte_size: Some(1),
        modified_at: None,
        harness: "pi".into(),
        parent_reference: None,
        subagent_type: None,
        locator: None,
        source_revision: None,
        modified_nanos: None,
    };
    let mut second = first.clone();
    second.path = "/private/second.jsonl".into();
    let unique = [first.clone()];
    assert_eq!(
        resolve_session(&unique, &first.id).expect("unique").path,
        first.path
    );
    assert!(matches!(
        resolve_session(&unique, "missing"),
        Err(AppError::NotFound)
    ));
    let duplicate = [first, second];
    let error = resolve_session(&duplicate, "pi-123456789abc").expect_err("ambiguous");
    let response = error.into_response();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    let bytes = body(response).await;
    let json: serde_json::Value = serde_json::from_slice(&bytes).expect("JSON");
    assert_eq!(json["error"]["code"], "AMBIGUOUS_SESSION");
    assert!(!String::from_utf8_lossy(&bytes).contains("/private"));
}

#[tokio::test]
async fn exact_comma_separated_etags_keep_header_and_body_parity() {
    for value in ["\"test\"", " \"other\", \"test\" , \"last\" "] {
        assert!(etag_matches(&conditional(value), "\"test\""));
    }
    for value in ["*", "W/\"test\"", "\"other\""] {
        assert!(!etag_matches(&conditional(value), "\"test\""));
    }
    let cached = CachedResponse {
        body: bytes::Bytes::from_static(b"{\"test\":true}"),
        etag: "\"test\"".into(),
        approximate_bytes: 13,
    };
    let response = response_for(&cached, &HeaderMap::new()).expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::CONTENT_TYPE], "application/json");
    assert_eq!(
        response.headers()[header::CONTENT_LENGTH],
        cached.body.len().to_string()
    );
    assert_eq!(body(response).await, cached.body);
    let response =
        response_for(&cached, &conditional("\"other\", \"test\"")).expect("conditional response");
    assert_eq!(response.status(), StatusCode::NOT_MODIFIED);
    assert_eq!(response.headers()[header::ETAG], "\"test\"");
    assert!(body(response).await.is_empty());
}

#[tokio::test]
async fn catalogue_etags_track_generation_and_revision_while_availability_headers_stay_current() {
    let mut snapshot = CatalogSnapshot {
        generation: "first-generation".into(),
        revision: 4,
        sessions: Arc::from(Vec::<SessionFile>::new()),
    };
    let original_etag = list_etag(&snapshot);
    let headers = conditional(&format!("\"other\", {original_etag}"));
    let response =
        list_response(&snapshot, LiveAvailability::Active, &HeaderMap::new()).expect("list");
    assert_eq!(response.headers()["X-Highwater-Catalog-Revision"], "4");
    assert_eq!(body(response).await, b"{\"sessions\":[]}".as_slice());
    let response = list_response(&snapshot, LiveAvailability::Degraded, &headers)
        .expect("conditional degraded list");
    assert_eq!(response.status(), StatusCode::NOT_MODIFIED);
    assert_eq!(response.headers()["X-Highwater-Live-Updates"], "degraded");
    assert!(body(response).await.is_empty());
    snapshot.revision += 1;
    let response =
        list_response(&snapshot, LiveAvailability::Active, &headers).expect("changed revision");
    assert_eq!(response.status(), StatusCode::OK);
    assert_ne!(response.headers()[header::ETAG], original_etag);
    snapshot.revision = 4;
    snapshot.generation = "new-generation".into();
    let response =
        list_response(&snapshot, LiveAvailability::Active, &headers).expect("changed generation");
    assert_eq!(response.status(), StatusCode::OK);
    assert_ne!(response.headers()[header::ETAG], original_etag);
}
