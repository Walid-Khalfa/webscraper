import ProductTopbar from "../../components/ProductTopbar";
import SiteFooter from "../../components/SiteFooter";
import { legalContact } from "../../lib/site-config";

export const metadata = {
  title: "Kontakt",
  description: "Kontakt und Demo-Anfrage für KhalfaJobs.",
  alternates: { canonical: "/kontakt" },
  openGraph: {
    title: "Kontakt | KhalfaJobs",
    description: "Kontakt und Demo-Anfrage für KhalfaJobs.",
    url: "/kontakt",
  },
};

export default function KontaktPage() {
  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Anwendungsidentität">
        <span>BA</span>
        <span>DEMO</span>
        <span>TALK</span>
      </aside>
      <article className="workspace legal-page">
        <ProductTopbar />
        <header className="job-detail-hero legal-hero">
          <p className="eyebrow">Kontakt</p>
          <h1>Demo oder Rückfrage anfragen</h1>
          <p>Für Preisgespräche, Agenturzugänge oder Rückfragen zur Datenquelle kann der Kontakt direkt per E-Mail erfolgen.</p>
        </header>

        <section className="job-detail-section legal-grid">
          <div>
            <h2>E-Mail</h2>
            <p><a href={`mailto:${legalContact.email}`}>{legalContact.email}</a></p>
          </div>
          <div>
            <h2>Ansprechpartner</h2>
            <p>{legalContact.ownerName}</p>
          </div>
          <div>
            <h2>Hinweis</h2>
            <p>Für eine rechtssichere Kontaktseite sollten vor dem produktiven Launch zusätzlich vollständige Unternehmens- und Adressdaten im Impressum hinterlegt sein.</p>
          </div>
        </section>

        <SiteFooter />
      </article>
    </main>
  );
}
