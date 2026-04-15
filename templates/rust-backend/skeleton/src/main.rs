use axum::{
    routing::get,
    Router,
};

#[tokio::main]
async fn main() {
    let app = create_app();

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .expect("Failed to bind to port 8080");
    println!("Server running on port 8080");
    axum::serve(listener, app)
        .await
        .expect("Server failed to start");
}

fn create_app() -> Router {
    Router::new().route("/", get(|| async { "Hello, World!" }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt; // for `oneshot` and `ready`

    #[tokio::test]
    async fn test_hello_world() {
        let app = create_app();

        // `oneshot` creates a child service and runs it until completion
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
        assert_eq!(&body[..], b"Hello, World!");
    }
}
