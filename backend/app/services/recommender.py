"""
推荐引擎
根据浪况数据和用户偏好，计算每个浪点的冲浪质量评分并排序推荐
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.database import Spot, DailySummary, UserFavorite, User


TZ_SHANGHAI = timezone(timedelta(hours=8))


def calculate_surf_score(summary: DailySummary) -> float:
    """
    多因子加权评分模型 (0-10分)

    评分因子：
    1. 浪高适配 (0-4分)：冲浪最佳浪高 0.5-2.5m
    2. 涌浪周期 (0-3分)：长周期涌浪能量更足
    3. 涌浪占比 (0-2分)：涌浪为主优于风浪
    4. 水温适配 (0-1分)：舒适水温范围
    """
    score = 0.0

    # 因子1: 浪高适配 (0-4分)
    wave_h = summary.wave_height_avg_m
    if wave_h is not None:
        if 0.5 <= wave_h <= 2.5:
            # 最佳浪高范围，满分4分，以1.5m为中心
            distance = abs(wave_h - 1.5) / 1.0  # 归一化
            score += 4.0 * max(0, 1 - distance)
        elif wave_h < 0.5:
            score += 4.0 * (wave_h / 0.5) * 0.5  # 太小了，最多2分
        else:
            score += 4.0 * max(0, 1 - (wave_h - 2.5) / 2.0)  # 太大了扣分

    # 因子2: 涌浪周期 (0-3分)
    period = summary.swell_period_avg_s
    if period is not None:
        if period >= 10:
            score += 3.0  # 长周期涌浪，极佳
        elif period >= 7:
            score += 2.0 + (period - 7) / 3.0  # 中等周期
        elif period >= 4:
            score += 1.0 + (period - 4) / 3.0
        else:
            score += max(0, period / 4.0)

    # 因子3: 涌浪占比 (0-2分) — 涌浪能量占比越高越好
    swell_h = summary.swell_height_avg_m
    wind_h = summary.wind_wave_height_avg_m
    if swell_h is not None and wind_h is not None:
        total = swell_h + wind_h
        if total > 0:
            swell_ratio = swell_h / total
            if swell_ratio >= 0.7:
                score += 2.0
            elif swell_ratio >= 0.5:
                score += 1.0 + (swell_ratio - 0.5) * 5.0
            else:
                score += swell_ratio * 2.0

    # 因子4: 水温适配 (0-1分) — 舒适水温范围 20-30°C
    temp = summary.sea_temp_avg_c
    if temp is not None:
        if 20 <= temp <= 30:
            score += 1.0  # 舒适
        elif 15 <= temp < 20 or 30 < temp <= 33:
            score += 0.5  # 可接受
        else:
            score += 0.0  # 太冷或太热

    return round(min(10.0, score), 1)


def get_rating_label(score: float) -> str:
    if score >= 8:
        return "excellent"
    elif score >= 6:
        return "good"
    elif score >= 4:
        return "fair"
    return "poor"


async def update_ratings(db: AsyncSession) -> None:
    """更新所有浪点今日摘要的评分"""
    today_str = datetime.now(TZ_SHANGHAI).strftime("%Y-%m-%d")

    summaries = (await db.execute(
        select(DailySummary).where(DailySummary.date_str == today_str)
    )).scalars().all()

    for summary in summaries:
        score = calculate_surf_score(summary)
        summary.rating_score = score
        summary.rating_label = get_rating_label(score)

    await db.commit()


async def get_recommendations(
    db: AsyncSession,
    user: User | None = None,
    lat: float | None = None,
    lon: float | None = None,
    limit: int = 10,
) -> list[dict]:
    """获取浪点推荐列表"""
    today_str = datetime.now(TZ_SHANGHAI).strftime("%Y-%m-%d")

    # 基础查询：今日有摘要的浪点
    query = (
        select(DailySummary, Spot)
        .join(Spot, DailySummary.spot_id == Spot.id)
        .where(
            DailySummary.date_str == today_str,
            Spot.is_active == True,
        )
        .order_by(DailySummary.rating_score.desc().nullslast())
        .limit(limit * 2)  # 多取一些用于排序
    )

    result = await db.execute(query)
    rows = result.all()

    recommendations = []
    for summary, spot in rows:
        recommendations.append({
            "id": spot.spot_key,
            "name": spot.name,
            "region": spot.region,
            "cover_url": spot.cover_url,
            "lat": spot.lat,
            "lon": spot.lon,
            "wave_height_avg_m": summary.wave_height_avg_m,
            "swell_period_avg_s": summary.swell_period_avg_s,
            "sea_temp_avg_c": summary.sea_temp_avg_c,
            "wave_direction": summary.wave_direction_cn,
            "rating_score": summary.rating_score,
            "rating_label": summary.rating_label,
            "trend_7day": summary.trend_7day,
        })

    # 如果用户已登录且有收藏，优先推荐收藏的浪点
    if user:
        fav_spot_ids = await _get_user_favorite_spot_ids(db, user.id)
        fav_set = set(fav_spot_ids)
        if fav_set:
            # 收藏的浪点排在前面
            fav_recs = [r for r in recommendations if r["id"] in fav_set]
            other_recs = [r for r in recommendations if r["id"] not in fav_set]
            recommendations = fav_recs + other_recs

    # 如果提供了位置，计算距离并加权
    if lat is not None and lon is not None:
        for r in recommendations:
            r["distance_km"] = _haversine_distance(lat, lon, r["lat"], r["lon"])

    return recommendations[:limit]


async def _get_user_favorite_spot_ids(db: AsyncSession, user_id: int) -> list[str]:
    result = await db.execute(
        select(Spot.spot_key)
        .join(UserFavorite, UserFavorite.spot_id == Spot.id)
        .where(UserFavorite.user_id == user_id)
    )
    return [row[0] for row in result.all()]


def _haversine_distance(lat1, lon1, lat2, lon2) -> float:
    """计算两点间距离 (km)"""
    from math import radians, sin, cos, sqrt, asin

    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return round(R * 2 * asin(sqrt(a)), 1)
