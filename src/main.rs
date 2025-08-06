mod routers;
mod middleware;
mod state;
mod database;
pub mod csrf;
mod config;
mod logging;
mod server;

use crate::config::Config;
use crate::logging::setup_tracing;
use crate::server::create_app;
use axum::serve;
use tokio::net::TcpListener;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    setup_tracing().await;
    
    info!("Starting server initialization");
    
    let config: Config = Config::from_env()?;
    let app = create_app(config.clone()).await?;
    
    let listener: TcpListener = TcpListener::bind(&config.server_address).await?;
    info!("🚀 Сервер запущен на http://{}", config.server_address);
    serve(listener, app).await?;

    Ok(())
}