//! Loopback binding alone does not stop DNS rebinding: a page whose hostname
//! later resolves to 127.0.0.1 can make same-origin requests to this port.
//! Every request must therefore name this server explicitly.

use super::error::AppError;
use axum::{
    extract::{Request, State},
    http::{header, HeaderMap, HeaderValue, Uri},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    Router,
};

const LOCAL_HOST_NAMES: [&str; 2] = ["127.0.0.1", "localhost"];
const DEFAULT_HTTP_PORT: u16 = 80;
// Svelte writes inline `style` attributes, so styles need 'unsafe-inline';
// scripts, fetch and EventSource stay restricted to this origin.
const CONTENT_SECURITY_POLICY: &str = "default-src 'self'; script-src 'self'; \
style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; \
object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/// Reject requests that do not address this server by a loopback name and
/// its bound port, and add browser hardening headers to every response.
pub(super) fn protect(router: Router, port: u16) -> Router {
    router.layer(middleware::from_fn_with_state(port, require_local_origin))
}

async fn require_local_origin(State(port): State<u16>, request: Request, next: Next) -> Response {
    let mut response = if is_local_request(request.headers(), request.uri(), port) {
        next.run(request).await
    } else {
        AppError::ForeignOrigin.into_response()
    };
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(CONTENT_SECURITY_POLICY),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    response
}

fn is_local_request(headers: &HeaderMap, uri: &Uri, port: u16) -> bool {
    // HTTP/1.1 sends Host; HTTP/2 carries the same value as the URI authority.
    let host = match headers.get(header::HOST) {
        Some(value) => value.to_str().ok(),
        None => uri.authority().map(|authority| authority.as_str()),
    };
    if !host.is_some_and(|host| is_local_authority(host, port)) {
        return false;
    }
    // Browsers omit Origin on same-origin GETs; when present it must also be ours.
    match headers.get(header::ORIGIN) {
        None => true,
        Some(origin) => origin
            .to_str()
            .ok()
            .and_then(|origin| origin.strip_prefix("http://"))
            .is_some_and(|authority| is_local_authority(authority, port)),
    }
}

fn is_local_authority(authority: &str, port: u16) -> bool {
    let (name, authority_port) = match authority.rsplit_once(':') {
        Some((name, explicit)) => match explicit.parse::<u16>() {
            Ok(explicit) => (name, explicit),
            Err(_) => return false,
        },
        None => (authority, DEFAULT_HTTP_PORT),
    };
    authority_port == port
        && LOCAL_HOST_NAMES
            .iter()
            .any(|local| name.eq_ignore_ascii_case(local))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::StatusCode, routing::get};
    use tower::ServiceExt;

    const PORT: u16 = 43123;

    fn app() -> Router {
        protect(Router::new().route("/probe", get(|| async { "ok" })), PORT)
    }

    async fn status(host: Option<&str>, origin: Option<&str>) -> (StatusCode, HeaderMap) {
        let mut request = Request::builder().uri("/probe");
        if let Some(host) = host {
            request = request.header(header::HOST, host);
        }
        if let Some(origin) = origin {
            request = request.header(header::ORIGIN, origin);
        }
        let response = app()
            .oneshot(request.body(Body::empty()).expect("request"))
            .await
            .expect("response");
        (response.status(), response.headers().clone())
    }

    #[tokio::test]
    async fn loopback_hosts_on_the_bound_port_are_served_with_hardening_headers() {
        for host in ["127.0.0.1:43123", "localhost:43123", "LOCALHOST:43123"] {
            let (status, headers) = status(Some(host), None).await;
            assert_eq!(status, StatusCode::OK, "{host}");
            assert_eq!(headers[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
            assert_eq!(headers[header::REFERRER_POLICY], "no-referrer");
            assert!(headers[header::CONTENT_SECURITY_POLICY]
                .to_str()
                .expect("policy")
                .contains("connect-src 'self'"));
        }
        let (status, _) = status(Some("localhost:43123"), Some("http://localhost:43123")).await;
        assert_eq!(status, StatusCode::OK);
    }

    #[tokio::test]
    async fn rebinding_hosts_wrong_ports_and_foreign_origins_are_rejected() {
        for host in [
            None,
            Some("attacker.example:43123"),
            Some("attacker.example"),
            Some("127.0.0.1:43124"),
            Some("127.0.0.1"),
            Some("localhost.attacker.example:43123"),
            Some("[::1]:43123"),
            Some("127.0.0.1:notaport"),
        ] {
            let (status, headers) = status(host, None).await;
            assert_eq!(status, StatusCode::FORBIDDEN, "{host:?}");
            assert_eq!(headers[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
        }
        for origin in [
            "http://attacker.example:43123",
            "https://localhost:43123",
            "http://localhost:3000",
            "null",
        ] {
            let (status, _) = status(Some("localhost:43123"), Some(origin)).await;
            assert_eq!(status, StatusCode::FORBIDDEN, "{origin}");
        }
    }

    #[test]
    fn port_80_accepts_hosts_without_an_explicit_port() {
        assert!(is_local_authority("localhost", 80));
        assert!(is_local_authority("127.0.0.1:80", 80));
        assert!(!is_local_authority("localhost", PORT));
    }
}
