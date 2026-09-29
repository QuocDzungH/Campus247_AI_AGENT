from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from src.api.errors import install_error_handlers
from src.api.routes import router
from src.api.v1 import router as p0_router
from src.config import get_settings
from src.db.engine import get_engine
from src.services.common import new_id


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.app_env} mode")
    yield
    print("Shutting down...")


app = FastAPI(
    title="Campus 24/7",
    description="Campus 24/7 academic-ops assistant — P0 API",
    version="1.0.0",
    lifespan=lifespan,
)
install_error_handlers(app)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = new_id("req")
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers.setdefault("X-Request-Id", request_id)
    return response


app.include_router(p0_router, prefix="/api/v1")
app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}


@app.get("/ready")
async def ready():
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    except Exception:
        return {"status": "not_ready", "database": "error"}
