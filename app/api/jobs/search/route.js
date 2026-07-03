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
    const { exactLocation, location, keyword, page } = params;

    const targetPage = Number(page) || 1;
    const firstPageNumber = 10 * (targetPage - 1) + 1;

    // 1. Fetch the first page of the block
    const firstPayload = await searchJobs({ keyword, location, page: firstPageNumber, size: 100 });
    const maxErgebnisse = Number(firstPayload.maxErgebnisse || 0);

    let rawItems = extractJobItems(firstPayload);

    // 2. Dynamically fetch remaining pages of the block in parallel if there are more results
    if (maxErgebnisse > firstPageNumber * 100) {
      const additionalPagesCount = Math.min(9, Math.ceil((maxErgebnisse - firstPageNumber * 100) / 100));
      const promises = [];
      for (let i = 1; i <= additionalPagesCount; i++) {
        promises.push(searchJobs({ keyword, location, page: firstPageNumber + i, size: 100 }));
      }
      const additionalPayloads = await Promise.all(promises);
      rawItems = [rawItems, additionalPayloads.flatMap(extractJobItems)].flat();
    }

    if (!exactLocation) {
      const payload = {
        ...firstPayload,
        ergebnisliste: rawItems,
      };

      if (page === 1) {
        await recordSearchHistory(agencyKey(request), {
          keyword,
          location,
          exactLocation: false,
          resultCount: rawItems.length,
        });
      }
      return json(payload);
    }

    // For exactLocation, filter the aggregated raw items
    const filteredItems = filterJobsByExactLocation(rawItems, location);

    const exactPayload = {
      ...firstPayload,
      ergebnisliste: filteredItems,
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
