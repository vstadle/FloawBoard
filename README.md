# FloawBoard

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
    git clone https://github.com/yourusername/floawboard.git
    cd floawboard
    ```

2.  Start the application:
    ```bash
    docker compose up -d --build
    ```

3.  Access the application:
    -   **Frontend**: http://localhost:3000
    -   **Backend API**: http://localhost:8080

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
