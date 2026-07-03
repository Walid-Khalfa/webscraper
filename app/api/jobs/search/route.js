import { errorResponse, json } from "../../_lib/http";
import { assertRateLimit } from "../../_lib/rate-limit";
import { recordSearchHistory } from "../../_lib/store";
import { parseWithSchema, searchQuerySchema } from "../../_lib/validation";
import { filterJobsByExactLocation } from "../../_lib/ba";
import { collectSearchResults } from "../../_lib/ba-import";
import { agencyKey } from "../../_lib/http";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await assertRateLimit(request, "jobs-search", { max: 60, windowMs: 60_000 });
    const params = parseWithSchema(searchQuerySchema, Object.fromEntries(request.nextUrl.searchParams.entries()));
    const { exactLocation, location, keyword, page } = params;
    const targetPage = Number(page) || 1;
    const firstPageNumber = 10 * (targetPage - 1) + 1;
    const result = await collectSearchResults({ keyword, location }, {
      mode: "full",
      startPage: firstPageNumber,
      maxPages: 10,
    });
    let rawItems = result.items;
    const payloadBase = {
      maxErgebnisse: result.stats.totalFound,
      page: targetPage,
      size: rawItems.length,
      source: "bundesagentur",
      pagination: result.stats,
    };

    if (!exactLocation) {
      const payload = {
        ...payloadBase,
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
      ...payloadBase,
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
