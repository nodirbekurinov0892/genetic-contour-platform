import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.security import (
    create_access_token,
    create_refresh_token_value,
    hash_password,
    hash_refresh_token,
    refresh_token_expires_at,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def register(self, data: RegisterRequest) -> tuple[User, str, str]:
        existing = await self.db.execute(select(User).where(User.email == data.email.lower()))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        user = User(
            id=uuid.uuid4(),
            email=data.email.lower(),
            name=data.name,
            password_hash=hash_password(data.password),
            role=UserRole.USER.value,
            is_active=True,
        )
        self.db.add(user)
        await self.db.flush()

        access_token, refresh_token = await self._issue_tokens(user)
        logger.info("User registered: %s", user.id)
        return user, access_token, refresh_token

    async def login(self, data: LoginRequest) -> tuple[User, str, str]:
        result = await self.db.execute(select(User).where(User.email == data.email.lower()))
        user = result.scalar_one_or_none()

        if user is None or not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

        access_token, refresh_token = await self._issue_tokens(user)
        logger.info("User logged in: %s", user.id)
        return user, access_token, refresh_token

    async def refresh(self, refresh_token: str) -> tuple[User, str, str]:
        token_hash = hash_refresh_token(refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        stored = result.scalar_one_or_none()

        if stored is None or stored.revoked_at is not None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        if stored.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

        user_result = await self.db.execute(select(User).where(User.id == stored.user_id))
        user = user_result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

        stored.revoked_at = datetime.now(timezone.utc)
        access_token, new_refresh_token = await self._issue_tokens(user)
        return user, access_token, new_refresh_token

    async def logout(self, refresh_token: str) -> None:
        token_hash = hash_refresh_token(refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        stored = result.scalar_one_or_none()
        if stored and stored.revoked_at is None:
            stored.revoked_at = datetime.now(timezone.utc)

    async def _issue_tokens(self, user: User) -> tuple[str, str]:
        access_token = create_access_token(str(user.id), self.settings)
        refresh_value = create_refresh_token_value()
        refresh_record = RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_value),
            expires_at=refresh_token_expires_at(self.settings),
        )
        self.db.add(refresh_record)
        await self.db.flush()
        return access_token, refresh_value
