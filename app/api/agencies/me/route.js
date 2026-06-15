import { agencyKey, errorResponse, json } from "../../_lib/http";
import { getAgency } from "../../_lib/store";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    return json(getAgency(agencyKey(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
