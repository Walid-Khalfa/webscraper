"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BadgeCheck,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  FolderKanban,
  History,
  KeyRound,
  LayoutGrid,
  List,
  LoaderCircle,
  LogOut,
  Mail,
  PanelRightClose,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Columns3,
  Users,
  Map as MapIcon,
} from "lucide-react";
import JobCard from "./JobCard";
import JobCardSkeleton from "./JobCardSkeleton";
import ProductTopbar from "./ProductTopbar";
import SiteFooter from "./SiteFooter";
import SearchPanel from "./SearchPanel";
import ToastStack from "./ToastStack";
import ClientErrorBoundary from "./ClientErrorBoundary";
import { pricingPlans, recruitingBenefits, recruitingUseCases } from "../lib/site-config";

// Hooks
import { useUIFeedback } from "./hooks/useUIFeedback";
import { useFavorites, statusLabels, statusCycle } from "./hooks/useFavorites";
import { useSearch, buildSalaryBuckets } from "./hooks/useSearch";
import { useWorkspace } from "./hooks/useWorkspace";
import { useAlerts } from "./hooks/useAlerts";
import { useAgency } from "./hooks/useAgency";

const Dashboard = dynamic(() => import("./Dashboard"));
const KanbanBoard = dynamic(() => import("./KanbanBoard"), {
  loading: () => null,
});
const JobMap = dynamic(() => import("./JobMap"), {
  ssr: false,
  loading: () => <div style={{ height: "400px", width: "100%", background: "#f0f0f0", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>Karte wird geladen...</div>,
}) as React.ComponentType<any>;
const AlertManager = dynamic(() => import("./AlertManager"), {
  loading: () => null,
});
const EmailDigestPreview = dynamic(() => import("./EmailDigestPreview"), {
  loading: () => null,
});

const ALL_MAP_CITIES = "__all_map_cities__";

function formatFrequencyLabel(value: string) {
  const normalized = String(value || "").toLocaleLowerCase("de-DE");
  if (normalized === "daily") return "Täglich";
  if (normalized === "weekly") return "Wöchentlich";
  if (normalized === "monthly") return "Monatlich";
  return value || "Individuell";
}

function normalizeSubscriptionText(value: string) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  const half = Math.floor(text.length / 2);
  if (text.length % 2 === 0 && text.slice(0, half) === text.slice(half)) return text.slice(0, half);
  return text;
}

interface HomeProps {
  initialShowcase: any;
  platformInsights: any;
}

export default function Home({ initialShowcase, platformInsights }: HomeProps) {
  // 1. UI Feedback state
  const ui = useUIFeedback();

  // 2. Parent states for linking hooks
  const [workspaceOverview, setWorkspaceOverview] = useState<any>(null);
  const [agency, setAgency] = useState<any>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [saasStatus, setSaasStatus] = useState("");
  const [saasLoading, setSaasLoading] = useState(false);

  // 3. Favorites hook
  const favs = useFavorites({
    agency,
    pushToast: ui.pushToast,
    setWorkspaceOverview,
  });

  // 4. Search hook
  const search = useSearch({
    favorites: favs.favorites,
    updateFavoriteField: favs.updateFavoriteField,
    agency,
    platformInsights,
    pushToast: ui.pushToast,
    appendConsole: ui.appendConsole,
    setIsConsoleOpen: ui.setIsConsoleOpen,
  });

  // 5. Workspace hook
  const ws = useWorkspace({
    agency,
    pushToast: ui.pushToast,
    mergeFavoritesFromDossiers: favs.mergeFavoritesFromDossiers,
  });

  // 6. Alerts hook
  const alerts = useAlerts({
    agency,
    pushToast: ui.pushToast,
    setSaasStatus,
    loadWorkspace: ws.loadWorkspace,
    saasLoading,
    setSaasLoading,
    keyword: search.keyword,
    location: search.location,
  });

  // 7. Agency hook
  const ag = useAgency({
    loadWorkspace: ws.loadWorkspace,
    refreshSubscriptions: alerts.refreshSubscriptions,
    setEmailTemplateOpts: ui.setEmailTemplateOpts,
    defaultEmailTemplate: ui.defaultEmailTemplate,
    pushToast: ui.pushToast,
    setAgentOpen,
    setSubscriptions,
    setWorkspaceOverview,
    saasStatus,
    setSaasStatus,
    saasLoading,
    setSaasLoading,
  });

  // Keep parent state in sync with agency hook's local state
  useEffect(() => {
    setAgency(ag.agency);
  }, [ag.agency]);

  useEffect(() => {
    setWorkspaceOverview(ws.workspaceOverview);
  }, [ws.workspaceOverview]);

  useEffect(() => {
    setSubscriptions(alerts.subscriptions);
  }, [alerts.subscriptions]);

  // Derived state or calculations for charts
  const employerStats = useMemo(() => {
    const map = new Map<string, number>();
    search.rawJobs.forEach((job: any) => {
      map.set(job.employer, (map.get(job.employer) || 0) + 1);
    });
    return [...map.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [search.rawJobs]);

  const commercialInsights = useMemo(
    () => [
      ...recruitingBenefits,
      {
        label: "Job-Alarm",
        value: platformInsights?.activeAlerts ? `${platformInsights.activeAlerts} aktiv` : "Sofort verfügbar",
        description: "Wiederkehrende Recherchen lassen sich automatisch überwachen, ohne manuell erneut zu suchen.",
      },
      {
        label: "Standortfilter",
        value: "Präzise oder breit",
        description: "Ergebnisse lassen sich für exakte Standortrecherche oder regionale Marktbeobachtung steuern.",
      },
      {
        label: "CSV-Export",
        value: "Direkt weiterverwendbar",
        description: "Exportieren Sie Trefferlisten sofort für Kundenprojekte, Reporting oder interne Abstimmung.",
      },
    ],
    [platformInsights?.activeAlerts]
  );

  const workspaceData = workspaceOverview?.workspace || null;
  const workspaceMembers = workspaceData?.members || [];
  const workspaceSearchHistory = workspaceData?.search_history || [];
  const workspaceDossiers = workspaceData?.candidate_dossiers || [];
  const workspaceIntegrations = workspaceData?.crm_integrations || [];
  const workspaceBilling = workspaceData?.billing_account || null;
  const workspaceTrust = workspaceData?.trust || null;
  const workspaceReporting = workspaceData?.reporting || null;

  function renderSalaryChart() {
    const salaryBuckets = buildSalaryBuckets(search.rawJobs);
    const maxCount = Math.max(...salaryBuckets.map((bucket) => bucket.count), 1);
    return (
      <svg viewBox="0 0 360 180" className="chart-svg" role="img" aria-label="Vergütungsverteilung">
        {salaryBuckets.map((bucket, index) => {
          const height = (bucket.count / maxCount) * 110;
          const x = 20 + index * 82;
          const y = 140 - height;
          return (
            <g key={bucket.id} className="chart-bar-group" onClick={() => search.setSalaryBucket(bucket.id)}>
              <rect x={x} y={y} width="54" height={height} className={`chart-bar${search.salaryBucket === bucket.id ? " active" : ""}`} />
              <text x={x + 27} y={160} textAnchor="middle" className="chart-label">{bucket.label}</text>
              <text x={x + 27} y={y - 8} textAnchor="middle" className="chart-value">{bucket.count}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  function renderEmployerChart() {
    const maxCount = Math.max(...employerStats.map((bucket) => bucket.count), 1);
    return (
      <svg viewBox="0 0 360 210" className="chart-svg" role="img" aria-label="Top-Arbeitgeber">
        {employerStats.map((entry, index) => {
          const width = (entry.count / maxCount) * 220;
          const y = 18 + index * 36;
          return (
            <g key={entry.name}>
              <text x="0" y={y + 14} className="chart-label">{entry.name.slice(0, 20)}</text>
              <rect x="140" y={y} width={width} height="22" className="chart-bar secondary" />
              <text x={145 + width} y={y + 15} className="chart-value">{entry.count}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <main className="app-shell" id="top">
      {search.jobPostingJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(search.jobPostingJsonLd) }} /> : null}
      <ToastStack toasts={ui.toasts} />

      {favs.activeFavorite ? (
        <aside className="favorite-drawer" aria-label="Favoriten und Notizen">
          <div className="favorite-drawer-header">
            <div>
              <p className="eyebrow">Favorit bearbeiten</p>
              <h3>{favs.activeFavorite.job?.title || favs.activeFavoriteRef}</h3>
            </div>
            <button className="icon-button" type="button" onClick={() => favs.setActiveFavoriteRef(null)} aria-label="Seitenpanel schließen">
              <PanelRightClose size={18} />
            </button>
          </div>
          <div className="favorite-drawer-meta">
            <strong>{favs.activeFavorite.job?.employer}</strong>
            <span>{favs.activeFavorite.job?.location}</span>
          </div>
          <label>
            <span>Status</span>
            <select value={favs.activeFavorite.status} onChange={(event) => favs.updateFavoriteField(favs.activeFavoriteRef!, { status: event.target.value })}>
              {statusCycle.map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Notizen</span>
            <textarea
              rows={6}
              value={favs.activeFavorite.notes}
              onChange={(event) => favs.updateFavoriteField(favs.activeFavoriteRef!, { notes: event.target.value })}
            />
          </label>
          <label>
            <span>Tags (durch Komma getrennt)</span>
            <input
              value={(favs.activeFavorite.tags || []).join(", ")}
              onChange={(event) =>
                favs.updateFavoriteField(favs.activeFavoriteRef!, {
                  tags: event.target.value
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>

          {workspaceIntegrations.some((integration: any) => integration.status === "CONNECTED") ? (
            <div style={{ marginTop: "24px", borderTop: "2px solid #1f1d1a", paddingTop: "18px" }}>
              <p className="eyebrow" style={{ marginBottom: "8px" }}>ATS / CRM Synchronisation</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {workspaceIntegrations
                  .filter((integration: any) => integration.status === "CONNECTED")
                  .map((integration: any) => {
                    const key = `${favs.activeFavoriteRef}:${integration.provider}`;
                    const isSyncing = ws.syncingCrmCandidate[key];
                    return (
                      <button
                        key={integration.id}
                        type="button"
                        className="button"
                        disabled={isSyncing}
                        onClick={() => ws.handlePushToCrm(integration.provider, favs.activeFavoriteRef!, integration.display_name)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          justifyContent: "center",
                          width: "100%",
                          backgroundColor: "#ffce45",
                          border: "2px solid #1f1d1a",
                          padding: "10px 14px",
                          fontWeight: "bold",
                          cursor: isSyncing ? "not-allowed" : "pointer"
                        }}
                      >
                        {isSyncing ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
                        An {integration.display_name} übertragen
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}

      <aside className="registry-rail" aria-label="Anwendungsidentität">
        <span>BA</span>
        <span>LIVE</span>
        <span>SAAS</span>
      </aside>

      <section className="workspace">
        <ClientErrorBoundary
          compact
          title="Die Navigation ist momentan nicht verfügbar."
          description="Bitte laden Sie nur diesen Abschnitt neu, um die Navigation wiederherzustellen."
        >
          <ProductTopbar
            onToggleWorkspace={() => {
              setAgentOpen(true);
            }}
          />
        </ClientErrorBoundary>

        <header className="masthead hero-layout" style={{ marginBottom: "12px" }}>
          <div className="hero-primary" style={{ gap: "4px" }}>
            <p className="eyebrow">BA-Recherche für Recruiting-Agenturen</p>
            <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", lineHeight: "1.15" }}>
              BA-Stellenanzeigen für Recruiting-Agenturen schneller recherchieren, bewerten und organisieren
            </h1>
            <p className="hero-copy" style={{ margin: "4px 0 0", fontSize: "15px" }}>
              KhalfaJobs bündelt Recherche, Filter, Alerts und Export in einem Workflow, damit Recruiting-Agenturen relevante BA-Stellenanzeigen ohne manuelle Einzelsuche auswerten können.
            </p>
          </div>
          <div className="hero-proof" style={{ gap: "8px" }}>
            <div className="sync-badge" style={{ padding: "6px 10px" }}>
              <Clock size={16} aria-hidden="true" />
              Live-Daten der BA
            </div>
            <p style={{ fontSize: "13px", margin: 0 }}>
              Entwickelt für Recruiting-Agenturen, Personalberater und Executive-Search-Teams.
              <br />
              Weniger manuelle Recherche, more Struktur in Shortlists und Monitoring.
            </p>
          </div>
        </header>

        <ClientErrorBoundary
          compact
          title="Die Rechercheoberfläche konnte nicht geladen werden."
          description="Bitte laden Sie nur diesen Bereich neu, um die Suche fortzusetzen."
        >
          <SearchPanel
            form={(
              <form className="search-panel search-panel-prominent" onSubmit={search.handleSearch} onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  search.setOpenSuggest(null);
                  search.setShowAllSuggestions(true);
                }
              }}>
              <label className="suggest-field">
                <span>Position, Rolle oder Suchbegriff</span>
                <div className="suggest-input-wrap">
                  <input
                    value={search.keyword}
                    onChange={(event) => {
                      search.setKeyword(event.target.value);
                      search.setOpenSuggest("keyword");
                      search.setShowAllSuggestions(false);
                    }}
                    onFocus={() => {
                      search.setOpenSuggest("keyword");
                      search.setShowAllSuggestions(true);
                    }}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    aria-expanded={search.openSuggest === "keyword"}
                    aria-controls="keyword-suggestion-list"
                  />
                  <button className="suggest-toggle" type="button" aria-label="Suchvorschläge anzeigen" aria-expanded={search.openSuggest === "keyword"} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                    if (search.openSuggest === "keyword") {
                      search.setOpenSuggest(null);
                      search.setShowAllSuggestions(true);
                      return;
                    }
                    search.setOpenSuggest("keyword");
                    search.setShowAllSuggestions(true);
                  }}>
                    <ChevronDown size={18} className={search.openSuggest === "keyword" ? "suggest-chevron open" : "suggest-chevron"} />
                  </button>
                </div>
                {search.openSuggest === "keyword" ? (
                  <div className="suggest-menu" id="keyword-suggestion-list" role="listbox">
                    {(search.visibleKeywordSuggestions).map((suggestion) => (
                      <button className="suggest-option" type="button" key={suggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                        search.setKeyword(suggestion);
                        search.setOpenSuggest(null);
                        search.setShowAllSuggestions(true);
                      }}>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>

              <label className="suggest-field">
                <span>Standort</span>
                <div className="suggest-input-wrap">
                  <input
                    value={search.location}
                    onChange={(event) => {
                      search.setLocation(event.target.value);
                      search.setOpenSuggest("location");
                      search.setShowAllSuggestions(false);
                    }}
                    onFocus={() => {
                      search.setOpenSuggest("location");
                      search.setShowAllSuggestions(true);
                    }}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    aria-expanded={search.openSuggest === "location"}
                    aria-controls="location-suggestion-list"
                  />
                  <button className="suggest-toggle" type="button" aria-label="Standortvorschläge anzeigen" aria-expanded={search.openSuggest === "location"} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                    if (search.openSuggest === "location") {
                      search.setOpenSuggest(null);
                      search.setShowAllSuggestions(true);
                      return;
                    }
                    search.setOpenSuggest("location");
                    search.setShowAllSuggestions(true);
                  }}>
                    <ChevronDown size={18} className={search.openSuggest === "location" ? "suggest-chevron open" : "suggest-chevron"} />
                  </button>
                </div>
                {search.openSuggest === "location" ? (
                  <div className="suggest-menu" id="location-suggestion-list" role="listbox">
                    {search.loadingLocationSuggestions ? (
                      <button className="suggest-option" type="button" disabled>
                        <LoaderCircle size={16} className="spin-icon" />
                        Standorte werden geladen...
                      </button>
                    ) : search.locationSuggestions.length ? (
                      search.locationSuggestions.map((suggestion) => (
                        <button className="suggest-option suggest-option-rich" type="button" key={suggestion.label} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                          search.setLocation(suggestion.value);
                          search.setOpenSuggest(null);
                          search.setShowAllSuggestions(true);
                        }}>
                          <span>{suggestion.value}</span>
                          {suggestion.state && suggestion.state !== suggestion.value ? <small>{suggestion.state}</small> : null}
                        </button>
                      ))
                    ) : (
                      <button className="suggest-option" type="button" disabled>
                        Kein passender Standort verfügbar
                      </button>
                    )}
                  </div>
                ) : null}
              </label>

              <label className="exact-location-toggle">
                <input type="checkbox" checked={search.exactLocation} onChange={(event) => search.setExactLocation(event.target.checked)} />
                <span className={`toggle-switch-track${search.exactLocation ? " active" : ""}`} aria-hidden="true">
                  <span className="toggle-switch-thumb" />
                </span>
                <span>Nur exakte Standorte</span>
              </label>
              <button className="primary-action" type="submit" disabled={search.loading}>
                {search.loading ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />}
                Recherche starten
              </button>
              </form>
            )}
            trustItems={search.trustItems}
            quickSearches={[{ keyword: "Softwareentwickler", location: "Berlin" }, { keyword: "Pflegefachkraft", location: "Hamburg" }, { keyword: "Elektriker", location: "Köln" }, { keyword: "Projektmanager", location: "Frankfurt am Main" }]}
            onQuickSearch={search.applyQuickSearch}
            isStatusOpen={ui.isConsoleOpen}
            loading={search.loading}
            consoleLogs={ui.consoleLogs}
            liveSearchStatus={search.liveSearchStatus}
            onToggleStatus={() => ui.setIsConsoleOpen((value) => !value)}
            hasSearched={search.hasSearched}
          />
        </ClientErrorBoundary>

        {search.error ? (
          <div className="error-banner error-panel" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>Die Suche konnte nicht geladen werden.</strong>
              <span>{search.error}</span>
            </div>
          </div>
        ) : null}

        {search.hasSearched || search.loading ? (
          <>
            <section className="results-header" id="ergebnisse" aria-live="polite">
              <div>
                <p className="eyebrow">Ergebnisse</p>
                <h2>{search.loading ? "Stellenanzeigen werden geladen..." : `${search.jobsWithClientFilters.length} Stellenanzeigen${search.totalResults ? ` von ${search.totalResults}` : ""}`}</h2>
              </div>
              <div className="results-actions">
                <p>{search.loading ? "Die offiziellen BA-Daten werden live geladen." : "Filtern, bewerten und exportieren Sie relevante Treffer direkt für Ihr Team oder Ihr Kundenmandat."}</p>
                <button className="ghost-action" type="button" onClick={search.handleExport} disabled={search.exporting || search.loading}>
                  {search.exporting ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />}
                  CSV exportieren
                </button>
              </div>
            </section>

            <div className="results-toolbar">
              <div className="view-mode-switch">
                {[
                  { id: "grid", label: "Gitter", icon: LayoutGrid },
                  { id: "list", label: "Liste", icon: List },
                  { id: "map", label: "Karte", icon: MapIcon },
                  { id: "kanban", label: "Job-Tracker", icon: Columns3 },
                ].map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button key={mode.id} type="button" className={`toolbar-chip${ui.viewMode === mode.id ? " active" : ""}`} onClick={() => ui.setViewMode(mode.id)}>
                      <Icon size={16} />
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              <div className="results-filters">
                <label>
                  <span>Treffer durchsuchen</span>
                  <input value={search.searchTerm} onChange={(event) => search.setSearchTerm(event.target.value)} />
                </label>
                <label>
                  <span>Sortierung</span>
                  <select value={search.sortBy} onChange={(event) => search.setSortBy(event.target.value)}>
                    <option value="relevance">Relevanz</option>
                    <option value="salary">Vergütung</option>
                    <option value="title">Stellentitel</option>
                    <option value="employer">Arbeitgeber</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="filter-note">
              Die Bundesagentur für Arbeit kann auch Treffer aus dem Umkreis liefern. Mit &quot;Nur exakte Standorte&quot; sehen und exportieren Sie ausschließlich Anzeigen für den angegebenen Ort.
            </div>

            {search.rawJobs.length ? (
              <ClientErrorBoundary
                compact
                title="Die Analyseansicht ist momentan nicht verfügbar."
                description="Die Ergebnisliste bleibt nutzbar. Laden Sie die Analyse bei Bedarf separat neu."
              >
                <Dashboard>
                  <article className="dashboard-card">
                    <div className="dashboard-card-header">
                      <div>
                        <p className="eyebrow">Vergütungsübersicht</p>
                        <h3>Treffer nach Gehalt einordnen</h3>
                      </div>
                      <button className="toolbar-chip" type="button" onClick={() => search.setSalaryBucket("all")}>Filter zurücksetzen</button>
                    </div>
                    {renderSalaryChart()}
                  </article>
                  <article className="dashboard-card">
                    <div className="dashboard-card-header">
                      <div>
                        <p className="eyebrow">Arbeitgeber im Fokus</p>
                        <h3>Häufige Arbeitgeber im aktuellen Datensatz</h3>
                      </div>
                      <Sparkles size={18} />
                    </div>
                    {renderEmployerChart()}
                  </article>
                </Dashboard>
              </ClientErrorBoundary>
            ) : null}
          </>
        ) : null}

        {search.loading ? (
          <section className="results-grid" aria-label="Stellenanzeigen werden geladen">
            {Array.from({ length: 6 }).map((_, index) => (
              <JobCardSkeleton key={index} />
            ))}
          </section>
        ) : search.jobsWithClientFilters.length > 0 ? (
          <>
            {ui.viewMode === "kanban" ? (
              <ClientErrorBoundary
                compact
                title="Der Tracker ist momentan nicht verfügbar."
                description="Wechseln Sie vorübergehend zur Gitter-, Listen- oder Kartenansicht."
              >
                <KanbanBoard
                  columns={favs.kanbanJobs}
                  statusLabels={statusLabels}
                  draggingRef={favs.draggingRef}
                  onDropCard={(status) => favs.moveFavoriteToStatus(favs.draggingRef!, status)}
                  onStartDrag={favs.setDraggingRef}
                  onEndDrag={() => favs.setDraggingRef(null)}
                  onToggleFavorite={favs.toggleFavorite}
                  onOpenFavorite={favs.setActiveFavoriteRef}
                  onCycleStatus={favs.cycleFavoriteStatus}
                />
              </ClientErrorBoundary>
            ) : ui.viewMode === "map" ? (
              <section className="map-explorer" aria-label="Guide des villes allemandes">
                <div className="map-explorer-shell">
                  <aside className="map-guide-panel">
                    <div className="map-guide-header">
                      <p className="eyebrow">Deutschlandkarte</p>
                      <h3>Relevante Zielmärkte schneller erkennen</h3>
                      <p>Die Karte zeigt, in welchen Städten Ihre aktuelle Recherche Schwerpunkte bildet. So priorisieren Sie Regionen und Arbeitgeber gezielter.</p>
                    </div>

                    <div className="map-guide-stats">
                      <div className="map-guide-stat">
                        <span>Städte im Blick</span>
                        <strong>{search.cityGuide.length}</strong>
                      </div>
                      <div className="map-guide-stat">
                        <span>Kartierte Treffer</span>
                        <strong>{search.jobsWithClientFilters.length}</strong>
                      </div>
                    </div>

                    <div className="map-city-list" role="list">
                      <button
                        type="button"
                        className={`map-city-card map-city-card-overview${search.selectedMapCity === ALL_MAP_CITIES ? " active" : ""}`}
                        onClick={() => search.setSelectedMapCity(ALL_MAP_CITIES)}
                      >
                        <span className="map-city-rank">DE</span>
                        <div className="map-city-copy">
                          <strong>Gesamtmarkt Deutschland</strong>
                          <span>Gesamtüberblick über alle Städte Ihrer aktuellen Recherche, bevor Sie einzelne Regionen vertiefen.</span>
                        </div>
                        <span className="map-city-signal">{search.cityGuide.length} aktive Städte</span>
                      </button>
                      {search.cityGuide.map((entry) => (
                        <button
                          key={entry.cityKey}
                          type="button"
                          className={`map-city-card${search.selectedMapCity === entry.cityName ? " active" : ""}`}
                          onClick={() => search.setSelectedMapCity(entry.cityName)}
                        >
                          <span className="map-city-rank">{String(entry.count).padStart(2, "0")}</span>
                          <div className="map-city-copy">
                            <strong>{entry.cityName}</strong>
                            <span>{entry.note}</span>
                          </div>
                          <span className="map-city-signal">{entry.signal}</span>
                        </button>
                      ))}
                    </div>
                  </aside>

                  <div className="map-stage">
                    <div className="map-stage-overlay map-stage-overlay-left">
                      <p className="map-kicker">KhalfaJobs Map</p>
                      <h3>BA-Stellenanzeigen geografisch einordnen</h3>
                      <p>Wählen Sie eine Stadt, um passende Anzeigen direkt im Kontext Ihres Suchprofils zu prüfen.</p>
                    </div>

                    <div className="map-stage-overlay map-stage-overlay-right">
                      <div className="map-search-pill">
                        <Search size={18} />
                        <span>{search.keyword || "Recherche libre"} · {search.selectedMapCity === ALL_MAP_CITIES ? "Allemagne" : (search.selectedMapCity || search.location || "Allemagne")}</span>
                      </div>
                      <div className="map-stage-toggles">
                        <span className="map-stage-chip">Live-Karte</span>
                        <span className="map-stage-chip">{search.selectedCityGuide ? `${search.selectedCityGuide.count} Treffer` : `${search.jobsWithClientFilters.length} Treffer`}</span>
                      </div>
                    </div>

                    <div className="results-map-container">
                      <JobMap jobs={search.jobsWithClientFilters} selectedCity={search.selectedMapCity} onSelectCity={search.setSelectedMapCity} />
                    </div>

                    <div className="map-results-panel">
                      <div className="map-results-header">
                        <div>
                          <p className="eyebrow">Fokusregion</p>
                          <h3>{search.selectedCityGuide?.cityName || "Alle Städte"}</h3>
                          <p>{search.selectedCityGuide?.note || "Alle aktuell verfügbaren Treffer zu Ihrer laufenden Recherche."}</p>
                        </div>
                        {search.selectedCityGuide ? (
                          <button className="toolbar-chip" type="button" onClick={() => search.setSelectedMapCity(ALL_MAP_CITIES)}>
                            Übersicht anzeigen
                          </button>
                        ) : null}
                      </div>

                      <div className="map-results-grid">
                        {search.mapJobs.slice(0, 6).map((job: any, index: number) => (
                          <JobCard
                            job={job}
                            key={`${job.reference || job.title}-${index}`}
                            viewMode="list"
                            isFavorite={Boolean(favs.favorites[job.reference])}
                            favoriteData={favs.favorites[job.reference]}
                            onToggleFavorite={favs.toggleFavorite}
                            onOpenFavorite={favs.setActiveFavoriteRef}
                            onCycleStatus={favs.cycleFavoriteStatus}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className={`results-grid${ui.viewMode === "list" ? " results-list" : ""}`}>
                {search.jobsWithClientFilters.map((job, index) => (
                  <JobCard
                    job={job}
                    key={`${job.reference || job.title}-${index}`}
                    viewMode={ui.viewMode}
                    isFavorite={Boolean(favs.favorites[job.reference])}
                    favoriteData={favs.favorites[job.reference]}
                    onToggleFavorite={favs.toggleFavorite}
                    onOpenFavorite={favs.setActiveFavoriteRef}
                    onCycleStatus={favs.cycleFavoriteStatus}
                  />
                ))}
              </section>
            )}
            <div className="pagination-row">
              <button className="secondary-action" type="button" onClick={search.handleLoadMore} disabled={search.loadingMore || !search.canLoadMore}>
                {search.loadingMore ? <LoaderCircle className="spin" size={19} /> : <Plus size={19} />}
                Weitere laden
              </button>
            </div>
          </>
        ) : search.hasSearched && !search.error ? (
          <div className="zero-state" aria-live="polite">
            <div className="zero-illustration" aria-hidden="true">
              <AlertTriangle size={42} />
            </div>
            <h3>Keine passenden Stellenanzeigen gefunden</h3>
            <p>Die Recherche wurde erfolgreich ausgeführt, liefert mit den aktuellen Kriterien jedoch keine relevanten Treffer.</p>
            <ul className="zero-actions">
              <li>Prüfen Sie die Schreibweise von Rolle und Standort.</li>
              <li>Deaktivieren Sie &quot;Nur exakte Standorte&quot;, wenn auch angrenzende Orte relevant sind.</li>
              <li>Verwenden Sie einen allgemeineren Suchbegriff für eine breitere Marktübersicht.</li>
            </ul>
          </div>
        ) : (
          <section className="showcase-stack" aria-live="polite">
            <div className="zero-state">
              <div className="zero-illustration" aria-hidden="true">
                <Search size={42} />
              </div>
              <h3>Starten Sie mit Ihrer ersten Recherche</h3>
              <p>Durchsuchen Sie BA-Stellenanzeigen nach Rolle und Standort, speichern Sie relevante Treffer und exportieren Sie Ihre Shortlist in wenigen Schritten.</p>
            </div>

            <section className="insights-strip" aria-label="Produkt- und Vertrauensmerkmale">
              {commercialInsights.map((item) => (
                <article className="insight-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.description}</p>
                </article>
              ))}
            </section>

            <section className="showcase-grid" aria-label="Marktüberblick">
              <div className="showcase-main">
                <div className="showcase-header">
                  <div>
                    <p className="eyebrow">Beispielhafte Treffer</p>
                    <h3>So sehen strukturierte BA-Recherchen in KhalfaJobs aus</h3>
                  </div>
                </div>
                <div className="results-grid results-grid-showcase">
                  {(initialShowcase?.jobs || []).map((job: any, index: number) => (
                    <JobCard
                      job={job}
                      key={`${job.reference || job.title}-${index}`}
                      viewMode="grid"
                      isFavorite={Boolean(favs.favorites[job.reference])}
                      favoriteData={favs.favorites[job.reference]}
                      onToggleFavorite={favs.toggleFavorite}
                      onOpenFavorite={favs.setActiveFavoriteRef}
                      onCycleStatus={favs.cycleFavoriteStatus}
                    />
                  ))}
                </div>
              </div>

              <aside className="showcase-side">
                <article className="showcase-list-card">
                  <p className="eyebrow">Beliebte Suchanfragen</p>
                  <ul>
                    {(initialShowcase?.positions || ["Softwareentwickler in Berlin", "Pflegefachkraft in Hamburg", "Elektriker in Köln", "Projektmanager in Frankfurt am Main"]).map((entry: string) => {
                      const [nextKeyword, ...rest] = entry.split(" in ");
                      const nextLocation = rest.join(" in ");
                      return (
                        <li key={entry}>
                          <button type="button" onClick={() => search.runQuickSearch(nextKeyword, nextLocation)}>{entry}</button>
                        </li>
                      );
                    })}
                  </ul>
                </article>

                <article className="showcase-list-card">
                  <p className="eyebrow">Aktive Regionen</p>
                  <ul>
                    {(initialShowcase?.regions || []).map((entry: string) => (
                      <li key={entry}>
                        <button type="button" onClick={() => search.runQuickSearch(search.keyword || "Softwareentwickler", entry)}>{entry}</button>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="showcase-list-card">
                  <p className="eyebrow">Trends</p>
                  <ul>
                    {(initialShowcase?.trends?.length ? initialShowcase.trends : ["Live-Daten stehen für Ihre nächste Recherche bereit."]).map((entry: string) => (
                      <li key={entry}><span>{entry}</span></li>
                    ))}
                  </ul>
                </article>
              </aside>
            </section>
          </section>
        )}

        <section className="credibility-section" aria-label="Einsatzszenarien">
          <div className="section-heading">
            <p className="eyebrow">Einsatzszenarien</p>
            <h2>Entwickelt für Recruiting-Agenturen, Personalberater und Executive Search</h2>
            <p>KhalfaJobs unterstützt konkrete B2B-Workflows: von der Marktanalyse über Shortlists bis zum laufenden Monitoring neuer Ausschreibungen.</p>
          </div>
          <div className="use-case-grid">
            {recruitingUseCases.map((useCase) => (
              <article key={useCase.title} className="use-case-card">
                <Users size={20} aria-hidden="true" />
                <h3>{useCase.title}</h3>
                <p>{useCase.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pricing-section" id="pricing" aria-label="Preise">
          <div className="section-heading">
            <p className="eyebrow">Tarife</p>
            <h2>Tarife für strukturierte Recherche, Monitoring und Teamarbeit</h2>
            <p>Jeder Tarif ist auf einen klaren Nutzungskontext ausgelegt: vom einzelnen Recruiter bis zur Agentur mit gemeinsamem Workflow und Integrationen.</p>
          </div>
          <div className="plan-grid">
            {pricingPlans.map((plan) => (
              <article key={plan.name} className={`plan-card${plan.highlighted ? " is-highlighted" : ""}`}>
                <div>
                  {plan.highlighted ? <span className="plan-badge">Für die meisten Agenturen</span> : null}
                  <h3>{plan.name}</h3>
                  <p className="plan-price">{plan.price}</p>
                  <p>{plan.description}</p>
                  <ul className="plan-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
                <Link href={plan.href} className="plan-cta">
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <ClientErrorBoundary
          compact
          title="Der Alert-Bereich ist momentan nicht verfügbar."
          description="Recherche und CSV-Export bleiben nutzbar. Laden Sie den Alert-Bereich bei Bedarf separat neu."
        >
          <AlertManager
            agentOpen={agentOpen}
            onToggle={() => {
              setAgentOpen((open) => !open);
            }}
            statusBanner={saasStatus ? <div className="status-banner">{saasStatus}</div> : null}
            subscriptions={(
              <div className="subscription-list">
                {subscriptions.map((subscription) => (
                  <article className="subscription-row" key={subscription.id}>
                    <div className="subscription-copy">
                      <span className="subscription-kicker">Aktiver Alert</span>
                      <strong>{normalizeSubscriptionText(subscription.keyword) || "Suchprofil fehlt"}</strong>
                      <span className="subscription-location">{normalizeSubscriptionText(subscription.location) || "Standort fehlt"}</span>
                    </div>
                    <span className="subscription-frequency">{formatFrequencyLabel(subscription.frequency)}</span>
                    <div className="subscription-actions">
                      <button className="secondary-action" type="button" onClick={() => alerts.handleDeleteAlert(subscription.id)} disabled={saasLoading}>
                        <Trash2 size={18} />
                        Entfernen
                      </button>
                      <button className="secondary-action" type="button" onClick={() => alerts.handleSendNow(subscription.id)} disabled={saasLoading}>
                        <Send size={18} />
                        Jetzt senden
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          >
          {agentOpen ? (
            <div className="agent-body">
              <div className="agent-summary">
                <strong>Einrichtung in zwei Schritten</strong>
                <span>Legen Sie zuerst Ihren Zugang an, definieren Sie danach Suchprofil und Standort und prüfen Sie direkt die Vorschau Ihres Alerts.</span>
              </div>

              <div className="saas-grid">
                <div className="saas-panel saas-panel-primary">
                  <div className="view-mode-switch" style={{ marginBottom: "14px", display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className={`theme-chip${ag.authMode === "register" ? " active" : ""}`}
                      onClick={() => ag.setAuthMode("register")}
                      style={{ flex: 1, minHeight: "34px", fontSize: "0.78rem" }}
                    >
                      Registrieren
                    </button>
                    <button
                      type="button"
                      className={`theme-chip${ag.authMode === "login" ? " active" : ""}`}
                      onClick={() => ag.setAuthMode("login")}
                      style={{ flex: 1, minHeight: "34px", fontSize: "0.78rem" }}
                    >
                      Anmelden
                    </button>
                  </div>

                  {ag.authMode === "register" ? (
                    <form onSubmit={ag.handleCreateAgency} style={{ display: "grid", gap: "14px" }}>
                      <div className="panel-title">
                        <KeyRound size={19} aria-hidden="true" />
                        <h3>1. Zugang für Ihre Agentur anlegen</h3>
                      </div>
                      <label>
                        <span>Name der Agentur</span>
                        <input value={ag.agencyForm.name} onChange={(event) => ag.setAgencyForm({ ...ag.agencyForm, name: event.target.value })} />
                      </label>
                      <label>
                        <span>Geschäftliche E-Mail-Adresse</span>
                        <input type="email" value={ag.agencyForm.email} onChange={(event) => ag.setAgencyForm({ ...ag.agencyForm, email: event.target.value })} />
                      </label>
                      <button className="primary-action" type="submit" disabled={saasLoading}>
                        {saasLoading ? <LoaderCircle className="spin" size={19} /> : <Plus size={19} />}
                        {agency ? "Weiteren Zugang anlegen" : "Zugang anlegen"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={ag.handleLoginAgency} style={{ display: "grid", gap: "14px" }}>
                      <div className="panel-title">
                        <KeyRound size={19} aria-hidden="true" />
                        <h3>Vorhandenen Zugang öffnen</h3>
                      </div>
                      <label>
                        <span>Agentur-Schlüssel</span>
                        <input
                          type="password"
                          required
                          placeholder="API-Schlüssel eingeben"
                          value={ag.loginKey}
                          onChange={(event) => ag.setLoginKey(event.target.value)}
                        />
                      </label>
                      <button className="primary-action" type="submit" disabled={saasLoading}>
                        {saasLoading ? <LoaderCircle className="spin" size={19} /> : <KeyRound size={19} />}
                        Anmelden
                      </button>
                    </form>
                  )}

                  {agency ? (
                    <div className="agency-summary-card" style={{ marginTop: "16px" }}>
                      <div>
                        <span>Aktiver Zugang</span>
                        <strong>{agency.name}</strong>
                        <p style={{ margin: 0 }}>{agency.email}</p>
                        <p style={{ margin: "4px 0 0 0", fontSize: "13px" }}>{agency.email_verified ? "E-Mail-Adresse bestätigt" : "Bestätigung der E-Mail-Adresse ausstehend"}</p>
                        <details style={{ marginTop: "8px", fontSize: "12px", cursor: "pointer" }}>
                          <summary style={{ color: "var(--muted)" }}>Zugangsschlüssel anzeigen</summary>
                          <code style={{ display: "block", marginTop: "4px", padding: "4px", backgroundColor: "var(--paper)", wordBreak: "break-all" }}>{agency.api_key}</code>
                        </details>
                      </div>
                      <div className="agency-summary-actions">
                        {!agency.email_verified ? (
                          <button className="secondary-action" type="button" onClick={ag.handleResendVerification} disabled={ag.verificationSending}>
                            {ag.verificationSending ? <LoaderCircle className="spin" size={17} /> : <Mail size={17} />}
                            Bestätigungs-E-Mail erneut senden
                          </button>
                        ) : null}
                        <button className="secondary-action" type="button" onClick={ag.handleForgetAgency}>
                          <LogOut size={17} />
                          Diesen Zugang entfernen
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <form className="saas-panel saas-panel-secondary" onSubmit={alerts.handleCreateAlert} onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    alerts.setAgentSuggest(null);
                    alerts.setShowAllAgentSuggestions(true);
                  }
                }}>
                  <div className="panel-title">
                    <Mail size={19} aria-hidden="true" />
                    <h3>2. Alert anlegen</h3>
                  </div>
                  <label className="suggest-field">
                    <span>Rolle oder Suchprofil</span>
                    <div className="suggest-input-wrap">
                      <input
                        value={alerts.alertForm.keyword}
                        onChange={(event) => {
                          alerts.setAlertForm({ ...alerts.alertForm, keyword: event.target.value });
                          alerts.setAgentSuggest("keyword");
                          alerts.setShowAllAgentSuggestions(false);
                        }}
                        onFocus={() => {
                          alerts.setAgentSuggest("keyword");
                          alerts.setShowAllAgentSuggestions(true);
                        }}
                        autoComplete="off"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-haspopup="listbox"
                        aria-expanded={alerts.agentSuggest === "keyword"}
                        aria-controls="agent-keyword-suggestion-list"
                      />
                      <button className="suggest-toggle" type="button" aria-label="Suchprofile anzeigen" aria-expanded={alerts.agentSuggest === "keyword"} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                        if (alerts.agentSuggest === "keyword") {
                          alerts.setAgentSuggest(null);
                          alerts.setShowAllAgentSuggestions(true);
                          return;
                        }
                        alerts.setAgentSuggest("keyword");
                        alerts.setShowAllAgentSuggestions(true);
                      }}>
                        <ChevronDown size={18} className={alerts.agentSuggest === "keyword" ? "suggest-chevron open" : "suggest-chevron"} />
                      </button>
                    </div>
                    {alerts.agentSuggest === "keyword" ? (
                      <div className="suggest-menu" id="agent-keyword-suggestion-list" role="listbox">
                        {(alerts.visibleAgentKeywordSuggestions).map((suggestion) => (
                          <button className="suggest-option" type="button" key={suggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                            alerts.setAlertForm({ ...alerts.alertForm, keyword: suggestion });
                            alerts.setAgentSuggest(null);
                            alerts.setShowAllAgentSuggestions(true);
                          }}>
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>
                  <label className="suggest-field">
                    <span>Standort</span>
                    <div className="suggest-input-wrap">
                      <input
                        value={alerts.alertForm.location}
                        onChange={(event) => {
                          alerts.setAlertForm({ ...alerts.alertForm, location: event.target.value });
                          alerts.setAgentSuggest("location");
                          alerts.setShowAllAgentSuggestions(false);
                        }}
                        onFocus={() => {
                          alerts.setAgentSuggest("location");
                          alerts.setShowAllAgentSuggestions(true);
                        }}
                        autoComplete="off"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-haspopup="listbox"
                        aria-expanded={alerts.agentSuggest === "location"}
                        aria-controls="agent-location-suggestion-list"
                      />
                      <button className="suggest-toggle" type="button" aria-label="Standorte anzeigen" aria-expanded={alerts.agentSuggest === "location"} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                        if (alerts.agentSuggest === "location") {
                          alerts.setAgentSuggest(null);
                          alerts.setShowAllAgentSuggestions(true);
                          return;
                        }
                        alerts.setAgentSuggest("location");
                        alerts.setShowAllAgentSuggestions(true);
                      }}>
                        <ChevronDown size={18} className={alerts.agentSuggest === "location" ? "suggest-chevron open" : "suggest-chevron"} />
                      </button>
                    </div>
                    {alerts.agentSuggest === "location" ? (
                      <div className="suggest-menu" id="agent-location-suggestion-list" role="listbox">
                        {alerts.loadingAgentLocationSuggestions ? (
                          <button className="suggest-option" type="button" disabled>
                            <LoaderCircle size={16} className="spin-icon" />
                            Standorte werden geladen...
                          </button>
                        ) : alerts.visibleAgentLocationSuggestions.length ? (
                          alerts.visibleAgentLocationSuggestions.map((suggestion) => (
                            <button className="suggest-option suggest-option-rich" type="button" key={suggestion.label} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                              alerts.setAlertForm({ ...alerts.alertForm, location: suggestion.value });
                              alerts.setAgentSuggest(null);
                              alerts.setShowAllAgentSuggestions(true);
                            }}>
                              <span>{suggestion.value}</span>
                              {suggestion.state && suggestion.state !== suggestion.value ? <small>{suggestion.state}</small> : null}
                            </button>
                          ))
                        ) : (
                          <button className="suggest-option" type="button" disabled>
                            Kein passender Standort verfügbar
                          </button>
                        )}
                      </div>
                    ) : null}
                  </label>
                  <p className="form-hint">Alerts arbeiten mit exakten Standorten, damit Ihre tägliche Zusammenfassung nur wirklich relevante Treffer enthält.</p>
                  <button className="cta-action" type="submit" disabled={saasLoading}>
                    <Plus size={19} />
                    Alert erstellen
                  </button>
                  <div className="alarm-trust-line">Datenquelle: Bundesagentur für Arbeit · Versand nur nach bestätigter E-Mail-Adresse · Starter = 1 Alert, Agentur-Zugang = bis zu 200 CSV-Treffer</div>
                </form>
              </div>

              {agency ? (
                <section className="workspace-command-grid" aria-label="Agentur-Workspace">
                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">Zugang und Team</p>
                        <h3>Gemeinsamer Agenturzugang mit Rollen</h3>
                      </div>
                      <Users size={18} />
                    </div>
                    {ws.workspaceLoading ? <p className="workspace-muted">Workspace wird geladen...</p> : null}
                    <div className="workspace-kpis">
                      <div>
                        <span>Aktive Mitglieder</span>
                        <strong>{workspaceReporting?.active_members || 0}</strong>
                      </div>
                      <div>
                        <span>Verifizierte Absenderadresse</span>
                        <strong>{agency.email_verified ? "Ja" : "Ausstehend"}</strong>
                      </div>
                    </div>
                    <ul className="workspace-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {workspaceMembers.length ? workspaceMembers.map((member: any) => {
                        const isPrimaryOwner = member.role === "OWNER" || member.email === agency.email;
                        return (
                          <li key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e3ded3", paddingBottom: "8px" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <strong>{member.full_name}</strong>
                              <span style={{ fontSize: "12px", color: "#6b665c" }}>{member.email}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{
                                fontSize: "11px",
                                textTransform: "uppercase",
                                border: "1px solid #1f1d1a",
                                padding: "2px 6px",
                                backgroundColor: member.role === "OWNER" ? "#fef3c7" : "#f3f4f6"
                              }}>
                                {member.role}
                              </span>
                              {!isPrimaryOwner ? (
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() => ws.handleRemoveMember(member.id, member.full_name)}
                                  style={{ padding: "4px", color: "#b5361f", border: "none", cursor: "pointer", background: "none" }}
                                  title="Mitglied entfernen"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : null}
                            </div>
                          </li>
                        );
                      }) : <li><span>Der erste Owner wird bei der Registrierung automatisch angelegt.</span></li>}
                    </ul>

                    {/* Seat Limit Warning or Invite Controls */}
                    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "2px solid #1f1d1a" }}>
                      {workspaceMembers.length >= (workspaceBilling?.seats || 1) ? (
                        <p style={{ fontSize: "12px", color: "#b5361f", margin: 0 }}>
                          Maximale Anzahl an Sitzplätzen ({workspaceBilling?.seats || 1}) erreicht. Bitte wechseln Sie in einen größeren Tarif, um weitere Mitglieder einzuladen.
                        </p>
                      ) : (
                        <div>
                          {ws.showInviteForm ? (
                            <form onSubmit={ws.handleInviteMember} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "bold" }}>Name</span>
                                <input
                                  type="text"
                                  required
                                  value={ws.inviteName}
                                  onChange={(e) => ws.setInviteName(e.target.value)}
                                  placeholder="Vollständigen Namen eingeben"
                                  style={{ padding: "6px", fontSize: "13px", border: "1px solid #1f1d1a", backgroundColor: "#fffaf1" }}
                                />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "bold" }}>E-Mail-Adresse</span>
                                <input
                                  type="email"
                                  required
                                  value={ws.inviteEmail}
                                  onChange={(e) => ws.setInviteEmail(e.target.value)}
                                  placeholder="name@agentur.de"
                                  style={{ padding: "6px", fontSize: "13px", border: "1px solid #1f1d1a", backgroundColor: "#fffaf1" }}
                                />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "bold" }}>Rolle</span>
                                <select
                                  value={ws.inviteRole}
                                  onChange={(e) => ws.setInviteRole(e.target.value)}
                                  style={{ padding: "6px", fontSize: "13px", border: "1px solid #1f1d1a", backgroundColor: "#fffaf1" }}
                                >
                                  <option value="ADMIN">Administrator</option>
                                  <option value="RECRUITER">Recruiter</option>
                                  <option value="VIEWER">Viewer</option>
                                </select>
                              </label>
                              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                <button
                                  type="submit"
                                  className="button"
                                  disabled={ws.inviteLoading}
                                  style={{ padding: "6px 14px", fontSize: "12px", backgroundColor: "#ffce45", border: "1px solid #1f1d1a" }}
                                >
                                  {ws.inviteLoading ? "Einladung wird gesendet..." : "Einladung senden"}
                                </button>
                                <button
                                  type="button"
                                  className="button button-secondary"
                                  onClick={() => ws.setShowInviteForm(false)}
                                  style={{ padding: "6px 14px", fontSize: "12px", border: "1px solid #1f1d1a" }}
                                >
                                  Abbrechen
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="button"
                              onClick={() => ws.setShowInviteForm(true)}
                              style={{ width: "100%", padding: "8px", fontSize: "13px", border: "1px solid #1f1d1a", backgroundColor: "#ffce45" }}
                            >
                              Teammitglied einladen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">Tarif und Kapazität</p>
                        <h3>Tarif, Plätze und Laufzeit</h3>
                      </div>
                      <CreditCard size={18} />
                    </div>
                    <div className="workspace-kpis">
                      <div>
                        <span>Plan</span>
                        <strong>{workspaceBilling?.plan_name || "Starter"}</strong>
                      </div>
                      <div>
                        <span>Status</span>
                        <strong>{workspaceBilling?.status || "TRIAL"}</strong>
                      </div>
                      <div>
                        <span>Sitzplätze</span>
                        <strong>{workspaceBilling?.seats || 1}</strong>
                      </div>
                    </div>
                    <p className="workspace-muted">Die Abrechnungslogik ist vorbereitet und kann bei Bedarf um Zahlungsanbieter erweitert werden.</p>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">Recherche und Reporting</p>
                        <h3>Aktivität und Verlauf</h3>
                      </div>
                      <BarChart3 size={18} />
                    </div>
                    <div className="workspace-kpis">
                      <div>
                        <span>Aktive Job-Alarme</span>
                        <strong>{workspaceReporting?.active_alerts || 0}</strong>
                      </div>
                      <div>
                        <span>Letzte Recherchen</span>
                        <strong>{workspaceReporting?.recent_searches || 0}</strong>
                      </div>
                    </div>
                    <ul className="workspace-list workspace-list-compact">
                      {workspaceSearchHistory.length ? workspaceSearchHistory.map((entry: any) => (
                        <li key={entry.id}>
                          <strong>{entry.keyword || "Allgemeine Suche"}</strong>
                          <span>{entry.location || "Deutschland"} · {entry.result_count} Treffer</span>
                        </li>
                      )) : <li><span>Noch keine gespeicherte Recherchehistorie vorhanden.</span></li>}
                    </ul>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">Pipeline und Dossiers</p>
                        <h3>Geteilte Arbeitsliste für Ihr Team</h3>
                      </div>
                      <FolderKanban size={18} />
                    </div>
                    <div className="workspace-kpis">
                      <div>
                        <span>Geteilte Dossiers</span>
                        <strong>{workspaceReporting?.shared_dossiers || 0}</strong>
                      </div>
                    </div>
                    <ul className="workspace-list workspace-list-compact">
                      {workspaceDossiers.length ? workspaceDossiers.map((dossier: any) => (
                        <li key={dossier.reference}>
                          <strong>{dossier.title}</strong>
                          <span>{dossier.location}</span>
                          <em>{statusLabels[dossier.status] || dossier.status}</em>
                        </li>
                      )) : <li><span>Favoriten aus dem Tracker werden hier als gemeinsame Dossiers gespeichert.</span></li>}
                    </ul>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">Datenschutz und Versand</p>
                        <h3>Vertrauen, Nachvollziehbarkeit und Double Opt-in</h3>
                      </div>
                      <ShieldCheck size={18} />
                    </div>
                    <ul className="workspace-checks">
                      <li><BadgeCheck size={16} /> Audit Trail {workspaceTrust?.audit_trail ? "aktiv" : "inaktiv"}</li>
                      <li><BadgeCheck size={16} /> Double Opt-in {workspaceTrust?.double_opt_in ? "erzwingbar" : "deaktiviert"}</li>
                      <li><BadgeCheck size={16} /> DSGVO-Basis {workspaceTrust?.gdpr_ready ? "bestätigt" : "vorbereitet"}</li>
                      <li><BadgeCheck size={16} /> Verifizierter Versand {workspaceTrust?.verified_sender ? "aktiv" : "ausstehend"}</li>
                    </ul>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">CRM- und ATS-Integrationen</p>
                        <h3>Verbindungen zu externen Systemen</h3>
                      </div>
                      <History size={18} />
                    </div>
                    <ul className="workspace-list workspace-list-compact">
                      {workspaceIntegrations.length ? workspaceIntegrations.map((integration: any) => (
                        <li key={integration.id} style={{ display: "flex", flexDirection: "column", gap: "8px", borderBottom: "1px solid #e3ded3", paddingBottom: "12px", marginBottom: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <div>
                              <strong>{integration.display_name}</strong>
                              <span style={{ fontSize: "12px", color: "#6b665c", marginLeft: "8px" }}>({integration.provider})</span>
                            </div>
                            <span style={{
                              fontSize: "12px",
                              fontWeight: "bold",
                              padding: "2px 8px",
                              border: "1px solid #1f1d1a",
                              backgroundColor: integration.status === "CONNECTED" ? "#d1fae5" : "#f3f4f6",
                              color: integration.status === "CONNECTED" ? "#065f46" : "#374151"
                            }}>
                              {integration.status === "CONNECTED" ? "Verbunden" : "Bereit"}
                            </span>
                          </div>
                          
                          {integration.status === "CONNECTED" ? (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                              {integration.last_sync_at ? (
                                <span style={{ fontSize: "11px", color: "#6b665c" }}>Letzter Abgleich: {new Date(integration.last_sync_at).toLocaleString("de-DE")}</span>
                              ) : (
                                <span style={{ fontSize: "11px", color: "#6b665c" }}>Noch keine Synchronisation</span>
                              )}
                              <button
                                type="button"
                                className="button button-secondary"
                                style={{ padding: "4px 8px", fontSize: "12px", border: "1px solid #1f1d1a" }}
                                onClick={() => ws.handleDisconnectCrm(integration.provider, integration.display_name)}
                              >
                                Trennen
                              </button>
                            </div>
                          ) : (
                            <div>
                              {ws.connectingCrm?.provider === integration.provider ? (
                                <form onSubmit={ws.handleConnectCrm} style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px", width: "100%" }}>
                                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <span style={{ fontSize: "12px", fontWeight: "bold" }}>API-Schlüssel</span>
                                    <input
                                      type="password"
                                      required
                                      placeholder="API-Schlüssel einfügen"
                                      value={ws.crmApiKey}
                                      onChange={(e) => ws.setCrmApiKey(e.target.value)}
                                      style={{ padding: "6px", fontSize: "13px", border: "1px solid #1f1d1a", backgroundColor: "#fffaf1" }}
                                    />
                                  </label>
                                  <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                      type="submit"
                                      className="button"
                                      disabled={ws.crmActionLoading}
                                      style={{ padding: "4px 12px", fontSize: "12px", backgroundColor: "#ffce45", border: "1px solid #1f1d1a" }}
                                    >
                                      Verbindung aktivieren
                                    </button>
                                    <button
                                      type="button"
                                      className="button button-secondary"
                                      onClick={() => { ws.setConnectingCrm(null); ws.setCrmApiKey(""); }}
                                      style={{ padding: "4px 12px", fontSize: "12px", border: "1px solid #1f1d1a" }}
                                    >
                                      Abbrechen
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  className="button"
                                  style={{ padding: "4px 12px", fontSize: "12px", border: "1px solid #1f1d1a", backgroundColor: "#ffce45" }}
                                  onClick={() => ws.setConnectingCrm(integration)}
                                >
                                  Verbindung einrichten
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      )) : <li><span>Personio, HubSpot und Greenhouse können als Integrationsziele vorbereitet werden.</span></li>}
                    </ul>
                    <p className="workspace-muted">Diese Integrationen sind als Teil des Agentur-Workflows vorbereitet und können hier verbunden werden.</p>
                  </article>
                </section>
              ) : null}

              <ClientErrorBoundary
                compact
                title="Die E-Mail-Vorschau konnte nicht geladen werden."
                description="Der Agentur-Bereich bleibt verfügbar. Laden Sie nur die Vorschau neu."
              >
                <EmailDigestPreview
                  agencyName={agency?.name}
                  keyword={alerts.alertForm.keyword || search.keyword}
                  location={alerts.alertForm.location || search.location}
                  jobs={search.jobsWithClientFilters.length ? search.jobsWithClientFilters : initialShowcase?.jobs}
                  options={ui.emailTemplateOpts}
                  onChange={ui.setEmailTemplateOpts}
                  onSimulateSend={ui.handleSimulateEmailSend}
                  simulating={ui.simulatingEmail}
                />
              </ClientErrorBoundary>
            </div>
          ) : null}
          </AlertManager>
        </ClientErrorBoundary>

        <section className="data-source-section" id="datenquelle" aria-label="Datenquelle">
          <div className="section-heading">
            <p className="eyebrow">Datenbasis</p>
            <h2>Recherche auf Basis öffentlicher BA-Stellenanzeigen</h2>
            <p>KhalfaJobs strukturiert öffentliche BA-Daten für Recruiting-Agenturen. Die Originalanzeige bleibt dabei immer die maßgebliche Primärquelle.</p>
          </div>
          <div className="data-source-grid">
            <article className="use-case-card">
              <ShieldCheck size={20} aria-hidden="true" />
              <h3>Verlässliche Primärquelle</h3>
              <p>Suchanfragen werden live gegen die BA-Daten verarbeitet, statt mit statischen Beispieldaten zu arbeiten.</p>
            </article>
            <article className="use-case-card">
              <Download size={20} aria-hidden="true" />
              <h3>Export für Shortlists</h3>
              <p>Treffer lassen sich speichern, priorisieren und als CSV für Kundenprojekte oder interne Übergaben exportieren.</p>
            </article>
            <article className="use-case-card">
              <Mail size={20} aria-hidden="true" />
              <h3>Alerts für Monitoring</h3>
              <p>Wiederkehrende Recherchen lassen sich per E-Mail überwachen, sobald Zugang und Versand eingerichtet sind.</p>
            </article>
          </div>
        </section>

        <SiteFooter />
      </section>
    </main>
  );
}
