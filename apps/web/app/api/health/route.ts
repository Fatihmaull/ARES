import { apiSuccess } from "@/lib/api";
import {
  overallStatus,
  runDependencyChecks,
} from "@/lib/health-checks";

/**
 * Liveness + dependency checks for ops (§10 P7). Not authenticated.
 * Use `data.status` and `data.checks` for probes; `degraded` = 200 with signal to alert.
 */
export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const { checks, errors } = await runDependencyChecks();
  const status = overallStatus(checks);

  return apiSuccess(requestId, {
    status,
    service: "asst-web",
    timestamp: new Date().toISOString(),
    checks,
    ...(Object.keys(errors).length ? { checkErrors: errors } : {}),
    ...(status === "degraded"
      ? {
          alerts: {
            message:
              "Dependency check failed or misconfigured; page probes billing/redis readiness.",
          },
        }
      : {}),
  });
}
