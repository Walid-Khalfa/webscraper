import { agencyKey, errorResponse, json } from "../../../../_lib/http";
import { extractJobItems, filterJobsByExactLocation, normalizeJob, searchJobs } from "../../../../_lib/ba";
import { getSubscription, recordDelivery } from "../../../../_lib/store";
import { buildDigestHtml, sendEmail } from "../../../../_lib/email";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { agency, subscription } = await getSubscription(agencyKey(request), id, { requireVerified: true });
    const payload = await searchJobs({
      keyword: subscription.keyword,
      location: subscription.location,
      page: 1,
      size: subscription.max_results,
    });
    const rows = filterJobsByExactLocation(extractJobItems(payload), subscription.location).map(normalizeJob);
    const subject = `${rows.length} neue BA-Stellenangebote: ${subscription.keyword} in ${subscription.location}`;
    const delivery = await sendEmail({
      to: agency.email,
      subject,
      html: buildDigestHtml({ agency, subscription, rows }),
    });
    await recordDelivery(subscription, agency.email, subject, delivery.status);

    return json({
      subscription_id: subscription.id,
      recipient: agency.email,
      job_count: rows.length,
      sent: delivery.status === "sent",
      dry_run: delivery.status === "dry_run",
      delivery_status: delivery.status,
      provider_id: delivery.providerId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
