# syntax=docker/dockerfile:1
# Build context = repo root:  docker build -f api/Dockerfile -t wc2026/api .
#
# SUPPLY-CHAIN: the base images below use mutable tags (node:22-bookworm-slim), which can
# silently change underneath us. For reproducible/verified builds, pin by digest, e.g.:
#   FROM node:22-bookworm-slim@sha256:<DIGEST> AS build
# Resolve the current digest with:  docker buildx imagetools inspect node:22-bookworm-slim
# (Left as a mutable tag here so a human can fill in the real, verified digest — no placeholder sha.)
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY . .
RUN npm ci \
 && npm run build --workspace @wc2026/shared \
 && npm run build:server --workspace @wc2026/api

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Only the self-contained bundles are needed at runtime.
COPY --from=build /repo/api/dist ./dist
USER 1000:1000
EXPOSE 4000
# Default command runs the API server; the sync CronJob overrides with ["node","dist/sync.cjs"].
CMD ["node", "dist/server.cjs"]
