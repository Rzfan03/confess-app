FROM node:20-slim

RUN apt-get update && apt-get install -y \
    chromium chromium-sandbox \
    build-essential python3 \
    libnss3 libnspr4 libatk-bridge2.0-0 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Frontend deps & build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npx astro build

# Backend source
COPY backend/ ./backend/

# Gabungin frontend build ke backend
RUN mkdir -p backend/public && cp -r frontend/dist/* backend/public/

ENV PORT=8080 \
    CHROME_PATH=/usr/bin/chromium

WORKDIR /app/backend
CMD ["node", "src/index.js"]
