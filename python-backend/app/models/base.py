from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

class BaseResponse(BaseModel):
    """Base response model for all API responses."""
    success: bool = True
    message: Optional[str] = None

class ErrorResponse(BaseResponse):
    """Error response model."""
    success: bool = False
    message: str
    error: Optional[str] = None

class PaginatedResponse(BaseResponse):
    """Paginated response model."""
    total: int
    page: int
    page_size: int
    has_more: bool
