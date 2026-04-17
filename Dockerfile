# Stage 1: Build the React frontend
FROM node:20 AS frontend
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Remove package-lock.json to avoid cross-platform native binary issues (e.g. esbuild/Tailwind on Windows to Linux)
RUN rm -f package-lock.json && npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Python backend + built frontend
FROM python:3.11-slim
WORKDIR /app

# Ensure basic system dependencies for Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc python3-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy built frontend from Stage 1
COPY --from=frontend /app/dist ./dist

# Copy backend source files
COPY server.py .

# Expose port
EXPOSE 5000

# Default env vars
ENV PORT=5000
ENV SECRET_KEY=local-dev-secret-key

# Start with database initialization, then gunicorn
CMD sh -c 'python -c "import server; server.init_db()" && exec gunicorn server:app --bind 0.0.0.0:5000 --workers 2 --timeout 120'
