use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Submission {
    pub submission_id: Uuid,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub message: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub status: String
}

#[derive(Debug, Serialize)]
pub struct PaginationResult<T> {
    pub data: Vec<T>,
    pub total_count: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
    pub has_next: bool,
    pub has_prev: bool,
}

impl<T> PaginationResult<T> {
    pub fn new(data: Vec<T>, total_count: i64, page: i64, per_page: i64) -> Self {
        let total_pages = (total_count + per_page - 1) / per_page;
        Self {
            data,
            total_count,
            page,
            per_page,
            total_pages,
            has_next: page < total_pages,
            has_prev: page > 1,
        }
    }
}


#[derive(Debug, Serialize)]
pub struct DatabaseStats {
    pub total_submissions: i64,
    pub today_count: i64,
    pub this_week_count: i64,
    pub this_month_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateSubmissionRequest {
    pub submission_id: Uuid,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub message: String,
}

impl CreateSubmissionRequest {
    pub fn into_submission(self) -> Submission {
        let now = chrono::Utc::now();
        Submission {
            submission_id: Uuid::new_v4(),
            name: self.name,
            email: self.email,
            phone: self.phone,
            message: self.message,
            created_at: now,
            status: "new".to_string()
        }
    }
}