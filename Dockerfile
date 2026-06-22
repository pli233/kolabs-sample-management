# Multi-stage build: build the SPA, then serve it + the API from one Python image.

# --- Stage 1: build frontend ---
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: backend + static SPA ---
FROM python:3.12-slim AS runtime
WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Persistent volume mount point (configure on the host platform).
ENV UPLOAD_DIR=/data/uploads \
    DB_URL=sqlite:////data/app.db
RUN mkdir -p /data/uploads

WORKDIR /app/backend
EXPOSE 8000
# Railway/Render provide $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
