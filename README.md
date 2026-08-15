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

## OCR
`OCRProvider` изолирует провайдера. По умолчанию `OCR_PROVIDER=disabled`: файл безопасно сохраняется, а пользователь получает ручную форму проверки. Секрет провайдера передается только через backend environment. PDF-провайдер может сначала применять `pypdf` для текстового слоя.

## Excel
Экспорт использует одну строку на счет с повторением человекочитаемых данных расхода; расход без счета также получает строку, поэтому данные не теряются.

Deployment, Nginx, backup и restore описаны в [DEPLOY.md](DEPLOY.md).
