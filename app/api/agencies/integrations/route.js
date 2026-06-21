import { agencyKey, errorResponse, json } from "../../_lib/http";
import { assertRateLimit } from "../../_lib/rate-limit";
import { updateCrmIntegration } from "../../_lib/store";
import { crmConnectSchema, parseWithSchema } from "../../_lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const rawKey = agencyKey(request);
    await assertRateLimit(request, "crm-connect", { max: 10, windowMs: 60_000, keySuffix: rawKey || "" });
    const payload = parseWithSchema(crmConnectSchema, await request.json());
    
    const result = await updateCrmIntegration(rawKey, payload.provider, {
      status: "CONNECTED",
      config: {
        apiKey: payload.apiKey,
        ...payload.config,
      },
    });

    return json(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    const rawKey = agencyKey(request);
    await assertRateLimit(request, "crm-disconnect", { max: 10, windowMs: 60_000, keySuffix: rawKey || "" });
    
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    if (!provider || !["personio", "hubspot", "greenhouse"].includes(provider)) {
      const error = new Error("Ungueltiger CRM-Provider");
      error.status = 400;
      throw error;
    }

    const result = await updateCrmIntegration(rawKey, provider, {
      status: "NOT_CONNECTED",
      config: null,
    });

    return json(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
