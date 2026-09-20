# Multi-stage Dockerfile for Next.js Web Application
FROM node:22-alpine AS base

# Install libc6-compat for sharp native binaries if needed
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Step 1: Install dependencies based on lockfile
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Step 2: Build the Next.js application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set dummy build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Step 3: Production runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
