import { errorResponse, json } from "../../_lib/http";
import { assertRateLimit } from "../../_lib/rate-limit";
import { recordSearchHistory } from "../../_lib/store";
import { parseWithSchema, searchQuerySchema } from "../../_lib/validation";
import { extractJobItems, filterJobsByExactLocation, searchJobs } from "../../_lib/ba";
import { agencyKey } from "../../_lib/http";

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
    if (!exactLocation) {
      if (page === 1) {
        await recordSearchHistory(agencyKey(request), {
          keyword,
          location,
          exactLocation: false,
          resultCount: extractJobItems(payload).length,
        });
      }
      return json(payload);
    }

    const exactPayload = {
      ...payload,
      ergebnisliste: filterJobsByExactLocation(extractJobItems(payload), location),
      exactLocation: true,
    };
    if (page === 1) {
      await recordSearchHistory(agencyKey(request), {
        keyword,
        location,
        exactLocation: true,
        resultCount: exactPayload.ergebnisliste.length,
      });
    }

    return json(exactPayload);
  } catch (error) {
    return errorResponse(error);
  }
}
