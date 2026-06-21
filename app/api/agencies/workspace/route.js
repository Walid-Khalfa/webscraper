import { agencyKey, errorResponse, json } from "../../_lib/http";
import { assertRateLimit } from "../../_lib/rate-limit";
import { getAgencyWorkspace } from "../../_lib/store";
import { agencyWorkspaceQuerySchema, parseWithSchema } from "../../_lib/validation";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await assertRateLimit(request, "agency-workspace", { max: 60, windowMs: 60_000, keySuffix: agencyKey(request) || "" });
    const params = parseWithSchema(agencyWorkspaceQuerySchema, Object.fromEntries(request.nextUrl.searchParams.entries()));
    return json(await getAgencyWorkspace(agencyKey(request), params));
  } catch (error) {
    return errorResponse(error);
  }
}
