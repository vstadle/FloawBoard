use axum::{
    routing::{get, post, put, delete},
    Router,
};
use std::net::SocketAddr;
use sqlx::postgres::PgPoolOptions;
use dotenvy::dotenv;
use std::env;
use tower_http::cors::{CorsLayer, Any};
use crate::handlers::user::{register_user, login_user, get_me, AppState};
use crate::handlers::board::{
    get_boards, create_board, get_board_details, update_board, delete_board, add_member,
    get_lists, create_list, update_list, delete_list,
    get_cards, create_card, update_card, delete_card
};

mod models;
mod handlers;

#[tokio::main]
async fn main() {
    // Charger les variables d'environnement
    dotenv().ok();
    
    // Initialiser le logger
    tracing_subscriber::fmt::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());

    // Créer le pool de connexion à la base de données
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to create pool");

    let state = AppState {
        db: pool,
        jwt_secret,
    };

    // Configurer le routeur avec les routes et l'état
    let app = Router::new()
        .route("/", get(|| async { "API Kanban en Rust : Opérationnelle 🦀" }))
        // Auth Routes
        .route("/register", post(register_user))
        .route("/login", post(login_user))
        .route("/me", get(get_me))
        // Board Routes
        .route("/boards", get(get_boards).post(create_board))
        .route("/boards/:board_id", get(get_board_details).put(update_board).delete(delete_board))
        // Board Members
        .route("/boards/:board_id/members", post(add_member))
        // List Routes
        .route("/boards/:board_id/lists", get(get_lists).post(create_list))
        .route("/lists/:list_id", put(update_list).delete(delete_list))
        // Card Routes
        .route("/lists/:list_id/cards", get(get_cards).post(create_card))
        .route("/cards/:card_id", put(update_card).delete(delete_card))
        .layer(CorsLayer::new().allow_origin(Any).allow_headers(Any).allow_methods(Any))
        .with_state(state);

    // Lancer le serveur sur le port 8080
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    println!("Lancement du serveur sur {}", addr);
    
    axum::serve(tokio::net::TcpListener::bind(&addr).await.unwrap(), app)
        .await
        .unwrap();
}
