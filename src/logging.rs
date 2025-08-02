use std::time::Duration;
use axum::{
    http::{HeaderMap, Request, Response},
    body::Body,
};
use tower_http::classify::ServerErrorsFailureClass;
use tracing::{info, warn, error, debug, Span};
use tracing_subscriber::{
    prelude::*,
    EnvFilter,
};

pub async fn setup_tracing() {
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)        // Убираем target
        .with_thread_ids(false)    // Убираем thread IDs  
        .with_thread_names(false)  // Убираем thread names
        .with_file(false)          // Убираем имена файлов
        .with_line_number(false)   // Убираем номера строк
        .compact();                // Используем компактный формат

    // Более строгие фильтры логирования
    let filter_layer = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| {
            EnvFilter::new("info,tower_http=warn,axum=warn,hyper=warn,sqlx=warn")
        });

    tracing_subscriber::registry()
        .with(filter_layer)
        .with(fmt_layer)
        .init();
}

pub fn log_request<B>(req: &Request<B>, span: &Span) {
    let method = req.method();
    let uri = req.uri();
    let version = req.version();
    let headers = req.headers();
    
    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("Unknown");
    
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("None");
    
    let content_length = headers
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("0");

    let client_ip = get_client_ip(headers);
    
    span.record("http.method", method.as_str());
    span.record("http.url", uri.to_string().as_str());
    span.record("http.version", format!("{:?}", version).as_str());
    span.record("http.user_agent", user_agent);
    span.record("client.ip", client_ip.as_str());
    
    info!(
        method = %method,
        uri = %uri,
        version = ?version,
        user_agent = %user_agent,
        content_type = %content_type,
        content_length = %content_length,
        client_ip = %client_ip,
        "Incoming request"
    );
    
    debug!(
        headers = ?headers,
        "Request headers"
    );
}

pub fn log_response<B>(res: &Response<B>, latency: Duration, span: &Span) {
    let status = res.status();
    let headers = res.headers();
    
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("None");
    
    let content_length = headers
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("Unknown");
    
    span.record("http.status_code", status.as_u16());
    span.record("http.response_time_ms", latency.as_millis() as u64);
    
    match status.as_u16() {
        200..=299 => {
            info!(
                status = %status,
                latency_ms = %latency.as_millis(),
                content_type = %content_type,
                content_length = %content_length,
                "Request completed successfully"
            );
        },
        300..=399 => {
            info!(
                status = %status,
                latency_ms = %latency.as_millis(),
                location = ?headers.get("location"),
                "Request redirected"
            );
        },
        400..=499 => {
            warn!(
                status = %status,
                latency_ms = %latency.as_millis(),
                "Client error response"
            );
        },
        500..=599 => {
            error!(
                status = %status,
                latency_ms = %latency.as_millis(),
                "Server error response"
            );
        },
        _ => {
            warn!(
                status = %status,
                latency_ms = %latency.as_millis(),
                "Unusual response status"
            );
        }
    }
    
    debug!(
        response_headers = ?headers,
        "Response headers"
    );
}

pub fn log_failure(failure: ServerErrorsFailureClass, latency: Duration, _span: &Span) {
    match failure {
        ServerErrorsFailureClass::StatusCode(status) => {
            error!(
                status = %status,
                latency_ms = %latency.as_millis(),
                "Request failed with status code"
            );
        },
        ServerErrorsFailureClass::Error(ref err) => {
            error!(
                error = %err,
                latency_ms = %latency.as_millis(),
                "Request failed with error"
            );
        }
    }
}

fn get_client_ip(headers: &HeaderMap) -> String {
    let ip_headers: [&'static str; 5] = [
        "x-forwarded-for",
        "x-real-ip", 
        "cf-connecting-ip",
        "x-client-ip",
        "x-forwarded",
    ];
    
    for header_name in &ip_headers {
        if let Some(value) = headers.get(*header_name) {
            if let Ok(ip_str) = value.to_str() {
                let ip = ip_str.split(',').next().unwrap_or(ip_str).trim();
                if !ip.is_empty() && ip != "unknown" {
                    return ip.to_string();
                }
            }
        }
    }
    
    "unknown".to_string()
}