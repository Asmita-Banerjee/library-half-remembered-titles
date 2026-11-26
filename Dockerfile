# --- 1. frontend --------------------------------------------------------
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- 2. C engine ----------------------------------------------------------
FROM gcc:13 AS engine
WORKDIR /engine
COPY engine/ ./
RUN make && make test

# --- 3. runtime -------------------------------------------------------------
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=engine /engine/build/libtitlesearch.so engine/build/libtitlesearch.so
COPY --from=web /web/dist frontend/dist
ENV DATABASE_PATH=/app/backend/data/library.db PORT=8000
EXPOSE 8000
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
