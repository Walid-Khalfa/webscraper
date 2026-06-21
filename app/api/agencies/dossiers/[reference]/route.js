import { agencyKey, errorResponse, json } from "../../../_lib/http";
import { assertRateLimit } from "../../../_lib/rate-limit";
import { removeCandidateDossier } from "../../../_lib/store";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
  try {
    await assertRateLimit(request, "agency-dossiers-delete", { max: 30, windowMs: 60_000, keySuffix: agencyKey(request) || "" });
    return json(await removeCandidateDossier(agencyKey(request), decodeURIComponent(params.reference)));
  } catch (error) {
    return errorResponse(error);
  }
}
