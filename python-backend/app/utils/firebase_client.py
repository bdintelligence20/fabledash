"""Firebase Admin SDK initialization and Firestore client utility."""

import base64
import json
import logging
import os
import tempfile
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

from app.config import get_settings

logger = logging.getLogger(__name__)

_db = None


def _resolve_credentials_path(settings) -> Path:
    """Resolve Firebase credentials, decoding from env var if needed.

    If FIREBASE_CREDENTIALS_JSON (base64) is set and the credentials
    file doesn't exist on disk, decode it and write to a temp file.
    """
    cred_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
    if cred_path.is_file():
        return cred_path

    b64_json = os.environ.get("FIREBASE_CREDENTIALS_JSON", "")
    if b64_json:
        try:
            decoded = base64.b64decode(b64_json)
            json.loads(decoded)  # validate it's real JSON
            cred_path.parent.mkdir(parents=True, exist_ok=True)
            cred_path.write_bytes(decoded)
            logger.info("Decoded FIREBASE_CREDENTIALS_JSON to %s", cred_path)
            return cred_path
        except Exception:
            logger.exception("Failed to decode FIREBASE_CREDENTIALS_JSON")

    return cred_path


def initialize_firebase() -> None:
    """Initialize Firebase Admin SDK.

    Credential resolution order:
    1. FIREBASE_CREDENTIALS_PATH / FIREBASE_CREDENTIALS_JSON -> Certificate
    2. GOOGLE_APPLICATION_CREDENTIALS env var -> Application Default Credentials
    3. No credentials -> default initialization (for GCP environments with ADC)
    """
    if firebase_admin._apps:
        logger.info("Firebase already initialized, skipping.")
        return

    settings = get_settings()
    cred_path = _resolve_credentials_path(settings)

    try:
        options = {}
        if settings.FIREBASE_PROJECT_ID:
            options["projectId"] = settings.FIREBASE_PROJECT_ID

        if cred_path.is_file():
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred, options=options or None)
            logger.info("Firebase initialized with service account credentials from %s", cred_path)
        elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, options=options or None)
            logger.info("Firebase initialized with Application Default Credentials")
        else:
            firebase_admin.initialize_app(options=options or None)
            logger.info("Firebase initialized with default credentials (GCP environment, project=%s)", settings.FIREBASE_PROJECT_ID)
    except Exception:
        logger.exception("Failed to initialize Firebase Admin SDK")
        raise


def get_firestore_client() -> firestore.firestore.Client:
    """Get the Firestore client, initializing Firebase if needed.

    Returns:
        Firestore client instance.
    """
    global _db
    if _db is None:
        if not firebase_admin._apps:
            initialize_firebase()
        _db = firestore.client()
        logger.info("Firestore client created")
    return _db
