use redis::AsyncCommands;
use redis::FromRedisValue;

pub struct RedisInterface {
    client: redis::Client,
}

impl RedisInterface {
    pub fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        Ok(Self { client })
    }

    pub async fn get_connection(&self) -> Result<redis::aio::ConnectionManager, redis::RedisError> {
        self.client.get_connection_manager().await
    }

    pub async fn set<T: Into<String>>(&self, key: T, value: T, ttl_seconds: usize) -> Result<(), redis::RedisError> {
        let mut conn = self.get_connection().await?;
        let _: () = conn.set_ex(key.into(), value.into(), ttl_seconds as u64).await?;
        Ok(())
    }

    pub async fn get<T: FromRedisValue>(&self, key: &str) -> Result<T, redis::RedisError> {
        let mut conn = self.get_connection().await?;
        conn.get(key).await
    }
    
}