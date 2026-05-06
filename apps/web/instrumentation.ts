/**
 * Next.js instrumentation hook — runs once per process boot.
 * Initializes Sentry on both server and edge runtimes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("@ares/observability");
    await initSentry({ serviceName: "ares-web" });
  }
}
