use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use uuid::Uuid;
use jsonwebtoken::{decode, DecodingKey, Validation};
use crate::models::board::{Board, CreateBoard, UpdateBoard, List, CreateList, UpdateList, Card, CreateCard, UpdateCard, AddMember};
use crate::handlers::user::{AppState, Claims};
use crate::models::user::User;
use chrono::{DateTime, Utc};

// Helper to extract user_id from Authorization header
fn get_user_id_from_header(headers: &HeaderMap, secret: &str) -> Option<Uuid> {
    let auth_header = headers.get("Authorization")?.to_str().ok()?;
    if !auth_header.starts_with("Bearer ") {
        return None;
    }
    let token = &auth_header[7..];
    
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    ).ok()?;

    Uuid::parse_str(&token_data.claims.sub).ok()
}

// --- BOARDS ---

pub async fn get_boards(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match get_user_id_from_header(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, "Invalid token").into_response(),
    };

    // Fetch boards where user is owner OR a member, including aggregated members
    let result = sqlx::query_as::<_, Board>(
        r#"
        SELECT 
            b.id, b.user_id, b.title, b.created_at, b.updated_at,
            owner.email as owner_email,
            owner.username as owner_username,
            COALESCE(array_agg(u.username) FILTER (WHERE u.username IS NOT NULL AND u.id != b.user_id), '{}')::text[] as members
        FROM boards b
        JOIN users owner ON b.user_id = owner.id
        LEFT JOIN board_members bm ON b.id = bm.board_id
        LEFT JOIN users u ON bm.user_id = u.id
        WHERE b.id IN (
            SELECT b2.id FROM boards b2
            LEFT JOIN board_members bm2 ON b2.id = bm2.board_id
            WHERE b2.user_id = $1 OR bm2.user_id = $1
        )
        GROUP BY b.id, owner.email, owner.username
        "#
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await;

    match result {
        Ok(boards) => (StatusCode::OK, Json(boards)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn create_board(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateBoard>,
) -> impl IntoResponse {
    let user_id = match get_user_id_from_header(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, "Invalid token").into_response(),
    };

    let board_id = Uuid::new_v4();
    
    // Start transaction
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    };

    // Create Board using sqlx::query and manual mapping
    let board_row = sqlx::query(
        r#"
        INSERT INTO boards (id, user_id, title)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, title, created_at, updated_at
        "#
    )
    .bind(board_id)
    .bind(user_id)
    .bind(payload.title)
    .map(|row: sqlx::postgres::PgRow| {
        use sqlx::Row;
        (
            row.get::<Uuid, _>("id"),
            row.get::<Uuid, _>("user_id"),
            row.get::<String, _>("title"),
            row.get::<Option<DateTime<Utc>>, _>("created_at"),
            row.get::<Option<DateTime<Utc>>, _>("updated_at"),
        )
    })
    .fetch_one(&mut *tx)
    .await;

    let (id, uid, title, created_at, updated_at) = match board_row {
        Ok(res) => res,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create board").into_response(),
    };

    // Add Creator as Owner in board_members
    let member_result = sqlx::query(
        r#"
        INSERT INTO board_members (board_id, user_id, role)
        VALUES ($1, $2, 'owner')
        "#
    )
    .bind(board_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await;

    if member_result.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to add member").into_response();
    }

    if tx.commit().await.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to commit transaction").into_response();
    }

    // Get the creator's username and email
    let user_result = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.db)
        .await;
        
    let (username, email) = match user_result {
        Ok(u) => (u.username, u.email),
        Err(_) => ("Owner".to_string(), "owner@example.com".to_string()),
    };

    let board = Board {
        id,
        user_id: uid,
        title,
        created_at,
        updated_at,
        members: vec![], // No other members yet
        owner_email: email,
        owner_username: username,
    };

    (StatusCode::CREATED, Json(board)).into_response()
}

pub async fn get_board_details(
    State(state): State<AppState>,
    Path(board_id): Path<Uuid>,
) -> impl IntoResponse {
    // Also fetch members for details view
    let board = sqlx::query_as::<_, Board>(
        r#"
        SELECT 
            b.id, b.user_id, b.title, b.created_at, b.updated_at,
            owner.email as owner_email,
            owner.username as owner_username,
            COALESCE(array_agg(u.username) FILTER (WHERE u.username IS NOT NULL AND u.id != b.user_id), '{}')::text[] as members
        FROM boards b
        JOIN users owner ON b.user_id = owner.id
        LEFT JOIN board_members bm ON b.id = bm.board_id
        LEFT JOIN users u ON bm.user_id = u.id
        WHERE b.id = $1
        GROUP BY b.id, owner.email, owner.username
        "#
    )
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
        WITH updated AS (
            UPDATE boards
            SET title = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, user_id, title, created_at, updated_at
        )
        SELECT 
            u.id, u.user_id, u.title, u.created_at, u.updated_at,
            owner.email as owner_email,
            owner.username as owner_username,
            COALESCE(array_agg(usr.username) FILTER (WHERE usr.username IS NOT NULL AND usr.id != u.user_id), '{}')::text[] as members
        FROM updated u
        JOIN users owner ON u.user_id = owner.id
        LEFT JOIN board_members bm ON u.id = bm.board_id
        LEFT JOIN users usr ON bm.user_id = usr.id
        GROUP BY u.id, u.user_id, u.title, u.created_at, u.updated_at, owner.email, owner.username
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

pub async fn add_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(board_id): Path<Uuid>,
    Json(payload): Json<AddMember>,
) -> impl IntoResponse {
    let user_id = match get_user_id_from_header(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, "Invalid token").into_response(),
    };

    // Check if the requester is the owner of the board
    let board_opt = sqlx::query("SELECT user_id FROM boards WHERE id = $1")
        .bind(board_id)
        .map(|row: sqlx::postgres::PgRow| {
            use sqlx::Row;
            row.get::<Uuid, _>("user_id")
        })
        .fetch_optional(&state.db)
        .await;

    match board_opt {
        Ok(Some(owner_id)) => {
            if owner_id != user_id {
                return (StatusCode::FORBIDDEN, "Only the owner can invite members").into_response();
            }
        }
        Ok(None) => return (StatusCode::NOT_FOUND, "Board not found").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }

    // 1. Find user by email
    let user_opt = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await;

    let user = match user_opt {
        Ok(Some(u)) => u,
        Ok(None) => return (StatusCode::NOT_FOUND, "User not found").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    };

    // 2. Add to board_members
    let result = sqlx::query(
        r#"
        INSERT INTO board_members (board_id, user_id, role)
        VALUES ($1, $2, 'editor')
        ON CONFLICT (board_id, user_id) DO NOTHING
        "#
    )
    .bind(board_id)
    .bind(user.id)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({ "message": "Member added" }))).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn remove_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((board_id, username)): Path<(Uuid, String)>,
) -> impl IntoResponse {
    let user_id = match get_user_id_from_header(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, "Invalid token").into_response(),
    };

    // 1. Check if the requester is the owner of the board
    let board_opt = sqlx::query("SELECT user_id FROM boards WHERE id = $1")
        .bind(board_id)
        .map(|row: sqlx::postgres::PgRow| {
            use sqlx::Row;
            row.get::<Uuid, _>("user_id")
        })
        .fetch_optional(&state.db)
        .await;

    match board_opt {
        Ok(Some(owner_id)) => {
            if owner_id != user_id {
                return (StatusCode::FORBIDDEN, "Only the owner can remove members").into_response();
            }
        }
        Ok(None) => return (StatusCode::NOT_FOUND, "Board not found").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }

    // 2. Find user by username
    let user_opt = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
        .bind(&username)
        .fetch_optional(&state.db)
        .await;

    let user = match user_opt {
        Ok(Some(u)) => u,
        Ok(None) => return (StatusCode::NOT_FOUND, "User not found").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    };

    // 2. Remove from board_members
    let result = sqlx::query(
        "DELETE FROM board_members WHERE board_id = $1 AND user_id = $2"
    )
    .bind(board_id)
    .bind(user.id)
    .execute(&state.db)
    .await;

    match result {
        Ok(res) => {
            if res.rows_affected() > 0 {
                (StatusCode::OK, Json(serde_json::json!({ "message": "Member removed" }))).into_response()
            } else {
                (StatusCode::NOT_FOUND, "Member not found").into_response()
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
