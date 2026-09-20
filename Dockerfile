# ============================================================================
# Multi-stage Dockerfile for Next.js Web Application
# ============================================================================
# Stages:
# 1. base: Node 22 Alpine with libc6-compat for sharp native binaries.
# 2. deps: Clean reproducible dependency installation via npm ci.
# 3. builder: Production Next.js compilation with telemetry disabled.
# 4. runner: Minimal unprivileged runtime image executing as 'nextjs' user.
# ============================================================================

FROM node:22-alpine AS base

# Install libc6-compat required for Sharp native binary compatibility on Alpine Linux
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Step 1: Install production and dev dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Step 2: Compile the Next.js application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry and set production mode during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Step 3: Minimal unprivileged production runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user for security isolation
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
