import { NextResponse } from "next/server";
import { agencyKey } from "../../../_lib/http";
import { errorResponse } from "../../../_lib/http";
import { filterJobsByExactLocation, normalizeJob, toCsv } from "../../../_lib/ba";
import { collectSearchResults } from "../../../_lib/ba-import";
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

    const collected = await collectSearchResults(
      { keyword, location },
      { mode: exportTier === "agentur" ? "full" : "test", startPage: 1, maxPages: exportTier === "agentur" ? 20 : 2 },
    );
    const rawItems = collected.items;
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
