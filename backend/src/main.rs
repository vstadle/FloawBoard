use axum::{
    routing::{get, post, put, delete},
    Router,
};
use std::net::SocketAddr;
use sqlx::postgres::PgPoolOptions;
use dotenvy::dotenv;
use std::env;
use std::sync::Arc;
use tower_http::cors::{CorsLayer, Any};
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tower::ServiceBuilder;
use crate::handlers::user::{register_user, login_user, get_me, change_password, AppState};
use crate::handlers::board::{
    get_boards, create_board, get_board_details, update_board, delete_board, add_member, remove_member,
};
use crate::handlers::tasklist::{get_lists, create_list, update_list, delete_list};
use crate::handlers::task::{get_cards, create_card, update_card, delete_card};

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
        .max_connections(20) // Augmenté pour gérer plus de requêtes en parallèle
        .connect(&database_url)
        .await
        .expect("Failed to create pool");

    let state = AppState {
        db: pool,
        jwt_secret,
    };

    // Configuration du Rate Limiter (Anti-Spam)
    // Autorise 5 requêtes par seconde avec un burst de 10 par IP
    let governor_conf = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(5)
            .burst_size(10)
            .finish()
            .unwrap(),
    );

    // Configurer le routeur avec les routes et l'état
    let app = Router::new()
        .route("/", get(|| async { "API Kanban en Rust : Opérationnelle 🦀" }))
        // Auth Routes
        .route("/register", post(register_user))
        .route("/login", post(login_user))
        .route("/me", get(get_me))
        .route("/me/password", put(change_password))
        // Board Routes
        .route("/boards", get(get_boards).post(create_board))
        .route("/boards/:board_id", get(get_board_details).put(update_board).delete(delete_board))
        // Board Members
        .route("/boards/:board_id/members", post(add_member))
        .route("/boards/:board_id/members/:username", delete(remove_member))
        // List Routes
        .route("/boards/:board_id/lists", get(get_lists).post(create_list))
        .route("/lists/:list_id", put(update_list).delete(delete_list))
        // Card Routes
        .route("/lists/:list_id/cards", get(get_cards).post(create_card))
        .route("/cards/:card_id", put(update_card).delete(delete_card))
        .layer(
            ServiceBuilder::new()
                .layer(CorsLayer::new().allow_origin(Any).allow_headers(Any).allow_methods(Any))
                .layer(GovernorLayer {
                    config: governor_conf,
                })
        )
        .with_state(state);

    // Lancer le serveur sur le port défini par APP_PORT ou 8080 par défaut
    let port = env::var("APP_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .expect("APP_PORT must be a valid number");
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Lancement du serveur sur {}", addr);
    
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}
