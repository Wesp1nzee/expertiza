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
            .await
            .map_err(|e| DatabaseError::Migration(e))?;

        Ok(())
    }
    
    pub async fn save_submission(&self, request: CreateSubmissionRequest) -> Result<()> {
        let submission = request.into_submission();

        sqlx::query(
            "
            INSERT INTO submissions (submission_id, name, email, phone, message, created_at, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "
        )
        .bind(submission.submission_id)
        .bind(submission.name)
        .bind(submission.email)
        .bind(submission.phone)
        .bind(submission.message)
        .bind(submission.created_at)
        .bind(submission.status)
        .execute(&self.pool)
        .await?;

        info!("Submission saved: {}", submission.submission_id);
        Ok(())
    }

    pub async fn get_submissions_paginated(
        &self,
        page: i64,
        per_page: i64,
        sort_by: Option<&str>,
        sort_order: Option<&str>,
    ) -> Result<PaginationResult> {
        let page = page.max(1);
        let per_page = per_page.clamp(1, 10);
        let offset = (page - 1) * per_page;

        let total_count_query = "SELECT COUNT(*) as count FROM submissions";
        let total_count: i64 = sqlx::query(total_count_query)
            .fetch_one(&self.pool)
            .await?
            .get("count");


        let sort_col = sort_by
            .map(|s| s.trim().to_lowercase())
            .unwrap_or_else(|| "created_at".to_string());

        let sort_column = match sort_col.as_str() {
            "created_at" | "created" | "date" => "created_at",
            "name" => "name",
            "email" => "email",
            "status" => "status",
            "submission_id" | "id" => "submission_id",
            _ => "created_at", // default
        };

        let order = sort_order
            .map(|o| o.trim().to_lowercase())
            .unwrap_or_else(|| "desc".to_string());

        let order_dir = match order.as_str() {
            "asc" => "ASC",
            "desc" => "DESC",
            _ => "DESC",
        };

        let data_query = format!(
            "SELECT * FROM submissions
            ORDER BY {} {}
            LIMIT $1 OFFSET $2",
            sort_column, order_dir
        );

        let submissions = sqlx::query_as::<_, Submission>(&data_query)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&self.pool)
            .await?;

        Ok(PaginationResult::new(submissions, total_count, page, per_page))
    }



    pub async fn get_statistics(&self) -> Result<DatabaseStats> {
        let stats = sqlx::query(
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
            total_submissions: stats.get::<i64, _>("total_submissions"),
            today_count: stats.get::<i64, _>("today_count"),
            this_week_count: stats.get::<i64, _>("this_week_count"),
            this_month_count: stats.get::<i64, _>("this_month_count"),
        })
    }

    pub async fn update_submissions_status(
        &self,
        submission_id: Uuid,
        status: String,
    ) -> Result<()> {  
        let updated_submission = sqlx::query(
            r#"
            UPDATE submissions
            SET status = $1
            WHERE submission_id = $2
            RETURNING submission_id
            "#,
        )
        .bind(status)
        .bind(submission_id)
        .fetch_one(&self.pool)
        .await?;

        info!("Submission updated: {}", updated_submission.get::<Uuid, _>("submission_id"));
        Ok(())
    }

    pub async fn get_admin_password(&self, admin_name: &str) -> Result<Option<(Uuid, String)>> {
        let result = sqlx::query(
            r#"
            SELECT id, password FROM admin WHERE username = $1
            "#
        )
        .bind(admin_name)
        .fetch_optional(&self.pool)
        .await?;
    
        Ok(result.map(|row| (row.get("id"), row.get("password"))))
    }

    pub async fn create_admin_comments(&self, admin_id: Uuid, submissions_id: Uuid, text: String) -> Result<()> {
        sqlx::query(    
            r#"
            INSERT INTO admin_comments (admin_id, submission_id, comment)
            VALUES ($1, $2, $3)
            "#
        )
        .bind(admin_id)
        .bind(submissions_id)
        .bind(text)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_admin_comments(&self, submissions_id: Uuid) -> Result<SubmissionCommentsRequest> {
        let rows = sqlx::query(
            r#"
            SELECT 
                ac.id as comment_id,
                ac.comment,
                ac.created_at,
                a.username as admin_name
            FROM admin_comments ac
            JOIN admin a ON ac.admin_id = a.id
            WHERE ac.submission_id = $1
            ORDER BY ac.created_at ASC
            "#
        )
        .bind(submissions_id)
        .fetch_all(&self.pool)
        .await?;

        let comments = rows
            .into_iter()
            .map(|row| SubmissionComment {
                comment_id: row.get("comment_id"),
                comment: row.get("comment"),
                created_at: row.get("created_at"),
                admin_name: row.get("admin_name"),
            })
            .collect();

        Ok(SubmissionCommentsRequest { data: comments })
    }
}
