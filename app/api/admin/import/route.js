import { errorResponse, json } from "../../_lib/http";
import { parseWithSchema, adminImportRunSchema } from "../../_lib/validation";
import { runBaImport } from "../../_lib/ba-import";
import { countImportedJobs, getLatestImportRun, listRecentImportedJobs } from "../../_lib/ba-import-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertAdminSecret(request) {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
    const error = new Error("Ungueltiger Admin-Schluessel");
    error.status = 401;
    throw error;
  }
}

export async function GET(request) {
  try {
    assertAdminSecret(request);
    const [latestRun, totalJobs, recentJobs] = await Promise.all([
      getLatestImportRun("bundesagentur"),
      countImportedJobs("bundesagentur"),
      listRecentImportedJobs({ source: "bundesagentur", limit: 10 }),
    ]);

    return json({
      source: "bundesagentur",
      total_jobs: totalJobs,
      latest_run: latestRun,
      recent_jobs: recentJobs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    assertAdminSecret(request);
    const payload = parseWithSchema(adminImportRunSchema, await request.json());
    const report = await runBaImport({
      mode: payload.mode,
      queries: payload.queries,
    });

    return json({
      ok: true,
      report,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
