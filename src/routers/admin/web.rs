use axum::{
    http::{StatusCode, HeaderMap, HeaderValue},
    response::{Html, IntoResponse},
};
use tokio::fs;
use uuid::Uuid;

// /admin/login 
pub async fn admin_login() -> Result<impl IntoResponse, StatusCode>{
    let content = fs::read_to_string("templates/admin/admin_login.html")
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let session_id = Uuid::new_v4().to_string();
    let cookie = format!(
        "session_id={}; Path=/; HttpOnly; Secure; SameSite=Strict",
        session_id
    );

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_str(&cookie).unwrap()
    );
    Ok((headers, Html(content)))
}
// /admin/dashboard
pub async fn admin_dashboard() -> Result<Html<String>, StatusCode> {
    match fs::read_to_string("templates/admin/admin_dashboard.html").await {
        Ok(content) => Ok(Html(content)),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}