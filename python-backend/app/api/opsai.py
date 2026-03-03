"""OpsAI conversational API — ask questions, get suggested queries, check status.

Includes proactive intelligence alert endpoints (plan 10-02).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies.auth import get_current_user, require_ceo
from app.models.base import ErrorResponse
from app.models.user import CurrentUser
from app.utils.firebase_client import get_firestore_client
from app.utils.opsai_engine import get_opsai_engine
from app.utils.proactive_engine import ProactiveEngine

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class AskRequest(BaseModel):
    """Request body for POST /ask."""

    question: str


class AskResponse(BaseModel):
    """Response body for POST /ask."""

    answer: str
    sources: list[str] = []
    tools_used: list[str] = []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/ask", response_model=dict)
async def ask_opsai(
    body: AskRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Ask OpsAI a natural-language question about business operations.

    The engine uses Gemini function calling to select the right data sources,
    queries Firestore, and returns a conversational answer.
    """
    if not body.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty")

    try:
        engine = get_opsai_engine()

        if not engine.openai_configured:
            raise HTTPException(
                status_code=503,
                detail="OpsAI is unavailable — Gemini API key not configured",
            )

        result = await engine.ask(body.question.strip())

        return {
            "success": True,
            "data": AskResponse(
                answer=result["answer"],
                sources=result.get("data_sources", []),
                tools_used=result.get("query_tools_used", []),
            ).model_dump(),
        }
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("OpsAI ask failed")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="OpsAI query failed", detail=str(e)).model_dump(),
        )


@router.get("/suggested-questions", response_model=dict)
async def suggested_questions(
    user: CurrentUser = Depends(get_current_user),
):
    """Return a curated list of example questions the CEO might ask OpsAI."""
    questions = [
        "What's our team utilization this month?",
        "Show me revenue for the current quarter.",
        "Which clients are generating the most revenue?",
        "Are there any overdue tasks I should know about?",
        "What meetings do we have this week?",
        "What's our current cash position?",
        "How many hours did we log for [client name] last month?",
        "Give me a summary of our top 5 clients by hours.",
        "What's the status of our accounts receivable?",
        "Which tasks are blocked or at risk?",
        "How does our P&L look this month?",
        "What does our revenue forecast say for the next 90 days?",
        "What's our time allocation across partner groups?",
        "Which agents are currently active?",
        "What files do we have in Drive for [client name]?",
        "How many emails have we sent this week?",
    ]
    return {"success": True, "data": questions}


@router.get("/status", response_model=dict)
async def opsai_status(
    user: CurrentUser = Depends(get_current_user),
):
    """Return OpsAI system status — AI configuration and available data sources."""
    try:
        engine = get_opsai_engine()
        return {
            "success": True,
            "data": {
                "configured": engine.openai_configured,
                "ai_provider": "google-gemini",
                "data_sources": [
                    "time_logs",
                    "financial_snapshots",
                    "invoices",
                    "pnl_uploads",
                    "revenue_forecasts",
                    "clients",
                    "tasks",
                    "meetings",
                    "agents",
                    "documents",
                    "google_calendar",
                    "gmail",
                    "google_drive",
                ],
                "available_tools": [
                    "get_utilization",
                    "get_revenue",
                    "get_pnl_data",
                    "get_revenue_forecast",
                    "get_client_info",
                    "get_recent_meetings",
                    "get_overdue_tasks",
                    "get_task_overview",
                    "get_cash_position",
                    "get_top_clients",
                    "get_partner_group_allocation",
                    "get_agent_status",
                    "search_documents",
                    "get_upcoming_calendar_events",
                    "get_email_stats",
                    "get_client_emails",
                    "get_drive_files",
                    "get_client_drive_files",
                ],
            },
        }
    except Exception as e:
        logger.exception("OpsAI status check failed")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(error="OpsAI status check failed", detail=str(e)).model_dump(),
        )


# ---------------------------------------------------------------------------
# Proactive intelligence alert schemas (plan 10-02)
# ---------------------------------------------------------------------------


class AlertConfigRequest(BaseModel):
    """Request body for POST /alerts/configure.

    All fields optional — only provided fields are updated.
    """

    over_servicing_zar_hr_min: float | None = None
    over_servicing_hours_min: float | None = None
    utilization_drop_pct: float | None = None
    cash_warning_level: float | None = None
    ar_warning_level: float | None = None
    ap_due_days: int | None = None
    scope_creep_hours_multiplier: float | None = None
    scope_creep_min_logs: int | None = None
    deadline_risk_days: int | None = None


# ---------------------------------------------------------------------------
# Helper: build ProactiveEngine
# ---------------------------------------------------------------------------


def _get_proactive_engine() -> ProactiveEngine:
    """Create a ProactiveEngine with Firestore and optional Gemini model."""
    db = get_firestore_client()

    gemini_model = None
    try:
        from app.utils.openai_client import get_ai_client

        gemini_model = get_ai_client()
    except Exception:
        logger.warning("Gemini client unavailable — alert summaries will use fallback")

    return ProactiveEngine(db=db, gemini_model=gemini_model)


# ---------------------------------------------------------------------------
# Proactive alert endpoints (plan 10-02)
# ---------------------------------------------------------------------------


@router.get("/alerts", response_model=dict)
async def get_alerts(
    user: CurrentUser = Depends(get_current_user),
):
    """Run all proactive intelligence checks and return alerts.

    Analyses time logs, financial snapshots, tasks, and clients to detect:
    - Over-servicing (high hours, low ZAR/Hr)
    - Utilization drops (current week vs 4-week average)
    - Cash position issues (low cash, high AR, AP due)
    - Scope creep (tasks with excessive time logs)
    - Deadline risks (approaching/overdue tasks)
    """
    try:
        engine = _get_proactive_engine()
        result = await engine.run_all_checks()
        return {"success": True, "data": result}
    except Exception as e:
        logger.exception("Proactive alerts check failed")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to run proactive alerts",
                detail=str(e),
            ).model_dump(),
        )


@router.get("/alerts/summary", response_model=dict)
async def get_alerts_summary(
    user: CurrentUser = Depends(get_current_user),
):
    """Run all proactive checks and generate an AI-powered executive summary.

    Returns the full alert list plus a natural-language briefing
    suitable for the CEO dashboard.
    """
    try:
        engine = _get_proactive_engine()
        result = await engine.run_all_checks()
        insight = await engine.generate_insight_summary(result["alerts"])
        return {
            "success": True,
            "data": {
                **result,
                "insight": insight,
            },
        }
    except Exception as e:
        logger.exception("Proactive alerts summary failed")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to generate alert summary",
                detail=str(e),
            ).model_dump(),
        )


@router.post(
    "/alerts/configure",
    response_model=dict,
    dependencies=[Depends(require_ceo)],
)
async def configure_alerts(
    body: AlertConfigRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Update proactive alert thresholds (CEO only).

    Saves provided threshold overrides to Firestore ``opsai_config/thresholds``.
    Only non-null fields are written; existing values for other fields are preserved.
    """
    try:
        db = get_firestore_client()
        updates = body.model_dump(exclude_none=True)

        if not updates:
            raise HTTPException(status_code=422, detail="No threshold values provided")

        updates["updated_by"] = user.uid
        from datetime import datetime

        updates["updated_at"] = datetime.utcnow().isoformat()

        doc_ref = db.collection("opsai_config").document("thresholds")
        doc_ref.set(updates, merge=True)

        # Return the full current config
        saved = doc_ref.get().to_dict()
        return {"success": True, "data": saved}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to configure alert thresholds")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Failed to save alert configuration",
                detail=str(e),
            ).model_dump(),
        )
