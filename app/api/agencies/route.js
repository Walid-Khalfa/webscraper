import { createAgency, markAgencyVerificationEmailSent } from "../_lib/store";
import { buildAgencyVerificationHtml, sendEmail } from "../_lib/email";
import { errorResponse, json } from "../_lib/http";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const payload = await request.json();
    if (!payload.name || !payload.email) {
      const error = new Error("Agenturname und E-Mail sind erforderlich");
      error.status = 400;
      throw error;
    }
    const agency = await createAgency(payload);
    const subject = "Bitte bestaetigen Sie Ihre E-Mail-Adresse fuer KhalfaJobs";
    const delivery = await sendEmail({
      to: agency.email,
      subject,
      html: buildAgencyVerificationHtml({ agency }),
    });
    if (delivery.status === "sent" || delivery.status === "dry_run") {
      await markAgencyVerificationEmailSent(agency.id);
      agency.verification_email_sent_at = new Date().toISOString();
    }
    return json(
      {
        ...agency,
        verification_delivery_status: delivery.status,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
