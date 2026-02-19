use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, FromRow)]
pub struct Board {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    #[sqlx(default)]
    pub members: Vec<String>, // List of usernames
}

#[derive(Debug, Deserialize)]
pub struct CreateBoard {
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBoard {
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct AddMember {
    pub email: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct List {
    pub id: Uuid,
    pub board_id: Uuid,
    pub title: String,
    pub position: i32,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateList {
    pub title: String,
    pub position: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateList {
    pub title: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Card {
    pub id: Uuid,
    pub list_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub position: i32,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCard {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub position: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCard {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub position: Option<i32>,
    pub list_id: Option<Uuid>,
}
