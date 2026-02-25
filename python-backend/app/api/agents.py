from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def get_agents():
    """Placeholder - will be rebuilt with Firebase in Phase 2."""
    return {"status": "pending rebuild"}
