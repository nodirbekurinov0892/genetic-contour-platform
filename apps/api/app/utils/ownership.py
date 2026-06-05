import uuid

from fastapi import HTTPException, status


def ensure_owner(resource_user_id: uuid.UUID, current_user_id: uuid.UUID, resource_name: str) -> None:
    if resource_user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have access to this {resource_name}",
        )
