# FloawBoard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

FloawBoard is a modern, self-hostable Kanban project management tool designed for high-performance teams. It provides a clean, intuitive interface for managing tasks, lists, and boards, featuring drag-and-drop functionality and real-time updates.

## Features

-   **User Authentication**: Secure registration (with password confirmation) and login system using Argon2 hashing and JWT (JSON Web Tokens).
-   **User Profiles**: Dedicated profile page to view account details (username, email, join date).
-   **Dashboard**: Centralized view to manage multiple project boards, displaying owner email and member avatars.
-   **Board Management**: Create, rename, and delete boards.
-   **Board Sharing**: Invite other registered users to your boards via email.
-   **List Management**: Create, rename, delete, and reorder lists within a board.
-   **Task Management**: Create, edit, delete, and prioritize tasks (Low, Medium, High) with color-coded indicators.
-   **Drag & Drop**: Native HTML5 drag-and-drop interface for moving tasks between lists.
-   **Responsive Design**: Modern UI built with Tailwind CSS, fully responsive for various screen sizes.
-   **Robust Security**: Built-in protection against SQL Injection, strict resource authorization (ownership/membership checks), and API rate limiting (Anti-Spam).

## Technology Stack

### Frontend
-   **Framework**: Next.js 15 (React 19)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS v4
-   **State Management**: React Hooks

### Backend
-   **Language**: Rust
-   **Framework**: Axum
-   **Database Driver**: SQLx (PostgreSQL)
-   **Serialization**: Serde
-   **Authentication**: Argon2 & JWT
-   **Security**: `tower-governor` (Rate Limiting)

### Database
-   **System**: PostgreSQL 16

### DevOps
-   **Containerization**: Docker & Docker Compose
-   **Build Tool**: Cargo Chef (for optimized Rust builds)

## Prerequisites

-   Docker Engine
-   Docker Compose

## Installation & Setup

The entire application is containerized and managed via Docker Compose for easy deployment.

1.  Clone the repository:
    ```bash
    git clone https://github.com/valentin/floawboard.git
    cd floawboard
    ```

2.  Configure environment variables:
    ```bash
    cp .env.example .env
    ```
    Open the `.env` file and review/modify the variables for your setup:
    
    *   **`WEB_HOST` / `WEB_PORT`**: Where your frontend handles public requests (default: `localhost:50001`).
    *   **`WEB_INTERNAL_PORT`**: The Next.js container's internal listening port (default: `3000`).
    *   **`API_HOST` / `API_PORT`**: Where your backend handles public requests (default: `localhost:50002`).
    *   **`API_INTERNAL_PORT`**: The Rust container's internal listening port (default: `50002`).
    *   **`DB_HOST` / `DB_PORT`**: Location of your database. Keep as `db` if running entirely inside Docker Compose, otherwise use an external IP.
    *   **`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`**: Default database credentials.
    *   **`JWT_SECRET`**: Secure string for signing authentication tokens. **Must be changed for production!**

3.  Start the application:
    ```bash
    docker compose up -d --build
    ```

4.  Access the application:
    -   **Frontend**: http://localhost:50001  (or the custom WEB_PORT you defined)
    -   **Backend API**: http://localhost:50002 (or the custom API_PORT you defined)

## Development

### Directory Structure

```
floawboard/
├── backend/                # Rust API source code
│   ├── src/
│   │   ├── handlers/       # API route handlers
│   │   ├── models/         # Database models and structs
│   │   └── main.rs         # Application entry point
│   ├── init.db/            # Database initialization scripts
│   ├── Cargo.toml          # Rust dependencies
│   └── Dockerfile          # Backend container configuration
├── frontend/               # Next.js frontend source code
│   ├── app/                # App router pages and layouts
│   ├── lib/                # Utility functions (API client)
│   ├── public/             # Static assets
│   └── Dockerfile          # Frontend container configuration
├── docker-compose.yml      # Service orchestration
└── README.md               # Project documentation
```

### Running Locally (Without Docker)

If you prefer to run services individually for development:

**Backend:**
1.  Ensure PostgreSQL is running.
2.  Set environment variables (`DATABASE_URL`, `JWT_SECRET`).
3.  Run the server:
    ```bash
    cd backend
    cargo run
    ```

**Frontend:**
1.  Install dependencies:
    ```bash
    cd frontend
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```

## API Documentation

**Note:** All API endpoints are rate-limited to 5 requests per second (burst 10) per IP address to prevent abuse.

### Authentication
-   `POST /register`: Register a new user.
    -   Body: `{ "username": "...", "email": "...", "password": "..." }`
-   `POST /login`: Authenticate user and receive JWT.
    -   Body: `{ "email": "...", "password": "..." }`
-   `GET /me`: Get current user profile.

### Boards
-   `GET /boards`: List all boards (owned or shared).
-   `POST /boards`: Create a new board.
-   `GET /boards/:id`: Get board details.
-   `PUT /boards/:id`: Update board details.
-   `DELETE /boards/:id`: Delete a board.
-   `POST /boards/:id/members`: Invite a user to the board.
    -   Body: `{ "email": "..." }`

### Lists
-   `GET /boards/:board_id/lists`: Get all lists for a board.
-   `POST /boards/:board_id/lists`: Create a new list.
-   `PUT /lists/:id`: Rename a list.
-   `DELETE /lists/:id`: Delete a list.

### Cards (Tasks)
-   `GET /lists/:list_id/cards`: Get all cards in a list.
-   `POST /lists/:list_id/cards`: Create a new card.
-   `PUT /cards/:id`: Update a card (title, description, priority, position, list_id).
-   `DELETE /cards/:id`: Delete a card.

## License

This project is licensed under the MIT License.

## Copyright

Copyright (c) 2026 vstadle
