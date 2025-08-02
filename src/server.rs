use std::time::Duration;
use axum::{
    http::{Method, Request},
    Router,
    body::Body,
    routing::{get, post, put},
    middleware as axum_middleware,
};
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
    services::ServeDir,
};
use tracing::info;

use crate::config::Config;
use crate::database::setup::setup_databases;
use crate::logging::{log_request, log_response, log_failure};
use crate::routers::error::handle_404;
use crate::routers::client::{
    web::serve_index,
    api::{get_csrf_token, accept_form},
};
use crate::routers::admin::{
    web::{admin_dashboard},
    api::{
        create_contact_submission, post_admin_dashboard, 
        get_admin_statistics, 
        update_admin_status
    },
};
use crate::middleware::{security_headers_middleware, rate_limit_middleware};

fn setup_cors() -> CorsLayer {
    CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::CONTENT_TYPE,
            axum::http::HeaderName::from_static("x-csrf-token"),
        ])
        .allow_origin(Any)
}

fn setup_static_service() -> ServeDir {
    ServeDir::new("static")
        .append_index_html_on_directories(false)
}

fn setup_routes() -> Router<crate::state::AppState> {
    Router::new()
        .route("/", get(serve_index))
        .route("/admin-dashboard", get(admin_dashboard))
        .route("/api/v1/admin/update-submission-status", put(update_admin_status))
        .route("/api/v1/admin/add-submissions", post(create_contact_submission))
        .route("/api/v1/admin/dashboard-submission-page", post(post_admin_dashboard))
        .route("/api/v1/admin/dashboard-stats", get(get_admin_statistics))
        .route("/api/v1/csrf-token", get(get_csrf_token))
        .route("/api/v1/contact-submissions", post(accept_form))
}

pub async fn create_app(config: Config) -> Result<Router, Box<dyn std::error::Error>> {
    info!("Setting up databases");
    let shared_state = setup_databases(&config).await?;
    
    info!("Setting up CORS and middleware");
    let cors = setup_cors();
    let static_service = setup_static_service();
    let routes = setup_routes();
    
    let app = routes
        .with_state(shared_state)
        .nest_service("/static", static_service)
        .fallback(handle_404)
        .layer(
            ServiceBuilder::new()
                .layer(
                    TraceLayer::new_for_http()
                        .make_span_with(|req: &Request<Body>| {
                            tracing::info_span!(
                                "http_request",
                                http.method = %req.method(),
                                http.url = %req.uri(),
                                http.version = ?req.version(),
                                otel.kind = "server",
                                otel.name = %format!("{} {}", req.method(), req.uri().path()),
                                http.status_code = tracing::field::Empty,
                                http.response_time_ms = tracing::field::Empty,
                                client.ip = tracing::field::Empty,
                                http.user_agent = tracing::field::Empty,
                            )
                        })
                        .on_request(log_request)
                        .on_response(log_response)
                        .on_failure(log_failure),
                )
                .layer(TimeoutLayer::new(Duration::from_secs(30)))
                .layer(CompressionLayer::new())
                .layer(cors)
                .layer(axum_middleware::from_fn(security_headers_middleware))
                .layer(axum_middleware::from_fn(rate_limit_middleware))
        );
    
    info!("Server configured successfully");
    Ok(app)
}