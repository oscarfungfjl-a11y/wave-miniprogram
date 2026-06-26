"""
浪点种子数据脚本
一次性导入中国沿海冲浪点
用法: python -m scripts.seed_data
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings
from app.database import async_session_factory
from app.models.database import Spot, WaveData, DailySummary, UserFavorite
from sqlalchemy import select, delete


# 中国沿海主要冲浪点（用户提供，坐标已验证）
SURF_SPOTS = [
    # ── 广东 ──
    {
        "spot_key": "shenzhen-dongchong",
        "name": "东涌海滩",
        "region": "广东深圳",
        "lat": 22.464, "lon": 114.542,
        "description": "未过度开发，沙质细腻，四季可浪",
    },
    {
        "spot_key": "shenzhen-xichong",
        "name": "西涌海滩",
        "region": "广东深圳",
        "lat": 22.48, "lon": 114.543,
        "description": "深圳最长海滩（4.5km），全国八大最美海滩之一",
    },
    {
        "spot_key": "huizhou-loop",
        "name": "LOOP",
        "region": "广东惠州",
        "lat": 22.59, "lon": 114.905,
        "description": "虹海湾东湾LOOP冲浪沙龙附近海岸",
    },
    {
        "spot_key": "huizhou-gaoyangwei",
        "name": "高洋尾",
        "region": "广东惠州",
        "lat": 22.555, "lon": 114.91,
        "description": "港口镇南侧东向海滩",
    },
    {
        "spot_key": "huizhou-qingrendao",
        "name": "情人岛",
        "region": "广东惠州",
        "lat": 22.55, "lon": 114.86,
        "description": "平海镇黑排角情人岛",
    },
    {
        "spot_key": "huizhou-honghaiwan",
        "name": "虹海湾",
        "region": "广东惠州",
        "lat": 22.593, "lon": 114.9,
        "description": "惠州虹海湾",
    },
    {
        "spot_key": "huizhou-wanke",
        "name": "万科",
        "region": "广东惠州",
        "lat": 22.597, "lon": 114.878,
        "description": "万科双月湾（Lunas Del Mar）",
    },
    {
        "spot_key": "huizhou-shizidao",
        "name": "狮子岛",
        "region": "广东惠州",
        "lat": 22.598, "lon": 114.842,
        "description": "纬度与夏威夷相同，日落美景出众",
    },
    {
        "spot_key": "shanwei-honghaiwan",
        "name": "红海湾（遮浪半岛）",
        "region": "广东汕尾",
        "lat": 22.67, "lon": 115.57,
        "description": "中国观浪第一湾，冬季浪高1-2m",
    },
    {
        "spot_key": "shantou-nanshanwan",
        "name": "南山湾",
        "region": "广东汕头",
        "lat": 23.244, "lon": 116.734,
        "description": "原始海滩风貌，玻璃海水质",
    },
    {
        "spot_key": "maoming-langmanhaian",
        "name": "浪漫海岸",
        "region": "广东茂名",
        "lat": 21.463, "lon": 111.142,
        "description": "5.3km私家海岸，国家4A景区",
    },
    {
        "spot_key": "zhanjiang-longhaitian",
        "name": "龙海天（东海岛）",
        "region": "广东湛江",
        "lat": 21.03, "lon": 110.48,
        "description": "中国第一长滩（28km），世界第二",
    },
    {
        "spot_key": "yangjiang-dajiaowan",
        "name": "大角湾",
        "region": "广东阳江",
        "lat": 21.57, "lon": 111.846,
        "description": "国家5A景区，广东首个滨海5A",
    },
    {
        "spot_key": "yangjiang-fuhuling",
        "name": "福湖岭（月亮湾）",
        "region": "广东阳江",
        "lat": 21.48, "lon": 111.6,
        "description": "天然礁石海滩，8km蜿蜒海岸",
    },
    # ── 海南 ──
    {
        "spot_key": "sanya-houhai",
        "name": "后海（皇后湾）",
        "region": "海南三亚",
        "lat": 18.263, "lon": 109.718,
        "description": "中国冲浪第一村，全年浪稳，新手圣地",
    },
    {
        "spot_key": "wanning-riyuewan",
        "name": "日月湾",
        "region": "海南万宁",
        "lat": 18.617, "lon": 110.198,
        "description": "国家冲浪基地，国家级赛事举办地",
    },
    {
        "spot_key": "wanning-shimeiwan",
        "name": "石梅湾",
        "region": "海南万宁",
        "lat": 18.669, "lon": 110.288,
        "description": "海南最美海湾，世界级青皮林保护区",
    },
    {
        "spot_key": "wanning-shenzhoubandao",
        "name": "神州半岛",
        "region": "海南万宁",
        "lat": 18.8, "lon": 110.39,
        "description": "缓坡长浪，适合家庭亲子体验",
    },
    {
        "spot_key": "lingshui-qingshuiwan",
        "name": "清水湾",
        "region": "海南陵水",
        "lat": 18.404, "lon": 109.854,
        "description": "会唱歌的沙滩，12km海岸线",
    },
    {
        "spot_key": "lingshui-xiangshuiwan",
        "name": "香水湾（富力湾）",
        "region": "海南陵水",
        "lat": 18.531, "lon": 110.101,
        "description": "4.2km私属海岸，北纬18度黄金度假带",
    },
]


async def seed_spots(reset: bool = False):
    async with async_session_factory() as db:
        if reset:
            # 清空所有浪点及相关数据
            print("[reset] 清空现有浪点数据...")
            await db.execute(delete(WaveData))
            await db.execute(delete(DailySummary))
            await db.execute(delete(UserFavorite))
            await db.execute(delete(Spot))
            await db.commit()
            print("[reset] 已清空，准备重新导入")

        created = 0
        skipped = 0

        for spot_data in SURF_SPOTS:
            existing = (await db.execute(
                select(Spot).where(Spot.spot_key == spot_data["spot_key"])
            )).scalar_one_or_none()

            if existing:
                print(f"  [SKIP] {spot_data['name']} (already exists)")
                skipped += 1
                continue

            spot = Spot(**spot_data, is_active=True)
            db.add(spot)
            created += 1
            print(f"  [OK]   {spot_data['name']} ({spot_data['region']}) — {spot_data['lat']}, {spot_data['lon']}")

        await db.commit()
        print(f"\n[seed_data] Done. Created: {created}, Skipped: {skipped}, Total: {len(SURF_SPOTS)}")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    asyncio.run(seed_spots(reset=reset))
