# Развертывание на Timeweb (Ubuntu)

## Требования и подготовка
Ubuntu 22.04/24.04, Docker Engine с Compose plugin, существующий Nginx, DNS и TLS. Разместите репозиторий, например, в `/opt/finomir`. Выполните `cp .env.example .env` и задайте надежные пароли. Публичные параметры уже настроены на целевой URL:

```env
BASE_PATH=/vr/finomir/
VITE_BASE_PATH=/vr/finomir/
CORS_ORIGINS=https://kvasmix.ru
OCR_PROVIDER=paddle
OCR_SERVICE_URL=http://ocr:8001
OCR_TIMEOUT_SECONDS=60
```

`BASE_PATH` и `VITE_BASE_PATH` должны совпадать. После изменения `VITE_BASE_PATH` frontend нужно пересобрать.

## Первый запуск
```bash
docker compose build
docker compose up -d --wait postgres ocr
docker compose up -d --wait backend
docker compose exec backend alembic upgrade head
docker compose up -d
curl -fsS http://127.0.0.1:8080/api/health
curl -fsS https://kvasmix.ru/vr/finomir/api/health
```
Compose создает именованные volumes `postgres_data` и `uploads`; пересборка их не удаляет.

## Nginx
Скопируйте только блоки из `deploy/nginx-location.conf` внутрь существующего HTTPS `server {}` для `kvasmix.ru`. До reload обязательно:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Безопасное обновление
```bash
git pull
docker compose build
docker compose up -d --wait postgres ocr
docker compose up -d --wait backend
docker compose exec backend alembic upgrade head
docker compose up -d --wait frontend
docker compose ps
curl -fsS https://kvasmix.ru/vr/finomir/api/health
```
Не удаляйте volumes при обычном обновлении.

Эквивалентная последовательность находится в `scripts/update.sh`. OCR не публикует порт наружу и проверяется внутренним healthcheck. Первый старт может занять больше времени из-за инициализации модели. Если OCR временно недоступен, backend продолжает работать, а интерфейс предлагает ручное заполнение. Для диагностики используйте `docker compose logs --tail=200 ocr backend`; удалять volumes для исправления OCR нельзя.

Если внешний `/var/www/html/vr/update_finomir.sh` уже выполняет `git pull`, запускайте проектный сценарий так, чтобы не получать изменения второй раз:

```bash
SKIP_GIT_PULL=1 /var/www/html/vr/finomir/scripts/update.sh
```

### Docker Hub: `server misbehaving`

Ошибка вида `lookup registry-1.docker.io on 127.0.0.53:53: server misbehaving` возникает **до чтения Dockerfile**: production-сервер не смог разрешить DNS-имя Docker Hub. Повторный merge или изменение базовых образов эту ошибку не исправляет. Сначала проверьте DNS:

```bash
resolvectl query registry-1.docker.io
getent ahosts registry-1.docker.io
curl -I --connect-timeout 10 https://registry-1.docker.io/v2/
```

Если используется `systemd-resolved`, задайте доступные серверу DNS в `/etc/systemd/resolved.conf` (например, DNS хостинг-провайдера либо разрешенные в вашей инфраструктуре публичные resolver), затем обновите resolver:

```ini
[Resolve]
DNS=1.1.1.1 8.8.8.8
FallbackDNS=9.9.9.9
```

```bash
sudo systemctl restart systemd-resolved
sudo resolvectl flush-caches
getent ahosts registry-1.docker.io
```

Если DNS хоста работает, а Docker по-прежнему не разрешает адреса, добавьте `/etc/docker/daemon.json`, сохранив уже имеющиеся параметры файла:

```json
{
  "dns": ["1.1.1.1", "8.8.8.8"]
}
```

После проверки JSON перезапустите только Docker daemon и повторите обновление:

```bash
sudo systemctl restart docker
cd /var/www/html/vr/finomir
SKIP_GIT_PULL=1 ./scripts/update.sh
```

Перезапуск Docker daemon не удаляет named volumes. Не выполняйте `docker compose down -v`. Новый update script проверяет DNS до сборки и делает до трех попыток; если сборка не удалась, уже запущенные production-контейнеры не останавливаются.

### Docker Hub: IPv6 `network is unreachable`

Ошибка вида:

```text
dial tcp [2600:...]:443: connect: network is unreachable
```

означает, что DNS уже работает, но Docker/BuildKit выбрал AAAA-запись Docker Hub, хотя у сервера нет рабочего IPv6-маршрута. Проверьте IPv4 и IPv6 отдельно:

```bash
getent ahostsv4 registry-1.docker.io
getent ahostsv6 registry-1.docker.io
curl -4 -I --connect-timeout 10 https://registry-1.docker.io/v2/
ip -6 route show default
```

Ответ `401 Unauthorized` от `curl -4` является успешной проверкой связи с Docker Registry. Если IPv4 работает, а `ip -6 route show default` ничего не возвращает, серверу нужно либо настроить IPv6 у хостинг-провайдера, либо отключить неработающий IPv6. Для сервера, где IPv6 не используется, временная проверка выполняется так:

```bash
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1
sudo sysctl -w net.ipv6.conf.default.disable_ipv6=1
sudo systemctl restart docker
```

Если после этого сборка работает, сохраните настройку после согласования с администратором сервера:

```bash
sudo tee /etc/sysctl.d/99-disable-broken-ipv6.conf >/dev/null <<'EOF'
net.ipv6.conf.all.disable_ipv6=1
net.ipv6.conf.default.disable_ipv6=1
EOF
sudo sysctl --system
sudo systemctl restart docker
```

Не отключайте IPv6, если на сервере через него доступны другие production-приложения: в этом случае следует настроить корректный IPv6 default route у провайдера.

В приведенном логе внешний `/var/www/html/vr/update_finomir.sh` по-прежнему вызывает `docker compose build` самостоятельно — сообщения `[время] Проверка DNS и IPv4-доступа...` отсутствуют. Поэтому проверки проектного `scripts/update.sh` не выполняются. После исправления сети измените шаг сборки внешнего сценария на:

```bash
cd /var/www/html/vr/finomir
SKIP_GIT_PULL=1 ./scripts/update.sh
```

## Backup и restore
Backup хранится снаружи контейнеров: `BACKUP_DIR=/srv/backups/finomir ./scripts/backup.sh`. Для восстановления остановите запись в сервис, затем:
```bash
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < /srv/backups/finomir/TIMESTAMP/database.dump
docker run --rm -v finomir_uploads:/data -v /srv/backups/finomir/TIMESTAMP:/backup:ro alpine sh -c 'cd /data && tar xzf /backup/uploads.tar.gz'
docker compose up -d
```
Регулярно проверяйте восстановление на отдельном окружении и копируйте backups на другой носитель.
## PIN-код

По умолчанию для входа используется PIN-код `8852285`. Для рабочей установки
обязательно задайте в `.env` постоянный случайный ключ сессии:

```dotenv
LOGIN_PIN=8852285
AUTH_SECRET=замените-на-длинную-случайную-строку
```

Не меняйте `AUTH_SECRET` без необходимости: после изменения все активные сессии
будут завершены.

## SMTP-уведомления

Перед сохранением SMTP-пароля задайте постоянный ключ шифрования в `.env`:

```bash
docker compose run --rm backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Скопируйте результат в `SMTP_ENCRYPTION_KEY`. Не меняйте и не удаляйте ключ после
сохранения SMTP-настроек: без него расшифровать пароль будет невозможно. Ключ не
хранится в базе данных и не возвращается через API.
