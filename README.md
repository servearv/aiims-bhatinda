# AIIMS Bathinda — School Health System

Digital health management system for AIIMS Bathinda school screening camps.

**Stack**: React + Vite + TypeScript · Flask · PostgreSQL

---

## Local Development

```bash
# Prerequisites: Python 3.11+, Node.js 18+

# 1. Install dependencies
pip install -r requirements.txt
npm install

# 2. Set environment variables (copy and edit)
cp .env.example .env

# 3. Start both Flask (port 3000) and Vite (port 5173)
python run_dev.py
```

Open [http://localhost:5173](http://localhost:5173). Default admin: `Admin` / `admin`.

---

## Docker Deployment

```bash
docker compose up --build
```

App: [http://localhost:8080](http://localhost:8080). Postgres runs alongside in a separate container.

### Environment Variables

Set these in `docker-compose.yml` or pass via `.env`:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SECRET_KEY` | Yes | Random string for session security |
| `LOGTAIL_TOKEN` | No | [Better Stack](https://betterstack.com) source token for remote log viewing |
| `SMTP_EMAIL` | No | Gmail address for sending OTP emails |
| `SMTP_PASSWORD` | No | Google App Password for the above |
| `REDIS_URL` | No | Redis URL for distributed sessions & Socket.IO |

---

## Logs

All application logs are structured JSON. In the Docker setup, they are automatically stored in **Loki** and can be viewed visually in **Grafana**.

1. Navigate to Grafana at: [http://localhost:3001](http://localhost:3001).
2. Go to **Explore** (Compass icon on the left panel).
3. The "Loki" data source is selected by default.
4. Click the "Label browser" to search your logs or run queries like `{application="aiims-bathinda-flask"}`.

*You can also still view raw container output via `docker compose logs -f app` if needed.*

---

## Database Migrations (Alembic)

Migrations run **automatically** on container startup. For manual control:

```bash
# Apply all pending migrations
docker compose exec app alembic upgrade head

# Create a new migration after schema changes
docker compose exec app alembic revision --autogenerate -m "describe change"

# Check current migration version
docker compose exec app alembic current

# Rollback one migration
docker compose exec app alembic downgrade -1
```

Migration scripts live in `migrations/versions/`.

---

## Database Backup & Restore

### Export
```bash
docker compose exec db pg_dump -U aiims aiims_db > backup.sql
```

### Import into a new server
```bash
cat backup.sql | docker exec -i <db-container> psql -U aiims -d aiims_db
```

Utility scripts are also available in `scripts/`:
```bash
DATABASE_URL=<url> ./scripts/db_export.sh
DATABASE_URL=<url> ./scripts/db_import.sh backup.dump
```
