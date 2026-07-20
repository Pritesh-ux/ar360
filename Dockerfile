# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV SKIP_RUNTIME_DDL=true
RUN npm run build

FROM base AS runner
ARG APP_UID=1001
ARG APP_GID=1001
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid "${APP_GID}" nodejs \
    && adduser --system --uid "${APP_UID}" --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/database ./database
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json

RUN mkdir -p storage/Customers storage/private/object-capture \
    && chown -R nextjs:nodejs storage public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
