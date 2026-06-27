import ProductTopbar from "../../components/ProductTopbar";
import SiteFooter from "../../components/SiteFooter";
import { legalContact, legalFieldsMissing } from "../../lib/site-config";

export const metadata = {
  title: "Impressum",
  description: "Impressum und Anbieterkennzeichnung für KhalfaJobs.",
  alternates: { canonical: "/impressum" },
  openGraph: {
    title: "Impressum | KhalfaJobs",
    description: "Impressum und Anbieterkennzeichnung für KhalfaJobs.",
    url: "/impressum",
  },
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
        <ProductTopbar />
        <header className="job-detail-hero legal-hero">
          <p className="eyebrow">Gesetzliche Angaben</p>
          <h1>Impressum</h1>
          <p>Die Pflichtangaben für den deutschen Markt sind sichtbar angelegt und müssen vor dem Live-Betrieb mit den echten Unternehmensdaten vervollständigt werden.</p>
        </header>

        {legalFieldsMissing.length ? (
          <section className="compliance-note" aria-label="Offene Pflichtangaben">
            <strong>Vor Veröffentlichung ergänzen:</strong>
            <ul>
              {legalFieldsMissing.map(([label]) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="job-detail-section legal-grid">
          <div>
            <h2>Diensteanbieter</h2>
            <p>
              <strong>{legalContact.businessName}</strong><br />
              {legalContact.ownerName}<br />
              {legalContact.street}<br />
              {legalContact.postalCode} {legalContact.city}<br />
              {legalContact.country}
            </p>
          </div>

          <div>
            <h2>Kontakt</h2>
            <p>
              E-Mail: <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a><br />
              Telefon: {legalContact.phone}<br />
              Website: <a href={legalContact.website}>{legalContact.website}</a>
            </p>
          </div>

          <div>
            <h2>Verantwortlich für den Inhalt</h2>
            <p>
              {legalContact.contentResponsible}<br />
              {legalContact.street}<br />
              {legalContact.postalCode} {legalContact.city}
            </p>
          </div>

          <div>
            <h2>Register und Umsatzsteuer</h2>
            <p>
              Registergericht: {legalContact.commercialRegisterCourt}<br />
              Registernummer: {legalContact.commercialRegisterNumber}<br />
              USt-IdNr. gemäß § 27a UStG: {legalContact.vatId}
            </p>
          </div>

          <div>
            <h2>Streitschlichtung</h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit:
              {" "}
              <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
                ec.europa.eu/consumers/odr
              </a>.
              {" "}
              Eine Teilnahme an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle erfolgt nur, wenn dies gesetzlich erforderlich ist.
            </p>
          </div>
        </section>

        <SiteFooter />
      </article>
    </main>
  );
}
