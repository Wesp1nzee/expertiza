use axum::{
    http::StatusCode,
    response::Html
};
use tokio::fs;
// /admin-login 
pub async fn admin_login() -> Result<Html<String>, StatusCode> {
    match fs::read_to_string("templates/admin/admin_login.html").await {
        Ok(content) => Ok(Html(content)),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}
// /admin-dashboard
pub async fn admin_dashboard() -> Result<Html<String>, StatusCode> {
    match fs::read_to_string("templates/admin/admin_dashboard.html").await {
        Ok(content) => Ok(Html(content)),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}