"""
数据库模型定义
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean,
    ForeignKey, Text, JSON, UniqueConstraint, Index,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ── 浪点 (Spot) ──────────────────────────────

class Spot(Base):
    __tablename__ = "spots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    spot_key = Column(String(100), unique=True, nullable=False, index=True,
                      comment="唯一标识，如 'shuangyuewan-shizi'")
    name = Column(String(200), nullable=False, comment="浪点名称")
    region = Column(String(100), nullable=False, comment="所属区域，如'广东惠州'")
    lat = Column(Float, nullable=False, comment="纬度")
    lon = Column(Float, nullable=False, comment="经度")
    cover_url = Column(String(500), comment="封面图URL")
    description = Column(Text, comment="浪点描述")
    is_active = Column(Boolean, default=True, comment="是否启用")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联
    wave_data = relationship("WaveData", back_populates="spot", cascade="all, delete-orphan")
    favorites = relationship("UserFavorite", back_populates="spot", cascade="all, delete-orphan")


# ── 浪况数据 (WaveData) ──────────────────────

class WaveData(Base):
    """小时级浪况数据"""
    __tablename__ = "wave_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    spot_id = Column(Integer, ForeignKey("spots.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    forecast_time = Column(DateTime, nullable=False, index=True,
                           comment="预报时间点 (东八区)")
    date_str = Column(String(10), nullable=False, index=True,
                      comment="日期 YYYY-MM-DD，方便按天查询")

    # 核心浪况指标
    wave_height_m = Column(Float, comment="有效波高 (m)")
    swell_height_m = Column(Float, comment="涌浪高度 (m)")
    swell_period_s = Column(Float, comment="涌浪周期 (s)")
    wind_wave_height_m = Column(Float, comment="风浪高度 (m)")
    wave_period_s = Column(Float, comment="平均波周期 (s)")
    wave_direction_deg = Column(Float, comment="平均波向 (度)")
    wave_direction_cn = Column(String(10), comment="波向中文")
    sea_temp_c = Column(Float, comment="海面温度 (C)")

    created_at = Column(DateTime, default=datetime.utcnow)

    # 关联
    spot = relationship("Spot", back_populates="wave_data")

    __table_args__ = (
        UniqueConstraint("spot_id", "forecast_time", name="uq_spot_forecast_time"),
        Index("idx_spot_date", "spot_id", "date_str"),
    )


# ── 每日摘要 (DailySummary) ─────────────────

class DailySummary(Base):
    """每日浪况摘要（预计算，加速查询）"""
    __tablename__ = "daily_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    spot_id = Column(Integer, ForeignKey("spots.id", ondelete="CASCADE"),
                     nullable=False)
    date_str = Column(String(10), nullable=False, comment="日期 YYYY-MM-DD")

    # 摘要指标
    wave_height_avg_m = Column(Float)
    wave_height_max_m = Column(Float)
    swell_height_avg_m = Column(Float)
    swell_height_max_m = Column(Float)
    swell_period_avg_s = Column(Float)
    wind_wave_height_avg_m = Column(Float)
    wave_period_avg_s = Column(Float)
    wave_direction_deg = Column(Float)
    wave_direction_cn = Column(String(10))
    sea_temp_avg_c = Column(Float)

    # 评级（推荐引擎计算）
    rating_score = Column(Float, comment="综合评分 0-10")
    rating_label = Column(String(20), comment="评级标签: excellent/good/fair/poor")

    trend_7day = Column(String(500), comment="7天趋势自然语言描述")

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("spot_id", "date_str", name="uq_spot_date"),
        Index("idx_summary_date", "date_str"),
    )


# ── 用户 (User) ──────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    openid = Column(String(100), unique=True, nullable=False, index=True)
    unionid = Column(String(100), unique=True, nullable=True)
    nickname = Column(String(100), comment="微信昵称")
    avatar_url = Column(String(500), comment="头像URL")
    phone = Column(String(20), comment="手机号(加密存储)")
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, default=datetime.utcnow)

    favorites = relationship("UserFavorite", back_populates="user", cascade="all, delete-orphan")


# ── 用户收藏 (UserFavorite) ──────────────────

class UserFavorite(Base):
    __tablename__ = "user_favorites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False)
    spot_id = Column(Integer, ForeignKey("spots.id", ondelete="CASCADE"),
                     nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorites")
    spot = relationship("Spot", back_populates="favorites")

    __table_args__ = (
        UniqueConstraint("user_id", "spot_id", name="uq_user_spot"),
    )


# ── 刷新令牌 (RefreshToken) ──────────────────

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    token_hash = Column(String(256), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
