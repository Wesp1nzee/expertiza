use std::sync::Arc;
use tracing::{info, error};
use crate::database::{
    redis::redis_interface::RedisDatabase,
    postgres::postgres_interface::PostgresDatabase,
};
use crate::state::AppState;
use crate::config::Config;

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

pub async fn setup_databases(config: &Config) -> Result<AppState, Box<dyn std::error::Error>> {
    let db_redis = setup_redis(&config.redis_url).await?;
    let db_postgres = setup_postgres(&config.database_url).await?;
    
    info!("Running database migrations");
    db_postgres.migrate().await?;
    info!("Database migrations completed");
    
    let shared_state = AppState { 
        db_postgres: Arc::new(db_postgres),
        db_redis: Arc::new(db_redis) 
    };
    
    Ok(shared_state)
}