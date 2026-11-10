# ====================================================================
# Multi-stage production-grade Dockerfile for E-Commerce Platform API
# Optimized for minimal attack surface, security hardening, and reproducibility
# ====================================================================

# Stage 1: Dependency builder
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies if needed
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# ====================================================================
# Stage 2: Production runtime image
# ====================================================================
FROM node:20-alpine AS runner

# Install dumb-init for PID 1 signal forwarding and wget for healthchecks
RUN apk add --no-cache dumb-init wget && \
    rm -rf /var/cache/apk/*

WORKDIR /usr/src/app

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=1.0.0

# Copy node_modules from builder stage
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules

# Copy application source code with non-root ownership
COPY --chown=node:node package.json ./
COPY --chown=node:node server.js ./
COPY --chown=node:node src/ ./src/

# Switch to unprivileged non-root user
USER node

# Expose internal API port
EXPOSE 3000

# Docker healthcheck probe targeting internal liveness endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

# Process supervisor
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Container execution command
CMD ["node", "server.js"]
