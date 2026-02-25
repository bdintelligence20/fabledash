"""Authentication dependencies for FastAPI dependency injection."""

import logging

from fastapi import Depends, HTTPException, Request
from firebase_admin import auth

from app.models.user import CurrentUser, UserRole

logger = logging.getLogger(__name__)


async def get_current_user(request: Request) -> CurrentUser:
    """Extract and verify Firebase ID token from Authorization header.

    Usage:
        @router.get("/protected")
        async def protected_route(user: CurrentUser = Depends(get_current_user)):
            return {"uid": user.uid}
    """
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        decoded_token = auth.verify_id_token(token)
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except auth.RevokedIdTokenError:
        raise HTTPException(status_code=401, detail="Token revoked")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    except Exception:
        logger.exception("Unexpected error verifying Firebase token")
        raise HTTPException(status_code=401, detail="Authentication failed")

    # Extract user info from decoded token
    uid = decoded_token.get("uid", "")
    email = decoded_token.get("email")
    display_name = decoded_token.get("name")
    custom_claims = {
        k: v
        for k, v in decoded_token.items()
        if k not in {"uid", "email", "name", "iss", "aud", "auth_time", "sub", "iat", "exp", "firebase"}
    }

    # Determine role from custom claims (default to team_member)
    role_value = decoded_token.get("role", UserRole.TEAM_MEMBER.value)
    try:
        role = UserRole(role_value)
    except ValueError:
        role = UserRole.TEAM_MEMBER

    return CurrentUser(
        uid=uid,
        email=email,
        display_name=display_name,
        role=role,
        custom_claims=custom_claims if custom_claims else None,
    )


def require_role(role: UserRole):
    """Dependency factory that checks if the current user has the required role.

    Usage:
        @router.post("/admin-only", dependencies=[Depends(require_role(UserRole.CEO))])
        async def admin_route():
            ...
    """

    async def _check_role(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role != role:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return _check_role


# Convenience shortcut for CEO-only endpoints
require_ceo = require_role(UserRole.CEO)
