# ==========================================
# AIRIS MCP Gateway API - Schema Partitioning
# ==========================================

FROM python:3.12-slim

WORKDIR /app

# Copy dependency file
COPY apps/api/pyproject.toml ./

# Install dependencies
RUN pip install --no-cache-dir -e . || pip install --no-cache-dir fastapi uvicorn httpx

# Copy application code
COPY apps/api/src/app ./app

# Expose port
EXPOSE 9400

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:9400/health')"

# Run FastAPI with uvicorn
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9400"]
