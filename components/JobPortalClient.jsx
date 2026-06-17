"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Download,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import JobCard from "./JobCard";
import JobCardSkeleton from "./JobCardSkeleton";
import ToastStack from "./ToastStack";
import { trackEvent } from "./analytics";

const preferredListKeys = ["ergebnisliste", "stellenangebote", "angebote", "jobs", "items", "results", "content", "data"];
const keywordSuggestions = [
  "Softwareentwickler",
  "Pflegefachkraft",
  "Elektriker",
  "Mechatroniker",
  "Buchhalter",
  "Vertriebsmitarbeiter",
  "Projektmanager",
  "Fachinformatiker",
];
const locationSuggestions = ["Berlin", "Muenchen", "Hamburg", "Koeln", "Frankfurt am Main", "Stuttgart", "Duesseldorf", "Leipzig"];
const quickSearches = [
  { keyword: "Softwareentwickler", location: "Berlin" },
  { keyword: "Pflegefachkraft", location: "Hamburg" },
  { keyword: "Elektriker", location: "Koeln" },
  { keyword: "Projektmanager", location: "Frankfurt am Main" },
];

function getVisibleSuggestions(query, suggestions, showAll) {
  if (showAll) return suggestions;
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  if (!normalizedQuery) return suggestions;

  return suggestions.filter((suggestion) => suggestion.toLocaleLowerCase("de-DE").includes(normalizedQuery));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(data?.detail || data || `Anfrage fehlgeschlagen mit Status ${response.status}`);
  }
  return data;
}

function extractJobs(payload) {
  if (Array.isArray(payload)) return payload.filter((item) => item && typeof item === "object");
  if (!payload || typeof payload !== "object") return [];
  for (const key of preferredListKeys) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
    if (value && typeof value === "object") {
      const nested = extractJobs(value);
      if (nested.length) return nested;
    }
  }
  return Object.values(payload).reduce((best, value) => {
    const nested = extractJobs(value);
    return nested.length > best.length ? nested : best;
  }, []);
}

function readPath(item, paths) {
  for (const path of paths) {
    let current = item;
    for (const part of path.split(".")) {
      if (Array.isArray(current)) {
        current = current
          .map((entry) => (entry && typeof entry === "object" ? entry[part] : undefined))
          .filter((value) => value !== undefined && value !== null && value !== "");
      } else {
        current = current && typeof current === "object" ? current[part] : undefined;
      }
      if (current === undefined || current === null) break;
    }
    if (current !== undefined && current !== null && current !== "") return current;
  }
  return "";
}

function flatten(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const preferred = ["name", "bezeichnung", "ort", "plz", "strasse", "region"];
    const parts = preferred.map((key) => flatten(value[key])).filter(Boolean);
    return parts.length ? parts.join(", ") : Object.values(value).map(flatten).filter(Boolean).join(", ");
  }
  return String(value);
}

function formatEuro(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: number % 1 === 0 ? 0 : 2,
    style: "currency",
    currency: "EUR",
  }).format(number);
}

function normalizeSalary(item) {
  const type = readPath(item, ["verguetungsangabe"]);
  const fixed = readPath(item, ["festgehalt"]);
  const from = readPath(item, ["gehaltsspanneVon"]);
  const to = readPath(item, ["gehaltsspanneBis"]);
  const unit = String(type || readPath(item, ["artDerVerguetung"]) || "").toLocaleLowerCase("de-DE");
  const suffix = unit.includes("stunde") ? "/Std." : unit.includes("jahr") ? "/Jahr" : "";

  if (from || to) return `${from ? formatEuro(from) : ""}${from && to ? " - " : ""}${to ? formatEuro(to) : ""} ${suffix}`.trim();
  if (fixed) return `${formatEuro(fixed)} ${suffix}`.trim();
  return "Keine Gehaltsangabe";
}

function normalizeJob(item) {
  const reference = readPath(item, ["referenznummer", "refnr", "refNr", "reference", "id", "hashId", "stellenangebotsId"]);
  const title = readPath(item, ["titel", "title", "stellenangebotsTitel", "stellenbezeichnung", "beruf", "jobtitel"]);
  const employer = readPath(item, ["arbeitgeber", "arbeitgebername", "firma", "unternehmen", "company", "betrieb.name"]);
  const location = readPath(item, ["arbeitsort", "arbeitsorte", "stellenlokationen.adresse.ort", "ort", "standort", "adresse.ort"]);
  const occupation = readPath(item, ["beruf", "berufsbezeichnung", "hauptberuf", "occupation", "berufsfeld", "branche"]);
  const url = flatten(readPath(item, ["url", "link", "externeURL", "stellenangebotUrl", "detailUrl", "externalUrl"]));
  const referenceText = flatten(reference);
  return {
    reference: referenceText,
    title: flatten(title) || "Stellenangebot ohne Titel",
    employer: flatten(employer) || "Arbeitgeber nicht angegeben",
    location: flatten(location) || "Ort nicht angegeben",
    occupation: flatten(occupation),
    salary: normalizeSalary(item),
    url: url || (referenceText ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${referenceText}` : ""),
  };
}

function downloadBlob(blob, filename) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function getErrorMessage(error, action) {
  return error.message || `${action} fehlgeschlagen`;
}

function formatLastUpdated(value) {
  if (!value) return "Noch keine Suche";
  const diffMs = Date.now() - value;
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes <= 1) return "Gerade eben aktualisiert";
  if (minutes < 60) return `Vor ${minutes} Minuten aktualisiert`;
  const hours = Math.round(minutes / 60);
  return `Vor ${hours} Stunde${hours === 1 ? "" : "n"} aktualisiert`;
}

export default function Home() {
  const [keyword, setKeyword] = useState("Softwareentwickler");
  const [location, setLocation] = useState("Berlin");
  const [openSuggest, setOpenSuggest] = useState(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(true);
  const [agentSuggest, setAgentSuggest] = useState(null);
  const [showAllAgentSuggestions, setShowAllAgentSuggestions] = useState(true);
  const [exactLocation, setExactLocation] = useState(true);
  const [payload, setPayload] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchAt, setLastSearchAt] = useState(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agency, setAgency] = useState(null);
  const [agencyForm, setAgencyForm] = useState({ name: "", email: "", plan: "starter" });
  const [alertForm, setAlertForm] = useState({ keyword: "", location: "", frequency: "daily", max_results: 25 });
  const [subscriptions, setSubscriptions] = useState([]);
  const [saasStatus, setSaasStatus] = useState("");
  const [saasLoading, setSaasLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const jobs = useMemo(() => extractJobs(payload).map(normalizeJob), [payload]);
  const jobPostingJsonLd = useMemo(() => {
    if (!jobs.length) return null;

    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: jobs.slice(0, 25).map((job, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "JobPosting",
          title: job.title,
          identifier: job.reference
            ? {
                "@type": "PropertyValue",
                name: "Bundesagentur fuer Arbeit",
                value: job.reference,
              }
            : undefined,
          hiringOrganization: {
            "@type": "Organization",
            name: job.employer,
          },
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.location,
              addressCountry: "DE",
            },
          },
          occupationalCategory: job.occupation || undefined,
          url: job.url || undefined,
        },
      })),
    };
  }, [jobs]);
  const totalResults = payload?.exactLocation ? 0 : Number(payload?.maxErgebnisse || 0);
  const canLoadMore = hasSearched && !loading && jobs.length > 0 && (totalResults ? jobs.length < totalResults : true);
  const visibleKeywordSuggestions = useMemo(
    () => getVisibleSuggestions(keyword, keywordSuggestions, openSuggest === "keyword" && showAllSuggestions),
    [keyword, openSuggest, showAllSuggestions],
  );
  const visibleLocationSuggestions = useMemo(
    () => getVisibleSuggestions(location, locationSuggestions, openSuggest === "location" && showAllSuggestions),
    [location, openSuggest, showAllSuggestions],
  );
  const visibleAgentKeywordSuggestions = useMemo(
    () => getVisibleSuggestions(alertForm.keyword, keywordSuggestions, agentSuggest === "keyword" && showAllAgentSuggestions),
    [alertForm.keyword, agentSuggest, showAllAgentSuggestions],
  );
  const visibleAgentLocationSuggestions = useMemo(
    () => getVisibleSuggestions(alertForm.location, locationSuggestions, agentSuggest === "location" && showAllAgentSuggestions),
    [alertForm.location, agentSuggest, showAllAgentSuggestions],
  );
  const trustItems = useMemo(
    () => [
      {
        label: "Live-API",
        value: "Bundesagentur fuer Arbeit",
      },
      {
        label: "Aktuelle Treffer",
        value: hasSearched ? `${totalResults || jobs.length} Ergebnisse` : "Suche starten",
      },
      {
        label: "Aktualisierung",
        value: formatLastUpdated(lastSearchAt),
      },
      {
        label: "Fuer Recruiting-Teams",
        value: "CSV-Export und Job-Alarm",
      },
    ],
    [hasSearched, jobs.length, lastSearchAt, totalResults],
  );

  function pushToast(type, message, persist = false) {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.filter((toast) => toast.type !== "loading"), { id, type, message }].slice(-3));
    if (!persist) {
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4200);
    }
    return id;
  }

  function mergePayload(currentPayload, nextPayload) {
    const currentItems = extractJobs(currentPayload);
    const nextItems = extractJobs(nextPayload);
    return {
      ...nextPayload,
      ergebnisliste: [...currentItems, ...nextItems],
    };
  }

  function applyQuickSearch(nextKeyword, nextLocation) {
    setKeyword(nextKeyword);
    setLocation(nextLocation);
    setExactLocation(true);
    setOpenSuggest(null);
    setShowAllSuggestions(true);
  }

  useEffect(() => {
    const stored = localStorage.getItem("agencyProfile");
    if (stored) setAgency(JSON.parse(stored));

    const params = new URLSearchParams(window.location.search);
    const keywordParam = params.get("keyword");
    const locationParam = params.get("location");
    const exactLocationParam = params.get("exactLocation");
    if (keywordParam) setKeyword(keywordParam);
    if (locationParam) setLocation(locationParam);
    if (exactLocationParam) setExactLocation(exactLocationParam !== "false");
  }, []);

  useEffect(() => {
    if (!agency?.api_key) return;
    requestJson("/api/alerts/subscriptions", { headers: { "X-Agency-Key": agency.api_key } })
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]));
  }, [agency?.api_key]);

  async function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setHasSearched(true);
    setPage(1);
    pushToast("loading", "Suche laeuft...", true);
    try {
      const params = new URLSearchParams({ keyword, location, page: "1", size: "25", exactLocation: String(exactLocation) });
      const shareParams = new URLSearchParams({ keyword, location, exactLocation: String(exactLocation) });
      window.history.replaceState(null, "", `?${shareParams.toString()}`);
      const result = await requestJson(`/api/jobs/search?${params.toString()}`);
      setPayload(result);
      setLastSearchAt(Date.now());
      const count = extractJobs(result).length;
      pushToast(count ? "success" : "success", count ? `${count} Stellenangebote gefunden` : "Keine passenden Stellenangebote gefunden");
    } catch (err) {
      setPayload(null);
      const message = getErrorMessage(err, "Suche");
      setError(message);
      pushToast("error", `API-Fehler: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    setError("");
    pushToast("loading", "Weitere Stellenangebote werden geladen...", true);
    try {
      const params = new URLSearchParams({ keyword, location, page: String(nextPage), size: "25", exactLocation: String(exactLocation) });
      const result = await requestJson(`/api/jobs/search?${params.toString()}`);
      const nextCount = extractJobs(result).length;
      setPayload((current) => mergePayload(current, result));
      setPage(nextPage);
      setLastSearchAt(Date.now());
      pushToast(nextCount ? "success" : "success", nextCount ? `${nextCount} weitere Stellenangebote geladen` : "Keine weiteren Stellenangebote gefunden");
    } catch (err) {
      const message = getErrorMessage(err, "Suche");
      setError(message);
      pushToast("error", `API-Fehler: ${message}`);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    trackEvent("csv_export_started", {
      keyword,
      location,
      exactLocation,
    });
    try {
      const params = new URLSearchParams({ keyword, location, exactLocation: String(exactLocation) });
      const response = await fetch(`/api/jobs/export/csv?${params.toString()}`);
      if (!response.ok) throw new Error((await response.json()).detail || "CSV-Export fehlgeschlagen");
      const safeKeyword = (keyword || "alle").trim().replace(/\s+/g, "-");
      const safeLocation = (location || "deutschland").trim().replace(/\s+/g, "-");
      downloadBlob(await response.blob(), `stellenangebote-${safeKeyword}-${safeLocation}.csv`);
      trackEvent("csv_export_completed", {
        keyword,
        location,
        exactLocation,
      });
    } catch (err) {
      setError(getErrorMessage(err, "CSV-Export"));
      trackEvent("csv_export_failed", {
        keyword,
        location,
        exactLocation,
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleCreateAgency(event) {
    event.preventDefault();
    setSaasLoading(true);
    setSaasStatus("");
    try {
      const created = await requestJson("/api/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agencyForm),
      });
      setAgency(created);
      localStorage.setItem("agencyProfile", JSON.stringify(created));
      setSaasStatus("Agentur-Arbeitsbereich erstellt.");
      trackEvent("agency_created", {
        plan: created.plan,
      });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Agentur-Erstellung"));
    } finally {
      setSaasLoading(false);
    }
  }

  function handleForgetAgency() {
    localStorage.removeItem("agencyProfile");
    setAgency(null);
    setSubscriptions([]);
    setSaasStatus("Lokaler Agentur-Arbeitsbereich wurde aus diesem Browser entfernt.");
  }

  function normalizeSubscriptionText(value) {
    const text = String(value || "").trim().replace(/\s+/g, " ");
    if (!text) return "";
    const half = Math.floor(text.length / 2);
    if (text.length % 2 === 0 && text.slice(0, half) === text.slice(half)) return text.slice(0, half);
    return text;
  }

  async function refreshSubscriptions(apiKey = agency?.api_key) {
    if (!apiKey) return;
    setSubscriptions(await requestJson("/api/alerts/subscriptions", { headers: { "X-Agency-Key": apiKey } }));
  }

  async function handleCreateAlert(event) {
    event.preventDefault();
    if (!agency?.api_key) {
      setSaasStatus("Erstellen Sie zuerst einen Agentur-Arbeitsbereich, bevor Sie E-Mail-Benachrichtigungen anlegen.");
      return;
    }
    setSaasLoading(true);
    setSaasStatus("");
    try {
      await requestJson("/api/alerts/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Agency-Key": agency.api_key },
        body: JSON.stringify(alertForm),
      });
      await refreshSubscriptions(agency.api_key);
      setSaasStatus("E-Mail-Benachrichtigung erstellt. Sie kann jetzt manuell oder per geplantem Job ausgefuehrt werden.");
      trackEvent("agency_alert_created", {
        keyword: alertForm.keyword,
        location: alertForm.location,
      });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Benachrichtigungserstellung"));
    } finally {
      setSaasLoading(false);
    }
  }

  async function handleSendNow(subscriptionId) {
    setSaasLoading(true);
    setSaasStatus("");
    try {
      const result = await requestJson(`/api/alerts/subscriptions/${subscriptionId}/send-now`, {
        method: "POST",
        headers: { "X-Agency-Key": agency.api_key },
      });
      await refreshSubscriptions(agency.api_key);
      setSaasStatus(
        result.dry_run
          ? `Zusammenfassung fuer ${result.recipient} vorbereitet. Konfigurieren Sie SMTP, um echte E-Mails zu versenden.`
          : `Zusammenfassung mit ${result.job_count} Stellenangeboten an ${result.recipient} gesendet.`,
      );
      trackEvent("agency_alert_send_now", {
        subscriptionId,
        jobCount: result.job_count || 0,
        dryRun: Boolean(result.dry_run),
      });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Versand der Zusammenfassung"));
    } finally {
      setSaasLoading(false);
    }
  }

  async function handleDeleteAlert(subscriptionId) {
    if (!agency?.api_key) return;
    setSaasLoading(true);
    setSaasStatus("");
    try {
      await requestJson(`/api/alerts/subscriptions/${subscriptionId}`, {
        method: "DELETE",
        headers: { "X-Agency-Key": agency.api_key },
      });
      await refreshSubscriptions(agency.api_key);
      setSaasStatus("Benachrichtigung wurde entfernt.");
      trackEvent("agency_alert_deleted", {
        subscriptionId,
      });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Loeschen der Benachrichtigung"));
    } finally {
      setSaasLoading(false);
    }
  }

  return (
    <main className="app-shell">
      {jobPostingJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }}
        />
      ) : null}
      <ToastStack toasts={toasts} />
      <aside className="registry-rail" aria-label="Anwendungsidentitaet">
        <span>BA</span>
        <span>LIVE</span>
        <span>SAAS</span>
      </aside>

      <section className="workspace">
        <div className="product-topbar">
          <span>KhalfaJobs fuer Recruiting-Teams</span>
          <span>Datenquelle: Bundesagentur fuer Arbeit</span>
          <span>Live-Suche, CSV-Export und Job-Alarme</span>
        </div>

        <header className="masthead hero-layout">
          <div className="hero-primary">
            <p className="eyebrow">Live-Stellensuche fuer Agenturen, Recruiter und Personalberater</p>
            <h1>Finden Sie passende Fachkraefte schneller.</h1>
            <p className="hero-copy">
              Durchsuchen Sie aktuelle Stellenangebote der Bundesagentur fuer Arbeit in Echtzeit und exportieren Sie passende Ergebnisse als CSV.
            </p>
          </div>
          <div className="hero-proof">
            <div className="sync-badge">
              <Clock size={18} aria-hidden="true" />
              Live-API
            </div>
            <p>Fuer Arbeitsvermittlungen, Personalberater, Headhunter und mittelstaendische Recruiting-Teams.</p>
          </div>
        </header>

        <section className="search-stage">
          <form className="search-panel search-panel-prominent" onSubmit={handleSearch} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setOpenSuggest(null);
              setShowAllSuggestions(true);
            }
          }}>
            <label className="suggest-field">
              <span>Beruf oder Suchbegriff</span>
              <div className="suggest-input-wrap">
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setOpenSuggest("keyword");
                    setShowAllSuggestions(false);
                  }}
                  onFocus={() => {
                    setOpenSuggest("keyword");
                    setShowAllSuggestions(true);
                  }}
                  autoComplete="off"
                  aria-expanded={openSuggest === "keyword"}
                  aria-controls="keyword-suggestion-list"
                />
                <button
                  className="suggest-toggle"
                  type="button"
                  aria-label="Berufsvorschlaege anzeigen"
                  aria-expanded={openSuggest === "keyword"}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (openSuggest === "keyword") {
                      setOpenSuggest(null);
                      setShowAllSuggestions(true);
                      return;
                    }
                    setOpenSuggest("keyword");
                    setShowAllSuggestions(true);
                  }}
                >
                  <ChevronDown size={18} className={openSuggest === "keyword" ? "suggest-chevron open" : "suggest-chevron"} />
                </button>
              </div>
              {openSuggest === "keyword" ? (
                <div className="suggest-menu" id="keyword-suggestion-list" role="listbox">
                  {(visibleKeywordSuggestions.length ? visibleKeywordSuggestions : keywordSuggestions).map((suggestion) => (
                    <button
                      className="suggest-option"
                      type="button"
                      key={suggestion}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setKeyword(suggestion);
                        setOpenSuggest(null);
                        setShowAllSuggestions(true);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
            <label className="suggest-field">
              <span>Ort</span>
              <div className="suggest-input-wrap">
                <input
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value);
                    setOpenSuggest("location");
                    setShowAllSuggestions(false);
                  }}
                  onFocus={() => {
                    setOpenSuggest("location");
                    setShowAllSuggestions(true);
                  }}
                  autoComplete="off"
                  aria-expanded={openSuggest === "location"}
                  aria-controls="location-suggestion-list"
                />
                <button
                  className="suggest-toggle"
                  type="button"
                  aria-label="Ortsvorschlaege anzeigen"
                  aria-expanded={openSuggest === "location"}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (openSuggest === "location") {
                      setOpenSuggest(null);
                      setShowAllSuggestions(true);
                      return;
                    }
                    setOpenSuggest("location");
                    setShowAllSuggestions(true);
                  }}
                >
                  <ChevronDown size={18} className={openSuggest === "location" ? "suggest-chevron open" : "suggest-chevron"} />
                </button>
              </div>
              {openSuggest === "location" ? (
                <div className="suggest-menu" id="location-suggestion-list" role="listbox">
                  {(visibleLocationSuggestions.length ? visibleLocationSuggestions : locationSuggestions).map((suggestion) => (
                    <button
                      className="suggest-option"
                      type="button"
                      key={suggestion}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setLocation(suggestion);
                        setOpenSuggest(null);
                        setShowAllSuggestions(true);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
            <label className="exact-location-toggle">
              <input type="checkbox" checked={exactLocation} onChange={(event) => setExactLocation(event.target.checked)} />
              <span>Nur exakte Treffer</span>
            </label>
            <button className="primary-action" type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />}
              Suchen
            </button>
          </form>

          <div className="trust-strip" aria-label="Produkt- und API-Informationen">
            {trustItems.map((item) => (
              <div className="trust-item" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="quick-searches">
            <span className="quick-search-label">Beliebte Einstiege</span>
            {quickSearches.map((entry) => (
              <button
                key={`${entry.keyword}-${entry.location}`}
                className="quick-search-chip"
                type="button"
                onClick={() => applyQuickSearch(entry.keyword, entry.location)}
              >
                {entry.keyword} in {entry.location}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <div className="error-banner error-panel" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>Die Suche konnte nicht geladen werden.</strong>
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        {hasSearched || loading ? (
          <>
            <section className="results-header" aria-live="polite">
              <div>
                <p className="eyebrow">Ergebnisse</p>
                <h2>
                  {loading
                    ? "Aktuelle Stellenangebote werden geladen..."
                    : `${jobs.length} Angebote${totalResults ? ` von ${totalResults}` : ""}`}
                </h2>
              </div>
              <div className="results-actions">
                <p>{loading ? "Wir fragen die Bundesagentur-API live ab." : "Exportieren Sie passende Treffer direkt als CSV fuer Ihr Recruiting-Team."}</p>
                <button className="ghost-action" type="button" onClick={handleExport} disabled={exporting || loading}>
                  {exporting ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />}
                  CSV exportieren
                </button>
              </div>
            </section>

            <div className="filter-note">
              Die Bundesagentur-API kann Ergebnisse aus dem Umkreis liefern. Mit "Nur exakter Ort" werden nur Angebote aus dem eingegebenen Ort angezeigt und exportiert.
            </div>
          </>
        ) : null}

        {loading ? (
          <section className="results-grid" aria-label="Stellenangebote werden geladen">
            {Array.from({ length: 6 }).map((_, index) => (
              <JobCardSkeleton key={index} />
            ))}
          </section>
        ) : jobs.length > 0 ? (
          <>
            <section className="results-grid">
              {jobs.map((job, index) => (
                <JobCard job={job} key={`${job.reference || job.title}-${index}`} />
              ))}
            </section>
            <div className="pagination-row">
              <button className="secondary-action" type="button" onClick={handleLoadMore} disabled={loadingMore || !canLoadMore}>
                {loadingMore ? <LoaderCircle className="spin" size={19} /> : <Plus size={19} />}
                Weitere laden
              </button>
            </div>
          </>
        ) : hasSearched && !error ? (
          <div className="zero-state" aria-live="polite">
            <div className="zero-illustration" aria-hidden="true">
              <AlertTriangle size={42} />
            </div>
            <h3>Keine passenden Stellenangebote gefunden</h3>
            <p>Die Suche war erfolgreich, aber die aktuellen Filter liefern keine Treffer.</p>
            <ul className="zero-actions">
              <li>Pruefen Sie die Schreibweise des Ortes.</li>
              <li>Entfernen Sie "Nur exakter Ort", wenn auch umliegende Orte relevant sind.</li>
              <li>Verwenden Sie einen allgemeineren Suchbegriff.</li>
            </ul>
          </div>
        ) : (
          <div className="zero-state" aria-live="polite">
            <div className="zero-illustration" aria-hidden="true">
              <Search size={42} />
            </div>
            <h3>Aktuelle Stellenangebote</h3>
            <p>Geben Sie einen Beruf und einen Ort ein, um passende Stellenangebote zu finden. Danach stehen CSV-Export und Job-Alarm sofort zur Verfuegung.</p>
          </div>
        )}

        <section className="saas-section secondary-zone">
          <div className="saas-header">
            <div>
              <p className="eyebrow">Job-Alarm per E-Mail</p>
              <h2>Erhalten Sie neue passende Stellenangebote automatisch jeden Morgen.</h2>
            </div>
            <button
              className="secondary-action"
              type="button"
              onClick={() =>
                setAgentOpen((open) => {
                  const next = !open;
                  if (next) trackEvent("agent_configurator_opened");
                  return next;
                })
              }
              aria-expanded={agentOpen}
            >
              <Mail size={18} aria-hidden="true" />
              {agentOpen ? "Agent ausblenden" : "Agent konfigurieren"}
            </button>
          </div>

          {agentOpen ? (
            <div className="agent-body">
              <div className="agent-summary">
                <strong>Einrichtung in zwei Schritten</strong>
                <span>Legen Sie zuerst den Agentur-Zugang an und erstellen Sie danach einen Job-Alarm fuer Beruf und Ort.</span>
              </div>
              <div className="saas-grid">
                <form className="saas-panel saas-panel-secondary" onSubmit={handleCreateAgency}>
                  <div className="panel-title">
                    <KeyRound size={19} aria-hidden="true" />
                    <h3>1. Agentur-Zugang</h3>
                  </div>
                  <label>
                    <span>Name der Agentur</span>
                    <input value={agencyForm.name} onChange={(event) => setAgencyForm({ ...agencyForm, name: event.target.value })} />
                  </label>
                  <label>
                    <span>E-Mail-Adresse</span>
                    <input type="email" value={agencyForm.email} onChange={(event) => setAgencyForm({ ...agencyForm, email: event.target.value })} />
                  </label>
                  <button className="primary-action" type="submit" disabled={saasLoading}>
                    {saasLoading ? <LoaderCircle className="spin" size={19} /> : <Plus size={19} />}
                    {agency ? "Neue Agentur anlegen" : "Agentur-Zugang erstellen"}
                  </button>
                  {agency ? (
                    <div className="agency-summary-card">
                      <div>
                        <span>Arbeitsbereich aktiv</span>
                        <strong>{agency.name}</strong>
                        <p>{agency.email}</p>
                      </div>
                      <div className="agency-summary-actions">
                        <button className="secondary-action" type="button" onClick={handleForgetAgency}>
                          <LogOut size={17} />
                          Entfernen
                        </button>
                      </div>
                    </div>
                  ) : null}
                </form>

                <form className="saas-panel saas-panel-primary" onSubmit={handleCreateAlert} onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setAgentSuggest(null);
                    setShowAllAgentSuggestions(true);
                  }
                }}>
                  <div className="panel-title">
                    <Mail size={19} aria-hidden="true" />
                    <h3>2. Job-Alarm erstellen</h3>
                  </div>
                  <label className="suggest-field">
                    <span>Beruf</span>
                    <div className="suggest-input-wrap">
                      <input
                        value={alertForm.keyword}
                        onChange={(event) => {
                          setAlertForm({ ...alertForm, keyword: event.target.value });
                          setAgentSuggest("keyword");
                          setShowAllAgentSuggestions(false);
                        }}
                        onFocus={() => {
                          setAgentSuggest("keyword");
                          setShowAllAgentSuggestions(true);
                        }}
                        autoComplete="off"
                        aria-expanded={agentSuggest === "keyword"}
                        aria-controls="agent-keyword-suggestion-list"
                      />
                      <button
                        className="suggest-toggle"
                        type="button"
                        aria-label="Suchbegriffe anzeigen"
                        aria-expanded={agentSuggest === "keyword"}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          if (agentSuggest === "keyword") {
                            setAgentSuggest(null);
                            setShowAllAgentSuggestions(true);
                            return;
                          }
                          setAgentSuggest("keyword");
                          setShowAllAgentSuggestions(true);
                        }}
                      >
                        <ChevronDown size={18} className={agentSuggest === "keyword" ? "suggest-chevron open" : "suggest-chevron"} />
                      </button>
                    </div>
                    {agentSuggest === "keyword" ? (
                      <div className="suggest-menu" id="agent-keyword-suggestion-list" role="listbox">
                        {(visibleAgentKeywordSuggestions.length ? visibleAgentKeywordSuggestions : keywordSuggestions).map((suggestion) => (
                          <button
                            className="suggest-option"
                            type="button"
                            key={suggestion}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setAlertForm({ ...alertForm, keyword: suggestion });
                              setAgentSuggest(null);
                              setShowAllAgentSuggestions(true);
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>
                  <label className="suggest-field">
                    <span>Ort</span>
                    <div className="suggest-input-wrap">
                      <input
                        value={alertForm.location}
                        onChange={(event) => {
                          setAlertForm({ ...alertForm, location: event.target.value });
                          setAgentSuggest("location");
                          setShowAllAgentSuggestions(false);
                        }}
                        onFocus={() => {
                          setAgentSuggest("location");
                          setShowAllAgentSuggestions(true);
                        }}
                        autoComplete="off"
                        aria-expanded={agentSuggest === "location"}
                        aria-controls="agent-location-suggestion-list"
                      />
                      <button
                        className="suggest-toggle"
                        type="button"
                        aria-label="Orte anzeigen"
                        aria-expanded={agentSuggest === "location"}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          if (agentSuggest === "location") {
                            setAgentSuggest(null);
                            setShowAllAgentSuggestions(true);
                            return;
                          }
                          setAgentSuggest("location");
                          setShowAllAgentSuggestions(true);
                        }}
                      >
                        <ChevronDown size={18} className={agentSuggest === "location" ? "suggest-chevron open" : "suggest-chevron"} />
                      </button>
                    </div>
                    {agentSuggest === "location" ? (
                      <div className="suggest-menu" id="agent-location-suggestion-list" role="listbox">
                        {(visibleAgentLocationSuggestions.length ? visibleAgentLocationSuggestions : locationSuggestions).map((suggestion) => (
                          <button
                            className="suggest-option"
                            type="button"
                            key={suggestion}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setAlertForm({ ...alertForm, location: suggestion });
                              setAgentSuggest(null);
                              setShowAllAgentSuggestions(true);
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>
                  <p className="form-hint">Der Job-Alarm nutzt immer den exakten Ort, damit nur wirklich passende Treffer in Ihrer taeglichen Zusammenfassung landen.</p>
                  <button className="secondary-action" type="submit" disabled={saasLoading || !agency}>
                    <Plus size={19} />
                    Job-Alarm erstellen
                  </button>
                  <div className="alarm-trust-line">Datenquelle: Bundesagentur fuer Arbeit</div>
                </form>
              </div>
            </div>
          ) : null}

          {saasStatus ? <div className="status-banner">{saasStatus}</div> : null}

          <div className="subscription-list">
            {subscriptions.map((subscription) => (
              <article className="subscription-row" key={subscription.id}>
                <div className="subscription-copy">
                  <span className="subscription-kicker">Aktive Benachrichtigung</span>
                  <strong>{normalizeSubscriptionText(subscription.keyword) || "Suchbegriff fehlt"}</strong>
                  <span className="subscription-location">{normalizeSubscriptionText(subscription.location) || "Ort fehlt"}</span>
                </div>
                <span className="subscription-frequency">{subscription.frequency}</span>
                <div className="subscription-actions">
                  <button className="secondary-action" type="button" onClick={() => handleDeleteAlert(subscription.id)} disabled={saasLoading}>
                    <Trash2 size={18} />
                    Loeschen
                  </button>
                  <button className="secondary-action" type="button" onClick={() => handleSendNow(subscription.id)} disabled={saasLoading}>
                    <Send size={18} />
                    Jetzt senden
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="site-footer" aria-label="KhalfaJobs Branding">
          <p className="site-footer-title">Entwickelt von Walid Khalfa</p>
          <div className="site-footer-links">
            <a href="mailto:walid@khalfajobs.me">walid@khalfajobs.me</a>
            <a href="https://wa.me/21653097624" target="_blank" rel="noreferrer">
              WhatsApp: +216 53 097 624
            </a>
          </div>
        </footer>
      </section>
    </main>
  );
}
