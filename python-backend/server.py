"""FableDash API server entry point."""

import uvicorn

from app.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    print(f"Starting FableDash API server on {settings.HOST}:{settings.PORT}")
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
