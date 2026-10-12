# ============================================================
# TRUSTGOV PRODUCTION MULTI-STAGE DOCKERFILE
# Runs non-root, minimal attack surface, zero baked secrets
# ============================================================

# Stage 1: Build Backend & Frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy root and package manifests
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY blockchain/package*.json ./blockchain/

# Install dependencies
RUN cd backend && npm ci
RUN cd frontend && npm ci

# Copy source trees
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build backend and frontend
RUN cd backend && npm run build
RUN cd frontend && npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies for backend
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled backend output from builder
COPY --from=builder /app/backend/dist ./dist
# Copy built static frontend assets for static serving
COPY --from=builder /app/frontend/dist ./public-frontend

# Create non-root user and secure directories
RUN mkdir -p /app/storage/evidence && \
    chown -R node:node /app

# Switch to non-root execution
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server.js"]
