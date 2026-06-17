import JobCardSkeleton from "../components/JobCardSkeleton";

export default function Loading() {
  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Anwendungsidentitaet">
        <span>BA</span>
        <span>LIVE</span>
        <span>SAAS</span>
      </aside>
      <section className="workspace">
        <header className="masthead">
          <div>
            <p className="eyebrow">Oeffentliche Suche der Bundesagentur fuer Arbeit</p>
            <h1>Deutsches Stellenregister</h1>
          </div>
        </header>
        <section className="results-grid" aria-label="Anwendung wird geladen">
          {Array.from({ length: 6 }).map((_, index) => (
            <JobCardSkeleton key={index} />
          ))}
        </section>
      </section>
    </main>
  );
}
