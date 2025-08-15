use dotenvy::dotenv;
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub server_address: String,
    pub jwt_secret: String,
    pub admin_login: String,
    pub admin_password: String
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

        let jwt_secret = env::var("JWT_SECRET")?;

        let admin_password = env::var("ADMIN_PASSWORD")?;
        let admin_login = env::var("ADMIN_LOGIN")?;
        
        Ok(Config {
            database_url,
            redis_url,
            server_address,
            jwt_secret,
            admin_login,
            admin_password
        })
    }
}