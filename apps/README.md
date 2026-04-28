# `apps/` — deployable surfaces

Each directory here is a deployable product. They all consume `@ares/engine`
as a workspace dependency and never duplicate engine logic.

| App                  | Package name          | Purpose                                                                       |
| -------------------- | --------------------- | ----------------------------------------------------------------------------- |
| `web/`               | `@asst/web`           | Next.js dashboard + public API routes. Future public product surface.         |
| `mcp-server/`        | `@asst/mcp-server`    | MCP (stdio) server that exposes assurance tools to Cursor / Claude Desktop.   |
| `chain-intake/`      | `@asst/chain-intake`  | Helius webhook receiver → Postgres. Feeds the assurance manifest pipeline.    |

## Rules for new apps

1. Depend on `@ares/engine` via `workspace:*`. Don't duplicate engine code.
2. Server-side surfaces that will be **publicly reachable** must use
   `createPublicOrchestrator()` from `apps/web/lib/engine-factory.ts`
   (or follow the same pattern) so mutating tools stay off by default.
3. Keep app-specific state inside the app (e.g. Next.js route handlers stay
   in `apps/web/app/api/`). Don't leak UI concerns into `@ares/engine`.
4. Add a top-level `README.md` inside the app that answers: what does this do,
   how do I run it locally, what environment does it need.
