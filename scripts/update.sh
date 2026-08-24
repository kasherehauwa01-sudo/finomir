#!/usr/bin/env bash
set -Eeuo pipefail

readonly REGISTRY_HOST="registry-1.docker.io"
readonly BUILD_ATTEMPTS="${BUILD_ATTEMPTS:-3}"

log() { printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }

check_docker_registry_network() {
  log "Проверка DNS и IPv4-доступа к Docker Hub (${REGISTRY_HOST})..."
  if ! getent ahostsv4 "${REGISTRY_HOST}" >/dev/null 2>&1; then
    cat >&2 <<'EOF'
ОШИБКА: сервер не может определить IP-адрес registry-1.docker.io.
Это проблема DNS сервера/хоста, а не Dockerfile Finomir.

Проверьте:
  resolvectl query registry-1.docker.io
  getent ahostsv4 registry-1.docker.io

Рекомендованное исправление приведено в DEPLOY.md, раздел
«Docker Hub: server misbehaving». Запущенные контейнеры и volumes не изменены.
EOF
    return 1
  fi

  local http_code
  http_code="$(curl -4 -sS --connect-timeout 10 -o /dev/null -w '%{http_code}' "https://${REGISTRY_HOST}/v2/" || true)"
  if [[ "${http_code}" == "000" ]]; then
    echo "ОШИБКА: IPv4-адрес Docker Hub найден, но HTTPS-соединение по IPv4 недоступно." >&2
    echo "Проверьте firewall и маршрут: curl -4 -I https://${REGISTRY_HOST}/v2/" >&2
    return 1
  fi

  # Docker/BuildKit может выбрать AAAA-запись первой. Если IPv6-маршрута нет,
  # сборка завершается `network is unreachable`, не успев перейти на IPv4.
  if command -v ip >/dev/null 2>&1 && getent ahostsv6 "${REGISTRY_HOST}" >/dev/null 2>&1 && ! ip -6 route show default 2>/dev/null | grep -q '^default'; then
    cat >&2 <<'EOF'
ОШИБКА: Docker Hub имеет IPv6-адрес, но на сервере отсутствует IPv6 default route.
Docker/BuildKit может выбрать IPv6 и завершить сборку с `network is unreachable`.
Настройте IPv6-маршрут или отключите неработающий IPv6 по инструкции в DEPLOY.md.
Текущие production-контейнеры и volumes не изменены.
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
      check_docker_registry_network
    fi
  done
  echo "ОШИБКА: Docker-образы не собраны после ${BUILD_ATTEMPTS} попыток. Текущие production-контейнеры не остановлены." >&2
  return 1
}

verify_sources() {
  log "Проверка исходников перед Docker-сборкой..."
  # Эти проверки используют уже установленные зависимости, если они есть на
  # сервере разработчика. Production остаётся независимым: TypeScript в любом
  # случае повторно проверяется внутри frontend Dockerfile.
  if [[ -d frontend/node_modules ]]; then
    # Production typecheck использует только граф приложения. Старые тестовые
    # файлы из конфликтной ветки не должны блокировать аварийное восстановление.
    (cd frontend && npm run typecheck)
  else
    log "frontend/node_modules отсутствует — проверку выполнит Docker build."
  fi
  (cd backend && python -m compileall -q app) 2>/dev/null || log "Локальный Python backend недоступен — проверку выполнит Docker build."
}

if [[ "${SKIP_GIT_PULL:-0}" != "1" ]]; then
  log "Получение изменений..."
  git pull --ff-only
fi

check_docker_registry_network
verify_sources
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
