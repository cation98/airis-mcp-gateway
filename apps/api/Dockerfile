# FastAPI Hybrid MCP Gateway
# Supports both Docker MCP Gateway proxy and direct uvx/npx process management
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (for npx MCP servers)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install uv (for uvx MCP servers)
RUN pip install --no-cache-dir uv

# Verify installations
RUN node --version && npm --version && npx --version && uvx --help || true

WORKDIR /app

# Copy everything
COPY . .

# Install Python dependencies
RUN uv pip install --system -e .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
