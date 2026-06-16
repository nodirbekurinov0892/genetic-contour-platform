"""Organization and team workspace."""

from __future__ import annotations

import re
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.organization import Organization, TeamMember
from app.models.user import User

VALID_ROLES = ("admin", "researcher", "analyst", "viewer")


class TeamService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _slugify(name: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        return slug[:120] or "org"

    async def create_organization(self, user: User, name: str) -> Organization:
        slug = self._slugify(name)
        existing = await self.db.execute(select(Organization).where(Organization.slug == slug))
        if existing.scalar_one_or_none():
            slug = f"{slug}-{uuid.uuid4().hex[:6]}"
        org = Organization(id=uuid.uuid4(), name=name, slug=slug, owner_id=user.id)
        self.db.add(org)
        await self.db.flush()
        self.db.add(
            TeamMember(
                id=uuid.uuid4(),
                organization_id=org.id,
                user_id=user.id,
                role="admin",
            )
        )
        await self.db.flush()
        return org

    async def list_for_user(self, user: User) -> list[Organization]:
        result = await self.db.execute(
            select(Organization)
            .join(TeamMember, TeamMember.organization_id == Organization.id)
            .where(TeamMember.user_id == user.id)
            .options(selectinload(Organization.members))
        )
        return list(result.scalars().unique().all())

    async def add_member(
        self, org_id: uuid.UUID, owner: User, member_email: str, role: str = "researcher"
    ) -> TeamMember:
        if role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        org = await self.db.get(Organization, org_id)
        if not org or org.owner_id != owner.id:
            raise HTTPException(status_code=404, detail="Organization not found")
        member_result = await self.db.execute(select(User).where(User.email == member_email))
        member = member_result.scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=404, detail="User not found")
        entry = TeamMember(
            id=uuid.uuid4(),
            organization_id=org.id,
            user_id=member.id,
            role=role,
        )
        self.db.add(entry)
        await self.db.flush()
        return entry
