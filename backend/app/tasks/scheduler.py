"""
定时任务 - APScheduler
每日凌晨自动获取浪况数据并更新评分
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ..config import get_settings
from ..database import async_session_factory
from ..services.wave_fetcher import fetch_all_spots
from ..services.recommender import update_ratings

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = AsyncIOScheduler()


async def daily_fetch_and_rate():
    """每日任务：获取浪况 + 更新评分"""
    logger.info("Daily wave fetch task started")

    async with async_session_factory() as db:
        try:
            # Step 1: 采集所有浪点数据
            results = await fetch_all_spots(db)
            success_count = sum(1 for r in results if "error" not in r)
            error_count = sum(1 for r in results if "error" in r)
            logger.info(f"Wave fetch completed: {success_count} success, {error_count} errors")

            # Step 2: 更新评分
            await update_ratings(db)
            logger.info("Ratings updated successfully")

        except Exception as e:
            logger.error(f"Daily task failed: {e}", exc_info=True)


def setup_scheduler():
    """配置定时任务"""
    # 每日凌晨 2:00 (东八区) 执行
    scheduler.add_job(
        daily_fetch_and_rate,
        "cron",
        hour=2,
        minute=0,
        id="daily_wave_fetch",
        name="Daily wave data fetch and rating",
        replace_existing=True,
    )

    # 每日上午 10:00 更新评分（确保准确性）
    scheduler.add_job(
        daily_fetch_and_rate,
        "cron",
        hour=10,
        minute=0,
        id="morning_rating_update",
        name="Morning rating update",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started with daily tasks")


def shutdown_scheduler():
    """关闭调度器"""
    logger.info(f"Scheduler shutdown")
