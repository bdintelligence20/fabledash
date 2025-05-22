from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import logging
from dotenv import load_dotenv
from app.utils.supabase_client import get_supabase_client

# Import routers
from app.api.agents import router as agents_router
from app.api.chats import router as chats_router
from app.api.documents import router as documents_router
from app.api.clients import router as clients_router
from app.api.tasks import router as tasks_router

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase = get_supabase_client()

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
    allow_origins=[
        "https://fabledash-frontend-73351471156.us-central1.run.app",
        # Keep localhost for development
        "http://localhost:3000",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(agents_router, prefix="/agents", tags=["agents"])
app.include_router(chats_router, prefix="/chats", tags=["chats"])
app.include_router(documents_router, prefix="/documents", tags=["documents"])
app.include_router(clients_router, prefix="/clients", tags=["clients"])
app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
# Add direct route for task-statuses that the frontend is trying to access
@app.get("/task-statuses", tags=["task-statuses"])
async def get_task_statuses():
    """
    Get all task statuses - direct endpoint for frontend compatibility.
    """
    try:
        result = supabase.table("task_statuses").select("*").order("id").execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error fetching task statuses: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching task statuses: {result.error}")
        
        return {"success": True, "statuses": result.data}
    except Exception as e:
        logger.error(f"Error fetching task statuses: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
