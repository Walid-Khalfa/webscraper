import { errorResponse, json } from "../../_lib/http";
import { extractJobItems, filterJobsByExactLocation, normalizeJob, searchJobs } from "../../_lib/ba";
import { mapWithConcurrency } from "../../_lib/concurrency";
import { listAllAgencySubscriptions, recordDelivery } from "../../_lib/store";
import { buildDigestHtml, sendEmail } from "../../_lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    // Never expose secret-misconfiguration details publicly on a sensitive route.
    if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
      const error = new Error("Ungueltiger Cron-Schluessel");
      error.status = 401;
      throw error;
    }

    const jobs = await listAllAgencySubscriptions();
    const concurrency = Number(process.env.CRON_AGENT_CONCURRENCY || 4);
    const settled = await mapWithConcurrency(jobs, concurrency, async ({ agency, subscription }) => {
        const payload = await searchJobs({
          keyword: subscription.keyword,
          location: subscription.location,
          page: 1,
          size: subscription.max_results,
        });
        const rows = filterJobsByExactLocation(extractJobItems(payload), subscription.location).map(normalizeJob);
        const subject = rows.length
          ? `${rows.length} neue BA-Stellenangebote: ${subscription.keyword} in ${subscription.location}`
          : `Keine neuen BA-Stellenangebote: ${subscription.keyword} in ${subscription.location}`;
        const delivery = await sendEmail({
          to: agency.email,
          subject,
          html: buildDigestHtml({ agency, subscription, rows }),
        });
        await recordDelivery(subscription, agency.email, subject, delivery.status);
        return {
          subscription_id: subscription.id,
          status: delivery.status,
          provider_id: delivery.providerId,
          job_count: rows.length,
        };
    });

    const results = settled.map((entry, index) => {
      if (entry.status === "fulfilled") return entry.value;
      return {
        subscription_id: jobs[index]?.subscription?.id,
        status: "failed",
        error: entry.reason?.message || "Unbekannter Fehler",
      };
    });

    return json({ processed: results.length, results });
  } catch (error) {
    return errorResponse(error);
  }
}
