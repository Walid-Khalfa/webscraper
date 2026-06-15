import { createAgency } from "../_lib/store";
import { errorResponse, json } from "../_lib/http";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const payload = await request.json();
    if (!payload.name || !payload.email) {
      const error = new Error("Agenturname und E-Mail sind erforderlich");
      error.status = 400;
      throw error;
    }
    return json(await createAgency(payload), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
