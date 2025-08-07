use axum::{
    http::StatusCode,
    response::{Json, IntoResponse, Response},
};
use serde_json::json;
use thiserror::Error;
use crate::database::postgres::error::DatabaseError;
use crate::database::redis::redis_interface::DatabaseError as RedisDbError;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] DatabaseError),
    
    #[error("Redis database error: {0}")]
    RedisError(#[from] RedisDbError),
    
    #[error("Raw Redis error: {0}")]
    RawRedis(#[from] redis::RedisError),
    
    #[error("Bad request: {0}")]
    BadRequest(String),
    
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    
    #[error("Too many requests: {0}")]
    TooManyRequests(String),
    
    #[error("JWT error: {0}")]
    JwtError(#[from] jsonwebtoken::errors::Error),
    
    #[error("BCrypt error: {0}")]
    BcryptError(#[from] bcrypt::BcryptError),
    
    #[error("JSON serialization error: {0}")]
    JsonError(#[from] serde_json::Error),
    
    #[error("Environment variable error: {0}")]
    EnvError(#[from] std::env::VarError),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            // Существующие ошибки базы данных
            AppError::DatabaseError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            ),
            
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::TooManyRequests(msg) => (StatusCode::TOO_MANY_REQUESTS, msg),
            
            AppError::RedisError(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Redis error: {}", e)),
            AppError::RawRedis(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Redis error: {}", e)),
            
            AppError::JwtError(e) => (StatusCode::UNAUTHORIZED, format!("Authentication error: {}", e)),
            
            AppError::BcryptError(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Password hashing error: {}", e)),
            
            AppError::JsonError(e) => (StatusCode::BAD_REQUEST, format!("JSON parsing error: {}", e)),
        
            AppError::EnvError(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Configuration error: {}", e)),
        };

        tracing::error!("Application error: {} - Status: {}", message, status);

        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl AppError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(msg.into())
    }
    
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(msg.into())
    }
    
    pub fn too_many_requests(msg: impl Into<String>) -> Self {
        Self::TooManyRequests(msg.into())
    }
    
}