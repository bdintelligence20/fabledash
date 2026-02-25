"""Authentication API endpoints for Firebase token verification and user management."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth
from pydantic import BaseModel

from app.dependencies.auth import get_current_user, require_ceo
from app.models.user import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter()


class SetRoleRequest(BaseModel):
    """Request body for setting a user's role."""

    uid: str
    role: str


@router.post("/verify")
async def verify_token(current_user: CurrentUser = Depends(get_current_user)):
    """Verify a Firebase ID token and return the authenticated user info.

    Accepts a Firebase ID token in the Authorization header (Bearer <token>).
    Returns the decoded user information if the token is valid.
    """
    return {
        "success": True,
        "user": {
            "uid": current_user.uid,
            "email": current_user.email,
            "display_name": current_user.display_name,
            "role": current_user.role.value,
        },
    }


@router.get("/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """Return the current authenticated user's info.

    Requires a valid Firebase ID token in the Authorization header.
    """
    return {
        "success": True,
        "user": {
            "uid": current_user.uid,
            "email": current_user.email,
            "display_name": current_user.display_name,
            "role": current_user.role.value,
        },
    }


@router.post("/set-role")
async def set_role(
    body: SetRoleRequest,
    current_user: CurrentUser = Depends(require_ceo),
):
    """Set a user's role (CEO-only endpoint).

    Updates the custom claims on the target user's Firebase account
    to include the specified role.
    """
    # Validate role value
    valid_roles = {"ceo", "team_member"}
    if body.role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{body.role}'. Must be one of: {', '.join(sorted(valid_roles))}",
        )

    try:
        # Get existing claims and merge with new role
        user_record = auth.get_user(body.uid)
        existing_claims = user_record.custom_claims or {}
        existing_claims["role"] = body.role
        auth.set_custom_user_claims(body.uid, existing_claims)
    except auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail=f"User {body.uid} not found")
    except Exception:
        logger.exception("Failed to set role for user %s", body.uid)
        raise HTTPException(status_code=500, detail="Failed to update user role")

    return {
        "success": True,
        "message": f"Role updated to '{body.role}' for user {body.uid}",
    }
