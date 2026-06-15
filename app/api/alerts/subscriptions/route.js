import { agencyKey, errorResponse, json } from "../../_lib/http";
import { createSubscription, listSubscriptions } from "../../_lib/store";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    return json(await listSubscriptions(agencyKey(request)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    if (!payload.keyword || !payload.location) {
      const error = new Error("Suchbegriff und Ort sind erforderlich");
      error.status = 400;
      throw error;
    }
    return json(await createSubscription(agencyKey(request), payload), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
