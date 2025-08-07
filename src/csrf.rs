use rand::rng;
use redis::AsyncCommands;
use rand::{distr::Alphanumeric, Rng};
use serde::Serialize;

use crate::error::AppError;

const CSRF_TOKEN_PREFIX: &str = "csrf";

#[derive(Serialize)]
pub struct CsrfTokenResponse {
    pub token: String,
    pub expires_in: usize, // lifetime the token in seconds
}

pub struct CsrfService {
    redis_con: redis::aio::ConnectionManager,
    ttl_seconds: usize,
}

impl CsrfService {
    pub fn new(redis_con: redis::aio::ConnectionManager, ttl_seconds: usize) -> Self {
        Self { redis_con, ttl_seconds }
    }

    /// Генерация крипто-безопасного CSRF-токена и сохранение с TTL
    pub async fn create_token(&mut self, session_id: String) -> Result<String, redis::RedisError> {
        let token: String = rng()
            .sample_iter(&Alphanumeric)
            .take(32)
            .map(char::from)
            .collect();

        let key = format!("{}:{}:{}", CSRF_TOKEN_PREFIX, session_id, token);
        let _: () = self.redis_con.set_ex(&key, b"1", self.ttl_seconds as u64).await?;

        Ok(token.as_str().to_string())
    }

    /// Проверка и немедленное удаление CSRF-токена
    pub async fn validate_csrf_token(&mut self, session_id: &str, token: &str) -> Result<(), AppError> {
        let key = format!("{}:{}:{}", CSRF_TOKEN_PREFIX, session_id, token);
        let exists: bool = self.redis_con.exists(&key).await
            .map_err(AppError::from)?;

        if !exists {
            return Err(AppError::unauthorized("Invalid or expired CSRF token"));
        }

        let _: () = self.redis_con.del(&key).await
            .map_err(AppError::from)?;

        Ok(())
    }
}
