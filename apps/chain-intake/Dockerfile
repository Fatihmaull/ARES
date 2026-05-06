# syntax=docker/dockerfile:1.7
# Render/Fly-friendly Dockerfile for apps/chain-intake (monorepo workspace build).
#
# We run from the repo root so pnpm can resolve workspace deps like
# @ares/observability and keep --frozen-lockfile installs reproducible.

FROM node:22-bookworm-slim AS base
WORKDIR /repo

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace manifests first for layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/observability/package.json packages/observability/
COPY apps/chain-intake/package.json apps/chain-intake/

# Install chain-intake and its workspace deps.
RUN pnpm install --frozen-lockfile --filter=@asst/chain-intake...

# Bring in sources.
COPY packages/observability packages/observability
COPY apps/chain-intake apps/chain-intake

# Build dist exports required at runtime.
RUN pnpm --filter @ares/observability build

ENV NODE_ENV=production
EXPOSE 8787
WORKDIR /repo/apps/chain-intake
CMD ["pnpm", "start"]
