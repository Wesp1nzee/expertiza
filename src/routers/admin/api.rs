use axum::{
    http::{StatusCode, HeaderMap, header},
    response::{Json, IntoResponse, Response},
    extract::Json as ExtractJson,
};
use serde::{Deserialize, Serialize};
use dotenv::var;
use tracing::{info, warn};
use bcrypt::verify;


#[derive(Debug, Deserialize)]
pub struct AdminLoginRequest {
    username: String,
    password: String,
}

#[derive(Debug, Serialize)]
struct AdminSuccessResponse {
    status: String,
    redirect: String,
}

#[derive(Debug, Serialize)]
struct AdminErrorResponse {
    error: String,
}

// Основной обработчик админ логина
// TODO: довести до ума
pub async fn post_admin_login(
    _headers: HeaderMap,
    ExtractJson(payload): ExtractJson<AdminLoginRequest>,
) -> Response {
    
    let admin_login = match var("ADMIN_LOGIN") {
        Ok(login) => login,
        Err(_) => {
            warn!("ADMIN_LOGIN environment variable not set");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AdminErrorResponse {
                    error: "Server configuration error".to_string(),
                }),
            ).into_response();
        }
    };

    let admin_password_hash = match var("ADMIN_PASSWORD_HASH") {
        Ok(hash) => hash,
        Err(_) => {
            warn!("ADMIN_PASSWORD_HASH environment variable not set");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AdminErrorResponse {
                    error: "Server configuration error".to_string(),
                }),
            ).into_response();
        }
    };

    // let csrf_secret = var("CSRF_SECRET").unwrap_or_else(|_| "default_secret".to_string());
    
    // // Проверка CSRF токена
    // let csrf_token = headers
    //     .get("X-CSRF-Token")
    //     .and_then(|v| v.to_str().ok())
    //     .unwrap_or("");
    
    // if !verify_csrf_token(csrf_token, &csrf_secret).await {
    //     warn!("Invalid CSRF token in admin login attempt");
    //     return (
    //         StatusCode::FORBIDDEN,
    //         Json(AdminErrorResponse {
    //             error: "Invalid CSRF token".to_string(),
    //         }),
    //     ).into_response();
    // }

    let username_valid = payload.username == admin_login;
    let password_valid = verify(
        &payload.password,
        if username_valid {
            &admin_password_hash
        } else {
            "$2b$12$dummyhashdummyhashdummyhac"
        },
    )
    .unwrap_or(false);

    if !(username_valid && password_valid) {
        warn!("Failed admin login attempt for: {}", payload.username);
        return (
            StatusCode::UNAUTHORIZED,
            Json(AdminErrorResponse {
                error: "Invalid credentials".to_string(),
            }),
        ).into_response();
    }

    // Генерация сессионного токена
    let session_token = "dasdasdsa".to_string(); // TODO: Здесь должна быть логика генерации безопасного токена. Мб JWT
    info!("Admin logged in: {}", payload.username);

    let cookie_value = format!(
        "admin_session={}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=3600",
        session_token
    );

    let mut response_headers = HeaderMap::new();
    if let Ok(cookie_header) = cookie_value.parse() {
        response_headers.insert(header::SET_COOKIE, cookie_header);
    }

    (
        StatusCode::OK,
        response_headers,
        Json(AdminSuccessResponse {
            status: "success".to_string(),
            redirect: "/admin/dashboard".to_string(),
        }),
    ).into_response()
}
