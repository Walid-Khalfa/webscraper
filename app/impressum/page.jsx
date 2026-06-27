import Link from "next/link";

export const metadata = {
  title: "Impressum | KhalfaJobs",
  description: "Rechtliche Angaben und Impressum für den Online-Dienst KhalfaJobs gemäß § 5 TMG.",
  robots: { index: false, follow: true },
};

export default function ImpressumPage() {
  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Anwendungsidentität">
        <span>BA</span>
        <span>RECHT</span>
        <span>INFO</span>
      </aside>
      <article className="workspace legal-page">
        <Link className="back-link" href="/">
          ← Zurück zur Recruiting-Suche
        </Link>
        <header className="job-detail-hero" style={{ marginBottom: "30px" }}>
          <p className="eyebrow">Gesetzliche Angaben</p>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", margin: "10px 0" }}>Impressum</h1>
          <p>Angaben gemäß § 5 TMG und Verantwortlichkeit für den Inhalt.</p>
        </header>

        <section className="job-detail-section" style={{ display: "grid", gap: "24px", lineHeight: "1.6" }}>
          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              Diensteanbieter
            </h2>
            <p>
              <strong>KhalfaJobs</strong><br />
              Walid Khalfa<br />
              c/o WebScraper Project Team<br />
              Musterstraße 12<br />
              10115 Berlin<br />
              Deutschland
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              Kontakt
            </h2>
            <p>
              E-Mail: <a href="mailto:alerts@khalfajobs.me" style={{ color: "var(--signal-dark)", textDecoration: "underline" }}>alerts@khalfajobs.me</a><br />
              Telefon: +49 (0) 30 12345678 (Dummy-Support)<br />
              Webseite: <a href="https://emploi-agences-next.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: "var(--signal-dark)", textDecoration: "underline" }}>https://emploi-agences-next.vercel.app</a>
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              Vertretungsberechtigte Person
            </h2>
            <p>Walid Khalfa (Inhaber / Projektleiter)</p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              Register und Steuern
            </h2>
            <p>
              <strong>Registergericht:</strong> Amtsgericht Berlin-Charlottenburg<br />
              <strong>Registernummer:</strong> HRB 123456 B (Dummy)<br />
              <strong>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:</strong> DE 123456789 (Dummy)
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
            </h2>
            <p>
              Walid Khalfa<br />
              Musterstraße 12<br />
              10115 Berlin
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              Haftung und Streitschlichtung
            </h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit, die Sie unter{" "}
              <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" style={{ color: "var(--signal-dark)", textDecoration: "underline" }}>
                https://ec.europa.eu/consumers/odr
              </a>{" "}
              finden. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", borderBottom: "3px solid var(--line)", paddingBottom: "8px", marginBottom: "12px" }}>
              Hoster
            </h2>
            <p>
              Vercel Inc.<br />
              650 2nd St<br />
              San Francisco, CA 94107<br />
              USA<br />
              E-Mail: support@vercel.com
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
