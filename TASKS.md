# Project Tasks: Trello Clone

## 1. Database & User Management (Backend)
- [x] **Setup Database Schema for Users**
    - [x] Design `users` table (id, username, email, password_hash, timestamps)
    - [x] Create SQL migration/init script
- [x] **Backend Setup**
    - [x] Configure SQLx database connection in `main.rs`
    - [x] Add password hashing dependency (argon2)
- [x] **User Domain Logic**
    - [x] Create `User` struct
    - [x] Implement User Repository (Create, Find by Email, etc.)

## 2. API Implementation (Backend)
- [x] **Authentication**
    - [x] Login endpoint (JWT generation)
    - [x] Registration endpoint
    - [x] Auth middleware (Manually handled in handlers via helper, plus Rate Limiting middleware)
- [x] **Board Management**
    - [x] Database schema for Boards, Lists, Cards
    - [x] CRUD Endpoints for Boards
    - [x] CRUD Endpoints for Lists
    - [x] CRUD Endpoints for Cards

## 3. Security & Optimization
- [x] **Security Audits**
    - [x] SQL Injection Verification (Safe via sqlx)
    - [x] API Authorization (Strict ownership/membership checks)
    - [x] Rate Limiting (Anti-Spam via tower-governor)

## 4. Frontend Implementation
- [ ] **Setup API client / Fetchers**
    - [x] Create `api.ts` helper
- [ ] **Authentication Pages**
    - [ ] Login Page
    - [ ] Register Page
- [ ] **Dashboard**
    - [ ] List Boards
    - [ ] Create Board Modal/Input
- [ ] **Board View**
    - [ ] Fetch Board Details (Lists & Cards)
    - [ ] Drag & Drop Interface
    - [ ] Create List/Card Functionality
