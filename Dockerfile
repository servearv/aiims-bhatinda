# ─── Multi-stage Dockerfile for AIIMS Bathinda ───
# Compatible with Docker and Podman. Does NOT affect Render deployment.

# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Python backend + built frontend
FROM python:3.11-slim
WORKDIR /app

# Install system deps for psycopg2-binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy built frontend from Stage 1
COPY --from=frontend /app/dist ./dist

# Copy backend source
COPY server.py .

# Expose port
EXPOSE 5000

# Default env vars (override in docker-compose or CLI)
ENV PORT=5000
ENV SECRET_KEY=change-me-in-production

# Start with gunicorn (same as Render)
CMD ["gunicorn", "server:app", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120"]
