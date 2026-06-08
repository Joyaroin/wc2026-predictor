# syntax=docker/dockerfile:1
# Build context = repo root:  docker build -f api/Dockerfile -t wc2026/api .
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
USER node
EXPOSE 4000
# Default command runs the API server; the sync CronJob overrides with ["node","dist/sync.cjs"].
CMD ["node", "dist/server.cjs"]
