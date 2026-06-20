import { errorResponse, json } from "../../_lib/http";
import { searchGermanLocalities, countGermanLocalities } from "../../_lib/localities";
import { assertRateLimit } from "../../_lib/rate-limit";
import { locationAutocompleteSchema, parseWithSchema } from "../../_lib/validation";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await assertRateLimit(request, "locations-autocomplete", { max: 90, windowMs: 60_000 });

    const input = Object.fromEntries(request.nextUrl.searchParams.entries());
    const { query, limit } = parseWithSchema(locationAutocompleteSchema, input);
    const items = searchGermanLocalities(query, limit);

    return json(
      {
        query,
        limit,
        totalLocalities: countGermanLocalities(),
        items,
      },
      200,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
