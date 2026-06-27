import ProductTopbar from "../../components/ProductTopbar";
import SiteFooter from "../../components/SiteFooter";
import { dataSourceHighlights } from "../../lib/site-config";

export const metadata = {
  title: "Datenquelle",
  description: "Informationen zur Datenquelle und technischen Einordnung von KhalfaJobs.",
  alternates: { canonical: "/datenquelle" },
  openGraph: {
    title: "Datenquelle | KhalfaJobs",
    description: "Informationen zur Datenquelle und technischen Einordnung von KhalfaJobs.",
    url: "/datenquelle",
  },
};

export default function DatenquellePage() {
  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Anwendungsidentität">
        <span>BA</span>
        <span>DATA</span>
        <span>INFO</span>
      </aside>
      <article className="workspace legal-page">
        <ProductTopbar />
        <header className="job-detail-hero legal-hero">
          <p className="eyebrow">Datenbasis</p>
          <h1>Datenquelle und Einordnung</h1>
          <p>KhalfaJobs richtet sich an Recruiting-Agenturen, nutzt aber keine eigenen Stelleninhalte. Die Plattform strukturiert die öffentlich zugänglichen Stellenangebote der Bundesagentur für Arbeit für Suche, Favoriten, Alerts und Export.</p>
        </header>

        <section className="job-detail-section legal-grid">
          <div>
            <h2>Was die Plattform macht</h2>
            <ul className="legal-list">
              <li>Stellenangebote live durchsuchen</li>
              <li>Treffer nach Region und Rolle filtern</li>
              <li>Favoriten und Shortlists vorbereiten</li>
              <li>Job-Alarme für wiederkehrende Recherchen verwalten</li>
            </ul>
          </div>

          <div>
            <h2>Technische Hinweise</h2>
            <ul className="legal-list">
              {dataSourceHighlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2>Wichtige Abgrenzung</h2>
            <p>Die Originalanzeige bei der Bundesagentur für Arbeit bleibt die maßgebliche Quelle. KhalfaJobs ergänzt die Recherche um einen effizienteren B2B-Workflow, ersetzt aber nicht die Primärquelle.</p>
          </div>
        </section>

        <SiteFooter />
      </article>
    </main>
  );
}
