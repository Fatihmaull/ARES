# syntax=docker/dockerfile:1.7
# Multi-stage build for apps/worker. Runs as a long-lived process consuming
# the BullMQ queue. Uses pnpm workspace install at the repo root so it pulls
# in @ares/engine and @ares/queue from the monorepo.

FROM node:22-bookworm-slim AS base
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Install only the workspace files we need first.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/observability/package.json packages/observability/
COPY packages/queue/package.json packages/queue/
COPY apps/worker/package.json apps/worker/

RUN pnpm install --frozen-lockfile --filter=@asst/worker...

# Now bring in the source.
COPY packages/engine packages/engine
COPY packages/observability packages/observability
COPY packages/queue packages/queue
COPY apps/worker apps/worker
COPY .agents .agents

# Optional build step (skipped — we run via tsx).
# RUN pnpm --filter @ares/engine build && pnpm --filter @ares/queue build && pnpm --filter @asst/worker build

ENV NODE_ENV=production
ENV ASST_WORKER_HEALTH_PORT=9090
ENV ASST_REPO_ROOT=/repo
EXPOSE 9090

CMD ["pnpm", "--filter", "@asst/worker", "start"]
