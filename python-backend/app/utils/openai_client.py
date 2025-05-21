import os
from openai import OpenAI
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Get OpenAI API key from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    logger.error("OpenAI API key not found in environment variables")
    raise ValueError("OpenAI API key not found in environment variables")

# Create OpenAI client
try:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    logger.info("OpenAI client created successfully")
except Exception as e:
    logger.error(f"Error creating OpenAI client: {e}")
    raise

def get_openai_client() -> OpenAI:
    """
    Returns the OpenAI client instance.
    
    Returns:
        OpenAI: The OpenAI client instance.
    """
    return openai_client

async def safe_api_call(api_call, fallback_message=None):
    """
    Safely calls an OpenAI API function and handles errors gracefully.
    
    Args:
        api_call: A callable that makes an API request to OpenAI.
        fallback_message: A message to return if the API call fails.
        
    Returns:
        The result of the API call, or a fallback response if the call fails.
    """
    try:
        return await api_call()
    except Exception as e:
        logger.error(f"API call error: {e}")
        return {
            "choices": [{
                "message": {
                    "content": fallback_message or "I encountered an error processing your request. Please try again later."
                }
            }]
        }
