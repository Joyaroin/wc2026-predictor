# syntax=docker/dockerfile:1
# Build context = repo root:  docker build -f web/Dockerfile -t wc2026/web --build-arg VITE_API_URL="" .
#
# SUPPLY-CHAIN: the base images (node:22-bookworm-slim and nginxinc/nginx-unprivileged below)
# use mutable tags. For reproducible/verified builds, pin by digest, e.g.:
#   FROM node:22-bookworm-slim@sha256:<DIGEST> AS build
# Resolve with:  docker buildx imagetools inspect node:22-bookworm-slim
# (Left as mutable tags here so a human can fill in the real, verified digests — no placeholder sha.)
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY . .
# Empty API URL => the SPA calls /api/* same-origin (ingress routes it to the API service).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm ci \
 && npm run build --workspace @wc2026/shared \
 && npm run build --workspace @wc2026/web

# Unprivileged nginx listens on 8080 as a non-root user (SECURITY-09).
# SUPPLY-CHAIN: pin by digest for reproducibility, e.g.
#   FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:<DIGEST> AS runtime
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/web/dist /usr/share/nginx/html
EXPOSE 8080
