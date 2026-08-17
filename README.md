# Финомир — финансы отдела маркетинга

Production-oriented modular monolith для учета цепочки **партнер → контрагент → расход → счет → платежи**. Денежные значения обрабатываются `Decimal`/`NUMERIC(15,2)`, документы находятся вне PostgreSQL в persistent volume.

Целевой production URL: **https://kvasmix.ru/vr/finomir/**.

## Архитектура и стек
- `backend/`: FastAPI, SQLAlchemy 2, Pydantic, PostgreSQL, Alembic; раздельные models, schemas, routes, repositories и services (finance, storage, OCR, export/audit).
- `frontend/`: React, TypeScript, Vite; pages, components, API client, hooks, types и utilities. Адаптивный реестр и mobile-first загрузка с `capture`.
- `docker-compose.yml`: PostgreSQL, API, Nginx frontend; постоянные volumes БД и uploads.
- PWA: manifest, installable icon, service worker с cache только оболочки. Offline CRUD намеренно отсутствует.

## Локальный запуск
```bash
cp .env.example .env
# замените пароли; base path уже настроен на /vr/finomir/
docker compose build
docker compose up -d postgres backend
docker compose exec backend alembic upgrade head
docker compose up -d
```
API health: `http://localhost:8080/api/health`. Миграции являются единственным production-механизмом схемы.

## Тесты
```bash
cd backend && python -m pip install -e '.[test]' && pytest
cd frontend && npm install && npm test && npm run build
```

## OCR счетов
`OCRProvider` сохранен как граница backend. При `OCR_PROVIDER=paddle` backend передает изображение только внутреннему сервису `ocr` (`OCR_SERVICE_URL=http://ocr:8001`), где русская модель PaddleOCR загружается один раз при старте. Порт OCR на host не публикуется. Оригинал остается в volume uploads, а временная копия получает EXIF-ориентацию, ограничение 3000×3000, grayscale, контраст, резкость и умеренный deskew.

Текст независимо обрабатывает `RussianInvoiceParser`: он определяет номер/дату счета, итоговую сумму через `Decimal`, поставщика и ИНН с проверкой контрольных цифр. Raw text, блоки с координатами, значения и confidence сохраняются в `ocr_results`. По точному ИНН выполняется поиск существующего контрагента; записи расходов и контрагентов OCR не создает. `POST /api/documents/{id}/recognize` позволяет повторить обработку. При `OCR_PROVIDER=disabled` остается ручной сценарий.

Переменные: `OCR_PROVIDER`, `OCR_SERVICE_URL`, `OCR_TIMEOUT_SECONDS`. Диагностика: `docker compose logs ocr`, `docker compose exec ocr python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8001/health').read())"`.

## Excel
Экспорт использует одну строку на счет с повторением человекочитаемых данных расхода; расход без счета также получает строку, поэтому данные не теряются.

Deployment, Nginx, backup и restore описаны в [DEPLOY.md](DEPLOY.md).

Если сборка завершается сообщением `lookup registry-1.docker.io ... server misbehaving`, это сбой DNS production-хоста. `scripts/update.sh` проверяет Docker Hub до сборки, повторяет временно неудачную сборку и не останавливает работающие контейнеры при ошибке. Пошаговая диагностика приведена в разделе `Docker Hub: server misbehaving` файла `DEPLOY.md`.
