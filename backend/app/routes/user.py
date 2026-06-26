"""
用户相关 API 路由
收藏浪点、个人信息、订阅设置
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..database import get_db
from ..models.database import User, UserFavorite, Spot, DailySummary
from .deps import get_current_user

router = APIRouter(prefix="/user", tags=["user"])


class FavoriteAction(BaseModel):
    spot_id: str
    action: str  # 'add' | 'remove'


@router.get("/favorites")
async def get_favorites(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """获取用户收藏的浪点列表"""
    if not user:
        return {"spots": []}

    result = await db.execute(
        select(Spot)
        .join(UserFavorite, UserFavorite.spot_id == Spot.id)
        .where(UserFavorite.user_id == user.id, Spot.is_active == True)
    )
    spots = result.scalars().all()

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


@router.post("/favorites")
async def toggle_favorite(
    data: FavoriteAction,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """添加/取消收藏浪点"""
    if not user:
        raise HTTPException(status_code=401, detail="Login required")

    # 查找浪点
    spot = (await db.execute(
        select(Spot).where(Spot.spot_key == data.spot_id)
    )).scalar_one_or_none()

    if not spot:
        raise HTTPException(status_code=404, detail="Spot not found")

    if data.action == "add":
        # 检查是否已收藏
        existing = (await db.execute(
            select(UserFavorite).where(
                UserFavorite.user_id == user.id,
                UserFavorite.spot_id == spot.id,
            )
        )).scalar_one_or_none()

        if not existing:
            fav = UserFavorite(user_id=user.id, spot_id=spot.id)
            db.add(fav)
            await db.commit()

        return {"favorited": True}

    elif data.action == "remove":
        await db.execute(
            delete(UserFavorite).where(
                UserFavorite.user_id == user.id,
                UserFavorite.spot_id == spot.id,
            )
        )
        await db.commit()
        return {"favorited": False}

    else:
        raise HTTPException(status_code=400, detail="Invalid action, must be 'add' or 'remove'")


@router.get("/favorites/wave-data")
async def get_favorite_wave_data(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """获取用户收藏浪点的实时浪况"""
    if not user:
        return {"spots": []}

    from datetime import datetime, timezone, timedelta
    today_str = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")

    result = await db.execute(
        select(Spot, DailySummary)
        .join(UserFavorite, UserFavorite.spot_id == Spot.id)
        .outerjoin(DailySummary,
                   (DailySummary.spot_id == Spot.id)
                   & (DailySummary.date_str == today_str))
        .where(UserFavorite.user_id == user.id, Spot.is_active == True)
    )
    rows = result.all()

    spots = []
    for spot, summary in rows:
        spots.append({
            "id": spot.spot_key,
            "name": spot.name,
            "region": spot.region,
            "cover_url": spot.cover_url,
            "wave_height_avg_m": summary.wave_height_avg_m if summary else None,
            "wave_height_max_m": summary.wave_height_max_m if summary else None,
            "swell_height_avg_m": summary.swell_height_avg_m if summary else None,
            "swell_height_max_m": summary.swell_height_max_m if summary else None,
            "swell_period_avg_s": summary.swell_period_avg_s if summary else None,
            "sea_temp_avg_c": summary.sea_temp_avg_c if summary else None,
            "wave_direction": summary.wave_direction_cn if summary else None,
            "rating_score": summary.rating_score if summary else None,
            "rating_label": summary.rating_label if summary else None,
            "trend_7day": summary.trend_7day if summary else None,
            "is_favorited": True,
        })

    return {"spots": spots}
