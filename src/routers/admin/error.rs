use axum::{
    http::StatusCode,
    response::{Json, IntoResponse, Response},
};
use serde_json::json;
use crate::database::postgres::error::DatabaseError;

#[derive(Debug)]
pub enum AppError {
    DatabaseError(DatabaseError),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::DatabaseError(DatabaseError::NotFound(e)) => {
                (StatusCode::NOT_FOUND, format!("Not found: {}", e))
            }
            AppError::DatabaseError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            ),
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<DatabaseError> for AppError {
    fn from(error: DatabaseError) -> Self {
        AppError::DatabaseError(error)
    }
}


