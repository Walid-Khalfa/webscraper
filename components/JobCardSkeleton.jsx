export default function JobCardSkeleton() {
  return (
    <article className="job-card skeleton-card" aria-hidden="true">
      <div className="skeleton-line skeleton-ref" />
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-meta" />
      <div className="skeleton-line skeleton-meta short" />
      <div className="skeleton-footer">
        <div className="skeleton-line skeleton-chip" />
        <div className="skeleton-line skeleton-button" />
      </div>
    </article>
  );
}

