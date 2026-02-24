use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use uuid::Uuid;
use crate::models::tasklist::{List, CreateList, UpdateList};
use crate::handlers::user::{AppState, get_user_id_from_header};

pub async fn get_lists(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(board_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match get_user_id_from_header(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, "Invalid token").into_response(),
    };

    let result = sqlx::query_as::<_, List>(
        r#"
        SELECT l.* FROM lists l
        JOIN boards b ON l.board_id = b.id
        LEFT JOIN board_members bm ON b.id = bm.board_id
        WHERE l.board_id = $1 AND (b.user_id = $2 OR bm.user_id = $2)
        ORDER BY l.position ASC
        "#
    )
        .bind(board_id)
        .bind(user_id)
        .fetch_all(&state.db)
        .await;

    match result {
        Ok(lists) => (StatusCode::OK, Json(lists)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn create_list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(board_id): Path<Uuid>,
    Json(payload): Json<CreateList>,
) -> impl IntoResponse {
    let user_id = match get_user_id_from_header(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, "Invalid token").into_response(),
    };

    // Check access first
    let has_access = sqlx::query(
        "SELECT 1 FROM boards b LEFT JOIN board_members bm ON b.id = bm.board_id WHERE b.id = $1 AND (b.user_id = $2 OR bm.user_id = $2)"
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    match has_access {
        Ok(Some(_)) => {},
        Ok(None) => return (StatusCode::FORBIDDEN, "Access denied").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }

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
    headers: HeaderMap,
    Path(list_id): Path<Uuid>,
    Json(payload): Json<UpdateList>,
) -> impl IntoResponse {
    let user_id = match get_user_id_from_header(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, "Invalid token").into_response(),
    };

    let result = sqlx::query_as::<_, List>(
        r#"
        WITH access_check AS (
            SELECT 1 FROM lists l
            JOIN boards b ON l.board_id = b.id
            LEFT JOIN board_members bm ON b.id = bm.board_id
            WHERE l.id = $2 AND (b.user_id = $3 OR bm.user_id = $3)
            LIMIT 1
        ),
        updated AS (
            UPDATE lists
            SET title = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND EXISTS (SELECT 1 FROM access_check)
            RETURNING id, board_id, title, position, created_at, updated_at
        )
        SELECT * FROM updated
        "#
    )
    .bind(payload.title)
    .bind(list_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(list)) => (StatusCode::OK, Json(list)).into_response(),
        Ok(None) => (StatusCode::FORBIDDEN, "Access denied or List not found").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn delete_list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(list_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match get_user_id_from_header(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, "Invalid token").into_response(),
    };

    let result = sqlx::query(
        r#"
        DELETE FROM lists 
        WHERE id = $1 AND EXISTS (
            SELECT 1 FROM lists l
            JOIN boards b ON l.board_id = b.id
            LEFT JOIN board_members bm ON b.id = bm.board_id
            WHERE l.id = $1 AND (b.user_id = $2 OR bm.user_id = $2)
        )
        "#
    )
        .bind(list_id)
        .bind(user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(res) => {
            if res.rows_affected() > 0 {
                (StatusCode::NO_CONTENT).into_response()
            } else {
                (StatusCode::FORBIDDEN, "Access denied or List not found").into_response()
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}
