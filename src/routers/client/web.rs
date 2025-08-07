use axum::{
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{Html, IntoResponse},
};
use tokio::fs;
use uuid::Uuid;

pub async fn serve_index() -> Result<impl IntoResponse, StatusCode> {
    let content = fs::read_to_string("templates/main.html")
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
