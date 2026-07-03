import ProductTopbar from "../../components/ProductTopbar";
import SiteFooter from "../../components/SiteFooter";
import { dataSourceHighlights } from "../../lib/site-config";

export const metadata = {
  title: "Datenbasis",
  description: "Informationen zur Datenbasis, Verarbeitung und Einordnung von KhalfaJobs.",
  alternates: { canonical: "/datenquelle" },
  openGraph: {
    title: "Datenbasis | KhalfaJobs",
    description: "Informationen zur Datenbasis, Verarbeitung und Einordnung von KhalfaJobs.",
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
          <h1>Die Datenbasis hinter KhalfaJobs</h1>
          <p>KhalfaJobs veröffentlicht keine eigenen Stelleninhalte. Die Plattform strukturiert öffentlich verfügbare BA-Stellenanzeigen für einen schnelleren, professionellen Recruiting-Workflow.</p>
        </header>

        <section className="job-detail-section legal-grid">
          <div>
            <h2>Wofür die Plattform genutzt wird</h2>
            <ul className="legal-list">
              <li>BA-Stellenanzeigen live recherchieren</li>
              <li>Treffer nach Rolle, Region und Arbeitgeber eingrenzen</li>
              <li>Relevante Ergebnisse als Shortlist speichern</li>
              <li>Wiederkehrende Recherchen per Alert überwachen</li>
            </ul>
          </div>

          <div>
            <h2>Technische Einordnung</h2>
            <ul className="legal-list">
              {dataSourceHighlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2>Wichtige Abgrenzung</h2>
            <p>Die Originalanzeige bei der Bundesagentur für Arbeit bleibt die maßgebliche Primärquelle. KhalfaJobs beschleunigt Recherche, Monitoring und Export, ersetzt aber nicht die Quelle selbst.</p>
          </div>
        </section>

        <SiteFooter />
      </article>
    </main>
  );
}
