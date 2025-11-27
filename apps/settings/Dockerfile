# ==========================================
# Multi-Stage Build: Vite + React with pnpm
# ==========================================

# ------------------------------
# Stage 1: Build (pnpm + Vite)
# ------------------------------
FROM node:24-alpine AS builder

# pnpm installation via corepack
RUN npm install -g --force corepack@latest && corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /monorepo

# Copy workspace files from root (context is project root)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all packages
COPY apps/settings ./apps/settings
COPY servers/mindbase/package.json ./servers/mindbase/package.json

# Install all dependencies (workspace aware)
RUN pnpm install

# Build settings only
WORKDIR /monorepo/apps/settings
RUN pnpm build

# ------------------------------
# Stage 2: Production (nginx)
# ------------------------------
FROM nginx:1.27-alpine

ENV UI_PORT=5173 \
    API_PROXY_URL=http://api:9000

# Copy built assets from builder stage (vite.config.ts: outDir: 'out')
COPY --from=builder /monorepo/apps/settings/out /usr/share/nginx/html
COPY apps/settings/nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 5173

CMD ["sh", "-c", "envsubst '$$UI_PORT $$API_PROXY_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
