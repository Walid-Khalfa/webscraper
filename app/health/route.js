import { json } from "../api/_lib/http";
import { getEnvironmentReport } from "../api/_lib/env";

export const runtime = "nodejs";

export async function GET() {
  const report = getEnvironmentReport();
  const status = report.ok ? "ok" : "degraded";
  return json(
    {
      status,
      environment: {
        ok: report.ok,
        missingRequired: report.missingRequired.map((item) => item.name),
        warnings: report.warnings.map((item) => item.name),
      },
    },
    report.ok ? 200 : 503,
  );
}
