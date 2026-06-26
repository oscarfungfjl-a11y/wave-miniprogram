"""
浪报后端 - 配置管理
集中管理环境变量，启动时校验必填项
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 应用
    app_name: str = "Wave Report API"
    debug: bool = False
    secret_key: str = "change-me-in-production"

    # 数据库 — 本地开发默认 SQLite，生产用 PostgreSQL
    database_url: str = "sqlite+aiosqlite:///./wave_report.db"

    # Redis — 本地开发可留空，启动时检测
    redis_url: str = ""

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # 微信小程序
    wx_appid: str = ""
    wx_secret: str = ""

    # Open-Meteo API
    open_meteo_base_url: str = "https://marine-api.open-meteo.com/v1/marine"

    # 推荐引擎参数
    rec_max_spots: int = 10
    rec_cache_ttl_seconds: int = 3600  # 推荐结果缓存1小时

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
