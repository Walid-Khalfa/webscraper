import { agencyKey, errorResponse, json } from "../../../_lib/http";
import { assertRateLimit } from "../../../_lib/rate-limit";
import { removeSubscription } from "../../../_lib/store";
import { numericIdSchema, parseWithSchema } from "../../../_lib/validation";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const parsedId = parseWithSchema(numericIdSchema, id);
    await assertRateLimit(request, "subscription-delete", { max: 10, windowMs: 60_000, keySuffix: agencyKey(request) || "" });
    return json(await removeSubscription(agencyKey(request), parsedId));
  } catch (error) {
    return errorResponse(error);
  }
}
