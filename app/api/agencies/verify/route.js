import { verifyAgencyVerificationToken } from "../../_lib/email";
import { errorResponse } from "../../_lib/http";
import { verifyAgencyEmail } from "../../_lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    const agencyId = verifyAgencyVerificationToken(token);
    if (!agencyId) {
      const error = new Error("Ungueltiger Verifizierungslink");
      error.status = 400;
      throw error;
    }

    await verifyAgencyEmail(agencyId);

    return new Response(
      `<!doctype html>
      <html lang="de">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>E-Mail bestaetigt</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; background: #f4f1ea; color: #1f1d1a; }
            main { max-width: 640px; margin: 12vh auto; padding: 32px; background: #fffaf1; border: 2px solid #1f1d1a; }
            h1 { margin: 0 0 12px; font-size: 32px; }
            p { font-size: 16px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <main>
            <h1>E-Mail-Adresse bestaetigt</h1>
            <p>Die Agentur wurde erfolgreich verifiziert. Ab sofort koennen Job-Alarme aktiviert und automatische KhalfaJobs E-Mails versendet werden.</p>
          </main>
        </body>
      </html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
