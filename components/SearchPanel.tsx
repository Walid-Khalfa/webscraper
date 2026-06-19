import type { ReactNode } from "react";
import SearchStatusPanel from "./SearchStatusPanel";

type TrustItem = {
  label: string;
  value: string;
};

type QuickSearch = {
  keyword: string;
  location: string;
};

type SearchStatus = {
  badge: string;
  title: string;
  summary: string;
};

type SearchPanelProps = {
  form: ReactNode;
  trustItems: TrustItem[];
  quickSearches: QuickSearch[];
  onQuickSearch: (keyword: string, location: string) => void;
  isStatusOpen: boolean;
  loading: boolean;
  consoleLogs: string[];
  liveSearchStatus: SearchStatus;
  onToggleStatus: () => void;
};

export default function SearchPanel({
  form,
  trustItems,
  quickSearches,
  onQuickSearch,
  isStatusOpen,
  loading,
  consoleLogs,
  liveSearchStatus,
  onToggleStatus,
}: SearchPanelProps) {
  return (
    <section className="search-stage" id="suche">
      {form}

      <div className="trust-strip" id="datenquelle" aria-label="Produkt- und API-Informationen">
        {trustItems.map((item) => (
          <div className="trust-item" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="quick-searches">
        <span className="quick-search-label">Beliebte Suchanfragen</span>
        {quickSearches.map((entry) => (
          <button
            key={`${entry.keyword}-${entry.location}`}
            className="quick-search-chip"
            type="button"
            onClick={() => onQuickSearch(entry.keyword, entry.location)}
          >
            {entry.keyword} in {entry.location}
          </button>
        ))}
        <SearchStatusPanel
          isOpen={isStatusOpen}
          loading={loading}
          logs={consoleLogs}
          status={liveSearchStatus}
          onToggle={onToggleStatus}
        />
      </div>
    </section>
  );
}
