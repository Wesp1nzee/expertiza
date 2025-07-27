use axum::{
    http::{StatusCode, HeaderMap, Method, Uri},
    response::Html
};
use tracing::{info, warn, error, instrument};
use std::fmt;

#[derive(Debug)]
struct RequestInfo {
    method: Option<String>,
    path: Option<String>,
    user_agent: Option<String>,
    client_ip: Option<String>,
}

impl fmt::Display for RequestInfo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Method: {:?}, Path: {:?}, User-Agent: {:?}, IP: {:?}",
            self.method, self.path, self.user_agent, self.client_ip
        )
    }
}

fn extract_request_info(headers: &HeaderMap, method: &Method, uri: &Uri) -> RequestInfo {
    RequestInfo {
        method: Some(method.to_string()),
        path: Some(uri.path().to_string()),
        user_agent: headers.get("User-Agent")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string()),
        client_ip: headers.get("X-Forwarded-For")
            .or_else(|| headers.get("X-Real-IP"))
            .or_else(|| headers.get("Forwarded"))
            .and_then(|v| v.to_str().ok())
            .map(|s| s.split(',').next().unwrap_or(s).trim().to_string()),
    }
}

#[instrument]
pub async fn handle_404(method: Method, uri: Uri, headers: HeaderMap) -> (StatusCode, Html<&'static str>) {
    let request_info = extract_request_info(&headers, &method, &uri);
    
    if let Some(path) = &request_info.path {
        if path.starts_with("/api/") {
            warn!("API endpoint not found: {}", request_info);
        } else {
            info!("Page not found: {}", request_info);
        }
    } else {
        error!("404 with missing path information: {}", request_info);
    }

    (
        StatusCode::NOT_FOUND,
        Html(r#"
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>404 - Not Found</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        line-height: 1.6; 
                        margin: 0; 
                        padding: 20px; 
                        color: #333;
                    }
                    .container { 
                        max-width: 800px; 
                        margin: 0 auto; 
                        text-align: center;
                    }
                    h1 { color: #d32f2f; }
                    a { color: #1a73e8; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>404 - Page Not Found</h1>
                    <p>The requested resource was not found on this server.</p>
                    <p><a href="/">Return to home page</a></p>
                </div>
            </body>
            </html>
        "#),
    )
}