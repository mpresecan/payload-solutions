# Production image for container hosts (Railway, Fly.io, Render, a VPS). Vercel does not use it.
#
# The build needs no secrets and no database: set DATABASE_URL, PAYLOAD_SECRET and the rest of
# .env.example on the host, at runtime. The public NEXT_PUBLIC_* values are the exception (below). Uploads on local disk do not survive a redeploy, so pick a
# storage adapter (S3, R2, ...) before you go live.
#
# Package manager: pnpm, npm or yarn, chosen by the lockfile. Corepack installs the exact pnpm or
# yarn version pinned in package.json's packageManager field.

FROM node:22.17.0-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* .npmrc* .yarnrc* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else echo "No lockfile found: install once locally and commit the lockfile." && exit 1; fi

FROM base AS builder
# NEXT_PUBLIC_* values are compiled into the browser bundle and the stack config, so they must be
# known at build time (Railway passes the service variables a Dockerfile declares as ARG). Public
# values only: secrets stay runtime variables and never become build arguments.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY
ARG NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY
ARG NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY
ARG NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN if [ -f pnpm-lock.yaml ]; then pnpm run build; \
    elif [ -f yarn.lock ]; then yarn run build; \
    else npm run build; fi

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
