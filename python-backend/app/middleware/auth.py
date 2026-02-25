"""Authentication middleware reference and public path configuration.

Note: Authentication is enforced via FastAPI dependency injection (Depends(get_current_user))
on individual routes, NOT globally via middleware. This file provides the list of public
paths that don't require authentication, for reference by route-level guards.
"""

# Paths that do not require authentication
PUBLIC_PATHS: list[str] = [
    "/",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
]
