import { agencyKey, errorResponse, json } from "../../../_lib/http";
import { assertRateLimit } from "../../../_lib/rate-limit";
import { recordCrmPush } from "../../../_lib/store";
import { crmPushSchema, parseWithSchema } from "../../../_lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const rawKey = agencyKey(request);
    await assertRateLimit(request, "crm-push", { max: 30, windowMs: 60_000, keySuffix: rawKey || "" });
    const payload = parseWithSchema(crmPushSchema, await request.json());
    
    // Simulate API push to the external CRM/ATS system
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Update the sync status and write to the audit log
    const result = await recordCrmPush(rawKey, payload.provider, payload.reference);

    return json({
      ok: true,
      message: `Bewerber-Dossier [${payload.reference}] erfolgreich zu ${result.display_name} exportiert.`,
      provider: payload.provider,
      reference: payload.reference,
      syncedAt: result.last_sync_at,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
