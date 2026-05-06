import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

/**
 * Load the monorepo's root `.env.local` so the web server sees the same
 * provider keys (GOOGLE_API_KEY, OPENROUTER_API_KEY, …) the CLI uses.
 *
 * Next.js only auto-loads `.env*` files from the app directory
 * (`apps/web/`); it does NOT walk upward to the workspace root. Without
 * this, POST /api/chat throws "GOOGLE_API_KEY is required" even though
 * the key is right there in `<repo>/.env.local`.
 *
 * Precedence: existing process.env > apps/web/.env.local (handled by
 * Next itself) > root .env.local (this file). We pass `override: false`
 * so nothing silently clobbers a key that's already defined in the
 * operator's shell.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(__dirname, "..", "..", ".env.local");
loadDotenv({ path: rootEnv, override: false });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-phantom",
  ],
  /**
   * Silences the "multiple lockfiles" warning we saw during smoke tests:
   * force Next to treat the monorepo root as the trace root rather than
   * guessing from whichever lockfile it finds first.
   */
  outputFileTracingRoot: path.resolve(__dirname, "..", ".."),
  /**
   * Native-module bailouts. Next.js's webpack bundler cannot load these
   * at runtime on the server — leaving the default import silently
   * `undefined`. Listing them here tells Next to require() them at
   * runtime like plain Node.js does.
   *
   * - `better-sqlite3`: used by @ares/engine's persistence layer.
   * - `pg`, `pg-native`: used by @ares/chain-intake (safe to list here
   *   even though the web app doesn't import chain-intake directly — it
   *   transitively reaches it via @ares/engine in some dev paths).
   */
  serverExternalPackages: ["better-sqlite3", "pg", "pg-native"],
  /**
   * Belt-and-braces: even though `better-sqlite3` is in Next's default
   * `serverExternalPackages` list, when we import it transitively via the
   * workspace package `@ares/engine`, webpack can still try to bundle
   * the native binding — which leaves the `Database` constructor broken
   * at runtime ("Cannot read properties of undefined (reading 'indexOf')"
   * inside `new Database()`). Forcing `commonjs` externalization for the
   * server build makes webpack emit a plain `require("better-sqlite3")`.
   *
   * Context: https://github.com/vercel/next.js/issues/47327
   */
  webpack: (config, { isServer }) => {
    if (isServer) {
      const nativeExternals = {
        "better-sqlite3": "commonjs better-sqlite3",
        pg: "commonjs pg",
        "pg-native": "commonjs pg-native",
      };
      if (Array.isArray(config.externals)) {
        config.externals.push(nativeExternals);
      } else if (config.externals) {
        config.externals = [config.externals, nativeExternals];
      } else {
        config.externals = [nativeExternals];
      }
    }
    return config;
  },
};

export default nextConfig;
