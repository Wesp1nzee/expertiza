use axum::{
    extract::{Request},
        http::{
        header::{CONTENT_SECURITY_POLICY, X_CONTENT_TYPE_OPTIONS, X_FRAME_OPTIONS, X_XSS_PROTECTION},
        HeaderValue, StatusCode
    },
    response::Response,
    middleware::{Next},
};
use std::{
    collections::HashMap,
    sync::{Arc},
    time::{Duration, Instant},
};
use tokio::{
    sync::Mutex,
    time::sleep,
};


#[derive(Debug, Clone)]
struct RateLimitEntry {
    count: u32,
    window_start: Instant,
}

type RateLimitStore = Arc<Mutex<HashMap<String, RateLimitEntry>>>;

pub async fn security_headers_middleware(request: Request, next: Next) -> Response {
    let response = next.run(request).await;
    let mut response = response;
    
    let headers = response.headers_mut();
    
    // Защита от XSS
    headers.insert(
        X_XSS_PROTECTION,
        HeaderValue::from_static("1; mode=block"),
    );
    
    // Защита от clickjacking
    headers.insert(
        X_FRAME_OPTIONS,
        HeaderValue::from_static("DENY"),
    );
    
    // Предотвращение MIME type sniffing
    headers.insert(
        X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    
    headers.insert(
        CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(
            "default-src 'self'; \
            script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; \
            style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; \
            img-src 'self' data: https:; \
            font-src 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com; \
            connect-src 'self'; \
            frame-ancestors 'none'; \
            base-uri 'self'; \
            form-action 'self'"
        ),
    );
    // Strict Transport Security (для HTTPS)
    headers.insert(
        "Strict-Transport-Security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains; preload"),
    );
    
    // Permissions Policy
    headers.insert(
        "Permissions-Policy",
        HeaderValue::from_static("geolocation=(), microphone=(), camera=()"),
    );

    headers.insert(
        "Cache-Control",
        HeaderValue::from_static("no-store, no-cache, must-revalidate, proxy-revalidate"),
    );
    
    response
}

pub async fn rate_limit_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    use std::sync::OnceLock;
    static RATE_LIMIT_STORE: OnceLock<RateLimitStore> = OnceLock::new();
    let rate_limit_store = RATE_LIMIT_STORE.get_or_init(|| Arc::new(Mutex::new(HashMap::new())));
    let now = Instant::now();
    let window_duration = Duration::from_secs(60); // 1 минута
    let max_requests = 100; // максимум 100 запросов в минуту
    
    let mut store = rate_limit_store.lock().await;
    
    let client_ip = "127.0.0.1".to_string(); // TODO: заменить на реальный IP клиента
    
    let entry = store.entry(client_ip.clone()).or_insert(RateLimitEntry {
        count: 0,
        window_start: now,
    });
    
    // сброс, если прошло больше минуты
    if now.duration_since(entry.window_start) > window_duration {
        entry.count = 0;
        entry.window_start = now;
    }
    
    entry.count += 1;
    
    if entry.count > max_requests {
        // небольшая задержка
        drop(store);
        sleep(Duration::from_millis(1000)).await;
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    
    drop(store);
    Ok(next.run(request).await)
}

