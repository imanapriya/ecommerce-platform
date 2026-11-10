# ====================================================================
# Multi-stage production-grade Dockerfile for E-Commerce Platform API
# Optimized for minimal attack surface, security hardening, and reproducibility
# ====================================================================

# Stage 1: Dependency builder
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# ====================================================================
# Stage 2: Production runtime image
# ====================================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init wget && \
    rm -rf /var/cache/apk/*

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=1.0.0

COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server.js ./
COPY --chown=node:node src/ ./src/

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
