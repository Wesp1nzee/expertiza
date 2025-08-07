use std::time::Duration;
use axum::{
    http::{Method, Request},
    Router,
    body::Body,
    routing::{get, post, put},
};
use axum::middleware::{from_fn_with_state, from_fn};
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
    services::ServeDir,
};
use tracing::info;
use std::sync::Arc;
use crate::config::Config;
use crate::logging::{log_request, log_response, log_failure};
use crate::routers::error::handle_404;
use crate::routers::client::{
    web::serve_index,
    api::{get_csrf_token, accept_form},
};
use crate::routers::admin::{
    web::{admin_dashboard, admin_login},
    auth::{
        admin_login_handler, 
        admin_logout_handler, 
        admin_auth_middleware},
    api::{
        create_contact_submission, 
        post_admin_dashboard, 
        get_admin_statistics, 
        update_admin_status,
    },
};
use crate::middleware::{security_headers_middleware, rate_limit_middleware};
use crate::state::AppState;
use crate::database::setup::{setup_redis, setup_postgres};


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

fn setup_routes_admin() -> Router<AppState> {
    Router::new()
        .route("/logout", get(admin_logout_handler))
        .route("/dashboard", get(admin_dashboard))
        .route("/api/v1/update-submission-status", put(update_admin_status))
        .route("/api/v1/add-submissions", post(create_contact_submission))
        .route("/api/v1/dashboard-page", post(post_admin_dashboard))
        .route("/api/v1/dashboard-stats", get(get_admin_statistics))
}

fn setup_routes_client() -> Router<AppState> {
    Router::new()
        .route("/csrf-token", get(get_csrf_token))
        .route("/contact-submissions", post(accept_form))
}

pub async fn setup_app_state(config: &Config) -> Result<AppState, Box<dyn std::error::Error>> {
    let db_redis = setup_redis(&config.redis_url).await?;
    let db_postgres = setup_postgres(&config.database_url).await?;

    let jwt_secret = config.jwt_secret.clone();
    let admin_username = config.admin_username.clone();
    let admin_password_hash = config.admin_password_hash.clone();
    
    info!("Running database migrations");
    db_postgres.migrate().await?;
    info!("Database migrations completed");
    
    let shared_state = AppState { 
        db_postgres: Arc::new(db_postgres),
        db_redis: Arc::new(db_redis),
        jwt_secret,
        admin_username,
        admin_password_hash
    };
    
    Ok(shared_state)
}

pub async fn create_app(config: Config) -> Result<Router<>, Box<dyn std::error::Error>> {
    let shared_state = setup_app_state(&config).await?;

    let cors = setup_cors();
    let static_service = setup_static_service();
    let static_service_admin = setup_static_service();
    let routes = Router::new();

    let admin_routes = setup_routes_admin();
    let client_routes = setup_routes_client();

    let app = routes
        .route("/", get(serve_index))
        .route("/admin/api/v1/login", post(admin_login_handler))
        .route("/admin/login", get(admin_login))
        .nest_service("/static", static_service)
        .nest_service("/admin/static", static_service_admin)
        .nest("/admin", admin_routes.route_layer(from_fn_with_state(shared_state.clone(), admin_auth_middleware)))
        .nest("/api/v1", client_routes)
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
                .layer(from_fn(security_headers_middleware))
                .layer(from_fn(rate_limit_middleware))
        )
        .with_state(shared_state);
    
    info!("Server configured successfully");
    Ok(app)
}
