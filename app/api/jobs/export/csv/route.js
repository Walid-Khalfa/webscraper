import { NextResponse } from "next/server";
import { agencyKey } from "../../../_lib/http";
import { errorResponse } from "../../../_lib/http";
import { extractJobItems, filterJobsByExactLocation, normalizeJob, searchJobs, toCsv } from "../../../_lib/ba";
import { assertRateLimit } from "../../../_lib/rate-limit";
import { getAgency, recordSearchHistory } from "../../../_lib/store";
import { parseWithSchema, searchQuerySchema } from "../../../_lib/validation";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await assertRateLimit(request, "jobs-export", { max: 20, windowMs: 10 * 60_000, keySuffix: agencyKey(request) || "" });
    const params = parseWithSchema(searchQuerySchema, Object.fromEntries(request.nextUrl.searchParams.entries()));
    const { keyword, location, exactLocation } = params;
    let exportLimit = 25;
    let exportTier = "starter";

    const rawAgencyKey = agencyKey(request);
    if (rawAgencyKey) {
      try {
        await getAgency(rawAgencyKey);
        exportLimit = 200;
        exportTier = "agentur";
      } catch {}
    }

    let rawItems = [];
    if (exactLocation) {
      const pages = await Promise.all([
        searchJobs({ keyword, location, page: 1, size: 100 }),
        searchJobs({ keyword, location, page: 2, size: 100 }),
        searchJobs({ keyword, location, page: 3, size: 100 }),
        searchJobs({ keyword, location, page: 4, size: 100 }),
        searchJobs({ keyword, location, page: 5, size: 100 }),
      ]);
      rawItems = pages.flatMap(extractJobItems);
    } else {
      const pages = await Promise.all([
        searchJobs({ keyword, location, page: 1, size: 100 }),
        searchJobs({ keyword, location, page: 2, size: 100 }),
      ]);
      rawItems = pages.flatMap(extractJobItems).slice(0, 200);
    }
    const filteredItems = exactLocation ? filterJobsByExactLocation(rawItems, location) : rawItems;
    const rows = filteredItems.map(normalizeJob).slice(0, exportLimit);
    if (rawAgencyKey) {
      await recordSearchHistory(rawAgencyKey, {
        keyword,
        location,
        exactLocation,
        resultCount: filteredItems.length,
        exportedCount: rows.length,
      });
    }
    const exactSuffix = exactLocation ? "-exakter-ort" : "";
    const filename = `stellenangebote-${(keyword || "alle").replaceAll(" ", "-")}-${(location || "deutschland").replaceAll(" ", "-")}${exactSuffix}.csv`;

    return new NextResponse(toCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-KhalfaJobs-Export-Limit": String(exportLimit),
        "X-KhalfaJobs-Export-Tier": exportTier,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
