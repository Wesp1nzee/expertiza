use axum::{
    http::StatusCode,
    response::{Json, IntoResponse},
    extract::Json as ExtractJson,
};
use serde::{Deserialize, Serialize};
use crate::csrf::{CsrfService, CsrfTokenResponse};
use tracing;

#[derive(Debug, Serialize, Deserialize)]
pub struct ContactSubmission {
    name: String,
    email: String,
    phone: Option<String>,
    message: String,
    timestamp: String,
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
pub async fn get_csrf_token() -> impl IntoResponse {
    let csrf_svc = CsrfService::new("redis://127.0.0.1/", 3600);
    match csrf_svc.create_token().await {
        Ok(token) => Json(CsrfTokenResponse {
            token,
            expires_in: csrf_svc.ttl_seconds,
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
pub async fn accept_form(ExtractJson(data): ExtractJson<ContactSubmission>) -> impl IntoResponse {
    // Валидация имени
    if data.name.len() < 2 || data.name.len() > 50 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "Имя должно содержать 2-50 символов".to_string(),
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

    tracing::info!("Received contact form submission from: {}", data.email);
    println!("timestamp: {}", data.timestamp);
    let submission_id = uuid::Uuid::new_v4().to_string();
    tracing::info!("Generated submission ID: {}", submission_id);
    // TODO: Сохраниние в Redis и отправка уведомления на почту 
    (
        StatusCode::OK,
        Json(SuccessResponse {
            message: "Сообщение успешно отправлено".to_string(),
            submission_id,
        }),
    ).into_response()
}