# Развертывание на Timeweb (Ubuntu)

## Требования и подготовка
Ubuntu 22.04/24.04, Docker Engine с Compose plugin, существующий Nginx, DNS и TLS. Разместите репозиторий, например, в `/opt/finomir`. Выполните `cp .env.example .env`, задайте надежные пароли, публичный `BASE_PATH=/vr/marketing-finance/`, `VITE_BASE_PATH` с тем же значением и разрешенный origin.

## Первый запуск
```bash
docker compose build
docker compose up -d postgres backend
docker compose exec backend alembic upgrade head
docker compose up -d
curl -fsS http://127.0.0.1:8080/api/health
```
Compose создает именованные volumes `postgres_data` и `uploads`; пересборка их не удаляет.

## Nginx
Скопируйте и адаптируйте только блоки из `deploy/nginx-location.conf` внутрь существующего `server {}`. До reload обязательно:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Безопасное обновление
```bash
git pull
docker compose build
docker compose up -d postgres backend
docker compose exec backend alembic upgrade head
docker compose up -d
```
Не удаляйте volumes при обычном обновлении.

## Backup и restore
Backup хранится снаружи контейнеров: `BACKUP_DIR=/srv/backups/finomir ./scripts/backup.sh`. Для восстановления остановите запись в сервис, затем:
```bash
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < /srv/backups/finomir/TIMESTAMP/database.dump
docker run --rm -v finomir_uploads:/data -v /srv/backups/finomir/TIMESTAMP:/backup:ro alpine sh -c 'cd /data && tar xzf /backup/uploads.tar.gz'
docker compose up -d
```
Регулярно проверяйте восстановление на отдельном окружении и копируйте backups на другой носитель.
