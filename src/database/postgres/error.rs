use thiserror;

#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
    
    #[error("Submission not found: {0}")]
    NotFound(String),
    
    #[error("Invalid UUID format: {0}")]
    InvalidUuid(#[from] uuid::Error),
}

pub type Result<T> = std::result::Result<T, DatabaseError>;