import JobCardSkeleton from "../components/JobCardSkeleton";

export default function Loading() {
  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Anwendungsidentität">
        <span>BA</span>
        <span>LIVE</span>
        <span>SAAS</span>
      </aside>
      <section className="workspace">
        <header className="masthead">
          <div>
            <p className="eyebrow">Öffentliche Suche der Bundesagentur für Arbeit</p>
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
