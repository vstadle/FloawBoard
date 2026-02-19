use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use argon2::{
    password_hash::{
        rand_core::OsRng,
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString
    },
    Argon2
};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{Utc, Duration};
use crate::models::user::{CreateUser, LoginUser, User, AuthResponse};

// État partagé pour l'application
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub jwt_secret: String,
}

// Structure des claims JWT
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // Subject (user_id)
    pub exp: usize,  // Expiration time
    pub iat: usize,  // Issued at
}

pub async fn register_user(
    State(state): State<AppState>,
    Json(payload): Json<CreateUser>,
) -> impl IntoResponse {
    // 1. Hachage du mot de passe
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = match argon2.hash_password(payload.password.as_bytes(), &salt) {
        Ok(hash) => hash.to_string(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to hash password").into_response(),
    };

    // 2. Insertion en base de données
    let user_id = Uuid::new_v4();
    let result = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, username, email, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, password_hash, created_at, updated_at
        "#
    )
    .bind(user_id)
    .bind(payload.username)
    .bind(payload.email)
    .bind(password_hash)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(user) => (StatusCode::CREATED, Json(user)).into_response(),
        Err(sqlx::Error::Database(db_err)) => {
            if db_err.is_unique_violation() {
                (StatusCode::CONFLICT, "User with this email or username already exists").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response()
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error").into_response(),
    }
}

pub async fn login_user(
    State(state): State<AppState>,
    Json(payload): Json<LoginUser>,
) -> impl IntoResponse {
    // 1. Récupération de l'utilisateur
    let user = match sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(payload.email)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(user)) => user,
        Ok(None) => return (StatusCode::UNAUTHORIZED, "Invalid email or password").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    };

    // 2. Vérification du mot de passe
    let parsed_hash = match PasswordHash::new(&user.password_hash) {
        Ok(hash) => hash,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Invalid password hash").into_response(),
    };

    if Argon2::default().verify_password(payload.password.as_bytes(), &parsed_hash).is_err() {
        return (StatusCode::UNAUTHORIZED, "Invalid email or password").into_response();
    }

    // 3. Génération du JWT
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id.to_string(),
        iat: Utc::now().timestamp() as usize,
        exp: expiration,
    };

    let token = match encode(&Header::default(), &claims, &EncodingKey::from_secret(state.jwt_secret.as_bytes())) {
        Ok(token) => token,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create token").into_response(),
    };

    (StatusCode::OK, Json(AuthResponse { token, user })).into_response()
}
