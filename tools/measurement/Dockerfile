FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy measurement script
COPY measure_token_reduction.py .

# Make script executable
RUN chmod +x measure_token_reduction.py

# Default command
CMD ["python", "measure_token_reduction.py"]
