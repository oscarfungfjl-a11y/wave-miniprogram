"""
浪况数据采集服务
基于 fetch_wave.py 逻辑改编，通过 Open-Meteo Marine API 获取浪况数据
"""
import httpx
from datetime import datetime, timezone, timedelta
from collections import Counter
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from ..config import get_settings
from ..models.database import Spot, WaveData, DailySummary


settings = get_settings()

HOURLY_PARAMS = [
    "wave_height", "swell_wave_height", "swell_wave_period",
    "wind_wave_height", "wave_period", "wave_direction",
    "sea_surface_temperature",
]
FORECAST_DAYS = 7
TZ_SHANGHAI = timezone(timedelta(hours=8))


def degree_to_direction(deg: float) -> str:
    """角度转中文波向"""
    if deg is None:
        return "未知"
    dirs = [
        (0, "北"), (22.5, "北东北"), (45, "东北"), (67.5, "东东北"),
        (90, "东"), (112.5, "东东南"), (135, "东南"), (157.5, "南东南"),
        (180, "南"), (202.5, "南西南"), (225, "西南"), (247.5, "西西南"),
        (270, "西"), (292.5, "西西北"), (315, "西北"), (337.5, "北西北"),
        (360, "北"),
    ]
    for threshold, name in dirs:
        if deg <= threshold:
            return name
    return "北"


def safe_avg(values: list) -> float | None:
    valid = [v for v in values if v is not None]
    return round(sum(valid) / len(valid), 2) if valid else None


def safe_max(values: list) -> float | None:
    valid = [v for v in values if v is not None]
    return round(max(valid), 2) if valid else None


def dominant_direction(hourly_dirs: list) -> dict:
    """从每小时波向中找出主导方向"""
    if not hourly_dirs:
        return {"degree": None, "direction": "未知"}
    valid = [d for d in hourly_dirs if d is not None]
    if not valid:
        return {"degree": None, "direction": "未知"}
    counter = Counter(round(d / 22.5) * 22.5 for d in valid)
    most = counter.most_common(1)[0][0]
    return {"degree": round(most, 1), "direction": degree_to_direction(most)}


def trend_summary(daily_data: dict) -> str:
    """7天趋势自然语言描述"""
    dates = sorted(daily_data.keys())
    if len(dates) < 2:
        return "数据不足，无法生成趋势"

    heights = [daily_data[d].get("wave_height_avg_m") or 0 for d in dates]
    temps = [daily_data[d].get("sea_temp_avg_c") or 0 for d in dates]
    h0, h_end = heights[0], heights[-1]
    t0, t_end = temps[0], temps[-1]

    parts = []
    if h_end > h0 + 0.3:
        parts.append(f"浪高整体上升 ({h0:.1f} → {h_end:.1f} m)")
    elif h_end < h0 - 0.3:
        parts.append(f"浪高整体下降 ({h0:.1f} → {h_end:.1f} m)")
    else:
        parts.append(f"浪高基本平稳 (~{h0:.1f} m)")

    if t_end > t0 + 1:
        parts.append(f"水温上升 ({t0:.0f} → {t_end:.0f}°C)")
    elif t_end < t0 - 1:
        parts.append(f"水温下降 ({t0:.0f} → {t_end:.0f}°C)")
    else:
        parts.append(f"水温稳定 (~{t0:.0f}°C)")

    max_idx = heights.index(max(heights))
    parts.append(f"最大浪高出现在 {dates[max_idx]} ({max(heights):.1f} m)")

    return "；".join(parts)


async def fetch_raw_wave_data(lat: float, lon: float) -> dict:
    """调用 Open-Meteo Marine API"""
    params_str = ",".join(HOURLY_PARAMS)
    url = (
        f"{settings.open_meteo_base_url}"
        f"?latitude={lat}&longitude={lon}"
        f"&hourly={params_str}"
        f"&timezone=Asia/Shanghai"
        f"&forecast_days={FORECAST_DAYS}"
        f"&length_unit=metric"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


def parse_hourly_data(raw: dict) -> list[dict]:
    """解析小时级原始数据"""
    hourly = raw["hourly"]
    times = hourly["time"]
    result = []
    for i, t_str in enumerate(times):
        deg = hourly.get("wave_direction", [None])[i]
        result.append({
            "time": t_str,
            "wave_height_m": hourly["wave_height"][i],
            "swell_height_m": hourly["swell_wave_height"][i],
            "swell_period_s": hourly["swell_wave_period"][i],
            "wind_wave_height_m": hourly["wind_wave_height"][i],
            "wave_period_s": hourly["wave_period"][i],
            "wave_direction_deg": deg,
            "wave_direction_cn": degree_to_direction(deg) if deg is not None else None,
            "sea_temp_c": hourly["sea_surface_temperature"][i],
        })
    return result


def build_daily_summaries(hourly_data: list[dict]) -> dict:
    """按天聚合小时数据，计算每日摘要"""
    daily = {}
    for entry in hourly_data:
        date_str = entry["time"][:10]
        if date_str not in daily:
            daily[date_str] = {k: [] for k in HOURLY_PARAMS}
        for k in HOURLY_PARAMS:
            daily[date_str][k].append(entry.get(k))

    result = {}
    for date_str, vals in sorted(daily.items()):
        result[date_str] = {
            "wave_height_avg_m": safe_avg(vals["wave_height"]),
            "wave_height_max_m": safe_max(vals["wave_height"]),
            "swell_height_avg_m": safe_avg(vals["swell_wave_height"]),
            "swell_height_max_m": safe_max(vals["swell_wave_height"]),
            "swell_period_avg_s": safe_avg(vals["swell_wave_period"]),
            "wind_wave_height_avg_m": safe_avg(vals["wind_wave_height"]),
            "wave_period_avg_s": safe_avg(vals["wave_period"]),
            "wave_direction_deg": (dir_result := dominant_direction(vals["wave_direction"]))["degree"],
            "wave_direction_cn": dir_result["direction"],
            "sea_temp_avg_c": safe_avg(vals["sea_surface_temperature"]),
        }
    return result


async def fetch_and_store_spot(db: AsyncSession, spot: Spot) -> dict:
    """
    获取单个浪点数据并存储到数据库
    使用 PostgreSQL 的 ON CONFLICT 实现 upsert
    """
    raw = await fetch_raw_wave_data(spot.lat, spot.lon)
    hourly_data = parse_hourly_data(raw)
    daily_summaries = build_daily_summaries(hourly_data)
    trend = trend_summary(daily_summaries)

    # 批量 upsert 小时数据
    for entry in hourly_data:
        stmt = insert(WaveData).values(
            spot_id=spot.id,
            forecast_time=datetime.fromisoformat(entry["time"]),
            date_str=entry["time"][:10],
            wave_height_m=entry["wave_height_m"],
            swell_height_m=entry["swell_height_m"],
            swell_period_s=entry["swell_period_s"],
            wind_wave_height_m=entry["wind_wave_height_m"],
            wave_period_s=entry["wave_period_s"],
            wave_direction_deg=entry["wave_direction_deg"],
            wave_direction_cn=entry["wave_direction_cn"],
            sea_temp_c=entry["sea_temp_c"],
        ).on_conflict_do_update(
            constraint="uq_spot_forecast_time",
            set_={
                "wave_height_m": entry["wave_height_m"],
                "swell_height_m": entry["swell_height_m"],
                "swell_period_s": entry["swell_period_s"],
                "wind_wave_height_m": entry["wind_wave_height_m"],
                "wave_period_s": entry["wave_period_s"],
                "wave_direction_deg": entry["wave_direction_deg"],
                "wave_direction_cn": entry["wave_direction_cn"],
                "sea_temp_c": entry["sea_temp_c"],
            },
        )
        await db.execute(stmt)

    # 批量 upsert 每日摘要
    for date_str, summary in daily_summaries.items():
        stmt = insert(DailySummary).values(
            spot_id=spot.id,
            date_str=date_str,
            wave_height_avg_m=summary["wave_height_avg_m"],
            wave_height_max_m=summary["wave_height_max_m"],
            swell_height_avg_m=summary["swell_height_avg_m"],
            swell_height_max_m=summary["swell_height_max_m"],
            swell_period_avg_s=summary["swell_period_avg_s"],
            wind_wave_height_avg_m=summary["wind_wave_height_avg_m"],
            wave_period_avg_s=summary["wave_period_avg_s"],
            wave_direction_deg=summary["wave_direction_deg"],
            wave_direction_cn=summary["wave_direction_cn"],
            sea_temp_avg_c=summary["sea_temp_avg_c"],
            trend_7day=trend,
        ).on_conflict_do_update(
            constraint="uq_spot_date",
            set_={
                "wave_height_avg_m": summary["wave_height_avg_m"],
                "wave_height_max_m": summary["wave_height_max_m"],
                "swell_height_avg_m": summary["swell_height_avg_m"],
                "swell_height_max_m": summary["swell_height_max_m"],
                "swell_period_avg_s": summary["swell_period_avg_s"],
                "wind_wave_height_avg_m": summary["wind_wave_height_avg_m"],
                "wave_period_avg_s": summary["wave_period_avg_s"],
                "wave_direction_deg": summary["wave_direction_deg"],
                "wave_direction_cn": summary["wave_direction_cn"],
                "sea_temp_avg_c": summary["sea_temp_avg_c"],
                "trend_7day": trend,
            },
        )
        await db.execute(stmt)

    await db.commit()

    return {
        "spot_id": spot.id,
        "spot_name": spot.name,
        "hourly_count": len(hourly_data),
        "daily_count": len(daily_summaries),
    }


async def fetch_all_spots(db: AsyncSession) -> list[dict]:
    """获取所有活跃浪点的数据"""
    spots = (await db.execute(
        select(Spot).where(Spot.is_active == True)
    )).scalars().all()

    results = []
    for spot in spots:
        try:
            result = await fetch_and_store_spot(db, spot)
            results.append(result)
        except Exception as e:
            results.append({
                "spot_id": spot.id,
                "spot_name": spot.name,
                "error": str(e),
            })

    return results
