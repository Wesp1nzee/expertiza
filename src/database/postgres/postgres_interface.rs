use super::error::{Result, DatabaseError};
use super::models::*;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use tracing::info;
pub struct PostgresDatabase {
    pool: PgPool,
}

impl PostgresDatabase {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = PgPool::connect(database_url).await?;
        
        sqlx::query("SELECT 1").execute(&pool).await?;
        
        info!("Successfully connected to PostgreSQL database");
        
        Ok(Self { pool })
    }

    pub async fn migrate(&self) -> Result<()> {
        sqlx::migrate!("./migrations")
            .run(&self.pool)
            .await?;

        Ok(())
    }
    
    pub async fn save_submission(&self, request: CreateSubmissionRequest) -> Result<Submission> {
        let submission = request.into_submission();

        let saved_submission = sqlx::query_as!(
            Submission,
            r#"
            INSERT INTO submissions (submission_id, name, email, phone, message, created_at, status, admin_comments)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
            submission.submission_id,
            submission.name,
            submission.email,
            submission.phone,
            submission.message,
            submission.created_at,
            submission.status,
            submission.admin_comments 
        )
        .fetch_one(&self.pool)
        .await?;

        info!("Submission saved: {}", saved_submission.submission_id);
        Ok(saved_submission)
    }

    /// Получает заявки с пагинацией
    pub async fn get_submissions_paginated(
    &self,
    page: i64,
    per_page: i64,
) -> Result<PaginationResult> {
    let page = page.max(1);
    let per_page = per_page.clamp(1, 10); 
    let offset = (page - 1) * per_page;

    let total_count_query = "SELECT COUNT(*) as count FROM submissions";
    let total_count: i64 = sqlx::query(total_count_query)
        .fetch_one(&self.pool)
        .await?
        .get("count");

    let data_query = "
        SELECT *
        FROM submissions
        LIMIT $1
        OFFSET $2
    ";

    let submissions = sqlx::query_as::<_, Submission>(data_query)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

    Ok(PaginationResult::new(submissions, total_count, page, per_page))
}


    /// Получает статистику базы данных
    pub async fn get_statistics(&self) -> Result<DatabaseStats> {
        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_submissions,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_count,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as this_week_count,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as this_month_count
            FROM submissions
            "#
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(DatabaseStats {
            total_submissions: stats.total_submissions.unwrap_or(0),
            today_count: stats.today_count.unwrap_or(0),
            this_week_count: stats.this_week_count.unwrap_or(0),
            this_month_count: stats.this_month_count.unwrap_or(0),
        })
    }

    pub async fn update_submissions_status(
        &self,
        submission_id: Uuid,
        status: String,
    ) -> Result<()> {  
        let updated_submission = sqlx::query_as!(
            Submission,
            r#"
            UPDATE submissions
            SET status = $1
            WHERE submission_id = $2
            RETURNING *
            "#,
            status,
            submission_id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(DatabaseError::from)?; 

        info!("Submission updated: {}", updated_submission.submission_id);
        Ok(())
    }
}
