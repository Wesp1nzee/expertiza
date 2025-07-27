use axum::{
    http::StatusCode,
    response::Html,
};
use tokio::fs;

// Обработчик главной страницы
pub async fn serve_index() -> Result<Html<String>, StatusCode> {
    match fs::read_to_string("templates/main.html").await {
        Ok(content) => Ok(Html(content)),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}