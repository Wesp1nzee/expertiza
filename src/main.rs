// mod routers;
// mod middleware;
// mod state;
// mod database;
// pub mod csrf;

// use std::sync::Arc;
// use std::time::Duration;
// use axum::{
//     http::{Method, Request, Response, HeaderMap},
//     serve,
//     Router,
//     body::Body,
// };
// use axum::routing::{get, post, put};
// use axum::middleware as axum_middleware;
// use tokio::net::TcpListener;
// use tower::ServiceBuilder;
// use tower_http::{
//     compression::CompressionLayer,
//     cors::{Any, CorsLayer},
//     timeout::TimeoutLayer,
//     trace::TraceLayer,
//     services::ServeDir,
//     classify::ServerErrorsFailureClass,
// };
// use tracing::{info, warn, error, debug, instrument, Span};
// use tracing_subscriber::{
//     prelude::*,
//     fmt::format::FmtSpan,
//     EnvFilter,
// };

// use crate::routers::error::handle_404;
// use crate::routers::client::{
//     web::serve_index,
//     api::{get_csrf_token, accept_form},
// };
// use crate::routers::admin::{
//     web::{admin_login, admin_dashboard},
//     api::{
//         create_contact_submission, post_admin_dashboard, 
//         get_admin_statistics, 
//         update_admin_status
//     },
// };
// use crate::middleware::{security_headers_middleware, rate_limit_middleware};
// use crate::database::{
//     redis::redis_interface::RedisDatabase,
//     postgres::postgres_interface::PostgresDatabase,
// };
// use crate::state::AppState;
// use dotenvy::dotenv; // или use dotenv::dotenv; если используете dotenv
// use std::env;


// fn log_request<B>(req: &Request<B>, span: &Span) {
//     let method = req.method();
//     let uri = req.uri();
//     let version = req.version();
//     let headers = req.headers();
    
//     let user_agent = headers
//         .get("user-agent")
//         .and_then(|v| v.to_str().ok())
//         .unwrap_or("Unknown");
    
//     let content_type = headers
//         .get("content-type")
//         .and_then(|v| v.to_str().ok())
//         .unwrap_or("None");
    
//     let content_length = headers
//         .get("content-length")
//         .and_then(|v| v.to_str().ok())
//         .unwrap_or("0");

//     let client_ip = get_client_ip(headers);
    
//     span.record("http.method", method.as_str());
//     span.record("http.url", uri.to_string().as_str());
//     span.record("http.version", format!("{:?}", version).as_str());
//     span.record("http.user_agent", user_agent);
//     span.record("client.ip", client_ip.as_str());
    
//     info!(
//         method = %method,
//         uri = %uri,
//         version = ?version,
//         user_agent = %user_agent,
//         content_type = %content_type,
//         content_length = %content_length,
//         client_ip = %client_ip,
//         "Incoming request"
//     );
    
//     debug!(
//         headers = ?headers,
//         "Request headers"
//     );
// }

// fn log_response<B>(res: &Response<B>, latency: Duration, span: &Span) {
//     let status = res.status();
//     let headers = res.headers();
    
//     let content_type = headers
//         .get("content-type")
//         .and_then(|v| v.to_str().ok())
//         .unwrap_or("None");
    
//     let content_length = headers
//         .get("content-length")
//         .and_then(|v| v.to_str().ok())
//         .unwrap_or("Unknown");
    
//     // Добавляем информацию об ответе в span
//     span.record("http.status_code", status.as_u16());
//     span.record("http.response_time_ms", latency.as_millis() as u64);
    
//     // Логируем на разных уровнях в зависимости от статуса
//     match status.as_u16() {
//         200..=299 => {
//             info!(
//                 status = %status,
//                 latency_ms = %latency.as_millis(),
//                 content_type = %content_type,
//                 content_length = %content_length,
//                 "Request completed successfully"
//             );
//         },
//         300..=399 => {
//             info!(
//                 status = %status,
//                 latency_ms = %latency.as_millis(),
//                 location = ?headers.get("location"),
//                 "Request redirected"
//             );
//         },
//         400..=499 => {
//             warn!(
//                 status = %status,
//                 latency_ms = %latency.as_millis(),
//                 "Client error response"
//             );
//         },
//         500..=599 => {
//             error!(
//                 status = %status,
//                 latency_ms = %latency.as_millis(),
//                 "Server error response"
//             );
//         },
//         _ => {
//             warn!(
//                 status = %status,
//                 latency_ms = %latency.as_millis(),
//                 "Unusual response status"
//             );
//         }
//     }
    
//     debug!(
//         response_headers = ?headers,
//         "Response headers"
//     );
// }

// fn get_client_ip(headers: &HeaderMap) -> String {
//     let ip_headers: [&'static str; 5] = [
//         "x-forwarded-for",
//         "x-real-ip", 
//         "cf-connecting-ip",
//         "x-client-ip",
//         "x-forwarded",
//     ];
    
//     for header_name in &ip_headers {
//         if let Some(value) = headers.get(*header_name) {
//             if let Ok(ip_str) = value.to_str() {
//                 // X-Forwarded-For может содержать список IP, берём первый
//                 let ip = ip_str.split(',').next().unwrap_or(ip_str).trim();
//                 if !ip.is_empty() && ip != "unknown" {
//                     return ip.to_string();
//                 }
//             }
//         }
//     }
    
//     "unknown".to_string()
// }

// // Функция для обработки ошибок HTTP
// fn log_failure(failure: ServerErrorsFailureClass, latency: Duration, _span: &Span) {
//     match failure {
//         ServerErrorsFailureClass::StatusCode(status) => {
//             error!(
//                 status = %status,
//                 latency_ms = %latency.as_millis(),
//                 "Request failed with status code"
//             );
//         },
//         ServerErrorsFailureClass::Error(ref err) => {
//             error!(
//                 error = %err,
//                 latency_ms = %latency.as_millis(),
//                 "Request failed with error"
//             );
//         }
//     }
// }

// #[instrument(name = "server_startup")]
// async fn setup_tracing() {
//     // Настройка многоуровневого логирования
//     let fmt_layer = tracing_subscriber::fmt::layer()
//         .with_target(true)
//         .with_thread_ids(true)
//         .with_thread_names(true)
//         .with_file(true)
//         .with_line_number(true)
//         .with_span_events(FmtSpan::CLOSE)
//         .pretty();

//     let filter_layer = EnvFilter::try_from_default_env()
//         .unwrap_or_else(|_| {
//             EnvFilter::new("info,tower_http=debug,axum=debug,hyper=info")
//         });

//     tracing_subscriber::registry()
//         .with(filter_layer)
//         .with(fmt_layer)
//         .init();
// }

// #[instrument(name = "redis_connection")]
// async fn setup_redis() -> Result<RedisDatabase, Box<dyn std::error::Error>> {
//     let redis_url = std::env::var("REDIS_URL")
//         .unwrap_or_else(|_| "redis://127.0.0.1/".into());
    
//     info!(redis_url = %redis_url, "Connecting to Redis");
    
//     match RedisDatabase::new(&redis_url).await {
//         Ok(db) => {
//             info!("Successfully connected to Redis");
//             Ok(db)
//         },
//         Err(e) => {
//             error!(error = %e, "Failed to connect to Redis");
//             Err(Box::new(e))
//         }
//     }
// }

// #[tokio::main]
// async fn main() -> Result<(), Box<dyn std::error::Error>> {
//     setup_tracing().await;
    
//     info!("Starting server initialization");
//     dotenv().ok();
//     let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

//     let db_redis = setup_redis().await?;
//     let db_postgres = PostgresDatabase::new(database_url.as_str()).await?;
//     db_postgres.migrate().await?; 
//     let shared_state = AppState { 
//         db_postgres: Arc::new(db_postgres),
//         db_redis: Arc::new(db_redis) 
//     };
    
//     let cors = CorsLayer::new()
//         .allow_methods([Method::GET, Method::POST])
//         .allow_headers([
//             axum::http::header::AUTHORIZATION,
//             axum::http::header::ACCEPT,
//             axum::http::header::CONTENT_TYPE,
//             axum::http::HeaderName::from_static("x-csrf-token"),
//         ])
//         .allow_origin(Any);
    
//     info!("CORS configured");
//     let static_service = ServeDir::new("static")
//         .append_index_html_on_directories(false);
    
//     info!("Static file service configured");
//     let app = Router::new()
//         .route("/", get(serve_index))
//         // .route("/admin-login", get(admin_login).post(post_admin_login))
//         .route("/admin-dashboard", get(admin_dashboard))
//         .route("/api/v1/admin/update-submission-status", put(update_admin_status))
//         .route("/api/v1/admin/add-submissions", put(create_contact_submission))
//         .route("/api/v1/admin/dashboard-submission-page", post(post_admin_dashboard))
//         .route("/api/v1/admin/dashboard-stats", get(get_admin_statistics))
//         .route("/api/v1/csrf-token", get(get_csrf_token))
//         .route("/api/v1/contact-submissions", post(accept_form))
//         .with_state(shared_state)
//         .nest_service("/static", static_service)
//         .fallback(handle_404)
//         .layer(
//             ServiceBuilder::new()
//                 .layer(
//                     TraceLayer::new_for_http()
//                         .make_span_with(|req: &Request<Body>| {
//                             tracing::info_span!(
//                                 "http_request",
//                                 http.method = %req.method(),
//                                 http.url = %req.uri(),
//                                 http.version = ?req.version(),
//                                 otel.kind = "server",
//                                 otel.name = %format!("{} {}", req.method(), req.uri().path()),
//                                 http.status_code = tracing::field::Empty,
//                                 http.response_time_ms = tracing::field::Empty,
//                                 client.ip = tracing::field::Empty,
//                                 http.user_agent = tracing::field::Empty,
//                             )
//                         })
//                         .on_request(log_request)
//                         .on_response(log_response)
//                         .on_failure(log_failure),
//                 )
//                 .layer(TimeoutLayer::new(Duration::from_secs(30)))
//                 .layer(CompressionLayer::new())
//                 .layer(cors)
//                 .layer(axum_middleware::from_fn(security_headers_middleware))
//                 // .layer(axum_middleware::from_fn(csrf_protection_middleware))
//                 .layer(axum_middleware::from_fn(rate_limit_middleware))
//         );

//     info!("Application routes and middleware configured");
//     let listener = TcpListener::bind("127.0.0.1:3000").await?;

//     info!("🚀 Сервер запущен на http://127.0.0.1:3000");    
//     serve(listener, app).await?;

//     Ok(())
// }

mod routers;
mod middleware;
mod state;
mod database;
pub mod csrf;
mod config;
mod logging;
mod server;

use crate::config::Config;
use crate::logging::setup_tracing;
use crate::server::create_app;
use axum::serve;
use tokio::net::TcpListener;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    setup_tracing().await;
    
    info!("Starting server initialization");
    
    let config = Config::from_env()?;
    let app = create_app(config.clone()).await?;
    
    let listener = TcpListener::bind(&config.server_address).await?;
    info!("🚀 Сервер запущен на http://{}", config.server_address);
    
    serve(listener, app).await?;
    Ok(())
}