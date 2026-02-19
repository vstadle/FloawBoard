use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;
use crate::models::board::{Board, CreateBoard, UpdateBoard, List, CreateList, UpdateList, Card, CreateCard, UpdateCard};
use crate::handlers::user::AppState;

// --- BOARDS ---

pub async fn get_boards(
    State(state): State<AppState>,
    // TODO: Extract user_id from JWT middleware
) -> impl IntoResponse {
    // Temporary: Fetch all boards (for testing), later filter by user_id
    let result = sqlx::query_as::<_, Board>("SELECT * FROM boards")
        .fetch_all(&state.db)
        .await;

    match result {
        Ok(boards) => (StatusCode::OK, Json(boards)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn create_board(
    State(state): State<AppState>,
    Json(payload): Json<CreateBoard>,
) -> impl IntoResponse {
    // TODO: Get user_id from JWT
    let user_id_result = sqlx::query_as::<_, (Uuid,)>("SELECT id FROM users LIMIT 1").fetch_one(&state.db).await;
    
    let user_id = match user_id_result {
        Ok(rec) => rec.0,
        Err(_) => return (StatusCode::BAD_REQUEST, "No users found to attach board to").into_response(),
    };

    let board_id = Uuid::new_v4();
    
    let result = sqlx::query_as::<_, Board>(
        r#"
        INSERT INTO boards (id, user_id, title)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, title, created_at, updated_at
        "#
    )
    .bind(board_id)
    .bind(user_id)
    .bind(payload.title)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(board) => (StatusCode::CREATED, Json(board)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn get_board_details(
    State(state): State<AppState>,
    Path(board_id): Path<Uuid>,
) -> impl IntoResponse {
    let board = sqlx::query_as::<_, Board>("SELECT * FROM boards WHERE id = $1")
        .bind(board_id)
        .fetch_optional(&state.db)
        .await;

    match board {
        Ok(Some(board)) => (StatusCode::OK, Json(board)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Board not found").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn update_board(
    State(state): State<AppState>,
    Path(board_id): Path<Uuid>,
    Json(payload): Json<UpdateBoard>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, Board>(
        r#"
        UPDATE boards
        SET title = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, user_id, title, created_at, updated_at
        "#
    )
    .bind(payload.title)
    .bind(board_id)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(board)) => (StatusCode::OK, Json(board)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Board not found").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn delete_board(
    State(state): State<AppState>,
    Path(board_id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM boards WHERE id = $1")
        .bind(board_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(res) => {
            if res.rows_affected() > 0 {
                (StatusCode::NO_CONTENT).into_response()
            } else {
                (StatusCode::NOT_FOUND, "Board not found").into_response()
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

// --- LISTS ---

pub async fn get_lists(
    State(state): State<AppState>,
    Path(board_id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, List>("SELECT * FROM lists WHERE board_id = $1 ORDER BY position ASC")
        .bind(board_id)
        .fetch_all(&state.db)
        .await;

    match result {
        Ok(lists) => (StatusCode::OK, Json(lists)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn create_list(
    State(state): State<AppState>,
    Path(board_id): Path<Uuid>,
    Json(payload): Json<CreateList>,
) -> impl IntoResponse {
    let list_id = Uuid::new_v4();
    
    let result = sqlx::query_as::<_, List>(
        r#"
        INSERT INTO lists (id, board_id, title, position)
        VALUES ($1, $2, $3, $4)
        RETURNING id, board_id, title, position, created_at, updated_at
        "#
    )
    .bind(list_id)
    .bind(board_id)
    .bind(payload.title)
    .bind(payload.position)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(list) => (StatusCode::CREATED, Json(list)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn update_list(
    State(state): State<AppState>,
    Path(list_id): Path<Uuid>,
    Json(payload): Json<UpdateList>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, List>(
        r#"
        UPDATE lists
        SET title = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, board_id, title, position, created_at, updated_at
        "#
    )
    .bind(payload.title)
    .bind(list_id)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(list)) => (StatusCode::OK, Json(list)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "List not found").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn delete_list(
    State(state): State<AppState>,
    Path(list_id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM lists WHERE id = $1")
        .bind(list_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(res) => {
            if res.rows_affected() > 0 {
                (StatusCode::NO_CONTENT).into_response()
            } else {
                (StatusCode::NOT_FOUND, "List not found").into_response()
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

// --- CARDS ---

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
    let existing = sqlx::query_as::<_, Card>("SELECT * FROM cards WHERE id = $1")
        .bind(card_id)
        .fetch_optional(&state.db)
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
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(card) => (StatusCode::OK, Json(card)).into_response(),
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
