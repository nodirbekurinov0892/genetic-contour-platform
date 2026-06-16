import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.team_service import TeamService

router = APIRouter(prefix="/api/teams", tags=["teams"])


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=256)


class MemberAdd(BaseModel):
    email: str
    role: str = "researcher"


@router.get("/organizations")
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = TeamService(db)
    orgs = await service.list_for_user(current_user)
    return [
        {
            "id": str(o.id),
            "name": o.name,
            "slug": o.slug,
            "owner_id": str(o.owner_id),
            "member_count": len(o.members),
            "members": [
                {"user_id": str(m.user_id), "role": m.role} for m in o.members
            ],
        }
        for o in orgs
    ]


@router.post("/organizations")
async def create_organization(
    request: Request,
    body: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = TeamService(db)
    org = await service.create_organization(current_user, body.name)
    audit = AuditService(db)
    await audit.log(
        user_id=current_user.id,
        action="organization.create",
        resource_type="organization",
        resource_id=str(org.id),
        details={"name": org.name},
        ip_address=request.client.host if request.client else None,
    )
    return {"id": str(org.id), "name": org.name, "slug": org.slug}


@router.post("/organizations/{org_id}/members")
async def add_member(
    request: Request,
    org_id: uuid.UUID,
    body: MemberAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = TeamService(db)
    member = await service.add_member(org_id, current_user, body.email, body.role)
    audit = AuditService(db)
    await audit.log(
        user_id=current_user.id,
        action="team.member.add",
        resource_type="organization",
        resource_id=str(org_id),
        details={"member_user_id": str(member.user_id), "role": body.role},
        ip_address=request.client.host if request.client else None,
    )
    return {"id": str(member.id), "user_id": str(member.user_id), "role": member.role}


@router.get("/audit-logs")
async def list_audit_logs(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    audit = AuditService(db)
    logs = await audit.list_for_user(current_user, limit=limit)
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details_json": log.details_json,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]
