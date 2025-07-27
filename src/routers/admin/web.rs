use axum::{
    http::StatusCode,
    response::Html
};
use tokio::fs;

pub async fn admin_login() -> Result<Html<String>, StatusCode> {
    match fs::read_to_string("templates/admin_login.html").await {
        Ok(content) => Ok(Html(content)),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}
