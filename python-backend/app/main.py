from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import logging
from dotenv import load_dotenv

# Import routers (commented out - will be rebuilt in Phase 2)
# from app.api.agents import router as agents_router
# from app.api.chats import router as chats_router
# from app.api.documents import router as documents_router
# from app.api.clients import router as clients_router
# from app.api.tasks import router as tasks_router

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="FableDash API",
    description="API for FableDash AI Agent System",
    version="2.0.0",
)

# Configure CORS
cors_origins_str = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
)
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]

logger.info(f"CORS origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router includes commented out - will be rebuilt with Firebase in Phase 2
# app.include_router(agents_router, prefix="/agents", tags=["agents"])
# app.include_router(chats_router, prefix="/chats", tags=["chats"])
# app.include_router(documents_router, prefix="/documents", tags=["documents"])
# app.include_router(clients_router, prefix="/clients", tags=["clients"])
# app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])


# Root endpoint
@app.get("/", tags=["root"])
async def root():
    return {"message": "Welcome to FableDash API", "version": "2.0.0"}


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "healthy"}


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
