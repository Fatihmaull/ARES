import pino, { type Logger as PinoLogger } from "pino";

export interface Logger {
  info(obj: Record<string, unknown> | string, msg?: string): void;
  warn(obj: Record<string, unknown> | string, msg?: string): void;
  error(obj: Record<string, unknown> | string, msg?: string): void;
  debug(obj: Record<string, unknown> | string, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

export interface LoggerOptions {
  service: string;
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
  /** Default `process.env.NODE_ENV !== 'production'` to use pino-pretty if available. */
  prettyInDev?: boolean;
}

export function createLogger(opts: LoggerOptions): Logger {
  const level =
    opts.level ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
  const isDev = opts.prettyInDev ?? process.env.NODE_ENV !== "production";

  const baseLogger = pino(
    {
      name: opts.service,
      level,
      base: { service: opts.service },
      timestamp: pino.stdTimeFunctions.isoTime,
      ...(isDev
        ? {
            transport: {
              target: "pino/file",
              options: { destination: 1 },
            },
          }
        : {}),
    },
  );

  return wrap(baseLogger);
}

function wrap(p: PinoLogger): Logger {
  return {
    info: (obj, msg) => callPino(p, "info", obj, msg),
    warn: (obj, msg) => callPino(p, "warn", obj, msg),
    error: (obj, msg) => callPino(p, "error", obj, msg),
    debug: (obj, msg) => callPino(p, "debug", obj, msg),
    child: (b) => wrap(p.child(b)),
  };
}

function callPino(
  p: PinoLogger,
  fn: "info" | "warn" | "error" | "debug",
  obj: Record<string, unknown> | string,
  msg?: string,
): void {
  if (typeof obj === "string") {
    p[fn](obj);
  } else if (msg) {
    p[fn](obj, msg);
  } else {
    p[fn](obj);
  }
}
