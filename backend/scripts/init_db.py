"""
数据库初始化脚本
创建所有表（通过 SQLAlchemy metadata.create_all）
用法: python -m scripts.init_db
"""
import asyncio
import sys
import os

# 添加项目根目录到 sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings
from app.models.database import Base
from sqlalchemy.ext.asyncio import create_async_engine


async def init_database():
    settings = get_settings()
    print(f"[init_db] Connecting to: {settings.database_url}")

    engine = create_async_engine(
        settings.database_url,
        echo=True,
    )

    async with engine.begin() as conn:
        print("[init_db] Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("[init_db] Tables created successfully!")

    await engine.dispose()
    print("[init_db] Done.")


if __name__ == "__main__":
    asyncio.run(init_database())
