# Optional Dockerfile for apps/web. Production primary path is Vercel; this
# image lets us run the same code on Fly/Render/etc when needed.
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/queue/package.json packages/queue/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter=@asst/web... --filter=@ares/engine... --filter=@ares/queue...

FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=deps /repo /repo
COPY packages/engine packages/engine
COPY packages/queue packages/queue
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @asst/web build

FROM node:22-bookworm-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=build /repo /repo
EXPOSE 3000
CMD ["pnpm", "--filter", "@asst/web", "start"]
