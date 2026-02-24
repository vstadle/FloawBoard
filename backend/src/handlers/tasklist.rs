use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;
use crate::models::tasklist::{List, CreateList, UpdateList};
use crate::handlers::user::AppState;

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
