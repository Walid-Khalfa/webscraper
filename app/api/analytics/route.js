import { captureEvent } from "../_lib/analytics";
import { errorResponse, json } from "../_lib/http";
import { recordProductEvent } from "../_lib/product-insights";
import { assertRateLimit } from "../_lib/rate-limit";
import { analyticsPayloadSchema, parseWithSchema } from "../_lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    assertRateLimit(request, "analytics-capture", { max: 120, windowMs: 60_000 });
    const payload = parseWithSchema(analyticsPayloadSchema, await request.json());
    const forwardedFor = request.headers.get("x-forwarded-for");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const requestUrl =
      payload.url ||
      (forwardedHost ? `${forwardedProto}://${forwardedHost}${payload.path || "/"}` : request.nextUrl.origin);

    const result = await captureEvent({
      event: payload.event,
      distinctId: payload.distinctId || forwardedFor || "anonymous",
      url: requestUrl,
      properties: payload.properties || {},
    });

    await recordProductEvent({
      event: payload.event,
      distinctId: payload.distinctId || forwardedFor || "anonymous",
      path: payload.path || request.nextUrl.pathname,
      url: requestUrl,
      properties: payload.properties || {},
    });

    return json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
