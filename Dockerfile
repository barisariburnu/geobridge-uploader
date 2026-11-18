# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

COPY --from=builder /app/src/lib/monitoring.cjs ./src/lib/monitoring.cjs
COPY --from=builder /app/scripts/monitoring-check.mjs ./scripts/monitoring-check.mjs
COPY --from=builder /app/node_modules/@sentry ./node_modules/@sentry
EXPOSE 3000
CMD ["node", "server.js"]

# Immutable runtime identity is added after expensive install/build layers.
ARG MONITORING_SOURCE_REVISION
RUN test "${#MONITORING_SOURCE_REVISION}" -eq 40 && case "$MONITORING_SOURCE_REVISION" in *[!0-9a-f]*) exit 35 ;; esac
ENV SENTRY_RELEASE=geobridge-uploader@${MONITORING_SOURCE_REVISION}
LABEL org.opencontainers.image.revision="${MONITORING_SOURCE_REVISION}"
