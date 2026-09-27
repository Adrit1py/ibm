FROM python:3.11-slim

WORKDIR /app


ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code and shared schema/types
COPY core/ /app/core/
COPY shared/ /app/shared/
COPY schemas/ /app/schemas/

EXPOSE 8000

# Bind to 0.0.0.0 and dynamically use $PORT provided by the cloud host
CMD ["sh", "-c", "uvicorn core.engine.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
