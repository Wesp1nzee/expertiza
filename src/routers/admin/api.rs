use axum::{
    http::{StatusCode, HeaderMap, header},
    response::{Json, IntoResponse, Response},
    extract::{Json as ExtractJson, State},
};
use serde::{Deserialize, Serialize};
use dotenv::var;
use tracing::{info, warn};
use bcrypt::verify;
use crate::state::AppState;
use crate::database::postgres::models::{PaginationResult, DatabaseStats, Submission};
use super::error::AppError;
use crate::database::postgres::models::CreateSubmissionRequest;

#[derive(Debug, Deserialize)]
pub struct AdminLoginRequest {
    username: String,
    password: String,
}

#[derive(Debug, Serialize)]
struct AdminLoginSuccessResponse {
    status: String,
    redirect: String,
}

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
    per_page: usize
}

#[derive(Debug, Serialize)]
pub struct AdminSuccessResponse {
    message: String,
    submission_id: String,
}


// Основной обработчик админ логина
// TODO: довести до ума
// pub async fn post_admin_login(
//     _headers: HeaderMap,
//     ExtractJson(payload): ExtractJson<AdminLoginRequest>,
// ) -> Response {
    
//     let admin_login = match var("ADMIN_LOGIN") {
//         Ok(login) => login,
//         Err(_) => {
//             warn!("ADMIN_LOGIN environment variable not set");
//             return (
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 Json(AdminErrorResponse {
//                     error: "Server configuration error".to_string(),
//                 }),
//             ).into_response();
//         }
//     };

//     let admin_password_hash = match var("ADMIN_PASSWORD_HASH") {
//         Ok(hash) => hash,
//         Err(_) => {
//             warn!("ADMIN_PASSWORD_HASH environment variable not set");
//             return (
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 Json(AdminErrorResponse {
//                     error: "Server configuration error".to_string(),
//                 }),
//             ).into_response();
//         }
//     };

//     let username_valid = payload.username == admin_login;
//     let password_valid = verify(
//         &payload.password,
//         if username_valid {
//             &admin_password_hash
//         } else {
//             "$2b$12$dummyhashdummyhashdummyhac"
//         },
//     )
//     .unwrap_or(false);

//     if !(username_valid && password_valid) {
//         warn!("Failed admin login attempt for: {}", payload.username);
//         return (
//             StatusCode::UNAUTHORIZED,
//             Json(AdminErrorResponse {
//                 error: "Invalid credentials".to_string(),
//             }),
//         ).into_response();
//     }

//     // Генерация сессионного токена
//     let session_token = "dasdasdsa".to_string(); // TODO: Здесь должна быть логика генерации безопасного токена. Мб JWT
//     info!("Admin logged in: {}", payload.username);

//     let cookie_value = format!(
//         "admin_session={}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=3600",
//         session_token
//     );

//     let mut response_headers = HeaderMap::new();
//     if let Ok(cookie_header) = cookie_value.parse() {
//         response_headers.insert(header::SET_COOKIE, cookie_header);
//     }

//     (
//         StatusCode::OK,
//         response_headers,
//         Json(AdminSuccessResponse {
//             status: "success".to_string(),
//             redirect: "/admin/dashboard".to_string(),
//         }),
//     ).into_response()
// }

// /api/v1/admin/dashboard-page?page=1&per_page=20
pub async fn post_admin_dashboard(
    State(state): State<AppState>,
    pagination: axum::extract::Query<PaginationQuery>,
) -> Result<Json<PaginationResult<Submission>>, AppError> {
    let result: PaginationResult<Submission> = state.db_postgres.get_submissions_paginated(
        pagination.page.try_into().unwrap(),
        pagination.per_page.try_into().unwrap()
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