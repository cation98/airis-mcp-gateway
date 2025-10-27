# ==========================================
# Multi-Stage Build: Vite + React with pnpm
# ==========================================

# ------------------------------
# Stage 1: Build (pnpm + Vite)
# ------------------------------
FROM node:24-alpine AS builder

# pnpm installation
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /monorepo

# Copy workspace files from root (context is project root)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all packages
COPY apps/settings ./apps/settings
COPY servers/mindbase/package.json ./servers/mindbase/package.json
COPY servers/self-management/package.json ./servers/self-management/package.json

# Install all dependencies (workspace aware)
RUN pnpm install --frozen-lockfile

# Build settings only
WORKDIR /monorepo/apps/settings
RUN pnpm build

# ------------------------------
# Stage 2: Production (nginx)
# ------------------------------
FROM nginx:1.27-alpine

# Copy built assets from builder stage (vite.config.ts: outDir: 'out')
COPY --from=builder /monorepo/apps/settings/out /usr/share/nginx/html

# Custom nginx config for SPA routing
RUN echo 'server { \
    listen 5173; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://api:9000; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
