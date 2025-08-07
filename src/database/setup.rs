use tracing::{info, error};
use crate::database::{
    redis::redis_interface::RedisDatabase,
    postgres::postgres_interface::PostgresDatabase,
};

pub async fn setup_redis(redis_url: &str) -> Result<RedisDatabase, Box<dyn std::error::Error>> {
    info!("Connecting to Redis");
    
    match RedisDatabase::new(redis_url).await {
        Ok(db) => {
            info!("Successfully connected to Redis");
            Ok(db)
        },
        Err(e) => {
            error!(error = %e, "Failed to connect to Redis");
            Err(Box::new(e))
        }
    }
}

pub async fn setup_postgres(database_url: &str) -> Result<PostgresDatabase, Box<dyn std::error::Error>> {
    info!("Connecting to PostgreSQL");
    
    match PostgresDatabase::new(database_url).await {
        Ok(db) => {
            info!("Successfully connected to PostgreSQL");
            Ok(db)
        },
        Err(e) => {
            error!(error = %e, "Failed to connect to PostgreSQL");
            Err(Box::new(e))
        }
    }
}
