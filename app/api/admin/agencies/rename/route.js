import { errorResponse, json } from "../../../_lib/http";
import { prisma } from "../../../_lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
      const error = new Error("Nicht autorisiert");
      error.status = 401;
      throw error;
    }

    const payload = await request.json();
    if (!payload.email || !payload.name) {
      const error = new Error("E-Mail und Name sind erforderlich");
      error.status = 400;
      throw error;
    }

    const result = await prisma.agency.updateMany({
      where: { email: payload.email },
      data: { name: payload.name },
    });

    return json({ updated: result.count });
  } catch (error) {
    return errorResponse(error);
  }
}
