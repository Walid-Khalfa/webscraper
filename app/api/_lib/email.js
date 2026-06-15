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

export function buildDigestHtml({ agency, subscription, rows }) {
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
          ${row.Arbeitgeber || "Arbeitgeber nicht angegeben"} - ${row.Ort || "Ort nicht angegeben"}<br />
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
