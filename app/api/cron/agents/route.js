import { errorResponse, json } from "../../_lib/http";
import { extractJobItems, normalizeJob, searchJobs } from "../../_lib/ba";
import { listAllAgencySubscriptions, recordDelivery } from "../../_lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sendEmail({ to, subject, html }) {
  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "BA Job Agent <jobs@example.com>",
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) throw new Error(`Resend failed with ${response.status}`);
    return "sent";
  }

  return "dry_run";
}

function buildDigestHtml({ agency, subscription, rows }) {
  if (!rows.length) {
    return `
      <p>Guten Morgen ${agency.name},</p>
      <p>fuer Ihre Suche <strong>${subscription.keyword}</strong> in <strong>${subscription.location}</strong> wurden heute keine neuen passenden Stellenangebote gefunden.</p>
      <p>Wir pruefen morgen automatisch erneut.</p>
    `;
  }

  const items = rows
    .slice(0, 20)
    .map(
      (row) => `
        <li>
          <strong>${row.Titel || "Stellenangebot"}</strong><br />
          ${row.Arbeitgeber || "Arbeitgeber nicht angegeben"} · ${row.Ort || "Ort nicht angegeben"}<br />
          ${row.URL ? `<a href="${row.URL}">Stellendetail oeffnen</a>` : ""}
        </li>
      `,
    )
    .join("");

  return `
    <p>Guten Morgen ${agency.name},</p>
    <p>wir haben ${rows.length} passende Stellenangebote fuer <strong>${subscription.keyword}</strong> in <strong>${subscription.location}</strong> gefunden.</p>
    <ul>${items}</ul>
  `;
}

export async function GET(request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
      const error = new Error("Ungueltiger Cron-Schluessel");
      error.status = 401;
      throw error;
    }

    const jobs = listAllAgencySubscriptions();
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
        const status = await sendEmail({
          to: agency.email,
          subject,
          html: buildDigestHtml({ agency, subscription, rows }),
        });
        recordDelivery(subscription, agency.email, subject, status);
        results.push({ subscription_id: subscription.id, status, job_count: rows.length });
      } catch (error) {
        results.push({ subscription_id: subscription.id, status: "failed", error: error.message });
      }
    }

    return json({ processed: results.length, results });
  } catch (error) {
    return errorResponse(error);
  }
}
