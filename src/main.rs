mod routers;
mod middleware;
pub mod csrf;
pub mod redis_interface;

use axum::{
    http::Method,
    serve
};
use axum::routing::{get, post};
use axum::Router;
use axum::middleware as axum_middleware;
use std::time::Duration;
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
    services::ServeDir
};
use crate::routers::error::handle_404;
use crate::routers::client::{
    web::serve_index,
    api::{get_csrf_token, accept_form}
};
use crate::routers::admin::{
    web::admin_login,
    api::post_admin_login
};
use crate::middleware::{security_headers_middleware, rate_limit_middleware, csrf_protection_middleware};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::CONTENT_TYPE,
            axum::http::HeaderName::from_static("x-csrf-token"),
        ])
        .allow_origin(Any); // TODO: В продакшене следует указать конкретные домены

    let static_service = ServeDir::new("static")
        .append_index_html_on_directories(false);
           
    let app = Router::new()
        .route("/", get(serve_index))
        .route("/admin-login", get(admin_login).post(post_admin_login))
        .route("/api/v1/csrf-token", get(get_csrf_token))
        .route("/api/v1/contact-submissions", post(accept_form))
        .nest_service("/static", static_service)
        .fallback(handle_404)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http()) // Логирование запросов
                .layer(TimeoutLayer::new(Duration::from_secs(30))) // Таймаут 30 сек
                .layer(CompressionLayer::new()) // Сжатие ответов
                .layer(cors)
                .layer(axum_middleware::from_fn(security_headers_middleware))
                .layer(axum_middleware::from_fn(csrf_protection_middleware))
                .layer(axum_middleware::from_fn(rate_limit_middleware))
        );

    let listener = TcpListener::bind("127.0.0.1:3000").await?;
    println!("🚀 Сервер запущен на http://127.0.0.1:3000");
    serve(listener, app).await?;
    
    Ok(())
}