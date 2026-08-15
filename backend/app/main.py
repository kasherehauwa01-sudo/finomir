import logging
from fastapi import FastAPI,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes import router
from app.config import get_settings
s=get_settings(); logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(name)s %(message)s")
app=FastAPI(title="Финансы отдела маркетинга",root_path=s.base_path.rstrip("/"))
if s.allowed_origins: app.add_middleware(CORSMiddleware,allow_origins=s.allowed_origins,allow_methods=["*"],allow_headers=["*"])
app.include_router(router,prefix="/api")
@app.exception_handler(Exception)
async def unexpected(request:Request,exc:Exception): logging.getLogger("api").exception("Ошибка API %s",request.url.path); return JSONResponse(status_code=500,content={"detail":"Внутренняя ошибка сервиса"})
