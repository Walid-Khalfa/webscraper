import { agencyKey, errorResponse, json } from "../../_lib/http";
import { assertRateLimit } from "../../_lib/rate-limit";
import { inviteAgencyMember, removeAgencyMember } from "../../_lib/store";
import { inviteMemberSchema, numericIdSchema, parseWithSchema } from "../../_lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const rawKey = agencyKey(request);
    await assertRateLimit(request, "member-invite", { max: 10, windowMs: 60_000, keySuffix: rawKey || "" });
    const payload = parseWithSchema(inviteMemberSchema, await request.json());
    
    const result = await inviteAgencyMember(rawKey, payload);

    return json(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    const rawKey = agencyKey(request);
    await assertRateLimit(request, "member-remove", { max: 20, windowMs: 60_000, keySuffix: rawKey || "" });
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const parsedId = parseWithSchema(numericIdSchema, id);
    
    const result = await removeAgencyMember(rawKey, parsedId);

    return json(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
