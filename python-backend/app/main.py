"""FableDash API - CEO Operations Intelligence Hub."""

import logging
import time
from contextlib import asynccontextmanager

import firebase_admin
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api.auth import router as auth_router
from app.api.clients import router as clients_router
from app.api.tasks import router as tasks_router
from app.api.time_logs import router as time_logs_router
from app.config import get_settings
from app.utils.firebase_client import initialize_firebase

settings = get_settings()

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# --- Lifespan ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize services on startup, cleanup on shutdown."""
    logger.info("Starting FableDash API...")
    try:
        initialize_firebase()
        logger.info("Firebase initialized successfully")
    except Exception:
        logger.exception("Firebase initialization failed - continuing without Firebase")
    yield
    logger.info("Shutting down FableDash API...")


# --- App ---

app = FastAPI(
    title="FableDash API",
    description="CEO Operations Intelligence Hub",
    version="2.0.0",
    lifespan=lifespan,
)

# --- Middleware ---

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Proxy headers for GCP / reverse-proxy deployments
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log every request with method, path, status code, and duration."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %d (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# --- Router includes ---
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(clients_router, prefix="/clients", tags=["clients"])
app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
app.include_router(time_logs_router, prefix="/time-logs", tags=["time-logs"])

# Placeholder routers (will be rebuilt in later phases)
# from app.api.agents import router as agents_router
# from app.api.chats import router as chats_router
# from app.api.documents import router as documents_router
# app.include_router(agents_router, prefix="/agents", tags=["agents"])
# app.include_router(chats_router, prefix="/chats", tags=["chats"])
# app.include_router(documents_router, prefix="/documents", tags=["documents"])


# --- Routes ---


@app.get("/", tags=["root"])
async def root():
    """Root endpoint returning API info."""
    return {
        "name": "FableDash API",
        "version": "2.0.0",
        "status": "operational",
    }


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint with Firebase connection status."""
    return {
        "status": "healthy",
        "firebase": bool(firebase_admin._apps),
    }


# --- Exception handling ---


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Return structured error response for all unhandled exceptions."""
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc),
        },
    )
