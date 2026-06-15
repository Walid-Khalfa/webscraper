import { agencyKey, errorResponse, json } from "../../../../_lib/http";
import { extractJobItems, normalizeJob, searchJobs } from "../../../../_lib/ba";
import { getSubscription, recordDelivery } from "../../../../_lib/store";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { agency, subscription } = await getSubscription(agencyKey(request), id);
    const payload = await searchJobs({
      keyword: subscription.keyword,
      location: subscription.location,
      page: 1,
      size: subscription.max_results,
    });
    const rows = extractJobItems(payload).map(normalizeJob);
    const subject = `${rows.length} neue BA-Stellenangebote: ${subscription.keyword} in ${subscription.location}`;
    await recordDelivery(subscription, agency.email, subject, "dry_run");

    return json({
      subscription_id: subscription.id,
      recipient: agency.email,
      job_count: rows.length,
      sent: false,
      dry_run: true,
      delivery_status: "dry_run",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
