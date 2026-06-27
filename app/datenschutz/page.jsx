import Link from "next/link";

export const metadata = {
  title: "Datenschutzerklärung | KhalfaJobs",
  description: "Datenschutzerklärung für die Nutzung von KhalfaJobs gemäß der Datenschutz-Grundverordnung (DS-GVO).",
  robots: { index: false, follow: true },
};

export default function DatenschutzPage() {
  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Anwendungsidentität">
        <span>BA</span>
        <span>DSGVO</span>
        <span>INFO</span>
      </aside>
      <article className="workspace legal-page">
        <Link className="back-link" href="/">
          ← Zurück zur Recruiting-Suche
        </Link>
        <header className="job-detail-hero" style={{ marginBottom: "30px" }}>
          <p className="eyebrow">Datenschutzkonforme Nutzung</p>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", margin: "10px 0" }}>Datenschutzerklärung</h1>
          <p>Informationen über die Verarbeitung Ihrer personenbezogenen Daten gemäß Art. 13 und 14 DS-GVO.</p>
        </header>

        <section className="job-detail-section" style={{ display: "grid", gap: "24px", lineHeight: "1.6" }}>
          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              1. Name und Kontaktdaten des Verantwortlichen
            </h2>
            <p>
              Verantwortlicher im Sinne des Art. 4 Nr. 7 DS-GVO ist:<br />
              Walid Khalfa<br />
              Musterstraße 12<br />
              10115 Berlin<br />
              Deutschland<br />
              E-Mail: <a href="mailto:alerts@khalfajobs.me" style={{ color: "var(--signal-dark)", textDecoration: "underline" }}>alerts@khalfajobs.me</a>
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              2. Erhebung und Speicherung personenbezogener Daten sowie Art und Zweck deren Verwendung
            </h2>
            <p>
              <strong>a) Beim Besuch der Website:</strong><br />
              Beim Aufrufen unserer Website werden durch den auf Ihrem Endgerät zum Einsatz kommenden Browser automatisch Informationen an den Server unserer Website (bzw. an unseren Hoster Vercel) gesendet. Diese Logs (z. B. IP-Adresse, Datum/Uhrzeit) werden temporär verarbeitet, um eine reibungslose Verbindung und Systemsicherheit zu gewährleisten (Rechtsgrundlage: Art. 6 Abs. 1 lit. f DS-GVO).
            </p>
            <p>
              <strong>b) Bei Nutzung der Job-Suche und des CSV-Exports:</strong><br />
              Wenn Sie Stellenangebote suchen, leiten wir Ihre Suchbegriffe und Ihren Standort an die API der Bundesagentur für Arbeit (BA) weiter, um die Ergebnisse live abzurufen. Falls Sie eine Agentur-Schnittstelle nutzen, protokollieren wir den Export statistisch in unserer BDD (Rechtsgrundlage: Art. 6 Abs. 1 lit. b und f DS-GVO zur Erfüllung des Nutzungsvertrags und Wahrung berechtigter B2B-Interessen).
            </p>
            <p>
              <strong>c) Bei Aktivierung des Job-Alarms (Newsletter-Digest):</strong><br />
              Wenn Sie als registrierte Agentur einen Job-Alarm einrichten, speichern wir Ihre E-Mail-Adresse sowie die gewählten Kriterien (Beruf, Standort, Intervall) in unserer PostgreSQL-Datenbank. Die Verarbeitung erfolgt zum Zweck der regelmäßigen Zusendung passender Stellenangebote (Rechtsgrundlage: Art. 6 Abs. 1 lit. b DS-GVO).
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              3. Weitergabe von Daten und Empfänger
            </h2>
            <p>
              <strong>Hoster:</strong> Unsere Website wird bei Vercel Inc. gehostet. Vercel verarbeitet die Zugriffsdaten in unserem Auftrag als Auftragsverarbeiter auf Grundlage eines entsprechenden Vertrags gemäß Art. 28 DS-GVO.
            </p>
            <p>
              <strong>E-Mail-Zustellungsdienst (Resend):</strong> Der Versand des täglichen Job-Digests erfolgt über den E-Mail-Dienst <strong>Resend Inc.</strong> (USA). Da Resend Server in den USA betreibt, haben wir mit Resend die EU-Standardvertragsklauseln (Standard Contractual Clauses - SCC) abgeschlossen, um ein angemessenes Datenschutzniveau gemäß Art. 46 Abs. 2 lit. c DS-GVO abzusichern.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              4. Cookies und lokaler Speicher (LocalStorage)
            </h2>
            <p>
              Wir setzen ausschließlich technisch notwendige Speicherverfahren ein. Die Verwaltung Ihrer Favoriten und Ihres Job-Trackers (Kanban-Board) erfolgt lokal auf Ihrem Endgerät im sogenannten <strong>LocalStorage</strong> Ihres Browsers. 
            </p>
            <p>
              Diese Daten werden zu keinem Zeitpunkt an unsere Server übertragen, es sei denn, Sie lösen explizit einen Export an Ihre verbundenen CRM-Systeme aus. Es werden keine zustimmungspflichtigen Tracking- oder Werbe-Cookies verwendet (gemäß TDDDG).
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              5. Speicherdauer
            </h2>
            <p>
              Ihre E-Mail-Adresse und Kriterien für Job-Alarme bleiben so lange gespeichert, wie das Abonnement aktiv ist. Löschen Sie das Abonnement über die API oder den Abmelde-Link im Footer der E-Mail, werden Ihre Daten unverzüglich und vollständig aus unseren Systemen entfernt.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              6. Rechte der betroffenen Person
            </h2>
            <p>
              Sie haben das Recht:
            </p>
            <ul style={{ paddingLeft: "20px" }}>
              <li>gemäß Art. 15 DS-GVO Auskunft über Ihre von uns verarbeiteten personenbezogenen Daten zu verlangen;</li>
              <li>gemäß Art. 16 DS-GVO unverzüglich die Berichtigung unrichtiger oder Vervollständigung Ihrer bei uns gespeicherten Daten zu verlangen;</li>
              <li>gemäß Art. 17 DS-GVO die Löschung Ihrer bei uns gespeicherten personenbezogenen Daten zu verlangen (Recht auf Vergessenwerden);</li>
              <li>gemäß Art. 21 DS-GVO Widerspruch gegen die Verarbeitung Ihrer personenbezogenen Daten einzulegen.</li>
            </ul>
            <p style={{ marginTop: "12px" }}>
              Zur Ausübung dieser Rechte wenden Sie sich einfach per E-Mail an <a href="mailto:alerts@khalfajobs.me" style={{ color: "var(--signal-dark)", textDecoration: "underline" }}>alerts@khalfajobs.me</a>.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              7. Beschwerderecht bei einer Aufsichtsbehörde
            </h2>
            <p>
              Sie haben gemäß Art. 77 DS-GVO das Recht, sich bei einer Aufsichtsbehörde zu beschweren. In der Regel können Sie sich hierfür an die Aufsichtsbehörde Ihres üblichen Aufenthaltsortes oder unseres Unternehmenssitzes wenden (z. B. Berliner Beauftragte für Datenschutz und Informationsfreiheit).
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
