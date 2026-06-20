type SearchStatus = {
  badge: string;
  title: string;
  summary: string;
};

type SearchStatusPanelProps = {
  isOpen: boolean;
  loading: boolean;
  logs: string[];
  status: SearchStatus;
  onToggle: () => void;
};

export default function SearchStatusPanel({ isOpen, loading, logs, status, onToggle }: SearchStatusPanelProps) {
  const hasTechnicalDetails = Boolean(logs.length);

  return (
    <section className="search-status-panel search-status-panel-compact" aria-label={status.title}>
      <div className="search-status-header">
        <div className="search-status-heading">
          <strong>{status.title}</strong>
          <p>{status.summary}</p>
        </div>
        <span className={`search-status-badge search-status-badge-${status.badge.toLowerCase()}`}>{status.badge}</span>
      </div>

      <div className="search-status-meta">
        <span>{loading ? "Live-Aktualisierung laeuft" : "Status fuer Recruiter aufbereitet"}</span>
        {hasTechnicalDetails ? (
          <button className="search-status-details-toggle" type="button" onClick={onToggle} aria-expanded={isOpen}>
            {isOpen ? "Technische Details ausblenden" : "Technische Details anzeigen"}
          </button>
        ) : null}
      </div>

      {hasTechnicalDetails && isOpen ? (
        <div className="search-status-body">
          {logs.map((line, index) => (
            <div key={`${line}-${index}`} className="status-line">
              <span className="status-dot" aria-hidden="true" />
              <span>{line}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
