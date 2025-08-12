use axum::{
    http::StatusCode,
    response::{Json, IntoResponse},
    extract::{Json as ExtractJson, State},
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use axum_extra::extract::cookie::{CookieJar, Cookie, SameSite};
use serde::{Deserialize, Serialize};
use tracing::info;
use uuid::Uuid;
use crate::state::AppState;
use crate::database::postgres::models::{PaginationResult, DatabaseStats};
use crate::error::AppError;
use crate::database::postgres::models::{CreateSubmissionRequest, SubmissionCommentsRequest};

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

#[derive(Debug, Deserialize)]
pub struct CreateAdminComment {
    pub submissions_id: Uuid,
    pub text: String
}

#[derive(Debug, Serialize, Deserialize)]
struct AdminTokenClaims {
    sub: String,    // Здесь хранится admin_id
    iat: i64,
    exp: i64,
    jti: String,
    role: String,
    session_id: String,
}

// /api/v1/admin/create-submissions-comment
pub async fn crate_submission_comment(
    State(state): State<AppState>,
    jar: CookieJar,
    ExtractJson(data): ExtractJson<CreateAdminComment>,
) -> impl IntoResponse {
    let cookie_value = match jar.get("__Secure-admin-session") {
        Some(cookie) => cookie.value().to_owned(),
        None => {
            tracing::warn!("Missing session cookie");
            return (StatusCode::UNAUTHORIZED, "Missing session cookie").into_response();
        }
    };

    let mut tokens = cookie_value.split(':');
    let access_token = match tokens.next() {
        Some(token) => token.trim(),
        None => {
            tracing::error!("Invalid cookie format: no access token");
            return (StatusCode::UNAUTHORIZED, "Invalid session format").into_response();
        }
    };

    let token_data = match decode::<AdminTokenClaims>(
        access_token,
        &DecodingKey::from_secret(state.jwt_secret.as_ref()),
        &Validation::new(Algorithm::HS256),
    ) {
        Ok(data) => data,
        Err(e) => {
            
            let msg = match e.kind() {
                jsonwebtoken::errors::ErrorKind::InvalidToken => "Invalid token format",
                jsonwebtoken::errors::ErrorKind::InvalidSignature => "Invalid signature",
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => "Token expired",
                jsonwebtoken::errors::ErrorKind::InvalidIssuer => "Invalid issuer",
                jsonwebtoken::errors::ErrorKind::InvalidAudience => "Invalid audience",
                _ => "Invalid token",
            };
            
            return (StatusCode::UNAUTHORIZED, msg).into_response();
        }
    };

    // 5. Парсинг UUID администратора
    let admin_id = match Uuid::parse_str(&token_data.claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return (StatusCode::UNAUTHORIZED, "Invalid admin ID").into_response();
        }
    };
    // 7. Создание комментария в базе данных
    match state
        .db_postgres
        .create_admin_comments(admin_id, data.submissions_id, data.text)
        .await
    {
        Ok(_) => StatusCode::CREATED.into_response(),
        Err(e) => {
            tracing::error!(
                "DB error for admin {}: {:?}",
                admin_id,
                e
            );
            
            let msg = if e.to_string().contains("foreign key constraint") {
                "Invalid submission ID"
            } else {
                "Internal server error"
            };
            
            (StatusCode::INTERNAL_SERVER_ERROR, msg).into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct GetAdminComments { 
    pub submissions_id: Uuid
}

// /api/v1/admin/get-submissions-comment
pub async fn get_submission_comments(
    State(state): State<AppState>,
    ExtractJson(params): ExtractJson<GetAdminComments>,
) -> Result<impl IntoResponse, AppError> {
    let submission_comments = state.db_postgres
        .get_admin_comments(params.submissions_id)
        .await?;
    println!("{:?}", submission_comments);
    Ok((StatusCode::OK, Json(submission_comments)))
}