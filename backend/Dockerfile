# Use official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies (needed for psycopg2 compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file
COPY requirements.txt .

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose backend port (default; Render overrides via $PORT at runtime)
EXPOSE 5000

# Start backend server with gunicorn (production WSGI server)
# Uses shell form so $PORT env var (set by Render) is expanded at runtime
CMD gunicorn app:app --bind 0.0.0.0:${PORT:-5000}
