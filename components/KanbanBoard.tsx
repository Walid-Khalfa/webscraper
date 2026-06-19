import JobCard from "./JobCard";

type FavoriteEntry = {
  job: any;
  status: string;
};

type KanbanColumn = {
  status: string;
  jobs: FavoriteEntry[];
};

type KanbanBoardProps = {
  columns: KanbanColumn[];
  statusLabels: Record<string, string>;
  draggingRef: string | null;
  onDropCard: (status: string) => void;
  onStartDrag: (reference: string) => void;
  onEndDrag: () => void;
  onToggleFavorite: (job: any) => void;
  onOpenFavorite: (reference: string) => void;
  onCycleStatus: (reference: string) => void;
};

export default function KanbanBoard({
  columns,
  statusLabels,
  draggingRef,
  onDropCard,
  onStartDrag,
  onEndDrag,
  onToggleFavorite,
  onOpenFavorite,
  onCycleStatus,
}: KanbanBoardProps) {
  return (
    <section className="kanban-board" aria-label="Job-Tracker Kanban">
      {columns.map((column) => (
        <article
          key={column.status}
          className="kanban-column"
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggingRef) onDropCard(column.status);
            onEndDrag();
          }}
        >
          <div className="kanban-column-header">
            <strong>{statusLabels[column.status]}</strong>
            <span>{column.jobs.length}</span>
          </div>
          <div className="kanban-column-body">
            {column.jobs.length ? (
              column.jobs.map((entry) => (
                <div key={entry.job.reference} draggable onDragStart={() => onStartDrag(entry.job.reference)}>
                  <JobCard
                    job={entry.job}
                    viewMode="kanban"
                    isFavorite
                    favoriteData={entry}
                    onToggleFavorite={onToggleFavorite}
                    onOpenFavorite={onOpenFavorite}
                    onCycleStatus={onCycleStatus}
                  />
                </div>
              ))
            ) : (
              <p className="kanban-empty">Noch keine gespeicherten Treffer in dieser Spalte.</p>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

