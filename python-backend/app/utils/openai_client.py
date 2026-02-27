"""AI client module — uses Google Gemini (google-generativeai SDK).

Maintains the same function names for backwards compatibility with modules
that import from ``app.utils.openai_client``.
"""

import os
import logging

import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Get Gemini API key from environment variables (fallback chain)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY") or ""

# Default model name
GEMINI_MODEL = "gemini-2.5-flash"

gemini_model = None

if not GEMINI_API_KEY:
    logger.warning("Gemini API key not found — AI features will be unavailable")
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel(GEMINI_MODEL)
        logger.info("Google Gemini client created successfully (model: %s)", GEMINI_MODEL)
    except Exception as e:
        logger.error(f"Error creating Gemini client: {e}")


def get_openai_client():
    """Returns the Gemini GenerativeModel instance, or None if not configured.

    Kept as ``get_openai_client`` for backwards compatibility with existing imports.
    """
    return gemini_model


def get_ai_client():
    """Returns the Gemini GenerativeModel instance, or None if not configured."""
    return gemini_model


def get_embedding_model():
    """Returns the embedding model name for use with genai.embed_content()."""
    if not GEMINI_API_KEY:
        return None
    return "models/text-embedding-004"


async def safe_api_call(api_call, fallback_message=None):
    """Safely calls an AI API function and handles errors gracefully.

    Args:
        api_call: A callable that makes an API request.
        fallback_message: A message to return if the API call fails.

    Returns:
        The result of the API call, or a fallback response if the call fails.
    """
    try:
        return await api_call()
    except Exception as e:
        logger.error(f"API call error: {e}")
        return fallback_message or "I encountered an error processing your request. Please try again later."
