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
  return (
    <>
      <button className="quick-search-chip terminal-toggle" type="button" onClick={onToggle}>
        {isOpen ? "Suchstatus ausblenden" : "Suchstatus einblenden"}
      </button>

      {Boolean(isOpen || loading || logs.length) && (
        <section className="search-status-panel" aria-label="Live-Suchstatus">
          <div className="search-status-header">
            <div className="search-status-heading">
              <strong>{status.title}</strong>
              <p>{status.summary}</p>
            </div>
            <span className={`search-status-badge search-status-badge-${status.badge.toLowerCase()}`}>
              {status.badge}
            </span>
          </div>
          <div className="search-status-body">
            {(logs.length ? logs : ["Keine laufende Suche. Die naechste Abfrage erscheint hier automatisch."]).map((line, index) => (
              <div key={`${line}-${index}`} className="status-line">
                <span className="status-dot" aria-hidden="true" />
                <span>{line}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
