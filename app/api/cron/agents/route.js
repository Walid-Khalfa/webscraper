import { errorResponse, json } from "../../_lib/http";
import { extractJobItems, normalizeJob, searchJobs } from "../../_lib/ba";
import { listAllAgencySubscriptions, recordDelivery } from "../../_lib/store";
import { buildDigestHtml, sendEmail } from "../../_lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
      const error = new Error("Ungueltiger Cron-Schluessel");
      error.status = 401;
      throw error;
    }

    const jobs = await listAllAgencySubscriptions();
    const results = [];

    for (const { agency, subscription } of jobs) {
      try {
        const payload = await searchJobs({
          keyword: subscription.keyword,
          location: subscription.location,
          page: 1,
          size: subscription.max_results,
        });
        const rows = extractJobItems(payload).map(normalizeJob);
        const subject = rows.length
          ? `${rows.length} neue BA-Stellenangebote: ${subscription.keyword} in ${subscription.location}`
          : `Keine neuen BA-Stellenangebote: ${subscription.keyword} in ${subscription.location}`;
        const delivery = await sendEmail({
          to: agency.email,
          subject,
          html: buildDigestHtml({ agency, subscription, rows }),
        });
        await recordDelivery(subscription, agency.email, subject, delivery.status);
        results.push({
          subscription_id: subscription.id,
          status: delivery.status,
          provider_id: delivery.providerId,
          job_count: rows.length,
        });
      } catch (error) {
        results.push({ subscription_id: subscription.id, status: "failed", error: error.message });
      }
    }

    return json({ processed: results.length, results });
  } catch (error) {
    return errorResponse(error);
  }
}
