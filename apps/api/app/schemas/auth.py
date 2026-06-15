from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class UserProfileData(BaseModel):
    first_name: str | None = Field(default=None, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    middle_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    position: str | None = Field(default=None, max_length=255)
    organization: str | None = Field(default=None, max_length=255)
    degree: str | None = Field(default=None, max_length=120)
    specialty: str | None = Field(default=None, max_length=255)
    birth_date: str | None = Field(default=None, max_length=32)
    gender: str | None = Field(default=None, max_length=32)
    country: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    bio: str | None = Field(default=None, max_length=2000)
    telegram: str | None = Field(default=None, max_length=128)
    linkedin: str | None = Field(default=None, max_length=512)
    github: str | None = Field(default=None, max_length=512)
    website: str | None = Field(default=None, max_length=512)
    orcid: str | None = Field(default=None, max_length=64)
    google_scholar: str | None = Field(default=None, max_length=512)
    researchgate: str | None = Field(default=None, max_length=512)
    scopus_id: str | None = Field(default=None, max_length=64)
    wos_id: str | None = Field(default=None, max_length=64)
    affiliation: str | None = Field(default=None, max_length=255)
    research_direction: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=1024)
    avatar_storage_key: str | None = Field(default=None, max_length=512)


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    profile: UserProfileData | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str | None
    role: str
    is_active: bool
    email_verified: bool = False
    onboarding_completed_at: datetime | None = None
    profile_data: dict | None = None
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


def user_to_response(user: User) -> UserResponse:
    """Build UserResponse from eagerly loaded columns (no ORM lazy IO)."""
    profile_data = user.profile_data
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        email_verified=user.email_verified,
        onboarding_completed_at=user.onboarding_completed_at,
        profile_data=dict(profile_data) if profile_data is not None else None,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def build_user_response(db: AsyncSession, user: User) -> UserResponse:
    """Refresh user in the active async session, then return a safe DTO."""
    await db.refresh(user)
    return user_to_response(user)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=1)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)
