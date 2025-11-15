# syntax=docker/dockerfile:1.6

###########################################
# API (FastAPI + uv + Alembic)
###########################################
FROM python:3.12-slim AS api

RUN pip install --no-cache-dir uv
WORKDIR /app

COPY apps/api/pyproject.toml ./pyproject.toml
RUN uv pip install --system -r pyproject.toml
RUN uv pip install --system pytest pytest-asyncio httpx pytest-cov

COPY apps/api/src ./src
COPY apps/api/alembic ./alembic
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV PYTHONPATH=/app/src
ENTRYPOINT ["./entrypoint.sh"]


###########################################
# Settings UI (Vite + pnpm + nginx)
###########################################
FROM node:24-alpine AS settings-builder

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /monorepo

COPY package.json pnpm-workspace.yaml ./
COPY apps/settings ./apps/settings
COPY servers/mindbase/package.json ./servers/mindbase/package.json
COPY servers/self-management/package.json ./servers/self-management/package.json

RUN pnpm install
WORKDIR /monorepo/apps/settings
RUN pnpm build

FROM nginx:1.27-alpine AS settings
ENV UI_PORT=5273 \
    API_PROXY_URL=http://api:9900

COPY --from=settings-builder /monorepo/apps/settings/out /usr/share/nginx/html
COPY apps/settings/nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 5273
CMD ["sh", "-c", "envsubst '$$UI_PORT $$API_PROXY_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]


###########################################
# WebUI (Dynamic Profile UI - Vite + pnpm + nginx)
###########################################
FROM node:24-alpine AS webui-builder

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /monorepo

COPY package.json pnpm-workspace.yaml ./
COPY apps/webui ./apps/webui
COPY servers/mindbase/package.json ./servers/mindbase/package.json
COPY servers/self-management/package.json ./servers/self-management/package.json

RUN pnpm install
WORKDIR /monorepo/apps/webui
RUN pnpm build

FROM nginx:1.27-alpine AS webui
ENV WEBUI_PORT=5274 \
    API_PROXY_URL=http://api:9900

COPY --from=webui-builder /monorepo/apps/webui/build /usr/share/nginx/html
COPY apps/webui/nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 5274
CMD ["sh", "-c", "envsubst '$$WEBUI_PORT $$API_PROXY_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]


###########################################
# Gateway (docker/mcp-gateway base)
###########################################
FROM docker/mcp-gateway:latest AS gateway

LABEL maintainer="AIRIS MCP Gateway Team"
LABEL description="AIRIS MCP Gateway - Centralized MCP Server routing with docker/mcp-gateway"
LABEL version="1.3.0"

ENV AIRIS_VERSION="1.3.0" \
    AIRIS_MCP_GATEWAY="true"

# Install jq for robust JSON parsing (Alpine)
RUN apk add --no-cache jq

COPY gateway/inject-secrets.sh /usr/local/bin/inject-secrets.sh
RUN chmod +x /usr/local/bin/inject-secrets.sh

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${GATEWAY_LISTEN_PORT:-9390}/" || exit 1

ENTRYPOINT ["/usr/local/bin/inject-secrets.sh"]
CMD ["/docker-mcp", "gateway", "run", "--transport=sse", "--port=9390"]


###########################################
# MindBase MCP Server Builder
###########################################
FROM node:24-alpine AS mindbase-builder

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
CMD ["sh", "-c", "pnpm install && pnpm build && sleep infinity"]


###########################################
# Self-Management MCP Server Builder
###########################################
FROM node:24-alpine AS self-management-builder

WORKDIR /app
CMD ["sh", "-c", "npm install && npm run build && sleep infinity"]


###########################################
# Token Measurement
###########################################
FROM python:3.12-slim AS measurement

WORKDIR /app
COPY tools/measurement/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY tools/measurement/measure_token_reduction.py .
RUN chmod +x measure_token_reduction.py
CMD ["python", "measure_token_reduction.py"]
