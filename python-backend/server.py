import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get port from environment variable or use default
PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")

if __name__ == "__main__":
    print(f"Starting FableDash API server on {HOST}:{PORT}")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
