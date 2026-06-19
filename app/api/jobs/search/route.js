import { errorResponse, json } from "../../_lib/http";
import { assertRateLimit } from "../../_lib/rate-limit";
import { parseWithSchema, searchQuerySchema } from "../../_lib/validation";
import { extractJobItems, filterJobsByExactLocation, searchJobs } from "../../_lib/ba";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await assertRateLimit(request, "jobs-search", { max: 60, windowMs: 60_000 });
    const params = parseWithSchema(searchQuerySchema, Object.fromEntries(request.nextUrl.searchParams.entries()));
    const { exactLocation, location, keyword, page, size } = params;
    const payload = await searchJobs({
      keyword,
      location,
      page,
      size,
    });
    if (!exactLocation) return json(payload);

    return json({
      ...payload,
      ergebnisliste: filterJobsByExactLocation(extractJobItems(payload), location),
      exactLocation: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
