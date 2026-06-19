import { buildAgencyVerificationHtml, sendEmail } from "../../_lib/email";
import { agencyKey, errorResponse, json } from "../../_lib/http";
import { assertRateLimit } from "../../_lib/rate-limit";
import { getAgency, markAgencyVerificationEmailSent } from "../../_lib/store";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    await assertRateLimit(request, "agency-resend-verification", { max: 5, windowMs: 10 * 60_000, keySuffix: agencyKey(request) || "" });
    const agency = await getAgency(agencyKey(request));
    if (agency.email_verified) {
      return json({ already_verified: true, message: "Die E-Mail-Adresse ist bereits bestaetigt." });
    }

    const subject = "Bitte bestaetigen Sie Ihre E-Mail-Adresse fuer KhalfaJobs";
    const delivery = await sendEmail({
      to: agency.email,
      subject,
      html: buildAgencyVerificationHtml({ agency }),
    });
    await markAgencyVerificationEmailSent(agency.id);

    return json({
      sent: delivery.status === "sent",
      dry_run: delivery.status === "dry_run",
      delivery_status: delivery.status,
      message: "Die Verifizierungs-E-Mail wurde erneut versendet.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
