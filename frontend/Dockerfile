# --- ÉTAPE 1 : Installation des dépendances ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- ÉTAPE 2 : Construction (Build) ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# On désactive la télémétrie Next.js pendant le build
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# --- ÉTAPE 3 : Exécution ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# On ne copie que le nécessaire pour l'exécution
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]