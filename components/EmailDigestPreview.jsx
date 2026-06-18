import { ArrowRight, Clock3, MailCheck, MapPin, SendHorizontal, ToggleLeft, WalletCards } from "lucide-react";

function previewRows(jobs) {
  return (jobs || []).slice(0, 3).map((job, index) => ({
    id: job.reference || `${job.title}-${index}`,
    title: job.title || "Stellenprofil",
    employer: job.employer || "Arbeitgeber nicht genannt",
    location: job.location || "Standort nicht genannt",
    salary: job.salary || "Keine Verguetung angegeben",
  }));
}

export default function EmailDigestPreview({
  keyword,
  location,
  agencyName,
  jobs,
  options,
  onChange,
  onSimulateSend,
  simulating,
}) {
  const rows = previewRows(jobs);
  const resolvedKeyword = keyword || "Softwareentwickler";
  const resolvedLocation = location || "Berlin";
  const resolvedAgency = options.agencyName || agencyName || "Ihre Agentur";
  const greeting = options.greeting || "Guten Morgen";
  const subject = options.subject || `Neue Stellenangebote fuer ${resolvedKeyword} in ${resolvedLocation}`;

  function update(field, value) {
    onChange?.({ ...options, [field]: value });
  }

  function toggle(field) {
    onChange?.({ ...options, [field]: !options[field] });
  }

  return (
    <section className="email-preview-band" aria-label="Vorschau des taeglichen Job-Alarms">
      <div className="email-preview-copy">
        <div>
          <p className="eyebrow">WYSIWYG E-Mail-Digest</p>
          <h3>Job-Alarm live anpassen und sofort als Digest-Vorschau sehen.</h3>
        </div>
        <p>
          Passen Sie Betreff, Begruessung und sichtbare Informationsbausteine an. Die Vorschau aktualisiert sich direkt
          neben den Eingaben.
        </p>

        <div className="email-editor-grid">
          <label>
            <span>Betreffzeile</span>
            <input value={options.subject} onChange={(event) => update("subject", event.target.value)} />
          </label>
          <label>
            <span>Agenturname im Digest</span>
            <input value={options.agencyName} onChange={(event) => update("agencyName", event.target.value)} />
          </label>
          <label>
            <span>Begruessung</span>
            <input value={options.greeting} onChange={(event) => update("greeting", event.target.value)} />
          </label>
          <label>
            <span>Einleitung</span>
            <textarea value={options.intro} onChange={(event) => update("intro", event.target.value)} rows={4} />
          </label>
        </div>

        <div className="email-toggle-group">
          {[
            ["showSalary", "Gehaltsangabe anzeigen"],
            ["showLocation", "Standort anzeigen"],
            ["showApplyLink", "Bewerbungslink anzeigen"],
          ].map(([field, label]) => (
            <button className="toggle-chip" type="button" key={field} onClick={() => toggle(field)}>
              <ToggleLeft size={18} className={options[field] ? "toggle-on" : ""} />
              {label}
            </button>
          ))}
        </div>

        <button className="primary-action" type="button" onClick={onSimulateSend} disabled={simulating}>
          <SendHorizontal size={18} />
          {simulating ? "Versand wird simuliert..." : "Versand simulieren"}
        </button>
      </div>

      <div className="digest-mockup" role="presentation">
        <div className="digest-mockup-header">
          <div>
            <span>KhalfaJobs Job-Alarm</span>
            <strong>{subject}</strong>
          </div>
          <div className="digest-mockup-badge">
            <Clock3 size={16} aria-hidden="true" />
            06:00 Uhr
          </div>
        </div>

        <div className="digest-mockup-intro">
          <MailCheck size={18} aria-hidden="true" />
          <p>
            {greeting} <strong>{resolvedAgency}</strong>, {options.intro}
          </p>
        </div>

        <div className="digest-mockup-list">
          {rows.map((row) => (
            <article className="digest-mockup-item" key={row.id}>
              <div className="digest-mockup-item-copy">
                <strong>{row.title}</strong>
                <span>{row.employer}</span>
                {options.showLocation ? (
                  <span className="digest-location">
                    <MapPin size={14} aria-hidden="true" />
                    {row.location}
                  </span>
                ) : null}
                {options.showSalary && row.salary !== "Keine Verguetung angegeben" ? (
                  <span className="digest-salary">
                    <WalletCards size={14} aria-hidden="true" />
                    {row.salary}
                  </span>
                ) : null}
              </div>
              {options.showApplyLink ? (
                <span className="digest-open-link">
                  Zur Stelle
                  <ArrowRight size={14} aria-hidden="true" />
                </span>
              ) : null}
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
