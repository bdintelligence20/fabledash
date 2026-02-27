FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OCR/PDF processing
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    tesseract-ocr \
    poppler-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

EXPOSE 8080

# Gunicorn with Uvicorn workers -- forwarded-allow-ips for Cloud Run proxy headers
# Uses shell form so $PORT is expanded at runtime
CMD gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --forwarded-allow-ips=*
