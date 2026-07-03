import { errorResponse, json } from "../../_lib/http";
import { filterJobsByExactLocation, normalizeJob } from "../../_lib/ba";
import { collectSearchResults, runBaImport } from "../../_lib/ba-import";
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

    if (String(process.env.CRON_RUN_BA_IMPORT || "false").toLowerCase() === "true") {
      await runBaImport({ mode: "full" });
    }

    const jobs = await listAllAgencySubscriptions();
    const concurrency = Number(process.env.CRON_AGENT_CONCURRENCY || 4);
    const settled = await mapWithConcurrency(jobs, concurrency, async ({ agency, subscription }) => {
        const collected = await collectSearchResults({
          keyword: subscription.keyword,
          location: subscription.location,
        }, {
          mode: "full",
          startPage: 1,
          maxPages: 6,
        });
        const rows = filterJobsByExactLocation(collected.items, subscription.location)
          .map(normalizeJob)
          .slice(0, subscription.max_results);
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
