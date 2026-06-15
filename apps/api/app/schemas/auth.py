from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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
    orcid: str | None = Field(default=None, max_length=64)
    google_scholar: str | None = Field(default=None, max_length=512)
    researchgate: str | None = Field(default=None, max_length=512)
    affiliation: str | None = Field(default=None, max_length=255)
    research_direction: str | None = Field(default=None, max_length=255)


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


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=1)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)
