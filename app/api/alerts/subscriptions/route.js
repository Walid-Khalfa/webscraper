import { agencyKey, errorResponse, json } from "../../_lib/http";
import { assertRateLimit } from "../../_lib/rate-limit";
import { createSubscription, listSubscriptions } from "../../_lib/store";
import { parseWithSchema, subscriptionCreateSchema } from "../../_lib/validation";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await assertRateLimit(request, "subscription-list", { max: 60, windowMs: 60_000, keySuffix: agencyKey(request) || "" });
    return json(await listSubscriptions(agencyKey(request)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    await assertRateLimit(request, "subscription-create", { max: 20, windowMs: 60_000, keySuffix: agencyKey(request) || "" });
    const payload = parseWithSchema(subscriptionCreateSchema, await request.json());
    return json(await createSubscription(agencyKey(request), payload), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
