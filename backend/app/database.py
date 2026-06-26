"""
数据库引擎与会话管理
FastAPI 依赖注入用，提供 async session
支持 SQLite（本地开发）和 PostgreSQL（生产环境）
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from .config import get_settings

settings = get_settings()

# SQLite 和 PostgreSQL 使用不同的引擎参数
is_sqlite = settings.database_url.startswith("sqlite")

engine_kwargs = {"echo": settings.debug}
if not is_sqlite:
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
    })

engine = create_async_engine(settings.database_url, **engine_kwargs)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """
    FastAPI Depends 用数据库会话
    每个请求创建一个独立 session，请求结束自动关闭
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def close_engine():
    """应用关闭时清理连接池"""
    await engine.dispose()
