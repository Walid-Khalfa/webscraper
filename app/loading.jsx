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
            <p className="eyebrow">Recherche für Recruiting-Agenturen</p>
            <h1>KhalfaJobs wird vorbereitet</h1>
          </div>
        </header>
        <section className="results-grid" aria-label="Inhalte werden geladen">
          {Array.from({ length: 6 }).map((_, index) => (
            <JobCardSkeleton key={index} />
          ))}
        </section>
      </section>
    </main>
  );
}
