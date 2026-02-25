# Project Context: FloawBoard

## 1. Project Overview
**Name:** FloawBoard
**Description:** A self-hostable, Trello-like Kanban project management application.
**Type:** Full-stack Web Application (Monorepo).
**Current State:** Fully functional prototype with auth, CRUD, drag-and-drop, and sharing. Supports distributed deployment via `.env` configuration.

## 2. Technology Stack

### Frontend (`/frontend`)
-   **Framework:** Next.js 15 (App Router)
-   **Library:** React 19
-   **Language:** TypeScript
-   **Styling:** Tailwind CSS v4
-   **State Management:** React Hooks (`useState`, `useEffect`, `useRef`)
-   **HTTP Client:** Native `fetch` wrapper (`lib/api.ts`)
-   **Configuration:** Runtime environment variables via `NEXT_PUBLIC_API_URL` (injected at build time or runtime depending on deployment).

### Backend (`/backend`)
-   **Language:** Rust
-   **Web Framework:** Axum
-   **Runtime:** Tokio
-   **Database Interface:** SQLx
-   **Serialization:** Serde / Serde JSON
-   **Authentication:** Argon2 (hashing) & `jsonwebtoken` (JWT)
-   **Security:** `tower-governor` (Rate Limiting), `tower` (Middleware)
-   **Container Optimization:** Cargo Chef
-   **Configuration:** `APP_PORT` env var for internal listening port.

### Database
-   **System:** PostgreSQL 16 (Alpine)
-   **Initialization:** `init.sql` script mounted in Docker.
-   **Connection:** Configurable via `DATABASE_URL` constructed from host/port env vars.

### Infrastructure
-   **Orchestration:** Docker Compose
-   **Network:** Internal bridge network `kanban-network`.
-   **Configuration:** Centralized `.env` file for managing IP addresses, ports (internal/external), and service locations (distributed hosting support).

## 3. Directory Structure
```text
/
├── backend/
│   ├── init.db/            # SQL Schema (init.sql)
│   ├── src/
│   │   ├── handlers/       # board.rs, user.rs, mod.rs
│   │   ├── models/         # board.rs, user.rs, mod.rs
│   │   └── main.rs         # Entry point, Router, CORS, DB Pool
│   ├── Cargo.toml
│   └── Dockerfile
├── frontend/
│   ├── app/                # Next.js Pages
│   │   ├── board/[id]/     # Board View (Drag & Drop, Lists, Cards)
│   │   ├── dashboard/      # Dashboard (List Boards, Create, Edit, Delete)
│   │   ├── login/          # Login Form
│   │   ├── profile/        # User Profile View
│   │   ├── register/       # Registration Form (w/ password confirm)
│   │   └── page.tsx        # Root redirect to /login
│   ├── lib/                # api.ts (Fetch wrapper)
│   └── Dockerfile
├── .env                    # Active configuration (Git-ignored)
├── .env.example            # Configuration template
├── docker-compose.yml
└── README.md
```

## 4. Database Schema (`init.sql`)

### Tables
1.  **`users`**
    *   `id` (UUID, PK)
    *   `username` (Text, Unique)
    *   `email` (Text, Unique)
    *   `password_hash` (Text)
    *   `created_at`, `updated_at`

2.  **`boards`**
    *   `id` (UUID, PK)
    *   `user_id` (UUID, FK -> users.id) [The Creator/Owner]
    *   `title` (Text)
    *   `created_at`, `updated_at`

3.  **`board_members`**
    *   `board_id` (UUID, FK -> boards.id)
    *   `user_id` (UUID, FK -> users.id)
    *   `role` (Text, default 'editor')
    *   `PK`: (board_id, user_id)

4.  **`lists`**
    *   `id` (UUID, PK)
    *   `board_id` (UUID, FK -> boards.id)
    *   `title` (Text)
    *   `position` (Int)
    *   `created_at`, `updated_at`

5.  **`cards`**
    *   `id` (UUID, PK)
    *   `list_id` (UUID, FK -> lists.id)
    *   `title` (Text)
    *   `description` (Text, Nullable)
    *   `priority` (Text, default 'low') [Values: 'low', 'medium', 'high']
    *   `position` (Int)
    *   `created_at`, `updated_at`

## 5. API Endpoints

### Auth (`handlers/user.rs`)
-   `POST /register`: Create user (args: username, email, password).
-   `POST /login`: Authenticate (args: email, password) -> Returns JWT.
-   `GET /me`: Get current user info (requires Bearer token).

### Boards (`handlers/board.rs`)
-   `GET /boards`: List boards user owns OR is a member of (includes member avatars & owner email).
-   `POST /boards`: Create board. **Note:** Manually adds creator to `board_members` as 'owner'.
-   `GET /boards/:id`: Get board details.
-   `PUT /boards/:id`: Rename board.
-   `DELETE /boards/:id`: Delete board.
-   `POST /boards/:id/members`: Invite user by email.

### Lists (`handlers/board.rs`)
-   `GET /boards/:id/lists`: Get lists for a board (ordered by position).
-   `POST /boards/:id/lists`: Create list.
-   `PUT /lists/:id`: Rename list.
-   `DELETE /lists/:id`: Delete list.

### Cards (`handlers/board.rs`)
-   `GET /lists/:id/cards`: Get cards for a list.
-   `POST /lists/:id/cards`: Create card.
-   `PUT /cards/:id`: Update card (Title, Description, Priority, Position, List ID).
-   `DELETE /cards/:id`: Delete card.

## 6. Key Implementation Details

### Backend
-   **Manual Mapping in `create_board`**: Due to a tuple type inference issue with `sqlx::query_as` combined with the struct having fields not present in the INSERT RETURNING clause, `create_board` uses `sqlx::query(...).map(...)` to manually construct the object.
-   **Aggregations**: `get_boards` uses `array_agg` and `LEFT JOIN` to fetch member usernames and the owner's email in a single query.
-   **Security**: 
    -   Routes (except auth) expect an `Authorization: Bearer <token>` header.
    -   **Rate Limiting:** Implemented via `tower-governor` (5 requests/second per IP, burst 10).
    -   **Authorization:** Strict ownership and membership checks enforced at the database level (SQL `EXISTS` and `JOIN`s) for all Board, List, and Card operations.
-   **Configuration**: Uses `APP_PORT` from environment (default 8080).

### Frontend
-   **Dynamic API URL**: `lib/api.ts` requires `NEXT_PUBLIC_API_URL` to be set. It throws an error if missing, preventing silent connection failures.
-   **Drag & Drop**: Implemented using the native HTML5 Drag and Drop API. Logic handles optimistic UI updates followed by an API call to persist the new `list_id` and `position`.
-   **Menus**: Dropdown menus (for Lists and Cards) use **Fixed Positioning** calculated via JS (`getBoundingClientRect`) to avoid being clipped by `overflow: hidden` or scrollbars on parent list containers.
-   **Styling**:
    -   Priority Colors: Green (Low), Yellow (Medium), Red (High).
    -   Member Avatars: Displayed on Dashboard cards (first 3 + count).
    -   Owner Email: Displayed on Dashboard cards.
-   **Redirect**: The root path `/` redirects immediately to `/login`.

## 7. Running the Project

### Configuration (`.env`)
The project uses a `.env` file for all configuration.
1.  Copy the example: `cp .env.example .env`
2.  Edit `.env` to set your Server IP (`WEB_HOST`, `API_HOST`) and Ports.
    -   **Distributed Hosting:** You can specify different IPs for `DB_HOST`, `API_HOST`, and `WEB_HOST` to run components on separate servers.

### Deployment
```bash
docker compose up -d --build
```
-   **Frontend:** Access via `http://${WEB_HOST}:${WEB_PORT}` (e.g., `http://192.168.1.50:50001`)
-   **Backend:** Access via `http://${API_HOST}:${API_PORT}` (e.g., `http://192.168.1.50:50002`)
-   **Database:** Exposed on `http://${DB_HOST}:${DB_PORT}` (e.g., `192.168.1.50:50003`)
