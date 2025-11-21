# ================================
# Tests Dockerfile
# ================================
# Python-based test runner

FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY tests/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Default command
CMD ["sleep", "infinity"]
