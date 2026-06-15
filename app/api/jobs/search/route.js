import { errorResponse, json } from "../../_lib/http";
import { extractJobItems, filterJobsByExactLocation, searchJobs } from "../../_lib/ba";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const params = request.nextUrl.searchParams;
    const exactLocation = params.get("exactLocation") === "true";
    const location = params.get("location") || "";
    const payload = await searchJobs({
      keyword: params.get("keyword") || "",
      location,
      page: params.get("page") || 1,
      size: params.get("size") || 25,
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
