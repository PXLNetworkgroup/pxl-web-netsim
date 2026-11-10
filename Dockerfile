# Google Cloud Run Dockerfile for PXL Web NetSim
# Multi-platform Python runtime with Gunicorn WSGI and SQLite database
FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Ensure data directory for SQLite exists
RUN mkdir -p /app/data /app/submissions

# Expose standard Cloud Run port
EXPOSE 8080

# Launch with Gunicorn (4 worker threads, production WSGI)
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 server:app

