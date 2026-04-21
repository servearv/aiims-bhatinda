#!/bin/bash
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set."
  exit 1
fi
if [ -z "$1" ]; then
  echo "Usage: ./db_import.sh <backup_file.dump>"
  exit 1
fi
echo "Importing database from $1 into $DATABASE_URL..."
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$1"
echo "Import complete."
