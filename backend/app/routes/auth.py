"""
认证相关 API 路由
微信登录、Token 刷新、用户信息
"""
import hashlib
import secrets
import httpx
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt

from ..config import get_settings
from ..database import get_db
from ..models.database import User, RefreshToken
from .deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire, "type": "access"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    """生成 refresh token 并返回 (raw_token, hash, expires_at)"""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    raw = secrets.token_urlsafe(64)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, token_hash, expire


@router.post("/wechat-login")
async def wechat_login(code: dict, db: AsyncSession = Depends(get_db)):
    """
    微信登录接口
    1. 用 code 换取 openid / session_key
    2. 查找或创建用户
    3. 签发 JWT access token + refresh token
    """
    wx_code = code.get("code")
    if not wx_code:
        raise HTTPException(status_code=400, detail="Missing code")

    # 调用微信接口换取 openid
    wx_url = "https://api.weixin.qq.com/sns/jscode2session"
    async with httpx.AsyncClient() as client:
        resp = await client.get(wx_url, params={
            "appid": settings.wx_appid,
            "secret": settings.wx_secret,
            "js_code": wx_code,
            "grant_type": "authorization_code",
        })
        wx_data = resp.json()

    if "errcode" in wx_data and wx_data["errcode"] != 0:
        raise HTTPException(
            status_code=400,
            detail=f"WeChat login failed: {wx_data.get('errmsg', 'unknown')}",
        )

    openid = wx_data["openid"]
    unionid = wx_data.get("unionid")

    # 查找或创建用户
    user = (await db.execute(
        select(User).where(User.openid == openid)
    )).scalar_one_or_none()

    if user is None:
        user = User(openid=openid, unionid=unionid)
        db.add(user)
        await db.flush()

    user.last_login_at = datetime.utcnow()
    await db.commit()

    # 签发 Token
    access_token = create_access_token(user.id)
    raw_refresh, token_hash, expires_at = create_refresh_token(user.id)

    # 存储 refresh token 哈希
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(refresh_record)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "nickname": user.nickname,
            "avatar_url": user.avatar_url,
            "favorite_spot_ids": [],  # 单独接口获取
        },
    }


@router.post("/refresh")
async def refresh_token(refresh_data: dict, db: AsyncSession = Depends(get_db)):
    """刷新 access token"""
    raw_refresh = refresh_data.get("refresh_token")
    if not raw_refresh:
        raise HTTPException(status_code=400, detail="Missing refresh_token")

    token_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()

    record = (await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.utcnow(),
        )
    )).scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # 撤销旧 refresh token（轮换策略）
    record.revoked = True

    # 签发新 Token
    access_token = create_access_token(record.user_id)
    raw_new, new_hash, expires_at = create_refresh_token(record.user_id)

    db.add(RefreshToken(
        user_id=record.user_id,
        token_hash=new_hash,
        expires_at=expires_at,
    ))
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_new,
    }


@router.get("/check")
async def check_auth(user: User = Depends(get_current_user)):
    """检查登录态"""
    return {"user_id": user.id, "valid": True}
