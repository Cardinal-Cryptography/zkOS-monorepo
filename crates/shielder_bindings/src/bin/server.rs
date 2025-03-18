//! This is a simple server that exposes the functions defined in the `shielder_bindings` crate.
//! It uses `axum` to create a REST API that can be called to execute the functions.
//! Functions are exposed through the `EXPORTED_FUNCTIONS` static vector, which is lazily populated
//! with the functions and singletons that are annotated with the `#[jsonize]` or `#[jsonize_singleton]` macro.
use axum::{extract::Json, routing::post, Router};
use serde_json::Value;
use shielder_bindings::EXPORTED_FUNCTIONS;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    let registry = {
        let registry = EXPORTED_FUNCTIONS.lock().unwrap();
        registry.clone()
    };
    for func in registry.iter() {
        println!("Exported function: {}", func.name);
    }

    let mut app = Router::new();
    for func_info in registry.iter() {
        let path = format!("/{}", func_info.name);
        let func_ptr = func_info.func;

        // Each route calls the bridging function
        let route = post(move |Json(payload): Json<Value>| async move {
            let output = (func_ptr)(payload);
            Json(output)
        });
        app = app.route(&path, route);
    }
    app = app.layer(CorsLayer::permissive());
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], 43312));
    println!("Server running on http://{}", addr);

    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}
