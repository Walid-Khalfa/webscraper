import { agencyKey, errorResponse, json } from "../../../_lib/http";
import { removeSubscription } from "../../../_lib/store";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
  try {
    return json(await removeSubscription(agencyKey(request), params.id));
  } catch (error) {
    return errorResponse(error);
  }
}
