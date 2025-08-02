use dotenvy::dotenv;
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub server_address: String,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        dotenv().ok();
        
        let database_url = env::var("DATABASE_URL")
            .map_err(|_| "DATABASE_URL must be set")?;
        
        let redis_url = env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1/".into());
        
        let server_address = env::var("SERVER_ADDRESS")
            .unwrap_or_else(|_| "127.0.0.1:3000".into());
        
        Ok(Config {
            database_url,
            redis_url,
            server_address,
        })
    }
}