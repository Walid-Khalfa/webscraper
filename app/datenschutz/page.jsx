import ProductTopbar from "../../components/ProductTopbar";
import SiteFooter from "../../components/SiteFooter";
import { legalContact, legalFieldsMissing } from "../../lib/site-config";

export const metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzhinweise für KhalfaJobs nach DSGVO.",
  alternates: { canonical: "/datenschutz" },
  openGraph: {
    title: "Datenschutzerklärung | KhalfaJobs",
    description: "Datenschutzhinweise für KhalfaJobs nach DSGVO.",
    url: "/datenschutz",
  },
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
        <ProductTopbar />
        <header className="job-detail-hero legal-hero">
          <p className="eyebrow">Datenschutzhinweise</p>
          <h1>Datenschutzerklärung</h1>
          <p>Die Datenschutzerklärung ist auf die im Projekt erkennbare technische Architektur abgestimmt und markiert Felder, die vor dem Launch mit den tatsächlichen Rechts- und Kontaktdaten ergänzt werden müssen.</p>
        </header>

        {legalFieldsMissing.length ? (
          <section className="compliance-note" aria-label="Offene Datenschutzangaben">
            <strong>Bitte vor dem Launch prüfen und ergänzen:</strong>
            <ul>
              <li>Verantwortlicher mit vollständiger Postanschrift</li>
              <li>Telefon oder weiterer direkter Kontaktkanal</li>
              <li>Tatsächlich aktivierte Drittanbieter und Analytics-Tools</li>
            </ul>
          </section>
        ) : null}

        <section className="job-detail-section legal-grid">
          <div>
            <h2>1. Verantwortlicher</h2>
            <p>
              {legalContact.ownerName}<br />
              {legalContact.businessName}<br />
              E-Mail: <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a>
            </p>
          </div>

          <div>
            <h2>2. Verarbeitung bei der Nutzung der Suche</h2>
            <p>Bei Suchanfragen werden Suchbegriffe, Standort und technische Zugriffsdaten verarbeitet, um Ergebnisse der Bundesagentur für Arbeit live abzurufen und auszuliefern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und lit. f DSGVO.</p>
          </div>

          <div>
            <h2>3. Job-Alarm und E-Mail-Zustellung</h2>
            <p>Für Job-Alarme werden E-Mail-Adresse, Suchkriterien und Versandintervall gespeichert. Der Versand erfolgt über Resend. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO; bei Marketing- oder Analyseerweiterungen sind die tatsächlichen Zwecke gesondert zu dokumentieren.</p>
          </div>

          <div>
            <h2>4. Hosting und eingesetzte Dienste</h2>
            <p>Das Projekt ist für Hosting über Vercel, E-Mail-Zustellung über Resend und Live-Abfragen an die Schnittstelle der Bundesagentur für Arbeit ausgelegt. Analytics-Endpunkte für Plausible oder PostHog sind im Code vorbereitet und dürfen nur dann in dieser Erklärung genannt werden, wenn sie in der Produktionsumgebung tatsächlich aktiviert sind.</p>
          </div>

          <div>
            <h2>5. Speicherfristen</h2>
            <p>Server-Logs werden nur so lange gespeichert, wie es für Betriebssicherheit und Fehleranalyse erforderlich ist. Job-Alarm-Daten bleiben bis zur Löschung des Abonnements oder bis zum Ende des Vertragsverhältnisses gespeichert.</p>
          </div>

          <div>
            <h2>6. Cookies, Local Storage und Tracking</h2>
            <p>Für Favoriten, Ansichtsoptionen und lokale Bedienzustände wird Local Storage verwendet. Zustimmungspflichtige Tracking- oder Marketing-Cookies sollten erst nach tatsächlicher Aktivierung und mit passendem Consent-Mechanismus produktiv eingesetzt werden.</p>
          </div>

          <div>
            <h2>7. Rechte betroffener Personen</h2>
            <p>Sie haben insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Anfragen können an <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a> gerichtet werden.</p>
          </div>

          <div>
            <h2>8. Beschwerderecht</h2>
            <p>Betroffene Personen haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren. Zuständig ist in der Regel die Aufsichtsbehörde am Sitz des Verantwortlichen.</p>
          </div>
        </section>

        <SiteFooter />
      </article>
    </main>
  );
}
