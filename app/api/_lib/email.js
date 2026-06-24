import crypto from "node:crypto";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function getEmailSecret() {
  if (process.env.NODE_ENV === "production" && !process.env.EMAIL_LINK_SECRET) {
    throw new Error("EMAIL_LINK_SECRET fehlt in Produktion");
  }
  return process.env.EMAIL_LINK_SECRET || process.env.RESEND_API_KEY || "dev-email-link-secret";
}

export function createUnsubscribeToken(subscriptionId) {
  const id = String(subscriptionId);
  const signature = crypto.createHmac("sha256", getEmailSecret()).update(id).digest("base64url");
  return `${id}.${signature}`;
}

export function createAgencyVerificationToken(agencyId) {
  const id = String(agencyId);
  const signature = crypto.createHmac("sha256", getEmailSecret()).update(`verify:${id}`).digest("base64url");
  return `${id}.${signature}`;
}

export function verifyUnsubscribeToken(token) {
  const [id, signature] = String(token || "").split(".");
  if (!id || !signature || !/^\d+$/.test(id)) return null;

  const expected = crypto.createHmac("sha256", getEmailSecret()).update(id).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer) ? Number(id) : null;
}

export function verifyAgencyVerificationToken(token) {
  const [id, signature] = String(token || "").split(".");
  if (!id || !signature || !/^\d+$/.test(id)) return null;

  const expected = crypto.createHmac("sha256", getEmailSecret()).update(`verify:${id}`).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer) ? Number(id) : null;
}

export async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    return { status: "dry_run", providerId: null };
  }

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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || `Resend failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return { status: "sent", providerId: payload?.id || null };
}

export function buildAgencyVerificationHtml({ agency }) {
  const appBaseUrl = getAppBaseUrl();
  const verificationUrl = `${appBaseUrl}/api/agencies/verify?token=${encodeURIComponent(createAgencyVerificationToken(agency.id))}`;
  const escapedAgency = escapeHtml(agency.name);

  return `
    <div style="display:none; max-height:0; overflow:hidden;">Bestaetigen Sie Ihre E-Mail-Adresse fuer KhalfaJobs.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea; margin:0; padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px; max-width:100%; background:#fffaf1; border:2px solid #1f1d1a;">
            <tr>
              <td style="padding: 28px 32px 18px; background:#1f1d1a; color:#fffaf1;">
                <div style="font: 700 13px Arial, sans-serif; letter-spacing:.08em; text-transform:uppercase; color:#ffce45;">KhalfaJobs Verifizierung</div>
                <h1 style="margin:10px 0 0; font: 700 30px Arial, sans-serif;">E-Mail-Adresse bestaetigen</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 26px 32px 32px; color:#1f1d1a; font:16px Arial, sans-serif; line-height:1.6;">
                <p style="margin:0 0 16px;">Guten Tag ${escapedAgency},</p>
                <p style="margin:0 0 16px;">bitte bestaetigen Sie zuerst Ihre E-Mail-Adresse, bevor fuer Ihre Agentur automatische Job-Alarme aktiviert werden.</p>
                <p style="margin:0 0 24px;">Ohne diese Verifizierung werden keine Recruiting-Digests von KhalfaJobs versendet.</p>
                <a href="${verificationUrl}" style="display:inline-block; background:#df4829; color:#ffffff; font:700 15px Arial, sans-serif; text-decoration:none; padding:14px 18px; border:2px solid #1f1d1a;">
                  E-Mail-Adresse bestaetigen
                </a>
                <p style="margin:24px 0 0; color:#6b665c; font-size:13px;">Falls Sie diese Registrierung nicht gestartet haben, koennen Sie diese E-Mail ignorieren.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function buildDigestHtml({ agency, subscription, rows }) {
  const appBaseUrl = getAppBaseUrl();
  const unsubscribeUrl = `${appBaseUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(subscription.id))}`;
  const escapedAgency = escapeHtml(agency.name);
  const escapedKeyword = escapeHtml(subscription.keyword);
  const escapedLocation = escapeHtml(subscription.location);
  const preheader = rows.length
    ? `${rows.length} neue Stellenangebote fuer ${subscription.keyword} in ${subscription.location}`
    : `Keine neuen Stellenangebote fuer ${subscription.keyword} in ${subscription.location}`;

  const footer = `
    <tr>
      <td style="padding: 24px 32px 32px; color: #6b665c; font: 13px Arial, sans-serif; line-height: 1.6; border-top: 1px solid #e3ded3;">
        <strong>KhalfaJobs</strong><br />
        Automatisierte Stellenangebote aus der Bundesagentur fuer Arbeit fuer registrierte Agenturen.<br />
        Sie erhalten diese E-Mail, weil fuer Ihre Agentur ein Job-Alarm aktiv ist.
        <a href="${unsubscribeUrl}" style="color: #b5361f; text-decoration: underline;">Job-Alarm abbestellen</a>.<br /><br />
        <a href="${appBaseUrl}" style="display:inline-block; background:#f5c542; color:#1f1d1a; font:700 13px Arial, sans-serif; text-decoration:none; padding:10px 14px; border:2px solid #1f1d1a;">
          Eigenen Recruiting-Job-Alarm einrichten
        </a>
      </td>
    </tr>
  `;

  if (!rows.length) {
    return `
      <div style="display:none; max-height:0; overflow:hidden;">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea; margin:0; padding:28px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px; max-width:100%; background:#fffaf1; border:2px solid #1f1d1a;">
              <tr>
                <td style="padding: 28px 32px 18px; background:#1f1d1a; color:#fffaf1;">
                  <div style="font: 700 13px Arial, sans-serif; letter-spacing:.08em; text-transform:uppercase; color:#ffce45;">KhalfaJobs Job-Alarm</div>
                  <h1 style="margin:10px 0 0; font: 700 28px Arial, sans-serif;">Keine neuen Treffer heute</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 28px 32px; color:#1f1d1a; font:16px Arial, sans-serif; line-height:1.6;">
                  <p style="margin:0 0 16px;">Guten Morgen ${escapedAgency},</p>
                  <p style="margin:0 0 16px;">fuer Ihre Suche <strong>${escapedKeyword}</strong> in <strong>${escapedLocation}</strong> wurden heute keine neuen passenden Stellenangebote gefunden.</p>
                  <p style="margin:0;">Wir pruefen morgen automatisch erneut und senden Ihnen nur Ergebnisse aus dem exakt angegebenen Ort.</p>
                </td>
              </tr>
              ${footer}
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  const items = rows
    .slice(0, 20)
    .map(
      (row) => `
        <tr>
          <td style="padding: 18px 0; border-top:1px solid #e3ded3;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding-right:16px; vertical-align:top;">
                  <div style="font:700 18px Arial, sans-serif; color:#1f1d1a; line-height:1.25;">${escapeHtml(row.Titel || "Stellenprofil")}</div>
                  <div style="margin-top:8px; font:14px Arial, sans-serif; color:#4d6570;">${escapeHtml(row.Arbeitgeber || "Arbeitgeber nicht genannt")} · ${escapeHtml(row.Ort || "Standort nicht genannt")}</div>
                  <div style="margin-top:6px; font:13px Arial, sans-serif; color:#6b665c;">${escapeHtml(row.Beruf || "Beruf nicht genannt")}</div>
                  ${row.Gehalt && row.Gehalt !== "Keine Verguetung angegeben" ? `<div style="margin-top:8px; font:700 14px Arial, sans-serif; color:#b5361f;">${escapeHtml(row.Gehalt)}</div>` : ""}
                </td>
                <td align="right" style="width:140px; vertical-align:middle;">
                  ${
                    row.URL
                      ? `<a href="${escapeHtml(row.URL)}" style="display:inline-block; background:#df4829; color:#ffffff; font:700 14px Arial, sans-serif; text-decoration:none; padding:12px 16px; border:2px solid #1f1d1a;">Zur Stelle</a>`
                      : ""
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <div style="display:none; max-height:0; overflow:hidden;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea; margin:0; padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px; max-width:100%; background:#fffaf1; border:2px solid #1f1d1a;">
            <tr>
              <td style="padding: 28px 32px 18px; background:#1f1d1a; color:#fffaf1;">
                <div style="font: 700 13px Arial, sans-serif; letter-spacing:.08em; text-transform:uppercase; color:#ffce45;">KhalfaJobs Job-Alarm</div>
                <h1 style="margin:10px 0 0; font: 700 30px Arial, sans-serif;">${rows.length} neue Stellenangebote</h1>
                <p style="margin:12px 0 0; font:16px Arial, sans-serif; color:#f4f1ea;">${escapedKeyword} in ${escapedLocation}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 26px 32px 10px; color:#1f1d1a; font:16px Arial, sans-serif; line-height:1.6;">
                <p style="margin:0 0 16px;">Guten Morgen ${escapedAgency},</p>
                <p style="margin:0;">wir haben ${rows.length} passende Stellenangebote gefunden. Angezeigt werden nur Treffer mit exakt dem Ort <strong>${escapedLocation}</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${items}</table>
              </td>
            </tr>
            ${footer}
          </table>
        </td>
      </tr>
    </table>
  `;
}
