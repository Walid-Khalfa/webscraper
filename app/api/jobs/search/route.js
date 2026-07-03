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

    if (!exactLocation) {
      // Fetch 2 pages in parallel with size 100 to maximize scraping yield (200 raw results)
      const pages = await Promise.all([
        searchJobs({ keyword, location, page: 2 * targetPage - 1, size: 100 }),
        searchJobs({ keyword, location, page: 2 * targetPage, size: 100 }),
      ]);
      const rawItems = pages.flatMap(extractJobItems);
      
      const payload = {
        ...pages[0],
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

    // For exactLocation, fetch page (2P-1) and (2P) with size 100 to maximize scraping yield
    const pages = await Promise.all([
      searchJobs({ keyword, location, page: 2 * targetPage - 1, size: 100 }),
      searchJobs({ keyword, location, page: 2 * targetPage, size: 100 }),
    ]);
    const rawItems = pages.flatMap(extractJobItems);
    const filteredItems = filterJobsByExactLocation(rawItems, location);

    const exactPayload = {
      ...pages[0],
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
