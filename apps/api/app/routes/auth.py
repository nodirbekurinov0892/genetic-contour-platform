from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
    build_user_response,
)
from app.services.auth_service import AuthService
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/config")
async def auth_config(settings: Settings = Depends(get_settings)):
    return {
        "smtp_configured": settings.smtp_configured,
        "email_verification_required": settings.email_verification_required,
        "degraded_auth_mode": not settings.api_debug and not settings.smtp_configured,
    }


@router.post("/register", response_model=TokenResponse)
@limiter.limit("10/hour")
async def register(
    request: Request,
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = AuthService(db, settings)
    _, access_token, refresh_token = await service.register(data)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = AuthService(db, settings)
    _, access_token, refresh_token = await service.login(data)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh_token(
    request: Request,
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = AuthService(db, settings)
    _, access_token, refresh_token = await service.refresh(data.refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout")
@limiter.limit("30/minute")
async def logout(
    request: Request,
    data: LogoutRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = AuthService(db, settings)
    await service.logout(data.refresh_token)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await build_user_response(db, current_user)


@router.patch("/me", response_model=UserResponse)
@limiter.limit("30/minute")
async def update_me(
    request: Request,
    data: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = AuthService(db, settings)
    user = await service.update_profile(current_user, data)
    return await build_user_response(db, user)


@router.post("/me/password")
@limiter.limit("10/hour")
async def change_password(
    request: Request,
    data: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = AuthService(db, settings)
    await service.change_password(current_user, data.current_password, data.new_password)
    return {"message": "Parol muvaffaqiyatli yangilandi"}


@router.post("/me/avatar", response_model=UserResponse)
@limiter.limit("20/hour")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = AuthService(db, settings)
    user = await service.upload_avatar(current_user, file)
    return await build_user_response(db, user)


@router.delete("/me/avatar", response_model=UserResponse)
@limiter.limit("20/hour")
async def delete_avatar(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = AuthService(db, settings)
    user = await service.delete_avatar(current_user)
    return await build_user_response(db, user)


@router.post("/verify-email")
@limiter.limit("10/hour")
async def verify_email(
    request: Request,
    data: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = AuthService(db, settings)
    user = await service.verify_email(data.token)
    return {"message": "Email verified", "email": user.email}


@router.post("/password-reset/request")
@limiter.limit("5/hour")
async def request_password_reset(
    request: Request,
    data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = AuthService(db, settings)
    token = await service.request_password_reset(data.email)
    payload: dict = {"message": "If the email exists, a reset link was sent"}
    if settings.api_debug and token:
        payload["dev_reset_token"] = token
    return payload


@router.post("/password-reset/confirm")
@limiter.limit("10/hour")
async def confirm_password_reset(
    request: Request,
    data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = AuthService(db, settings)
    await service.reset_password(data.token, data.new_password)
    return {"message": "Password updated successfully"}


@router.post("/onboarding/complete", response_model=UserResponse)
async def complete_onboarding(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = AuthService(db, settings)
    user = await service.complete_onboarding(current_user)
    return await build_user_response(db, user)
