import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Get Supabase credentials from environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Supabase credentials not found in environment variables")
    raise ValueError("Supabase credentials not found in environment variables")

# Create Supabase client
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("Supabase client created successfully")
except Exception as e:
    logger.error(f"Error creating Supabase client: {e}")
    raise

def get_supabase_client() -> Client:
    """
    Returns the Supabase client instance.
    
    Returns:
        Client: The Supabase client instance.
    """
    return supabase
