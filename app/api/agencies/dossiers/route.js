import { agencyKey, errorResponse, json } from "../../_lib/http";
import { assertRateLimit } from "../../_lib/rate-limit";
import { listCandidateDossiers, upsertCandidateDossier } from "../../_lib/store";
import { agencyWorkspaceQuerySchema, candidateDossierSchema, parseWithSchema } from "../../_lib/validation";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await assertRateLimit(request, "agency-dossiers-list", { max: 60, windowMs: 60_000, keySuffix: agencyKey(request) || "" });
    const params = parseWithSchema(agencyWorkspaceQuerySchema, Object.fromEntries(request.nextUrl.searchParams.entries()));
    return json(await listCandidateDossiers(agencyKey(request), params));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    await assertRateLimit(request, "agency-dossiers-upsert", { max: 60, windowMs: 60_000, keySuffix: agencyKey(request) || "" });
    const payload = parseWithSchema(candidateDossierSchema, await request.json());
    return json(await upsertCandidateDossier(agencyKey(request), payload), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
