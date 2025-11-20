# ================================
# Desktop App Dockerfile
# ================================
# Node.js/Tauri App

FROM node:24-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Default command
CMD ["sh", "-c", "pnpm install --frozen-lockfile && sleep infinity"]
