# ================================
# MindBase MCP Server Dockerfile
# ================================
# TypeScript Builder (pnpm-based)

FROM node:24-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Default command: install + build + wait
# Actual command is overridden in docker-compose.yml
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm build && sleep infinity"]
