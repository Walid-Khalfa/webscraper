import { captureEvent } from "../_lib/analytics";
import { errorResponse, json } from "../_lib/http";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const payload = await request.json();
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

    return json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
