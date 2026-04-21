#!/bin/bash
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set."
  exit 1
fi
FILENAME="backup_$(date +%Y%m%d_%H%M%S).dump"
echo "Exporting database to $FILENAME..."
pg_dump "$DATABASE_URL" --format=custom --file="$FILENAME"
echo "Export complete."
