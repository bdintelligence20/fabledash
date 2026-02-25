"""User models for authentication and authorization."""

from enum import Enum

from pydantic import BaseModel


class UserRole(str, Enum):
    """User roles for role-based access control."""

    CEO = "ceo"
    TEAM_MEMBER = "team_member"


class CurrentUser(BaseModel):
    """Authenticated user extracted from Firebase ID token."""

    uid: str
    email: str | None = None
    display_name: str | None = None
    role: UserRole = UserRole.TEAM_MEMBER
    custom_claims: dict | None = None
