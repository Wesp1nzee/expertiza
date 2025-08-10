use axum::{
    http::StatusCode,
    response::{Json, IntoResponse},
    extract::{Json as ExtractJson, State},
};
use serde::{Deserialize, Serialize};
use tracing::info;
use crate::state::AppState;
use crate::database::postgres::models::{PaginationResult, DatabaseStats};
use crate::error::AppError;
use crate::database::postgres::models::CreateSubmissionRequest;


#[derive(Debug, Serialize, Deserialize)]
pub struct AdminContactSubmission {
    name: String,
    email: String,
    phone: Option<String>,
    message: String,
}

#[derive(Debug, Serialize)]
pub struct AdminErrorResponse {
    message: String,
    code: String,
}

#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    page: usize,
    per_page: usize,
    sort_by: Option<String>,
    order: Option<String>
}

#[derive(Debug, Serialize)]
pub struct AdminSuccessResponse {
    message: String,
    submission_id: String,
}

// /api/v1/admin/dashboard-page?page=1&per_page=10&sort_by=date&order=desc
pub async fn post_admin_dashboard(
    State(state): State<AppState>,
    pagination: axum::extract::Query<PaginationQuery>,
) -> Result<Json<PaginationResult>, AppError> {
    let result: PaginationResult = state.db_postgres.get_submissions_paginated(
        pagination.page.try_into().unwrap(),
        pagination.per_page.try_into().unwrap(),
        pagination.sort_by.as_deref(),
        pagination.order.as_deref()
    )
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(result))
}

pub async fn get_admin_statistics(
    State(state): State<AppState>,
) -> Result<Json<DatabaseStats>, AppError> {
    let result: DatabaseStats = state.db_postgres.get_statistics().await
        .map_err(AppError::DatabaseError)?;

    Ok(Json(result))
}


#[derive(Debug, Deserialize, Clone)]
pub struct UpdateViewedParams {
    submission_id: uuid::Uuid,
    status: String,
}
// api/v1/admin/update-submission-status
// Пример запроса PUT /api/v1/admin/update-submission-status?submission_id=123&viewed=true
pub async fn update_admin_status(
    State(state): State<AppState>,
    Json(params): Json<UpdateViewedParams>,
) -> Result<StatusCode, AppError> {
    state.db_postgres
        .update_submissions_status(params.submission_id, params.status)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// /api/v1/admin/add-submissions
pub async fn create_contact_submission(
    State(state): State<AppState>,
    ExtractJson(data): ExtractJson<AdminContactSubmission>,
) -> impl IntoResponse {
    if data.name.len() < 2 || data.name.len() > 255 {
        return (
            StatusCode::BAD_REQUEST,
            Json(AdminErrorResponse {
                message: "Имя должно содержать 2-255 символов".to_string(),
                code: "VALIDATION_ERROR".to_string(),
            }),
        ).into_response();
    }

    // Валидация email
    if !data.email.contains('@') || data.email.len() > 254 {
        return (
            StatusCode::BAD_REQUEST,
            Json(AdminErrorResponse {
                message: "Некорректный email адрес".to_string(),
                code: "VALIDATION_ERROR".to_string(),
            }),
        ).into_response();
    }

    // Валидация сообщения
    if data.message.len() < 10 || data.message.len() > 1000 {
        return (
            StatusCode::BAD_REQUEST,
            Json(AdminErrorResponse {
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
    info!("Admin submission saved: {}", submission_id);
    (
        StatusCode::OK,
        Json(AdminSuccessResponse {
            message: "Сообщение успешно отправлено".to_string(),
            submission_id: submission_id.to_string(),
        }),
    ).into_response()
}