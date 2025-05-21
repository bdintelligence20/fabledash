from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import logging
from dotenv import load_dotenv

# Import routers
from app.api.agents import router as agents_router
from app.api.chats import router as chats_router
from app.api.documents import router as documents_router
from app.api.clients import router as clients_router
from app.api.tasks import router as tasks_router

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="FableDash API",
    description="API for FableDash AI Agent System",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(agents_router, prefix="/api/agents", tags=["agents"])
app.include_router(chats_router, prefix="/api/chats", tags=["chats"])
app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(clients_router, prefix="/api/clients", tags=["clients"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])

# Root endpoint
@app.get("/", tags=["root"])
async def root():
    return {"message": "Welcome to FableDash API"}

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
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
