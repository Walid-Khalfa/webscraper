import { Building2, ExternalLink, Heart, MapPin, MessageSquareText, MoveRight, Star, WalletCards } from "lucide-react";

const statusLabels = {
  interested: "Interessiert",
  applied: "Beworben",
  interview: "Interview",
  closed: "Abgelehnt / Angebot",
};

export default function JobCard({
  job,
  viewMode = "grid",
  isFavorite = false,
  favoriteData,
  onToggleFavorite,
  onOpenFavorite,
  onCycleStatus,
}) {
  const detailUrl = job.reference ? `/jobs/${encodeURIComponent(job.reference)}` : "";
  const hasSalary = job.salary && job.salary !== "Keine Vergütung angegeben";
  const compact = viewMode === "list" || viewMode === "kanban";

  return (
    <article className={`job-card job-card-${viewMode}`}>
      <div className="job-card-top">
        <div className="job-card-reference-stack">
          {detailUrl ? (
            <a className="reference" href={detailUrl} aria-label={`${job.title} Detailseite öffnen`}>
              {job.reference}
            </a>
          ) : (
            <span className="reference">{job.reference}</span>
          )}
          {favoriteData?.status ? <span className="job-status-pill">{statusLabels[favoriteData.status]}</span> : null}
        </div>
        <div className="job-card-actions-top">
          <button
            className={`icon-button${isFavorite ? " active" : ""}`}
            type="button"
            aria-label={isFavorite ? "Favorit entfernen" : "Als Favorit speichern"}
            onClick={() => onToggleFavorite?.(job)}
          >
            {isFavorite ? <Star size={18} /> : <Heart size={18} />}
          </button>
          {detailUrl ? (
            <a className="icon-link" href={detailUrl} aria-label="SEO-Detailseite öffnen">
              <ExternalLink size={18} />
            </a>
          ) : null}
        </div>
      </div>

      <h3>{detailUrl ? <a href={detailUrl}>{job.title}</a> : job.title}</h3>

      <div className="meta-line">
        <Building2 size={18} aria-hidden="true" />
        <span>{job.employer}</span>
      </div>
      <div className="meta-line">
        <MapPin size={18} aria-hidden="true" />
        <span>{job.location}</span>
      </div>
      <div className={`meta-line salary-line${job.salary === "Keine Vergütung angegeben" ? " muted-salary" : ""}`}>
        <WalletCards size={18} aria-hidden="true" />
        <div className="salary-stack">
          <span>{job.salary || "Keine Vergütung angegeben"}</span>
          {hasSalary ? <small className="salary-badge">Vergütung standardisiert</small> : null}
        </div>
      </div>

      <div className="job-card-footer">
        {job.occupation ? <p className="occupation">{job.occupation}</p> : <span />}
        <div className="job-card-footer-actions">
          {isFavorite ? (
            <>
              <button className="mini-action" type="button" onClick={() => onOpenFavorite?.(job.reference)}>
                <MessageSquareText size={16} />
                Notiz
              </button>
              <button className="mini-action" type="button" onClick={() => onCycleStatus?.(job.reference)}>
                <MoveRight size={16} />
                Status
              </button>
            </>
          ) : null}
          {job.url ? (
            <a
              className={`apply-link${compact ? " apply-link-compact" : ""}`}
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${job.title} bei der Quelle öffnen`}
            >
              Zur Stelle
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
