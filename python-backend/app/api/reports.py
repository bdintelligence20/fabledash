"""Health & vitality report endpoints — operational efficiency, financial performance, process quality, comparisons."""

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_current_user
from app.models.user import CurrentUser
from app.utils.report_engine import ReportEngine
from app.utils.report_comparison import ReportComparison

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_engines() -> tuple[ReportEngine, ReportComparison]:
    """Instantiate report engine and comparison engine."""
    engine = ReportEngine()
    comparison = ReportComparison(engine)
    return engine, comparison


# --- Base report endpoints ---


@router.get("/operational-efficiency")
async def operational_efficiency(
    period_start: date = Query(..., description="Start of reporting period"),
    period_end: date = Query(..., description="End of reporting period"),
    user: CurrentUser = Depends(get_current_user),
):
    """Operational efficiency report — utilization, time allocation, saturation, productivity."""
    try:
        engine, _ = _get_engines()
        data = await engine.operational_efficiency(period_start, period_end)
        return {"success": True, "data": data}
    except Exception:
        logger.exception("Failed to generate operational efficiency report")
        return {"success": False, "error": "Failed to generate operational efficiency report"}


@router.get("/financial-performance")
async def financial_performance(
    period_start: date = Query(..., description="Start of reporting period"),
    period_end: date = Query(..., description="End of reporting period"),
    user: CurrentUser = Depends(get_current_user),
):
    """Financial performance report — revenue, expenses, profit, cost-benefit rankings."""
    try:
        engine, _ = _get_engines()
        data = await engine.financial_performance(period_start, period_end)
        return {"success": True, "data": data}
    except Exception:
        logger.exception("Failed to generate financial performance report")
        return {"success": False, "error": "Failed to generate financial performance report"}


@router.get("/process-quality")
async def process_quality(
    period_start: date = Query(..., description="Start of reporting period"),
    period_end: date = Query(..., description="End of reporting period"),
    user: CurrentUser = Depends(get_current_user),
):
    """Process quality report — task completion, overdue rates, time entry consistency."""
    try:
        engine, _ = _get_engines()
        data = await engine.process_quality(period_start, period_end)
        return {"success": True, "data": data}
    except Exception:
        logger.exception("Failed to generate process quality report")
        return {"success": False, "error": "Failed to generate process quality report"}


@router.get("/health")
async def full_health_report(
    period_start: date = Query(..., description="Start of reporting period"),
    period_end: date = Query(..., description="End of reporting period"),
    user: CurrentUser = Depends(get_current_user),
):
    """Full health & vitality report combining all three sections."""
    try:
        engine, _ = _get_engines()
        data = await engine.full_health_report(period_start, period_end)
        return {"success": True, "data": data}
    except Exception:
        logger.exception("Failed to generate full health report")
        return {"success": False, "error": "Failed to generate full health report"}


# --- Comparison endpoints ---


@router.get("/compare")
async def compare_periods(
    period_a_start: date = Query(..., description="Start of first period"),
    period_a_end: date = Query(..., description="End of first period"),
    period_b_start: date = Query(..., description="Start of second period"),
    period_b_end: date = Query(..., description="End of second period"),
    user: CurrentUser = Depends(get_current_user),
):
    """Compare two arbitrary periods — deltas, percentage changes, trend flags."""
    if period_a_start > period_a_end:
        raise HTTPException(status_code=400, detail="period_a_start must be before period_a_end")
    if period_b_start > period_b_end:
        raise HTTPException(status_code=400, detail="period_b_start must be before period_b_end")

    try:
        _, comparison = _get_engines()
        data = await comparison.compare_periods(
            period_a_start, period_a_end, period_b_start, period_b_end
        )
        return {"success": True, "data": data}
    except Exception:
        logger.exception("Failed to generate period comparison")
        return {"success": False, "error": "Failed to generate period comparison"}


@router.get("/quarterly")
async def quarterly_comparison(
    year: int = Query(..., description="Calendar year"),
    quarter_a: int = Query(..., ge=1, le=4, description="First quarter (1-4)"),
    quarter_b: int = Query(..., ge=1, le=4, description="Second quarter (1-4)"),
    user: CurrentUser = Depends(get_current_user),
):
    """Compare two quarters within a year — Q1 vs Q2, Q2 vs Q3, etc."""
    if quarter_a == quarter_b:
        raise HTTPException(status_code=400, detail="quarter_a and quarter_b must be different")

    try:
        _, comparison = _get_engines()
        data = await comparison.quarterly_comparison(year, quarter_a, quarter_b)
        return {"success": True, "data": data}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Failed to generate quarterly comparison")
        return {"success": False, "error": "Failed to generate quarterly comparison"}


@router.get("/ytd")
async def ytd_report(
    year: int = Query(default=None, description="Year for YTD report (defaults to current year)"),
    user: CurrentUser = Depends(get_current_user),
):
    """Year-to-date report compared with same period last year."""
    if year is None:
        year = date.today().year

    try:
        _, comparison = _get_engines()
        data = await comparison.ytd_report(year)
        return {"success": True, "data": data}
    except Exception:
        logger.exception("Failed to generate YTD report")
        return {"success": False, "error": "Failed to generate YTD report"}
