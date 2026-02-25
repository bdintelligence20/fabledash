"""Firebase Admin SDK initialization and Firestore client utility."""

import logging
import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

from app.config import get_settings

logger = logging.getLogger(__name__)

_db = None


def initialize_firebase() -> None:
    """Initialize Firebase Admin SDK.

    Credential resolution order:
    1. FIREBASE_CREDENTIALS_PATH if file exists -> Certificate credentials
    2. GOOGLE_APPLICATION_CREDENTIALS env var set -> Application Default Credentials
    3. No credentials -> default initialization (for GCP environments with ADC)
    """
    if firebase_admin._apps:
        logger.info("Firebase already initialized, skipping.")
        return

    settings = get_settings()
    cred_path = Path(settings.FIREBASE_CREDENTIALS_PATH)

    try:
        if cred_path.is_file():
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized with service account credentials from %s", cred_path)
        elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized with Application Default Credentials")
        else:
            firebase_admin.initialize_app()
            logger.info("Firebase initialized with default credentials (GCP environment)")
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
