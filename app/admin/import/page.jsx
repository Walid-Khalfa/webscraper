import ProductTopbar from "../../../components/ProductTopbar";
import SiteFooter from "../../../components/SiteFooter";
import AdminImportConsole from "../../../components/AdminImportConsole";
import { countImportedJobs, getLatestImportRun } from "../../api/_lib/ba-import-store";

export const metadata = {
  title: "Import Admin",
  description: "Interne Übersicht für BA-Importe, Import-Status und Testläufe.",
  robots: { index: false, follow: false },
};

export default async function AdminImportPage() {
  const [latestRun, totalJobs] = await Promise.all([
    getLatestImportRun("bundesagentur"),
    countImportedJobs("bundesagentur"),
  ]);

  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Admin">
        <span>BA</span>
        <span>IMPORT</span>
        <span>ADMIN</span>
      </aside>
      <article className="workspace legal-page">
        <ProductTopbar />
        <header className="job-detail-hero legal-hero">
          <p className="eyebrow">Import Admin</p>
          <h1>BA-Import überwachen und manuell auslösen</h1>
          <p>Interne Oberfläche für Testläufe, Vollimporte und die Kontrolle des zuletzt verarbeiteten Datenstands.</p>
        </header>

        <section className="interactive-dashboard" aria-label="Import-Kennzahlen">
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <p className="eyebrow">Importierte Jobs</p>
                <h3>Persistierte Datensätze</h3>
              </div>
            </div>
            <strong style={{ fontSize: "2rem" }}>{totalJobs}</strong>
          </article>
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <p className="eyebrow">Letzter Lauf</p>
                <h3>Status und Umfang</h3>
              </div>
            </div>
            <p style={{ margin: 0 }}><strong>Status:</strong> {latestRun?.status || "Noch kein Lauf"}</p>
            <p style={{ margin: "6px 0 0" }}><strong>Neue Jobs:</strong> {latestRun?.new_count || 0}</p>
            <p style={{ margin: "6px 0 0" }}><strong>Aktualisiert:</strong> {latestRun?.updated_count || 0}</p>
          </article>
        </section>

        <AdminImportConsole />
        <SiteFooter />
      </article>
    </main>
  );
}
