FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    tesseract-ocr \
    poppler-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 8080

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Run the application
# Add --forwarded-allow-ips="*" to Gunicorn command to pass to Uvicorn workers.
# This allows Uvicorn to trust X-Forwarded-Proto and X-Forwarded-For headers
# from any proxy (like Google Cloud Run's frontend).
# The proxy_headers setting in Uvicorn is typically enabled by default when forwarded_allow_ips is set.
CMD ["gunicorn", "app.main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8080", "--forwarded-allow-ips=*"]
