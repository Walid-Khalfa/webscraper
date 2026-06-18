"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Download,
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
  Sparkles,
  TerminalSquare,
  Trash2,
  Columns3,
} from "lucide-react";
import JobCard from "./JobCard";
import JobCardSkeleton from "./JobCardSkeleton";
import ToastStack from "./ToastStack";
import { trackEvent } from "./analytics";
import EmailDigestPreview from "./EmailDigestPreview";

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
const statusCycle = ["interested", "applied", "interview", "closed"];
const statusLabels = {
  interested: "Interessiert",
  applied: "Beworben",
  interview: "Interview",
  closed: "Abgelehnt / Angebot",
};
const themes = [
  { id: "brutalist", label: "Brutalistisch" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "hacker", label: "Retro Hacker" },
];
const viewModes = [
  { id: "grid", label: "Gitter", icon: LayoutGrid },
  { id: "list", label: "Liste", icon: List },
  { id: "kanban", label: "Job-Tracker", icon: Columns3 },
];
const defaultEmailTemplate = {
  subject: "",
  agencyName: "",
  greeting: "Guten Morgen",
  intro: "hier sind Ihre neuesten relevanten Stellenangebote fuer heute.",
  showSalary: true,
  showLocation: true,
  showApplyLink: true,
};

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

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

function extractSalaryValue(job) {
  const values = String(job.salary || "")
    .match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/g)
    ?.map((entry) => Number(entry.replaceAll(".", "").replace(",", ".")))
    .filter((entry) => Number.isFinite(entry));
  if (!values?.length) return 0;
  return Math.max(...values);
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
  return "Keine Verguetung angegeben";
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
    title: flatten(title) || "Stellenprofil ohne Titel",
    employer: flatten(employer) || "Arbeitgeber nicht genannt",
    location: flatten(location) || "Standort nicht genannt",
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

function formatFrequencyLabel(value) {
  const normalized = String(value || "").toLocaleLowerCase("de-DE");
  if (normalized === "daily") return "Taeglich";
  if (normalized === "weekly") return "Woechentlich";
  if (normalized === "monthly") return "Monatlich";
  return value || "Individuell";
}

function sortJobs(jobs, sortBy) {
  const copy = [...jobs];
  copy.sort((left, right) => {
    if (sortBy === "salary") return extractSalaryValue(right) - extractSalaryValue(left);
    if (sortBy === "title") return left.title.localeCompare(right.title, "de");
    if (sortBy === "employer") return left.employer.localeCompare(right.employer, "de");
    return 0;
  });
  return copy;
}

function buildSalaryBuckets(jobs) {
  const buckets = [
    { id: "all", label: "Alle", min: 0, max: Infinity },
    { id: "upto40", label: "Bis 40k", min: 1, max: 40000 },
    { id: "40to60", label: "40k - 60k", min: 40001, max: 60000 },
    { id: "60plus", label: "Ab 60k", min: 60001, max: Infinity },
  ];
  return buckets.map((bucket) => ({
    ...bucket,
    count:
      bucket.id === "all"
        ? jobs.length
        : jobs.filter((job) => {
            const salary = extractSalaryValue(job);
            return salary >= bucket.min && salary <= bucket.max;
          }).length,
  }));
}

export default function Home({ initialShowcase, platformInsights }) {
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
  const [theme, setTheme] = useState("brutalist");
  const [viewMode, setViewMode] = useState("grid");
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [favorites, setFavorites] = useState({});
  const [activeFavoriteRef, setActiveFavoriteRef] = useState(null);
  const [draggingRef, setDraggingRef] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [salaryBucket, setSalaryBucket] = useState("all");
  const [emailTemplateOpts, setEmailTemplateOpts] = useState(defaultEmailTemplate);
  const [simulatingEmail, setSimulatingEmail] = useState(false);

  const rawJobs = useMemo(() => extractJobs(payload).map(normalizeJob), [payload]);
  const jobsWithClientFilters = useMemo(() => {
    let next = [...rawJobs];
    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLocaleLowerCase("de-DE");
      next = next.filter((job) =>
        [job.title, job.employer, job.location, job.occupation, job.salary].some((value) =>
          String(value || "").toLocaleLowerCase("de-DE").includes(query),
        ),
      );
    }

    if (salaryBucket !== "all") {
      const buckets = buildSalaryBuckets(rawJobs);
      const activeBucket = buckets.find((bucket) => bucket.id === salaryBucket);
      if (activeBucket) {
        next = next.filter((job) => {
          const salary = extractSalaryValue(job);
          return salary >= activeBucket.min && salary <= activeBucket.max;
        });
      }
    }

    return sortJobs(next, sortBy);
  }, [rawJobs, searchTerm, salaryBucket, sortBy]);

  const jobPostingJsonLd = useMemo(() => {
    if (!jobsWithClientFilters.length) return null;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: jobsWithClientFilters.slice(0, 25).map((job, index) => ({
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
  }, [jobsWithClientFilters]);

  const totalResults = payload?.exactLocation ? 0 : Number(payload?.maxErgebnisse || 0);
  const canLoadMore = hasSearched && !loading && rawJobs.length > 0 && (totalResults ? rawJobs.length < totalResults : true);
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
  const salaryBuckets = useMemo(() => buildSalaryBuckets(rawJobs), [rawJobs]);
  const employerStats = useMemo(() => {
    const map = new Map();
    rawJobs.forEach((job) => {
      map.set(job.employer, (map.get(job.employer) || 0) + 1);
    });
    return [...map.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [rawJobs]);
  const kanbanJobs = useMemo(
    () =>
      statusCycle.map((status) => ({
        status,
        jobs: Object.values(favorites).filter((entry) => entry.status === status && entry.job),
      })),
    [favorites],
  );
  const activeFavorite = activeFavoriteRef ? favorites[activeFavoriteRef] : null;
  const trustItems = useMemo(
    () => [
      { label: "Datenquelle", value: "Bundesagentur fuer Arbeit" },
      { label: "Suchstatus", value: hasSearched ? `${totalResults || rawJobs.length} Treffer verfuegbar` : "Bereit fuer Ihre Recherche" },
      { label: "Aktualisierung", value: hasSearched ? formatLastUpdated(lastSearchAt) : platformInsights?.lastActivityLabel || "Noch keine Aktivitaet" },
      { label: "Recruiting-Tools", value: "CSV-Export, Job-Tracker, Job-Alarme" },
      { label: "Synchronisierte Treffer diese Woche", value: `${platformInsights?.searchHitsWeek || 0} Treffer erfasst` },
    ],
    [hasSearched, rawJobs.length, lastSearchAt, totalResults, platformInsights?.lastActivityLabel, platformInsights?.searchHitsWeek],
  );

  function pushToast(type, message, persist = false) {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.filter((toast) => toast.type !== "loading"), { id, type, message }].slice(-4));
    if (!persist) {
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4200);
    }
    return id;
  }

  function appendConsole(message) {
    setConsoleLogs((current) => [...current, `${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}  ${message}`].slice(-10));
  }

  function mergePayload(currentPayload, nextPayload) {
    const currentItems = extractJobs(currentPayload);
    const nextItems = extractJobs(nextPayload);
    return {
      ...nextPayload,
      ergebnisliste: [...currentItems, ...nextItems],
    };
  }

  function saveFavorites(next) {
    setFavorites(next);
    localStorage.setItem("jobFavorites", JSON.stringify(next));
  }

  function ensureFavorite(job, overrides = {}) {
    const current = favorites[job.reference];
    const next = {
      ...current,
      notes: current?.notes || "",
      tags: current?.tags || [],
      status: current?.status || "interested",
      job,
      ...overrides,
    };
    const all = { ...favorites, [job.reference]: next };
    saveFavorites(all);
    return next;
  }

  function toggleFavorite(job) {
    if (!job?.reference) return;
    if (favorites[job.reference]) {
      const next = { ...favorites };
      delete next[job.reference];
      saveFavorites(next);
      if (activeFavoriteRef === job.reference) setActiveFavoriteRef(null);
      pushToast("success", "Favorit entfernt.");
      return;
    }
    ensureFavorite(job);
    setActiveFavoriteRef(job.reference);
    pushToast("success", "Favorit gespeichert.");
  }

  function cycleFavoriteStatus(reference) {
    const current = favorites[reference];
    if (!current) return;
    const currentIndex = statusCycle.indexOf(current.status || "interested");
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    saveFavorites({ ...favorites, [reference]: { ...current, status: nextStatus } });
    pushToast("success", `Status auf ${statusLabels[nextStatus]} gesetzt.`);
  }

  function updateFavoriteField(reference, updates) {
    const current = favorites[reference];
    if (!current) return;
    saveFavorites({ ...favorites, [reference]: { ...current, ...updates } });
  }

  function moveFavoriteToStatus(reference, status) {
    const current = favorites[reference];
    if (!current) return;
    saveFavorites({ ...favorites, [reference]: { ...current, status } });
  }

  function applyQuickSearch(nextKeyword, nextLocation) {
    setKeyword(nextKeyword);
    setLocation(nextLocation);
    setExactLocation(true);
    setOpenSuggest(null);
    setShowAllSuggestions(true);
  }

  function runQuickSearch(nextKeyword, nextLocation) {
    applyQuickSearch(nextKeyword, nextLocation);
    window.setTimeout(() => {
      document.querySelector(".search-panel-prominent")?.requestSubmit();
    }, 0);
  }

  useEffect(() => {
    const storedAgency = localStorage.getItem("agencyProfile");
    const storedFavorites = localStorage.getItem("jobFavorites");
    const storedTheme = localStorage.getItem("jobTheme");
    const storedView = localStorage.getItem("jobViewMode");
    const storedEmailTemplate = localStorage.getItem("emailTemplateOpts");

    if (storedAgency) setAgency(JSON.parse(storedAgency));
    if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
    if (storedTheme) setTheme(storedTheme);
    if (storedView) setViewMode(storedView);
    if (storedEmailTemplate) {
      setEmailTemplateOpts({ ...defaultEmailTemplate, ...JSON.parse(storedEmailTemplate) });
    }

    const params = new URLSearchParams(window.location.search);
    const keywordParam = params.get("keyword");
    const locationParam = params.get("location");
    const exactLocationParam = params.get("exactLocation");
    if (keywordParam) setKeyword(keywordParam);
    if (locationParam) setLocation(locationParam);
    if (exactLocationParam) setExactLocation(exactLocationParam !== "false");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("jobTheme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("jobViewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("emailTemplateOpts", JSON.stringify(emailTemplateOpts));
  }, [emailTemplateOpts]);

  useEffect(() => {
    if (!agency?.api_key) return;
    requestJson("/api/alerts/subscriptions", { headers: { "X-Agency-Key": agency.api_key } })
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]));
  }, [agency?.api_key]);

  async function simulateConsoleBeforeFetch(pageNumber = 1) {
    setIsConsoleOpen(true);
    setConsoleLogs([]);
    appendConsole("Verbindung zur Bundesagentur fuer Arbeit wird aufgebaut...");
    await sleep(220);
    appendConsole(`Abfrage fuer Beruf "${keyword || "alle"}" und Ort "${location || "deutschland"}" vorbereitet...`);
    await sleep(180);
    appendConsole(`Stellenangebote Seite ${pageNumber} werden geladen...`);
    await sleep(180);
    appendConsole("Verguetungsfelder werden normalisiert und Ergebnisstruktur aufgebaut...");
  }

  async function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setHasSearched(true);
    setPage(1);
    pushToast("loading", "Suchergebnisse werden geladen...", true);
    await simulateConsoleBeforeFetch(1);
    try {
      const params = new URLSearchParams({ keyword, location, page: "1", size: "25", exactLocation: String(exactLocation) });
      const shareParams = new URLSearchParams({ keyword, location, exactLocation: String(exactLocation) });
      window.history.replaceState(null, "", `?${shareParams.toString()}`);
      const result = await requestJson(`/api/jobs/search?${params.toString()}`);
      const normalized = extractJobs(result).map(normalizeJob);
      setPayload(result);
      setLastSearchAt(Date.now());
      normalized.forEach((job) => {
        if (favorites[job.reference]) {
          updateFavoriteField(job.reference, { job });
        }
      });
      appendConsole(`${normalized.length} Stellenangebote erfolgreich geladen.`);
      trackEvent("search_completed", {
        keyword,
        location,
        exactLocation,
        resultCount: normalized.length,
      });
      pushToast("success", normalized.length ? `${normalized.length} relevante Stellenangebote geladen` : "Keine passenden Stellenangebote gefunden");
    } catch (err) {
      setPayload(null);
      const message = getErrorMessage(err, "Suche");
      setError(message);
      appendConsole(`Fehler: ${message}`);
      pushToast("error", `API-Fehler: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    setError("");
    pushToast("loading", "Weitere Treffer werden geladen...", true);
    await simulateConsoleBeforeFetch(nextPage);
    try {
      const params = new URLSearchParams({ keyword, location, page: String(nextPage), size: "25", exactLocation: String(exactLocation) });
      const result = await requestJson(`/api/jobs/search?${params.toString()}`);
      const nextCount = extractJobs(result).length;
      setPayload((current) => mergePayload(current, result));
      setPage(nextPage);
      setLastSearchAt(Date.now());
      appendConsole(`${nextCount} weitere Stellenangebote wurden angefuegt.`);
      pushToast("success", nextCount ? `${nextCount} weitere Treffer geladen` : "Keine weiteren Treffer gefunden");
    } catch (err) {
      const message = getErrorMessage(err, "Suche");
      setError(message);
      appendConsole(`Fehler: ${message}`);
      pushToast("error", `API-Fehler: ${message}`);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    trackEvent("csv_export_started", { keyword, location, exactLocation });
    try {
      const params = new URLSearchParams({ keyword, location, exactLocation: String(exactLocation) });
      const response = await fetch(`/api/jobs/export/csv?${params.toString()}`, {
        headers: agency?.api_key ? { "X-Agency-Key": agency.api_key } : undefined,
      });
      if (!response.ok) throw new Error((await response.json()).detail || "CSV-Export konnte nicht erstellt werden");
      const exportTier = response.headers.get("X-KhalfaJobs-Export-Tier");
      const exportLimit = Number(response.headers.get("X-KhalfaJobs-Export-Limit") || 25);
      const safeKeyword = (keyword || "alle").trim().replace(/\s+/g, "-");
      const safeLocation = (location || "deutschland").trim().replace(/\s+/g, "-");
      downloadBlob(await response.blob(), `stellenangebote-${safeKeyword}-${safeLocation}.csv`);
      pushToast(
        "success",
        exportTier === "agentur"
          ? `CSV-Export heruntergeladen. Ihr Agentur-Zugang enthaelt bis zu ${exportLimit} Treffer pro Export.`
          : `Starter-Export heruntergeladen. Ohne Agentur-Zugang sind bis zu ${exportLimit} Treffer enthalten.`,
      );
      trackEvent("csv_export_completed", { keyword, location, exactLocation });
    } catch (err) {
      setError(getErrorMessage(err, "CSV-Export"));
      trackEvent("csv_export_failed", { keyword, location, exactLocation });
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
      setEmailTemplateOpts((current) => ({ ...current, agencyName: current.agencyName || created.name }));
      setSaasStatus("Der Agentur-Zugang wurde erfolgreich eingerichtet.");
      trackEvent("agency_created", { plan: created.plan });
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
    setSaasStatus("Der lokale Agentur-Zugang wurde aus diesem Browser entfernt.");
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
      setSaasStatus("Richten Sie zuerst einen Agentur-Zugang ein, bevor Sie einen Job-Alarm anlegen.");
      trackEvent("alert_creation_failed", { reason: "missing_agency_access", keyword: alertForm.keyword, location: alertForm.location });
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
      setSaasStatus("Der Job-Alarm wurde eingerichtet und kann ab sofort genutzt werden.");
      trackEvent("agency_alert_created", { keyword: alertForm.keyword, location: alertForm.location });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Einrichtung des Job-Alarms"));
      trackEvent("alert_creation_failed", { reason: getErrorMessage(err, "Einrichtung des Job-Alarms"), keyword: alertForm.keyword, location: alertForm.location });
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
          ? `Die Zusammenfassung fuer ${result.recipient} wurde vorbereitet. Hinterlegen Sie einen Mail-Dienst, um reale Zustellungen zu aktivieren.`
          : `Die Zusammenfassung mit ${result.job_count} Treffern wurde an ${result.recipient} gesendet.`,
      );
      trackEvent("agency_alert_send_now", { subscriptionId, jobCount: result.job_count || 0, dryRun: Boolean(result.dry_run) });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Versand des Job-Alarms"));
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
      setSaasStatus("Der Job-Alarm wurde entfernt.");
      trackEvent("agency_alert_deleted", { subscriptionId });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Loeschen des Job-Alarms"));
    } finally {
      setSaasLoading(false);
    }
  }

  async function handleSimulateEmailSend() {
    setSimulatingEmail(true);
    pushToast("loading", "Versand wird simuliert...", true);
    await sleep(900);
    setSimulatingEmail(false);
    pushToast("success", "Digest erfolgreich simuliert. Die Vorschau entspricht dem aktuellen Layout.");
  }

  function renderSalaryChart() {
    const maxCount = Math.max(...salaryBuckets.map((bucket) => bucket.count), 1);
    return (
      <svg viewBox="0 0 360 180" className="chart-svg" role="img" aria-label="Verguetungsverteilung">
        {salaryBuckets.map((bucket, index) => {
          const height = (bucket.count / maxCount) * 110;
          const x = 20 + index * 82;
          const y = 140 - height;
          return (
            <g key={bucket.id} className="chart-bar-group" onClick={() => setSalaryBucket(bucket.id)}>
              <rect x={x} y={y} width="54" height={height} className={`chart-bar${salaryBucket === bucket.id ? " active" : ""}`} />
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
    <main className="app-shell theme-shell" data-theme={theme}>
      {jobPostingJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }} /> : null}
      <ToastStack toasts={toasts} />

      {activeFavorite ? (
        <aside className="favorite-drawer" aria-label="Favoriten und Notizen">
          <div className="favorite-drawer-header">
            <div>
              <p className="eyebrow">Favorit bearbeiten</p>
              <h3>{activeFavorite.job?.title || activeFavoriteRef}</h3>
            </div>
            <button className="icon-button" type="button" onClick={() => setActiveFavoriteRef(null)} aria-label="Seitenpanel schliessen">
              <PanelRightClose size={18} />
            </button>
          </div>
          <div className="favorite-drawer-meta">
            <strong>{activeFavorite.job?.employer}</strong>
            <span>{activeFavorite.job?.location}</span>
          </div>
          <label>
            <span>Status</span>
            <select value={activeFavorite.status} onChange={(event) => updateFavoriteField(activeFavoriteRef, { status: event.target.value })}>
              {statusCycle.map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Notizen</span>
            <textarea
              rows={6}
              value={activeFavorite.notes}
              onChange={(event) => updateFavoriteField(activeFavoriteRef, { notes: event.target.value })}
            />
          </label>
          <label>
            <span>Tags (durch Komma getrennt)</span>
            <input
              value={(activeFavorite.tags || []).join(", ")}
              onChange={(event) =>
                updateFavoriteField(activeFavoriteRef, {
                  tags: event.target.value
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
        </aside>
      ) : null}

      <aside className="registry-rail" aria-label="Anwendungsidentitaet">
        <span>BA</span>
        <span>LIVE</span>
        <span>SAAS</span>
      </aside>

      <section className="workspace">
        <div className="product-topbar">
          <span>KhalfaJobs fuer Personalvermittlungen</span>
          <span>Datenquelle: Bundesagentur fuer Arbeit</span>
          <span>Live-Recherche, CSV-Export, Job-Tracker und Job-Alarme</span>
          <div className="theme-switcher">
            {themes.map((entry) => (
              <button key={entry.id} type="button" className={`theme-chip${theme === entry.id ? " active" : ""}`} onClick={() => setTheme(entry.id)}>
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <header className="masthead hero-layout">
          <div className="hero-primary">
            <p className="eyebrow">LIVE-STELLENSUCHE FUER RECRUITING-TEAMS</p>
            <h1>Relevante Stellenangebote fuer Ihr Recruiting in wenigen Sekunden.</h1>
            <p className="hero-copy">
              Durchsuchen Sie aktuelle Stellenangebote der Bundesagentur fuer Arbeit in Echtzeit, verwalten Sie Favoriten im Job-Tracker und exportieren Sie passende Treffer direkt als CSV.
            </p>
          </div>
          <div className="hero-proof">
            <div className="sync-badge">
              <Clock size={18} aria-hidden="true" />
              Live-Daten
            </div>
            <p>Entwickelt fuer Arbeitsvermittler, Personalberater, Recruiting-Agenturen, Headhunter und HR-Dienstleister.</p>
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
              <span>Gesuchte Position oder Suchbegriff</span>
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
                <button className="suggest-toggle" type="button" aria-label="Berufsvorschlaege anzeigen" aria-expanded={openSuggest === "keyword"} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                  if (openSuggest === "keyword") {
                    setOpenSuggest(null);
                    setShowAllSuggestions(true);
                    return;
                  }
                  setOpenSuggest("keyword");
                  setShowAllSuggestions(true);
                }}>
                  <ChevronDown size={18} className={openSuggest === "keyword" ? "suggest-chevron open" : "suggest-chevron"} />
                </button>
              </div>
              {openSuggest === "keyword" ? (
                <div className="suggest-menu" id="keyword-suggestion-list" role="listbox">
                  {(visibleKeywordSuggestions.length ? visibleKeywordSuggestions : keywordSuggestions).map((suggestion) => (
                    <button className="suggest-option" type="button" key={suggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                      setKeyword(suggestion);
                      setOpenSuggest(null);
                      setShowAllSuggestions(true);
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
                <button className="suggest-toggle" type="button" aria-label="Standortvorschlaege anzeigen" aria-expanded={openSuggest === "location"} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                  if (openSuggest === "location") {
                    setOpenSuggest(null);
                    setShowAllSuggestions(true);
                    return;
                  }
                  setOpenSuggest("location");
                  setShowAllSuggestions(true);
                }}>
                  <ChevronDown size={18} className={openSuggest === "location" ? "suggest-chevron open" : "suggest-chevron"} />
                </button>
              </div>
              {openSuggest === "location" ? (
                <div className="suggest-menu" id="location-suggestion-list" role="listbox">
                  {(visibleLocationSuggestions.length ? visibleLocationSuggestions : locationSuggestions).map((suggestion) => (
                    <button className="suggest-option" type="button" key={suggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                      setLocation(suggestion);
                      setOpenSuggest(null);
                      setShowAllSuggestions(true);
                    }}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <label className="exact-location-toggle">
              <input type="checkbox" checked={exactLocation} onChange={(event) => setExactLocation(event.target.checked)} />
              <span>Nur exakte Standorte</span>
            </label>
            <button className="primary-action" type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />}
              Stellen finden
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
            <span className="quick-search-label">Beliebte Suchanfragen</span>
            {quickSearches.map((entry) => (
              <button key={`${entry.keyword}-${entry.location}`} className="quick-search-chip" type="button" onClick={() => applyQuickSearch(entry.keyword, entry.location)}>
                {entry.keyword} in {entry.location}
              </button>
            ))}
            <button className="quick-search-chip terminal-toggle" type="button" onClick={() => setIsConsoleOpen((value) => !value)}>
              <TerminalSquare size={16} />
              {isConsoleOpen ? "Konsole ausblenden" : "Konsole einblenden"}
            </button>
          </div>

          {(isConsoleOpen || loading || consoleLogs.length) && (
            <section className="scraper-console" aria-label="Live-Konsole der Suche">
              <div className="scraper-console-header">
                <strong>Scraping-Konsole</strong>
                <span>{loading ? "Aktiv" : "Bereit"}</span>
              </div>
              <div className="scraper-console-body">
                {(consoleLogs.length ? consoleLogs : ["Warten auf die naechste Suche..."]).map((line, index) => (
                  <div key={`${line}-${index}`} className="console-line">
                    <span className="console-prompt">&gt;</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
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
                <h2>{loading ? "Aktuelle Stellenangebote werden geladen..." : `${jobsWithClientFilters.length} Stellenangebote${totalResults ? ` von ${totalResults}` : ""}`}</h2>
              </div>
              <div className="results-actions">
                <p>{loading ? "Die offiziellen BA-Daten werden live geladen." : "Filtern, sortieren, tracken und exportieren Sie relevante Treffer direkt fuer Ihr Recruiting-Team."}</p>
                <button className="ghost-action" type="button" onClick={handleExport} disabled={exporting || loading}>
                  {exporting ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />}
                  CSV exportieren
                </button>
              </div>
            </section>

            <div className="results-toolbar">
              <div className="view-mode-switch">
                {viewModes.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button key={mode.id} type="button" className={`toolbar-chip${viewMode === mode.id ? " active" : ""}`} onClick={() => setViewMode(mode.id)}>
                      <Icon size={16} />
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              <div className="results-filters">
                <label>
                  <span>Suche in Ergebnissen</span>
                  <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
                </label>
                <label>
                  <span>Sortierung</span>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                    <option value="relevance">Relevanz</option>
                    <option value="salary">Verguetung</option>
                    <option value="title">Titel</option>
                    <option value="employer">Arbeitgeber</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="filter-note">
              Die Bundesagentur fuer Arbeit kann Treffer aus dem Umkreis liefern. Mit "Nur exakte Standorte" werden nur Stellenangebote fuer den eingegebenen Ort angezeigt und exportiert.
            </div>

            {rawJobs.length ? (
              <section className="interactive-dashboard" aria-label="Interaktiver Recruiting-Dashboard">
                <article className="dashboard-card">
                  <div className="dashboard-card-header">
                    <div>
                      <p className="eyebrow">Verguetungsverteilung</p>
                      <h3>Filter per Gehaltsklasse</h3>
                    </div>
                    <button className="toolbar-chip" type="button" onClick={() => setSalaryBucket("all")}>Zuruecksetzen</button>
                  </div>
                  {renderSalaryChart()}
                </article>
                <article className="dashboard-card">
                  <div className="dashboard-card-header">
                    <div>
                      <p className="eyebrow">Top-Arbeitgeber</p>
                      <h3>Unternehmen im geladenen Datensatz</h3>
                    </div>
                    <Sparkles size={18} />
                  </div>
                  {renderEmployerChart()}
                </article>
              </section>
            ) : null}
          </>
        ) : null}

        {loading ? (
          <section className="results-grid" aria-label="Stellenangebote werden geladen">
            {Array.from({ length: 6 }).map((_, index) => (
              <JobCardSkeleton key={index} />
            ))}
          </section>
        ) : jobsWithClientFilters.length > 0 ? (
          <>
            {viewMode === "kanban" ? (
              <section className="kanban-board" aria-label="Job-Tracker Kanban">
                {kanbanJobs.map((column) => (
                  <article key={column.status} className="kanban-column" onDragOver={(event) => event.preventDefault()} onDrop={() => {
                    if (draggingRef) moveFavoriteToStatus(draggingRef, column.status);
                    setDraggingRef(null);
                  }}>
                    <div className="kanban-column-header">
                      <strong>{statusLabels[column.status]}</strong>
                      <span>{column.jobs.length}</span>
                    </div>
                    <div className="kanban-column-body">
                      {column.jobs.length ? (
                        column.jobs.map((entry) => (
                          <div key={entry.job.reference} draggable onDragStart={() => setDraggingRef(entry.job.reference)}>
                            <JobCard
                              job={entry.job}
                              viewMode="kanban"
                              isFavorite
                              favoriteData={entry}
                              onToggleFavorite={toggleFavorite}
                              onOpenFavorite={setActiveFavoriteRef}
                              onCycleStatus={cycleFavoriteStatus}
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
            ) : (
              <section className={`results-grid${viewMode === "list" ? " results-list" : ""}`}>
                {jobsWithClientFilters.map((job, index) => (
                  <JobCard
                    job={job}
                    key={`${job.reference || job.title}-${index}`}
                    viewMode={viewMode}
                    isFavorite={Boolean(favorites[job.reference])}
                    favoriteData={favorites[job.reference]}
                    onToggleFavorite={toggleFavorite}
                    onOpenFavorite={setActiveFavoriteRef}
                    onCycleStatus={cycleFavoriteStatus}
                  />
                ))}
              </section>
            )}
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
            <p>Die Suche wurde erfolgreich ausgefuehrt, liefert mit den aktuellen Kriterien jedoch keine passenden Treffer.</p>
            <ul className="zero-actions">
              <li>Pruefen Sie die Schreibweise von Beruf und Standort.</li>
              <li>Deaktivieren Sie "Nur exakte Standorte", wenn auch angrenzende Orte relevant sind.</li>
              <li>Verwenden Sie einen allgemeineren Suchbegriff fuer eine breitere Recherche.</li>
            </ul>
          </div>
        ) : (
          <section className="showcase-stack" aria-live="polite">
            <div className="zero-state">
              <div className="zero-illustration" aria-hidden="true">
                <Search size={42} />
              </div>
              <h3>Aktuelle Stellenangebote</h3>
              <p>Starten Sie eine Suche nach Beruf und Standort, um relevante Stellenangebote sofort zu pruefen, zu exportieren, als Favorit zu speichern oder per Job-Alarm zu verfolgen.</p>
            </div>

            <section className="insights-strip" aria-label="Live-Recruiting-Kennzahlen">
              <article className="insight-card">
                <span>Live-Recruiting-Kennzahlen</span>
                <strong>{platformInsights?.searchesToday || 0} Suchen heute</strong>
                <p>Persistierte Suchaktivitaet aus Ihrer Plattform.</p>
              </article>
              <article className="insight-card">
                <span>Aktive Job-Alarme</span>
                <strong>{platformInsights?.activeAlerts || 0}</strong>
                <p>Gespeicherte Suchprofile fuer wiederkehrende Recruiting-Suchen.</p>
              </article>
              <article className="insight-card">
                <span>CSV-Exporte heute</span>
                <strong>{platformInsights?.exportsToday || 0}</strong>
                <p>Direkt aus Live-Treffern fuer Recruiting-Workflows erstellt.</p>
              </article>
              <article className="insight-card">
                <span>Aktive Agentur-Zugaenge</span>
                <strong>{platformInsights?.activeAgencies || 0}</strong>
                <p>Aktive Arbeitsbereiche auf Ihrer Plattform.</p>
              </article>
              <article className="insight-card">
                <span>Gespeicherte Favoriten</span>
                <strong>{Object.keys(favorites).length}</strong>
                <p>Persoenliche Shortlist fuer Ihren Job-Tracker.</p>
              </article>
              <article className="insight-card">
                <span>Letzte Plattform-Aktivitaet</span>
                <strong>{platformInsights?.lastActivityLabel || "Noch keine Aktivitaet"}</strong>
                <p>Basierend auf Such-, Export- und Alarm-Ereignissen.</p>
              </article>
            </section>

            <section className="showcase-grid" aria-label="Marktueberblick">
              <div className="showcase-main">
                <div className="showcase-header">
                  <div>
                    <p className="eyebrow">Neueste Beispiel-Treffer</p>
                    <h3>Direkter Einblick in aktuelle Stellenangebote</h3>
                  </div>
                </div>
                <div className="results-grid results-grid-showcase">
                  {(initialShowcase?.jobs || []).map((job, index) => (
                    <JobCard
                      job={job}
                      key={`${job.reference || job.title}-${index}`}
                      viewMode="grid"
                      isFavorite={Boolean(favorites[job.reference])}
                      favoriteData={favorites[job.reference]}
                      onToggleFavorite={toggleFavorite}
                      onOpenFavorite={setActiveFavoriteRef}
                      onCycleStatus={cycleFavoriteStatus}
                    />
                  ))}
                </div>
              </div>

              <aside className="showcase-side">
                <article className="showcase-list-card">
                  <p className="eyebrow">Beliebte Suchanfragen</p>
                  <ul>
                    {(initialShowcase?.positions || quickSearches.map((entry) => `${entry.keyword} in ${entry.location}`)).map((entry) => {
                      const [nextKeyword, ...rest] = entry.split(" in ");
                      const nextLocation = rest.join(" in ");
                      return (
                        <li key={entry}>
                          <button type="button" onClick={() => runQuickSearch(nextKeyword, nextLocation)}>{entry}</button>
                        </li>
                      );
                    })}
                  </ul>
                </article>

                <article className="showcase-list-card">
                  <p className="eyebrow">Aktive Regionen</p>
                  <ul>
                    {(initialShowcase?.regions || []).map((entry) => (
                      <li key={entry}>
                        <button type="button" onClick={() => runQuickSearch(keyword || "Softwareentwickler", entry)}>{entry}</button>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="showcase-list-card">
                  <p className="eyebrow">Trends</p>
                  <ul>
                    {(initialShowcase?.trends?.length ? initialShowcase.trends : ["Live-Daten stehen fuer Ihre Recruiting-Suche bereit."]).map((entry) => (
                      <li key={entry}><span>{entry}</span></li>
                    ))}
                  </ul>
                </article>
              </aside>
            </section>
          </section>
        )}

        <section className="saas-section secondary-zone">
          <div className="saas-header">
            <div>
              <p className="eyebrow">Job-Alarm fuer Recruiting-Teams</p>
              <h2>Neue passende Stellenangebote automatisch per E-Mail erhalten.</h2>
            </div>
            <button className="secondary-action" type="button" onClick={() => {
              setAgentOpen((open) => {
                const next = !open;
                if (next) trackEvent("agent_configurator_opened");
                return next;
              });
            }} aria-expanded={agentOpen}>
              <Mail size={18} aria-hidden="true" />
              {agentOpen ? "Job-Alarm ausblenden" : "Job-Alarm einrichten"}
            </button>
          </div>

          {agentOpen ? (
            <div className="agent-body">
              <div className="agent-summary">
                <strong>Einrichtung in zwei Schritten</strong>
                <span>Legen Sie zuerst Ihren Agentur-Zugang an, definieren Sie anschliessend Beruf und Standort und pruefen Sie direkt die Vorschau Ihres taeglichen E-Mail-Digests.</span>
              </div>

              <div className="saas-grid">
                <form className="saas-panel saas-panel-secondary" onSubmit={handleCreateAgency}>
                  <div className="panel-title">
                    <KeyRound size={19} aria-hidden="true" />
                    <h3>1. Agentur-Zugang einrichten</h3>
                  </div>
                  <label>
                    <span>Agenturname</span>
                    <input value={agencyForm.name} onChange={(event) => setAgencyForm({ ...agencyForm, name: event.target.value })} />
                  </label>
                  <label>
                    <span>Kontakt-E-Mail</span>
                    <input type="email" value={agencyForm.email} onChange={(event) => setAgencyForm({ ...agencyForm, email: event.target.value })} />
                  </label>
                  <button className="primary-action" type="submit" disabled={saasLoading}>
                    {saasLoading ? <LoaderCircle className="spin" size={19} /> : <Plus size={19} />}
                    {agency ? "Weiteren Zugang anlegen" : "Agentur-Zugang erstellen"}
                  </button>
                  {agency ? (
                    <div className="agency-summary-card">
                      <div>
                        <span>Aktiver Agentur-Zugang</span>
                        <strong>{agency.name}</strong>
                        <p>{agency.email}</p>
                      </div>
                      <div className="agency-summary-actions">
                        <button className="secondary-action" type="button" onClick={handleForgetAgency}>
                          <LogOut size={17} />
                          Zugang entfernen
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
                    <h3>2. Job-Alarm anlegen</h3>
                  </div>
                  <label className="suggest-field">
                    <span>Beruf oder Suchprofil</span>
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
                      <button className="suggest-toggle" type="button" aria-label="Suchprofile anzeigen" aria-expanded={agentSuggest === "keyword"} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                        if (agentSuggest === "keyword") {
                          setAgentSuggest(null);
                          setShowAllAgentSuggestions(true);
                          return;
                        }
                        setAgentSuggest("keyword");
                        setShowAllAgentSuggestions(true);
                      }}>
                        <ChevronDown size={18} className={agentSuggest === "keyword" ? "suggest-chevron open" : "suggest-chevron"} />
                      </button>
                    </div>
                    {agentSuggest === "keyword" ? (
                      <div className="suggest-menu" id="agent-keyword-suggestion-list" role="listbox">
                        {(visibleAgentKeywordSuggestions.length ? visibleAgentKeywordSuggestions : keywordSuggestions).map((suggestion) => (
                          <button className="suggest-option" type="button" key={suggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                            setAlertForm({ ...alertForm, keyword: suggestion });
                            setAgentSuggest(null);
                            setShowAllAgentSuggestions(true);
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
                      <button className="suggest-toggle" type="button" aria-label="Standorte anzeigen" aria-expanded={agentSuggest === "location"} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                        if (agentSuggest === "location") {
                          setAgentSuggest(null);
                          setShowAllAgentSuggestions(true);
                          return;
                        }
                        setAgentSuggest("location");
                        setShowAllAgentSuggestions(true);
                      }}>
                        <ChevronDown size={18} className={agentSuggest === "location" ? "suggest-chevron open" : "suggest-chevron"} />
                      </button>
                    </div>
                    {agentSuggest === "location" ? (
                      <div className="suggest-menu" id="agent-location-suggestion-list" role="listbox">
                        {(visibleAgentLocationSuggestions.length ? visibleAgentLocationSuggestions : locationSuggestions).map((suggestion) => (
                          <button className="suggest-option" type="button" key={suggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                            setAlertForm({ ...alertForm, location: suggestion });
                            setAgentSuggest(null);
                            setShowAllAgentSuggestions(true);
                          }}>
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>
                  <p className="form-hint">Der Job-Alarm arbeitet mit exakten Standorten, damit nur wirklich relevante Treffer in Ihrer taeglichen Zusammenfassung erscheinen.</p>
                  <button className="secondary-action" type="submit" disabled={saasLoading || !agency}>
                    <Plus size={19} />
                    Job-Alarm erstellen
                  </button>
                  <div className="alarm-trust-line">Datenquelle: Bundesagentur fuer Arbeit · Versand auf Basis Ihres gespeicherten Suchprofils · Starter = 1 Alarm, Agentur-Zugang = bis zu 200 CSV-Treffer</div>
                </form>
              </div>

              <EmailDigestPreview
                agencyName={agency?.name}
                keyword={alertForm.keyword || keyword}
                location={alertForm.location || location}
                jobs={jobsWithClientFilters.length ? jobsWithClientFilters : initialShowcase?.jobs}
                options={emailTemplateOpts}
                onChange={setEmailTemplateOpts}
                onSimulateSend={handleSimulateEmailSend}
                simulating={simulatingEmail}
              />
            </div>
          ) : null}

          {saasStatus ? <div className="status-banner">{saasStatus}</div> : null}

          <div className="subscription-list">
            {subscriptions.map((subscription) => (
              <article className="subscription-row" key={subscription.id}>
                <div className="subscription-copy">
                  <span className="subscription-kicker">Aktiver Job-Alarm</span>
                  <strong>{normalizeSubscriptionText(subscription.keyword) || "Suchprofil fehlt"}</strong>
                  <span className="subscription-location">{normalizeSubscriptionText(subscription.location) || "Standort fehlt"}</span>
                </div>
                <span className="subscription-frequency">{formatFrequencyLabel(subscription.frequency)}</span>
                <div className="subscription-actions">
                  <button className="secondary-action" type="button" onClick={() => handleDeleteAlert(subscription.id)} disabled={saasLoading}>
                    <Trash2 size={18} />
                    Loeschen
                  </button>
                  <button className="secondary-action" type="button" onClick={() => handleSendNow(subscription.id)} disabled={saasLoading}>
                    <Send size={18} />
                    Jetzt versenden
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="site-footer" aria-label="KhalfaJobs Branding">
          <p className="site-footer-title">KhalfaJobs fuer professionelle Personalvermittlung</p>
          <div className="site-footer-links">
            <span>Datenquelle: Bundesagentur fuer Arbeit</span>
            <a href="/">Impressum</a>
            <a href="/">Datenschutz</a>
            <a href="mailto:walid@khalfajobs.me">Kontakt</a>
            <a href="/health">API-Status</a>
            <a href="https://github.com/Walid-Khalfa/webscraper" target="_blank" rel="noreferrer">GitHub</a>
            <a href="mailto:walid@khalfajobs.me">walid@khalfajobs.me</a>
            <a href="https://wa.me/21653097624" target="_blank" rel="noreferrer">WhatsApp: +216 53 097 624</a>
          </div>
        </footer>
      </section>
    </main>
  );
}
