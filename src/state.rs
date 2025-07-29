use std::sync::Arc;
use crate::database::redis::redis_interface::RedisDatabase;
use crate::database::postgres::postgres_interface::PostgresDatabase;

#[derive(Clone)]
pub struct AppState {
    pub db_postgres: Arc<PostgresDatabase>,
    pub db_redis: Arc<RedisDatabase>,
}
