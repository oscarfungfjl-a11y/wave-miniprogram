"""
浪况相关 API 路由
推荐、浪点列表、详情、搜索
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.database import Spot, DailySummary, WaveData, UserFavorite
from .deps import get_current_user

router = APIRouter(prefix="", tags=["wave"])
TZ_SHANGHAI = timezone(timedelta(hours=8))


@router.get("/recommendations")
async def get_recommendations(
    lat: float | None = Query(None, description="用户纬度"),
    lon: float | None = Query(None, description="用户经度"),
    limit: int = Query(10, le=20),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """获取浪点推荐"""
    from ..services.recommender import get_recommendations as _get_recs
    recommendations = await _get_recs(db, user, lat, lon, limit)

    # 标记用户收藏状态
    if user:
        fav_result = await db.execute(
            select(UserFavorite.spot_id).where(UserFavorite.user_id == user.id)
        )
        fav_spot_ids = {row[0] for row in fav_result.all()}
    else:
        fav_spot_ids = set()

    return {
        "recommendations": recommendations,
        "has_more": len(recommendations) >= limit,
    }


@router.get("/spots")
async def get_spots(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=50),
    region: str | None = Query(None),
    keyword: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """获取浪点列表"""
    today_str = datetime.now(TZ_SHANGHAI).strftime("%Y-%m-%d")

    query = (
        select(Spot, DailySummary)
        .outerjoin(DailySummary,
                   (DailySummary.spot_id == Spot.id)
                   & (DailySummary.date_str == today_str))
        .where(Spot.is_active == True)
    )

    if region:
        query = query.where(Spot.region == region)
    if keyword:
        query = query.where(Spot.name.ilike(f"%{keyword}%"))

    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    rows = result.all()

    spots = []
    for spot, summary in rows:
        spots.append({
            "id": spot.spot_key,
            "name": spot.name,
            "region": spot.region,
            "cover_url": spot.cover_url,
            "lat": spot.lat,
            "lon": spot.lon,
            "wave_height_avg_m": summary.wave_height_avg_m if summary else None,
            "swell_period_avg_s": summary.swell_period_avg_s if summary else None,
            "sea_temp_avg_c": summary.sea_temp_avg_c if summary else None,
            "wave_direction": summary.wave_direction_cn if summary else None,
            "rating_score": summary.rating_score if summary else None,
            "rating_label": summary.rating_label if summary else None,
            "trend_7day": summary.trend_7day if summary else None,
        })

    return {"spots": spots, "page": page, "page_size": page_size}


@router.get("/spots/search")
async def search_spots(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """搜索浪点（必须定义在 /spots/{spot_id} 前面，否则会被路径参数匹配）"""
    spots = (await db.execute(
        select(Spot)
        .where(
            Spot.is_active == True,
            (Spot.name.ilike(f"%{q}%")) | (Spot.region.ilike(f"%{q}%")),
        )
        .limit(20)
    )).scalars().all()

    return {
        "spots": [
            {
                "id": s.spot_key,
                "name": s.name,
                "region": s.region,
                "cover_url": s.cover_url,
            }
            for s in spots
        ],
    }


@router.get("/spots/{spot_id}")
async def get_spot_detail(
    spot_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取浪点详情（含7天预报）"""
    spot = (await db.execute(
        select(Spot).where(Spot.spot_key == spot_id, Spot.is_active == True)
    )).scalar_one_or_none()

    if not spot:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Spot not found")

    # 获取7天每日摘要
    summaries = (await db.execute(
        select(DailySummary)
        .where(DailySummary.spot_id == spot.id)
        .order_by(DailySummary.date_str)
    )).scalars().all()

    daily_data = {}
    for s in summaries:
        daily_data[s.date_str] = {
            "wave_height_avg_m": s.wave_height_avg_m,
            "wave_height_max_m": s.wave_height_max_m,
            "swell_height_avg_m": s.swell_height_avg_m,
            "swell_height_max_m": s.swell_height_max_m,
            "swell_period_avg_s": s.swell_period_avg_s,
            "wind_wave_height_avg_m": s.wind_wave_height_avg_m,
            "wave_period_avg_s": s.wave_period_avg_s,
            "wave_direction_deg": s.wave_direction_deg,
            "wave_direction_cn": s.wave_direction_cn,
            "sea_temp_avg_c": s.sea_temp_avg_c,
            "rating_score": s.rating_score,
            "rating_label": s.rating_label,
            "trend_7day": s.trend_7day,
        }

    # 获取小时数据（仅今日）
    today_str = datetime.now(TZ_SHANGHAI).strftime("%Y-%m-%d")
    hourly_data = (await db.execute(
        select(WaveData)
        .where(
            WaveData.spot_id == spot.id,
            WaveData.date_str == today_str,
        )
        .order_by(WaveData.forecast_time)
    )).scalars().all()

    hourly_list = []
    for h in hourly_data:
        hourly_list.append({
            "time": h.forecast_time.isoformat(),
            "time_label": h.forecast_time.strftime("%H:00"),
            "wave_height_m": h.wave_height_m,
            "swell_height_m": h.swell_height_m,
            "swell_period_s": h.swell_period_s,
            "wind_wave_height_m": h.wind_wave_height_m,
            "wave_period_s": h.wave_period_s,
            "wave_direction_deg": h.wave_direction_deg,
            "wave_direction_cn": h.wave_direction_cn,
            "sea_temp_c": h.sea_temp_c,
        })

    return {
        "spot": {
            "id": spot.spot_key,
            "name": spot.name,
            "region": spot.region,
            "cover_url": spot.cover_url,
            "lat": spot.lat,
            "lon": spot.lon,
            "description": spot.description,
        },
        "daily_summary": daily_data,
        "hourly": hourly_list,
    }
