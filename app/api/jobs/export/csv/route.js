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
      const firstPayload = await searchJobs({ keyword, location, page: 1, size: 100 });
      const maxErgebnisse = Number(firstPayload.maxErgebnisse || 0);
      rawItems = extractJobItems(firstPayload);
      if (maxErgebnisse > 100) {
        const additionalPagesCount = Math.min(9, Math.ceil((maxErgebnisse - 100) / 100));
        const promises = [];
        for (let i = 1; i <= additionalPagesCount; i++) {
          promises.push(searchJobs({ keyword, location, page: 1 + i, size: 100 }));
        }
        const additionalPayloads = await Promise.all(promises);
        rawItems = [rawItems, additionalPayloads.flatMap(extractJobItems)].flat();
      }
    } else {
      const firstPayload = await searchJobs({ keyword, location, page: 1, size: 100 });
      const maxErgebnisse = Number(firstPayload.maxErgebnisse || 0);
      rawItems = extractJobItems(firstPayload);
      if (maxErgebnisse > 100) {
        const additionalPayload = await searchJobs({ keyword, location, page: 2, size: 100 });
        rawItems = [rawItems, extractJobItems(additionalPayload)].flat();
      }
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
