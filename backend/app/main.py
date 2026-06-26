"""
浪报后端 - FastAPI 主入口
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import get_settings
from .database import async_session_factory, close_engine
from .routes import auth, wave, user
from .tasks.scheduler import setup_scheduler, shutdown_scheduler

settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动调度器，关闭时清理连接"""
    logger.info(f"Starting {settings.app_name}")
    try:
        setup_scheduler()
    except Exception as e:
        logger.warning(f"Scheduler setup failed (DB may not be ready): {e}")
    yield
    logger.info(f"Shutting down {settings.app_name}")
    shutdown_scheduler()
    await close_engine()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="浪报小程序后端 API — 浪况预报与个性化推荐",
    lifespan=lifespan,
)

# CORS — 微信小程序不需要，但本地调试需要
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "code": "INTERNAL_ERROR"},
    )


# 注册路由
app.include_router(auth.router, prefix="/v1")
app.include_router(wave.router, prefix="/v1")
app.include_router(user.router, prefix="/v1")


# ── 管理接口 ──

@app.post("/admin/fetch-now")
async def manual_fetch():
    """手动触发浪况数据采集（调试用）"""
    from .tasks.scheduler import daily_fetch_and_rate
    import asyncio as _asyncio
    _asyncio.create_task(daily_fetch_and_rate())
    return {"message": "Wave data fetch triggered in background"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}


@app.get("/ready")
async def readiness_check():
    """就绪检查：测试数据库连接"""
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": str(e)},
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
