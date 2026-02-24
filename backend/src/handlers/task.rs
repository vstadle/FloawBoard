use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;
use crate::models::task::{Card, CreateCard, UpdateCard};
use crate::handlers::user::AppState;

pub async fn get_cards(
    State(state): State<AppState>,
    Path(list_id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, Card>("SELECT * FROM cards WHERE list_id = $1 ORDER BY position ASC")
        .bind(list_id)
        .fetch_all(&state.db)
        .await;

    match result {
        Ok(cards) => (StatusCode::OK, Json(cards)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn create_card(
    State(state): State<AppState>,
    Path(list_id): Path<Uuid>,
    Json(payload): Json<CreateCard>,
) -> impl IntoResponse {
    let card_id = Uuid::new_v4();
    let priority = payload.priority.unwrap_or_else(|| "low".to_string());
    
    let result = sqlx::query_as::<_, Card>(
        r#"
        INSERT INTO cards (id, list_id, title, description, priority, position)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, list_id, title, description, priority, position, created_at, updated_at
        "#
    )
    .bind(card_id)
    .bind(list_id)
    .bind(payload.title)
    .bind(payload.description)
    .bind(priority)
    .bind(payload.position)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(card) => (StatusCode::CREATED, Json(card)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn update_card(
    State(state): State<AppState>,
    Path(card_id): Path<Uuid>,
    Json(payload): Json<UpdateCard>,
) -> impl IntoResponse {
    // Start transaction to ensure atomicity and prevent collisions
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    };

    let existing = sqlx::query_as::<_, Card>("SELECT * FROM cards WHERE id = $1 FOR UPDATE")
        .bind(card_id)
        .fetch_optional(&mut *tx)
        .await;

    let existing_card = match existing {
        Ok(Some(card)) => card,
        Ok(None) => return (StatusCode::NOT_FOUND, "Card not found").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    };

    let title = payload.title.unwrap_or_else(|| existing_card.title.clone());
    let description = payload.description.or_else(|| existing_card.description.clone());
    let priority = payload.priority.unwrap_or_else(|| existing_card.priority.clone());
    let position = payload.position.unwrap_or(existing_card.position);
    let list_id = payload.list_id.unwrap_or(existing_card.list_id);

    let result = sqlx::query_as::<_, Card>(
        r#"
        UPDATE cards
        SET title = $1, description = $2, priority = $3, position = $4, list_id = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING id, list_id, title, description, priority, position, created_at, updated_at
        "#
    )
    .bind(title)
    .bind(description)
    .bind(priority)
    .bind(position)
    .bind(list_id)
    .bind(card_id)
    .fetch_one(&mut *tx)
    .await;

    match result {
        Ok(card) => {
            if tx.commit().await.is_err() {
                return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to commit transaction").into_response();
            }
            (StatusCode::OK, Json(card)).into_response()
        },
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn delete_card(
    State(state): State<AppState>,
    Path(card_id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM cards WHERE id = $1")
        .bind(card_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(res) => {
            if res.rows_affected() > 0 {
                (StatusCode::NO_CONTENT).into_response()
            } else {
                (StatusCode::NOT_FOUND, "Card not found").into_response()
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}
