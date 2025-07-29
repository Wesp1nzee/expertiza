#[derive(Debug)]
pub enum DatabaseError {
    Redis(redis::RedisError),
    Serialization(serde_json::Error),
    NotFound(String),
    InvalidUuid(String),
}

impl std::fmt::Display for DatabaseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DatabaseError::Redis(e) => write!(f, "Redis error: {}", e),
            DatabaseError::Serialization(e) => write!(f, "Serialization error: {}", e),
            DatabaseError::NotFound(id) => write!(f, "Submission not found: {}", id),
            DatabaseError::InvalidUuid(id) => write!(f, "Invalid UUID format: {}", id),
        }
    }
}

impl std::error::Error for DatabaseError {}

impl From<redis::RedisError> for DatabaseError {
    fn from(error: redis::RedisError) -> Self {
        DatabaseError::Redis(error)
    }
}

impl From<serde_json::Error> for DatabaseError {
    fn from(error: serde_json::Error) -> Self {
        DatabaseError::Serialization(error)
    }
}

pub struct RedisDatabase {
    connection_pool: redis::aio::ConnectionManager,
}

impl RedisDatabase {
    /// Создает новое подключение к Redis с connection pooling
    pub async fn new(redis_url: &str) -> Result<Self, DatabaseError> {
        let client = redis::Client::open(redis_url)?;
        let connection_pool = client.get_connection_manager().await?;
        
        Ok(Self {
            connection_pool,
        })
    }

    /// Получает connection из пула
    async fn get_connection(&self) -> Result<redis::aio::ConnectionManager, DatabaseError> {
        Ok(self.connection_pool.clone())
    }
}
