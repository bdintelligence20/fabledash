"""Health & vitality report API endpoints.

Provides four report types:
  - /operational-efficiency — utilization, time allocation, saturation, productivity
  - /financial-performance — revenue growth, cost/benefit, cash position
  - /process-quality — task completion, overdue rate, meeting actions, time consistency
  - /health — full combined health & vitality report
"""

import logging

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.models.base import ErrorResponse
from app.models.user import CurrentUser
from app.utils.report_engine import get_report_engine

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/operational-efficiency", response_model=None)
async def get_operational_efficiency(
    user: CurrentUser = Depends(get_current_user),
    period_start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    period_end: str = Query(..., description="End date (YYYY-MM-DD)"),
):
    """Operational efficiency report: utilization, time allocation, saturation, productivity."""
    try:
        engine = get_report_engine()
        data = await engine.operational_efficiency(period_start, period_end)
        if "error" in data:
            return ErrorResponse(error=data["error"]).model_dump()
        return {"success": True, "data": data}
    except Exception:
        logger.exception("Failed to generate operational efficiency report")
        return ErrorResponse(error="Failed to generate operational efficiency report").model_dump()


@router.get("/financial-performance", response_model=None)
async def get_financial_performance(
    user: CurrentUser = Depends(get_current_user),
    period_start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    period_end: str = Query(..., description="End date (YYYY-MM-DD)"),
):
    """Financial performance report: revenue growth, cost/benefit, cash position."""
    try:
        engine = get_report_engine()
        data = await engine.financial_performance(period_start, period_end)
        if "error" in data:
            return ErrorResponse(error=data["error"]).model_dump()
        return {"success": True, "data": data}
    except Exception:
        logger.exception("Failed to generate financial performance report")
        return ErrorResponse(error="Failed to generate financial performance report").model_dump()


@router.get("/process-quality", response_model=None)
async def get_process_quality(
    user: CurrentUser = Depends(get_current_user),
    period_start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    period_end: str = Query(..., description="End date (YYYY-MM-DD)"),
):
    """Process quality report: task completion, overdue rate, meeting actions, time consistency."""
    try:
        engine = get_report_engine()
        data = await engine.process_quality(period_start, period_end)
        if "error" in data:
            return ErrorResponse(error=data["error"]).model_dump()
        return {"success": True, "data": data}
    except Exception:
        logger.exception("Failed to generate process quality report")
        return ErrorResponse(error="Failed to generate process quality report").model_dump()


@router.get("/health", response_model=None)
async def get_health_report(
    user: CurrentUser = Depends(get_current_user),
    period_start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    period_end: str = Query(..., description="End date (YYYY-MM-DD)"),
):
    """Full health & vitality report combining operational, financial, and process quality."""
    try:
        engine = get_report_engine()
        data = await engine.full_health_report(period_start, period_end)
        if "error" in data:
            return ErrorResponse(error=data["error"]).model_dump()
        return {"success": True, "data": data}
    except Exception:
        logger.exception("Failed to generate health report")
        return ErrorResponse(error="Failed to generate health report").model_dump()
