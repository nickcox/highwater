use axum::{
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use mime_guess::from_path;
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "web/dist/"]
struct Frontend;

pub(crate) async fn static_file(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };
    if let Some(asset) = Frontend::get(path) {
        let mime = from_path(path).first_or_octet_stream();
        return (
            [(header::CONTENT_TYPE, mime.as_ref())],
            asset.data.into_owned(),
        )
            .into_response();
    }
    if let Some(asset) = Frontend::get("index.html") {
        return (
            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
            asset.data.into_owned(),
        )
            .into_response();
    }
    StatusCode::NOT_FOUND.into_response()
}
