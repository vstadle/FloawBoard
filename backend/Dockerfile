# --- ÉTAPE 1 : Planification (Optimisation du cache) ---
FROM lukemathwalker/cargo-chef:latest-rust-1.88.0-bookworm AS chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# --- ÉTAPE 2 : Construction (Le gros du travail) ---
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Build des dépendances uniquement (sera mis en cache par Docker)
RUN cargo chef cook --release --recipe-path recipe.json

# Build de l'application réelle
COPY . .
RUN cargo build --release

# --- ÉTAPE 3 : Exécution (L'image finale minuscule) ---
FROM debian:bookworm-slim AS runtime
WORKDIR /app

# Installation des certificats SSL et de la libpq pour Postgres
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# On ne récupère que le binaire compilé de l'étape précédente
COPY --from=builder /app/target/release/kanban-api /app/kanban-api

# Configuration de l'exécution
ENV APP_ENVIRONMENT=production
EXPOSE 8080

CMD ["./kanban-api"]