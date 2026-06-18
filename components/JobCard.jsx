import { Building2, ExternalLink, MapPin, WalletCards } from "lucide-react";

export default function JobCard({ job }) {
  const detailUrl = job.reference ? `/jobs/${encodeURIComponent(job.reference)}` : "";
  const hasSalary = job.salary && job.salary !== "Keine Verguetung angegeben";

  return (
    <article className="job-card">
      <div className="job-card-top">
        {detailUrl ? (
          <a className="reference" href={detailUrl} aria-label={`${job.title} Detailseite oeffnen`}>
            {job.reference}
          </a>
        ) : (
          <span className="reference">{job.reference}</span>
        )}
        {detailUrl ? (
          <a className="icon-link" href={detailUrl} aria-label="SEO-Detailseite oeffnen">
            <ExternalLink size={18} />
          </a>
        ) : null}
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
      <div className={`meta-line salary-line${job.salary === "Keine Verguetung angegeben" ? " muted-salary" : ""}`}>
        <WalletCards size={18} aria-hidden="true" />
        <div className="salary-stack">
          <span>{job.salary || "Keine Verguetung angegeben"}</span>
          {hasSalary ? <small className="salary-badge">Verguetung standardisiert</small> : null}
        </div>
      </div>
      <div className="job-card-footer">
        {job.occupation ? <p className="occupation">{job.occupation}</p> : <span />}
        {job.url ? (
          <a className="apply-link" href={job.url} target="_blank" rel="noopener noreferrer" aria-label={`${job.title} bei der Quelle oeffnen`}>
            Zur Stelle
          </a>
        ) : null}
      </div>
    </article>
  );
}
