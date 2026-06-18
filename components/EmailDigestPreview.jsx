import { ArrowRight, Clock3, MailCheck, MapPin, WalletCards } from "lucide-react";

function previewRows(jobs) {
  return (jobs || []).slice(0, 3).map((job, index) => ({
    id: job.reference || `${job.title}-${index}`,
    title: job.title || "Stellenprofil",
    employer: job.employer || "Arbeitgeber nicht genannt",
    location: job.location || "Standort nicht genannt",
    salary: job.salary || "Keine Verguetung angegeben",
  }));
}

export default function EmailDigestPreview({ keyword, location, agencyName, jobs }) {
  const rows = previewRows(jobs);
  const resolvedKeyword = keyword || "Softwareentwickler";
  const resolvedLocation = location || "Berlin";
  const resolvedAgency = agencyName || "Ihre Agentur";

  return (
    <section className="email-preview-band" aria-label="Vorschau des taeglichen Job-Alarms">
      <div className="email-preview-copy">
        <p className="eyebrow">Vorschau des E-Mail-Digests</p>
        <h3>So sieht der taegliche Job-Alarm fuer Ihr Team aus.</h3>
        <p>
          Zeigen Sie Ihrem Recruiting-Team vorab, welche Treffer morgens im Postfach landen. Suchbegriff, Ort und
          Gehaltsangaben werden fuer eine schnelle Sichtung aufbereitet.
        </p>
        <ul className="preview-points">
          <li>Versand taeglich um 06:00 Uhr</li>
          <li>Nur Treffer fuer den exakt definierten Standort</li>
          <li>Direktlink zur Quelle pro Stellenangebot</li>
        </ul>
      </div>

      <div className="digest-mockup" role="presentation">
        <div className="digest-mockup-header">
          <div>
            <span>KhalfaJobs Job-Alarm</span>
            <strong>{resolvedKeyword} in {resolvedLocation}</strong>
          </div>
          <div className="digest-mockup-badge">
            <Clock3 size={16} aria-hidden="true" />
            06:00 Uhr
          </div>
        </div>

        <div className="digest-mockup-intro">
          <MailCheck size={18} aria-hidden="true" />
          <p>
            Guten Morgen <strong>{resolvedAgency}</strong>, hier sind Ihre neuesten Treffer fuer heute.
          </p>
        </div>

        <div className="digest-mockup-list">
          {rows.map((row) => (
            <article className="digest-mockup-item" key={row.id}>
              <div className="digest-mockup-item-copy">
                <strong>{row.title}</strong>
                <span>{row.employer}</span>
                <span className="digest-location">
                  <MapPin size={14} aria-hidden="true" />
                  {row.location}
                </span>
                {row.salary !== "Keine Verguetung angegeben" ? (
                  <span className="digest-salary">
                    <WalletCards size={14} aria-hidden="true" />
                    {row.salary}
                  </span>
                ) : null}
              </div>
              <span className="digest-open-link">
                Zur Stelle
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </article>
          ))}
        </div>

        <div className="digest-mockup-footer">
          <span>Exakter Ort aktiv</span>
          <span>Datenquelle Bundesagentur fuer Arbeit</span>
        </div>
      </div>
    </section>
  );
}
