# syntax=docker/dockerfile:1

# ── Stage 1: build ───────────────────────────────────────────────────────────
# Compiles TypeScript to dist/ and builds the native modules (better-sqlite3,
# @node-rs/argon2). Build toolchain is only present in this stage.
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# node-gyp needs python3 + a C/C++ toolchain to compile native deps.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
  && npm prune --omit=dev   # drop dev deps; keep compiled native prod deps

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
# Same base image as the builder, so the compiled native bindings are ABI-compatible.
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/app/data/portfolio.db

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/views ./views
COPY --from=builder /app/public ./public
COPY --from=builder /app/eval-runs ./eval-runs
COPY --from=builder /app/package.json ./package.json

# Persisted SQLite lives here; run as the unprivileged `node` user.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
