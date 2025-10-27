# ================================
# Self-Management MCP Server Dockerfile
# ================================
# TypeScript Builder (npm-based)

FROM node:24-alpine

WORKDIR /app

# Default command: install + build + wait
# Actual command is overridden in docker-compose.yml
CMD ["sh", "-c", "npm install && npm run build && sleep infinity"]
