#!/bin/sh
set -eu
stamp=$(date -u +%Y%m%dT%H%M%SZ); dest=${BACKUP_DIR:-./backups}/$stamp; mkdir -p "$dest"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$dest/database.dump"
docker run --rm -v finomir_uploads:/data:ro -v "$(realpath "$dest"):/backup" alpine tar czf /backup/uploads.tar.gz -C /data .
echo "Backup: $dest"
