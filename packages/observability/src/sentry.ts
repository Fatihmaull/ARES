/**
 * Wraps @sentry/node so each service has a consistent init path. We import
 * lazily to keep cold-start cheap when SENTRY_DSN is unset (dev).
 */
export interface SentryInitOptions {
  serviceName: string;
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
  release?: string;
}

let initialized = false;

export async function initSentry(opts: SentryInitOptions): Promise<void> {
  if (initialized) return;
  const dsn = opts.dsn ?? process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn,
    environment: opts.environment ?? process.env.SENTRY_ENVIRONMENT ?? "production",
    release: opts.release ?? process.env.SENTRY_RELEASE,
    tracesSampleRate: opts.tracesSampleRate ?? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    initialScope: { tags: { service: opts.serviceName } },
  });
  initialized = true;
}

export async function captureException(err: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!initialized) return;
  const Sentry = await import("@sentry/node");
  Sentry.captureException(err, { extra: context });
}
