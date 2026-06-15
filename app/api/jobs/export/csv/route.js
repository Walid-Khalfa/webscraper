import { NextResponse } from "next/server";
import { errorResponse } from "../../../_lib/http";
import { extractJobItems, filterJobsByExactLocation, normalizeJob, searchJobs, toCsv } from "../../../_lib/ba";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const params = request.nextUrl.searchParams;
    const keyword = params.get("keyword") || "";
    const location = params.get("location") || "";
    const exactLocation = params.get("exactLocation") === "true";
    const pages = await Promise.all([
      searchJobs({ keyword, location, page: 1, size: 100 }),
      searchJobs({ keyword, location, page: 2, size: 100 }),
    ]);
    const items = pages.flatMap(extractJobItems).slice(0, 200);
    const filteredItems = exactLocation ? filterJobsByExactLocation(items, location) : items;
    const rows = filteredItems.map(normalizeJob);
    const exactSuffix = exactLocation ? "-exakter-ort" : "";
    const filename = `stellenangebote-${(keyword || "alle").replaceAll(" ", "-")}-${(location || "deutschland").replaceAll(" ", "-")}${exactSuffix}.csv`;

    return new NextResponse(toCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
