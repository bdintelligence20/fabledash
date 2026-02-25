"""Sage Business Cloud Accounting API client with OAuth2 token management."""

import logging
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.models.financial import SAGE_CREDENTIALS_COLLECTION, SageCredentials
from app.utils.firebase_client import get_firestore_client

logger = logging.getLogger(__name__)

# Sage OAuth2 endpoints
SAGE_AUTH_URL = "https://www.sageone.com/oauth2/auth/central"
SAGE_TOKEN_URL = "https://oauth.accounting.sage.com/token"

_sage_client: "SageClient | None" = None


class SageClient:
    """Async client for Sage Business Cloud Accounting API.

    Handles OAuth2 token lifecycle (exchange, refresh, auto-retry on 401)
    and provides convenience methods for GET requests with pagination.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.SAGE_API_BASE_URL
        self.http = httpx.AsyncClient(timeout=30.0)

    # --- Credential management ---

    async def get_credentials(self) -> SageCredentials | None:
        """Read the current Sage OAuth2 credentials from Firestore.

        Returns:
            SageCredentials if a stored credential document exists, else None.
        """
        try:
            db = get_firestore_client()
            doc = db.collection(SAGE_CREDENTIALS_COLLECTION).document("current").get()
            if doc.exists:
                return SageCredentials(**doc.to_dict())
            return None
        except Exception:
            logger.exception("Failed to read Sage credentials from Firestore")
            return None

    async def save_credentials(self, creds: SageCredentials) -> None:
        """Persist Sage OAuth2 credentials to Firestore."""
        try:
            db = get_firestore_client()
            db.collection(SAGE_CREDENTIALS_COLLECTION).document("current").set(
                creds.model_dump()
            )
            logger.info("Sage credentials saved to Firestore")
        except Exception:
            logger.exception("Failed to save Sage credentials to Firestore")
            raise

    async def refresh_token(self) -> SageCredentials:
        """Refresh the Sage access token using the stored refresh token.

        Returns:
            Updated SageCredentials with new access/refresh tokens.

        Raises:
            RuntimeError: If no credentials exist or the refresh request fails.
        """
        creds = await self.get_credentials()
        if not creds:
            raise RuntimeError("No Sage credentials to refresh")

        response = await self.http.post(
            SAGE_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": creds.refresh_token,
                "client_id": self.settings.SAGE_CLIENT_ID,
                "client_secret": self.settings.SAGE_CLIENT_SECRET,
            },
        )

        if response.status_code != 200:
            logger.error("Sage token refresh failed: %s %s", response.status_code, response.text)
            raise RuntimeError(f"Sage token refresh failed: {response.status_code}")

        data = response.json()
        now = datetime.now(timezone.utc)

        # Sage returns expires_in (seconds); calculate absolute expiry
        expires_in = data.get("expires_in", 3600)
        expires_at = datetime.fromtimestamp(
            now.timestamp() + expires_in, tz=timezone.utc
        ).isoformat()

        updated_creds = SageCredentials(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", creds.refresh_token),
            token_type=data.get("token_type", "Bearer"),
            expires_at=expires_at,
            scope=data.get("scope", creds.scope),
            updated_at=now.isoformat(),
        )

        await self.save_credentials(updated_creds)
        logger.info("Sage token refreshed successfully")
        return updated_creds

    async def _ensure_valid_token(self) -> str:
        """Return a valid access token, refreshing if expired.

        Returns:
            A valid access token string.

        Raises:
            RuntimeError: If no credentials exist.
        """
        creds = await self.get_credentials()
        if not creds:
            raise RuntimeError("Sage not connected — no credentials found")

        # Check if the token has expired (with 60-second buffer)
        try:
            expires_at = datetime.fromisoformat(creds.expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if now >= expires_at:
                logger.info("Sage token expired, refreshing...")
                creds = await self.refresh_token()
        except (ValueError, TypeError):
            logger.warning("Could not parse expires_at, refreshing token as precaution")
            creds = await self.refresh_token()

        return creds.access_token

    # --- API requests ---

    async def get(self, endpoint: str, params: dict | None = None) -> dict:
        """Make an authenticated GET request to the Sage API.

        Automatically retries once with a refreshed token on 401.

        Args:
            endpoint: API path relative to base URL (e.g. "/contacts").
            params: Optional query parameters.

        Returns:
            Parsed JSON response as a dict.
        """
        token = await self._ensure_valid_token()
        url = f"{self.base_url}{endpoint}"
        headers = {"Authorization": f"Bearer {token}"}

        response = await self.http.get(url, headers=headers, params=params)

        if response.status_code == 401:
            logger.info("Sage 401 — refreshing token and retrying")
            creds = await self.refresh_token()
            headers["Authorization"] = f"Bearer {creds.access_token}"
            response = await self.http.get(url, headers=headers, params=params)

        response.raise_for_status()
        return response.json()

    async def get_paginated(self, endpoint: str, params: dict | None = None) -> list[dict]:
        """Fetch all pages from a paginated Sage API endpoint.

        Sage uses a ``$next`` link in the response for pagination.

        Args:
            endpoint: API path relative to base URL.
            params: Optional query parameters.

        Returns:
            Combined list of items from all pages.
        """
        all_items: list[dict] = []
        url: str | None = f"{self.base_url}{endpoint}"
        token = await self._ensure_valid_token()
        headers = {"Authorization": f"Bearer {token}"}

        while url:
            response = await self.http.get(url, headers=headers, params=params)

            if response.status_code == 401:
                creds = await self.refresh_token()
                headers["Authorization"] = f"Bearer {creds.access_token}"
                response = await self.http.get(url, headers=headers, params=params)

            response.raise_for_status()
            data = response.json()

            # Sage wraps items in a $items key
            items = data.get("$items", data.get("items", []))
            all_items.extend(items)

            # Follow pagination link
            url = data.get("$next")
            # Clear params after first request since $next is a full URL
            params = None

        return all_items

    # --- OAuth2 flow ---

    async def exchange_code(self, code: str) -> SageCredentials:
        """Exchange an OAuth2 authorization code for access/refresh tokens.

        Args:
            code: The authorization code from Sage's OAuth2 redirect.

        Returns:
            SageCredentials with the new tokens.

        Raises:
            RuntimeError: If the token exchange request fails.
        """
        response = await self.http.post(
            SAGE_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": self.settings.SAGE_CLIENT_ID,
                "client_secret": self.settings.SAGE_CLIENT_SECRET,
                "redirect_uri": self.settings.SAGE_REDIRECT_URI,
            },
        )

        if response.status_code != 200:
            logger.error("Sage code exchange failed: %s %s", response.status_code, response.text)
            raise RuntimeError(f"Sage code exchange failed: {response.status_code}")

        data = response.json()
        now = datetime.now(timezone.utc)

        expires_in = data.get("expires_in", 3600)
        expires_at = datetime.fromtimestamp(
            now.timestamp() + expires_in, tz=timezone.utc
        ).isoformat()

        creds = SageCredentials(
            access_token=data["access_token"],
            refresh_token=data["refresh_token"],
            token_type=data.get("token_type", "Bearer"),
            expires_at=expires_at,
            scope=data.get("scope"),
            updated_at=now.isoformat(),
        )

        await self.save_credentials(creds)
        logger.info("Sage OAuth2 code exchanged and credentials saved")
        return creds

    def build_authorization_url(self) -> str:
        """Build the Sage OAuth2 authorization URL.

        Returns:
            Full authorization URL that the user should be redirected to.
        """
        params = {
            "response_type": "code",
            "client_id": self.settings.SAGE_CLIENT_ID,
            "redirect_uri": self.settings.SAGE_REDIRECT_URI,
            "scope": "full_access",
        }
        return f"{SAGE_AUTH_URL}?{urlencode(params)}"

    async def is_connected(self) -> bool:
        """Check whether valid Sage credentials exist.

        Returns:
            True if credentials are stored in Firestore, False otherwise.
        """
        creds = await self.get_credentials()
        return creds is not None


def get_sage_client() -> "SageClient":
    """Return a cached singleton SageClient instance."""
    global _sage_client
    if _sage_client is None:
        _sage_client = SageClient()
    return _sage_client
