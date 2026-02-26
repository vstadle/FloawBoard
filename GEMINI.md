# FloawBoard - Agent Context

This file provides foundational context, architectural guidelines, and technical constraints for AI agents working on the FloawBoard project. It should be treated as the ultimate source of truth for understanding how to interact with this codebase.

## 1. Project Overview
FloawBoard is a self-hostable, full-stack Kanban project management application (similar to Trello), featuring authentication, CRUD operations, drag-and-drop mechanics, and board sharing.

## 2. Repository Architecture (Monorepo)
The project is split into two main directories, orchestrated together using Docker Compose.

*   **/frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4.
*   **/backend**: Rust, Axum, Tokio, SQLx, Argon2 + JWT.
*   **/backend/init.db/init.sql**: The central database schema and initialization script for PostgreSQL.

## 3. Technology Stack & Key Conventions

### Frontend Conventions
*   **Data Fetching**: Do not install external fetching libraries (like Axios or React Query) unless explicitly requested. Use the existing native `fetch` wrapper located at `frontend/lib/api.ts`.
*   **Environment**: The app relies on the `NEXT_PUBLIC_API_URL` environment variable. The `api.ts` file throws errors if this is missing.
*   **UI/UX Mechanics**: 
    *   Drag-and-Drop uses the **native HTML5 Drag and Drop API** (not a 3rd party library like dnd-kit or react-beautiful-dnd).
    *   Dropdown menus (for lists and cards) use calculated fixed positioning (`getBoundingClientRect`) to avoid clipping from `overflow: hidden` parent containers.
*   **Routing**: The root page (`/`) redirects immediately to `/login`.

### Backend Conventions (Rust / Axum)
*   **Database Interface (SQLx)**: 
    *   *Gotcha / Workaround*: Be aware of a tuple type inference issue with `sqlx::query_as` combined with structs having fields not present in the `INSERT RETURNING` clause. Follow the pattern in `create_board` (in `handlers/board.rs`), which uses `sqlx::query(...).map(...)` to manually construct the object.
*   **Security & Auth**:
    *   Authentication is JWT-based. Routes (except `/register` and `/login`) expect an `Authorization: Bearer <token>` header.
    *   **Critical**: Authorization (checking if a user owns a board or is a member) MUST be enforced strictly at the database level using SQL `EXISTS` and `JOIN`s for all Board, List, and Card operations.
*   **Rate Limiting**: Uses `tower-governor` (5 req/sec, burst 10) to protect endpoints.

### Infrastructure & Deployment
*   **Orchestration**: Managed exclusively via Docker Compose (`docker-compose.yml`).
*   **Configuration**: All configuration (ports, host IPs, database URL) is driven by a centralized `.env` file (copied from `.env.example`). The setup is designed to support distributed hosting (separate IPs for DB, API, and WEB).

## 4. Developer Workflow

*   **Running the Stack**: `docker compose up -d --build`
*   **Validating Changes**:
    *   *Backend*: Always ensure the code compiles (`cargo check`) and follows formatting (`cargo fmt`) before considering a task complete.
    *   *Frontend*: Ensure Next.js builds successfully and there are no TypeScript or ESLint errors.
*   **Database Modifications**: If modifying the database, you must update the `init.sql` script AND the corresponding Rust models (`models/`) and SQLx queries in the handlers (`handlers/`).
*   **Dependencies**: Verify established library usage (e.g., checking `Cargo.toml` or `package.json`) before adding new dependencies to the project. Maintain the minimal, native-first approach already established.