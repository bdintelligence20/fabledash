"""Base response models for consistent API responses."""

from pydantic import BaseModel


class BaseResponse(BaseModel):
    """Base response model for all API responses."""

    success: bool
    message: str | None = None


class ErrorResponse(BaseModel):
    """Structured error response model."""

    success: bool = False
    error: str
    detail: str | None = None
