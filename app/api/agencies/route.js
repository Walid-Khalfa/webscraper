import { createAgency, markAgencyVerificationEmailSent } from "../_lib/store";
import { buildAgencyVerificationHtml, sendEmail } from "../_lib/email";
import { errorResponse, json } from "../_lib/http";
import { assertRateLimit } from "../_lib/rate-limit";
import { agencyCreateSchema, parseWithSchema } from "../_lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    await assertRateLimit(request, "agency-create", { max: 10, windowMs: 60_000 });
    const payload = parseWithSchema(agencyCreateSchema, await request.json());
    const agency = await createAgency(payload);
    const subject = "Bitte bestätigen Sie Ihre E-Mail-Adresse für KhalfaJobs";
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
