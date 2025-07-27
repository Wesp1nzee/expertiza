use redis::AsyncCommands;
use uuid::Uuid;
use serde::Serialize;

#[derive(Serialize)]
pub struct CsrfTokenResponse {
    pub token: String,
    pub expires_in: usize,
}

pub struct CsrfService {
    pub redis_url: String,
    pub ttl_seconds: usize,
}

impl CsrfService {
    pub fn new(redis_url: impl Into<String>, ttl_seconds: usize) -> Self {
        Self {
            redis_url: redis_url.into(),
            ttl_seconds,
        }
    }

    pub fn get_redis_url(&self) -> &str {
        &self.redis_url
    }

    /// Генерация и сохранение CSRF‑токена с TTL
    pub async fn create_token(&self) -> Result<String, redis::RedisError> {
        let mut conn = redis::Client::open(self.redis_url.as_str())?
            .get_connection_manager() 
            .await?;
            
        let token = Uuid::new_v4().to_string();
        println!("Generated CSRF token: {}", token);
        let key = format!("csrf:{}", token);
        let _: () = conn.set_ex(&key, 1u8, self.ttl_seconds as u64).await?;
        Ok(token)
    }
}