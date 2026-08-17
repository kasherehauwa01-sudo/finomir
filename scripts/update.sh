#!/usr/bin/env bash
set -Eeuo pipefail

readonly REGISTRY_HOST="registry-1.docker.io"
readonly BUILD_ATTEMPTS="${BUILD_ATTEMPTS:-3}"

log() { printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }

check_docker_registry_dns() {
  log "Проверка DNS для Docker Hub (${REGISTRY_HOST})..."
  if ! getent ahosts "${REGISTRY_HOST}" >/dev/null 2>&1; then
    cat >&2 <<'EOF'
ОШИБКА: сервер не может определить IP-адрес registry-1.docker.io.
Это проблема DNS сервера/хоста, а не Dockerfile Finomir.

Проверьте:
  resolvectl query registry-1.docker.io
  getent ahosts registry-1.docker.io

Рекомендованное исправление приведено в DEPLOY.md, раздел
«Docker Hub: server misbehaving». Запущенные контейнеры и volumes не изменены.
EOF
    return 1
  fi
}

build_images() {
  local attempt
  for ((attempt=1; attempt<=BUILD_ATTEMPTS; attempt++)); do
    log "Сборка Docker-образов: попытка ${attempt}/${BUILD_ATTEMPTS}..."
    if docker compose build; then return 0; fi
    if (( attempt < BUILD_ATTEMPTS )); then
      log "Сборка не выполнена. Повтор через $((attempt * 10)) секунд..."
      sleep "$((attempt * 10))"
      check_docker_registry_dns
    fi
  done
  echo "ОШИБКА: Docker-образы не собраны после ${BUILD_ATTEMPTS} попыток. Текущие production-контейнеры не остановлены." >&2
  return 1
}

if [[ "${SKIP_GIT_PULL:-0}" != "1" ]]; then
  log "Получение изменений..."
  git pull --ff-only
fi

check_docker_registry_dns
build_images
log "Запуск PostgreSQL и OCR..."
docker compose up -d --wait postgres ocr
log "Запуск backend и применение миграций..."
docker compose up -d --wait backend
docker compose exec -T backend alembic upgrade head
log "Запуск frontend..."
docker compose up -d --wait frontend
docker compose ps
curl -fsS "${FINOMIR_HEALTH_URL:-http://127.0.0.1:8080/api/health}"
