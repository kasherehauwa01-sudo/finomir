#!/usr/bin/env bash
set -euo pipefail
git pull --ff-only
docker compose build
docker compose up -d --wait postgres ocr
docker compose up -d --wait backend
docker compose exec -T backend alembic upgrade head
docker compose up -d --wait frontend
docker compose ps
curl -fsS "${FINOMIR_HEALTH_URL:-http://127.0.0.1:8080/api/health}"
