use axum::{
    extract::{State, Request},
    http::{StatusCode, HeaderMap},
    middleware::Next,
    response::{IntoResponse, Response, Redirect},
    Json,
};
use axum_extra::extract::cookie::{CookieJar, Cookie, SameSite};
use bcrypt::{verify};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::AppError};
use crate::state::AppState;
use crate::csrf::CsrfService;

// Структуры для запросов и ответов
#[derive(Debug, Deserialize)]
pub struct AdminLoginRequest {
    username: String,
    password: String,
}

#[derive(Debug, Serialize)]
pub struct AdminLoginResponse {
    redirect_url: String,
    expires_in: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdminClaims {
    pub sub: String,      // subject (admin ID)
    pub iat: i64,         // issued at
    pub exp: i64,         // expires at
    pub jti: String,      // JWT ID (для отзыва токенов)
    pub role: String, 
    pub session_id: String, // ID сессии
}

#[derive(Debug, Serialize)]
pub struct AdminUser {
    pub id: String,
    pub username: String,
    pub role: String,
}

// Константы безопасности
const ACCESS_TOKEN_EXPIRY: i64 = 3600; // 1 hour
const REFRESH_TOKEN_EXPIRY: i64 = 86400 * 7; // 7 days
const MAX_LOGIN_ATTEMPTS: i32 = 5;
const LOGIN_ATTEMPT_WINDOW: i64 = 900; // 15 minutes
const SECURE_COOKIE_NAME: &str = "__Secure-admin-session";

/// Основной обработчик авторизации админа. 
/// PATH admin/api/v1/login
pub async fn admin_login_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<AdminLoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    let conn = state
        .db_redis
        .get_connection()
        .await
        .map_err(AppError::RedisError)?;

    let mut csrf = CsrfService::new(conn, 3600);

    let csrf_token = headers
        .get("X-CSRF-Token")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::unauthorized("Missing CSRF token"))?;

    let session_id: &str = jar
        .get("session_id")
        .map(|cookie| cookie.value())
        .ok_or_else(|| AppError::unauthorized("Missing session_id"))?;


    csrf.validate_csrf_token(session_id, csrf_token).await?;

    check_rate_limit(&state, &payload.username).await?;

    if payload.username.trim().is_empty() || payload.password.is_empty() {
        increment_failed_attempts(&state, &payload.username).await?;
        return Err(AppError::bad_request("Username and password are required"));
    }

    let admin_user = authenticate_admin(&state, &payload.username, &payload.password).await?;

    let session_id = Uuid::new_v4().to_string();
    let (access_token, refresh_token) = create_admin_tokens(&state, &admin_user, &session_id).await?;

    // Saving the session in Redis
    save_admin_session(&state, &session_id, &admin_user, &access_token, &refresh_token).await?;

    // Clearing the failed login attempts counter
    clear_failed_attempts(&state, &payload.username).await?;

    let cookie_value = format!("{}:{}", access_token, refresh_token);
    let secure_cookie = format!(
        "{}={}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age={}",
        SECURE_COOKIE_NAME,
        cookie_value,
        ACCESS_TOKEN_EXPIRY
    );

    let mut response_headers = HeaderMap::new();
    response_headers.insert("Set-Cookie", secure_cookie.parse().unwrap());
    response_headers.insert(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private".parse().unwrap(),
    );

    Ok((
        StatusCode::OK,
        response_headers,
        Json(AdminLoginResponse {
            redirect_url: "/admin/dashboard".to_string(),
            expires_in: ACCESS_TOKEN_EXPIRY,

        }),
    ))
}


/// Проверка лимита попыток входа
async fn check_rate_limit(state: &AppState, username: &str) -> Result<(), AppError> {
    let mut conn = state.db_redis.get_connection().await?;
    let key = format!("login_attempts:{}", username);

    let attempts: Option<i32> = conn
        .get(&key)
        .await?;

    if let Some(count) = attempts {
        if count >= MAX_LOGIN_ATTEMPTS {
            return Err(AppError::too_many_requests(
                "Too many login attempts. Please try again later."
            ));
        }
    }

    Ok(())
}

/// Увеличение счетчика неудачных попыток
async fn increment_failed_attempts(state: &AppState, username: &str) -> Result<(), AppError> {
    let mut conn = state.db_redis.get_connection().await?;
    let key = format!("login_attempts:{}", username);

    let _: () = conn.incr(&key, 1).await?;
    let _: () = conn.expire(&key, LOGIN_ATTEMPT_WINDOW).await?;

    Ok(())
}

/// Очистка счетчика неудачных попыток
async fn clear_failed_attempts(state: &AppState, username: &str) -> Result<(), AppError> {
    let mut conn = state.db_redis.get_connection().await?;
    let key = format!("login_attempts:{}", username);

    let _: () = conn.del(&key).await?;

    Ok(())
}

/// Аутентификация админа по данным из .env
async fn authenticate_admin(state: &AppState, username: &str, password: &str) -> Result<AdminUser, AppError> {
    let admin_username = state.admin_username.clone();
    let admin_password_hash = state.admin_password_hash.clone();
    println!("\nAdmin password hash: {}", admin_password_hash);
    // Проверка имени пользователя
    if username != admin_username {
        return Err(AppError::unauthorized("Invalid credentials"));
    }

    // Проверка пароля
    let is_valid = verify(password, &admin_password_hash)?;
    if !is_valid {
        return Err(AppError::unauthorized("Invalid credentials"));
    }

    Ok(AdminUser {
        id: Uuid::new_v4().to_string(),
        username: admin_username,
        role: "admin".to_string(),
    })
}

/// Создание JWT токенов
async fn create_admin_tokens(state: &AppState, admin: &AdminUser, session_id: &str) -> Result<(String, String), AppError> {
    let jwt_secret = state.jwt_secret.clone();
    let now = Utc::now().timestamp();
    
    // Access token
    let access_claims = AdminClaims {
        sub: admin.id.clone(),
        iat: now,
        exp: now + ACCESS_TOKEN_EXPIRY,
        jti: Uuid::new_v4().to_string(),
        role: admin.role.clone(),
        session_id: session_id.to_string(),
    };

    // Refresh token
    let refresh_claims = AdminClaims {
        sub: admin.id.clone(),
        iat: now,
        exp: now + REFRESH_TOKEN_EXPIRY,
        jti: Uuid::new_v4().to_string(),
        role: admin.role.clone(),
        session_id: session_id.to_string(),
    };

    let encoding_key = EncodingKey::from_secret(jwt_secret.as_ref());
    
    let access_token = encode(&Header::default(), &access_claims, &encoding_key)?;
    let refresh_token = encode(&Header::default(), &refresh_claims, &encoding_key)?;

    Ok((access_token, refresh_token))
}

/// Сохранение сессии в Redis
async fn save_admin_session(
    state: &AppState,
    session_id: &str,
    admin: &AdminUser,
    access_token: &str,
    refresh_token: &str,
) -> Result<(), AppError> {
    let mut conn = state.db_redis.get_connection().await?;

    let session_data = serde_json::json!({
        "admin_id": admin.id,
        "username": admin.username,
        "role": admin.role,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "created_at": Utc::now().timestamp(),
        "last_activity": Utc::now().timestamp()
    });

    let session_key = format!("admin_session:{}", session_id);
    
    // Сохраняем сессию
    let _: () = conn
        .set_ex(&session_key, session_data.to_string(), ACCESS_TOKEN_EXPIRY as u64)
        .await?;

    // Сохраняем mapping токена к сессии для быстрого поиска
    let token_key = format!("token_session:{}", access_token);
    let _: () = conn
        .set_ex(&token_key, session_id, ACCESS_TOKEN_EXPIRY as u64)
        .await?;

    Ok(())
}

/// Middleware для проверки авторизации админа
pub async fn admin_auth_middleware(
    State(state): State<AppState>,
    jar: CookieJar,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    // TODO: Добавить к редиректу сообщения об ошибке
    let cookie = match jar.get(SECURE_COOKIE_NAME) {
        Some(c) => c,
        None => {
            return Ok(Redirect::to("/admin/login").into_response());
        }
    };

    let token = {
        let value = cookie.value();
        match value.splitn(2, ':').next().filter(|s| !s.is_empty()) {
            Some(t) => t.to_string(),
            None => {
                return Ok(Redirect::to("/admin/login").into_response());
            }
        }
    };

    let claims = match validate_admin_token(&state, &token).await {
        Ok(c) => c,
        Err(_) => return Ok(Redirect::to("/admin/login").into_response()),
    };

    if validate_admin_session(&state, &claims).await.is_err() {
        return Ok(Redirect::to("/admin/login").into_response());
    }

    update_session_activity(&state, &claims.session_id).await?;

    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}

/// Валидация JWT токена
async fn validate_admin_token(state: &AppState, token: &str) -> Result<AdminClaims, AppError> {
    let jwt_secret = state.jwt_secret.clone();

    let decoding_key = DecodingKey::from_secret(jwt_secret.as_ref());
    let validation = Validation::default();

    let token_data = decode::<AdminClaims>(token, &decoding_key, &validation)
        .map_err(|_| AppError::unauthorized("Invalid or expired token"))?;

    Ok(token_data.claims)
}

/// Валидация сессии в Redis
async fn validate_admin_session(state: &AppState, claims: &AdminClaims) -> Result<(), AppError> {
    let mut conn = state.db_redis.get_connection().await?;
    let session_key = format!("admin_session:{}", claims.session_id);

    let session_exists: bool = conn.exists(&session_key).await?;

    if !session_exists {
        return Err(AppError::unauthorized("Session not found or expired"));
    }

    Ok(())
}

/// Обновление активности сессии
async fn update_session_activity(state: &AppState, session_id: &str) -> Result<(), AppError> {
    let mut conn = state.db_redis.get_connection().await?;
    let session_key = format!("admin_session:{}", session_id);

    // Получаем текущую сессию
    let session_data: Option<String> = conn.get(&session_key).await?;

    if let Some(data) = session_data {
        let mut session: serde_json::Value = serde_json::from_str(&data)?;

        session["last_activity"] = serde_json::json!(Utc::now().timestamp());

        let _: () = conn
            .set_ex(&session_key, session.to_string(), ACCESS_TOKEN_EXPIRY as u64)
            .await?;
    }

    Ok(())
}

/// Обработчик выхода из системы
pub async fn admin_logout_handler(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<impl IntoResponse, AppError> {
    // Если в куках есть session_id — удаляем сессию в Redis
    if let Some(cookie) = jar.get(SECURE_COOKIE_NAME) {
        let token_str = cookie.value().splitn(2, ':').next().unwrap_or("");
        if let Ok(claims) = validate_admin_token(&state, token_str).await {
            let mut conn = state.db_redis.get_connection().await?;
            let session_key = format!("admin_session:{}", claims.session_id);
            let token_key = format!("token_session:{}", token_str);

            let _: () = conn.del(&session_key).await.unwrap_or(());
            let _: () = conn.del(&token_key).await.unwrap_or(());
        }
    }

    // Формируем удаление куки
    let jar = jar.remove(
        Cookie::build((SECURE_COOKIE_NAME, " "))
            .path("/")
            .http_only(true)
            .secure(true)
            .same_site(SameSite::Strict)
            .build()    // собираем Cookie из билдера
    );

    Ok((jar, Redirect::to("/admin/login")))
}