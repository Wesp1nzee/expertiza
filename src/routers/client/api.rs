use axum::{
    http::StatusCode,
    response::{Json, IntoResponse},
    extract::Json as ExtractJson,
    extract::State
};
use axum_extra::{
    extract::cookie::{CookieJar},
};
use serde::{Deserialize, Serialize};
use crate::csrf::{CsrfService, CsrfTokenResponse};
use crate::state::AppState;
use crate::database::postgres::models::CreateSubmissionRequest;

#[derive(Debug, Serialize, Deserialize)]
pub struct ContactSubmission {
    name: String,
    email: String,
    phone: Option<String>,
    message: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    message: String,
    code: String,
}

#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    message: String,
    submission_id: String,
}

// /api/v1/csrf-token
pub async fn get_csrf_token(
    State(state): State<AppState>,
    jar: CookieJar
) -> impl IntoResponse {
    let redis_conn: redis::aio::ConnectionManager = state
        .db_redis
        .get_connection()
        .await
        .expect("Unable to connect to Redis");

    let session_id = match jar
        .get("session_id")
        .and_then(|v| Some(v))
    {
        Some(id) => id.value().to_string(),
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    message: "Missing or invalid session_id".to_string(),
                    code: "MISSING_SESSION".to_string(),
                }),
            ).into_response();
        }
    };

    let mut csrf_svc = CsrfService::new(redis_conn, 900);
    match csrf_svc.create_token(session_id).await {
        Ok(token) => Json(CsrfTokenResponse {
            token,
            expires_in: 900, // 15 min
        }).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                message: "Failed to generate CSRF token".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        ).into_response()
    }
}

// /api/v1/contact-submissions
pub async fn accept_form(
    State(state): State<AppState>,
    ExtractJson(data): ExtractJson<ContactSubmission>,
) -> impl IntoResponse {
    if data.name.len() < 2 || data.name.len() > 255 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "Имя должно содержать 2-255 символов".to_string(),
                code: "VALIDATION_ERROR".to_string(),
            }),
        ).into_response();
    }

    // Валидация email
    if !data.email.contains('@') || data.email.len() > 254 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "Некорректный email адрес".to_string(),
                code: "VALIDATION_ERROR".to_string(),
            }),
        ).into_response();
    }

    // Валидация сообщения
    if data.message.len() < 10 || data.message.len() > 1000 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "Сообщение должно содержать 10-1000 символов".to_string(),
                code: "VALIDATION_ERROR".to_string(),
            }),
        ).into_response();
    }

    let submission_id = uuid::Uuid::new_v4();
    let submission = CreateSubmissionRequest {
        submission_id: submission_id.clone(),
        name: data.name,
        email: data.email,
        phone: data.phone,
        message: data.message,
    };
    state.db_postgres.save_submission(submission).await.unwrap();
    (
        StatusCode::OK,
        Json(SuccessResponse {
            message: "Сообщение успешно отправлено".to_string(),
            submission_id: submission_id.to_string(),
        }),
    ).into_response()
}