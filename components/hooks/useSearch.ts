import { useState, useEffect, useMemo, useRef } from "react";
import { extractJobItems, normalizeJob, valueAt, flatten } from "../../lib/shared";
import { trackEvent } from "../analytics";
import { CITY_MARKET_NOTES, extractPrimaryCity, normalizeCityKey } from "../../lib/german-city-map";

const ALL_MAP_CITIES = "__all_map_cities__";

const keywordSuggestions = [
  "Softwareentwickler",
  "Frontend-Entwickler",
  "Backend-Entwickler",
  "Full-Stack-Entwickler",
  "DevOps Engineer",
  "Data Analyst",
  "Data Engineer",
  "IT-Systemadministrator",
  "Pflegefachkraft",
  "Krankenpfleger",
  "Gesundheits- und Krankenpfleger",
  "Altenpfleger",
  "Kinderkrankenpfleger",
  "Pflegehelfer",
  "MFA",
  "Medizinischer Fachangestellter",
  "Hebamme",
  "Physiotherapeut",
  "Ergotherapeut",
  "Logopäde",
  "Radiologieassistent",
  "Notfallsanitäter",
  "Rettungssanitäter",
  "Apotheker",
  "Elektriker",
  "Mechatroniker",
  "Industriemechaniker",
  "Zerspanungsmechaniker",
  "Maschinenbauingenieur",
  "Produktionsmitarbeiter",
  "Schlosser",
  "CNC-Fachkraft",
  "Qualitätsmanager",
  "Servicetechniker",
  "Anlagenmechaniker",
  "Kfz-Mechatroniker",
  "Buchhalter",
  "Steuerfachangestellter",
  "Controller",
  "Finanzbuchhalter",
  "Sachbearbeiter",
  "Personalreferent",
  "Recruiter",
  "HR-Manager",
  "Vertriebsmitarbeiter",
  "Projektmanager",
  "Projektleiter",
  "Account Manager",
  "Key Account Manager",
  "Einkäufer",
  "Marketing Manager",
  "Customer Success Manager",
  "Fachinformatiker",
  "Bauleiter",
  "Architekt",
  "Tischler",
  "Maler und Lackierer",
  "Dachdecker",
  "Maurer",
  "Bauingenieur",
  "Lagerarbeiter",
  "Fachkraft für Lagerlogistik",
  "Kommissionierer",
  "Staplerfahrer",
  "Berufskraftfahrer",
  "Disponent",
  "Koch",
  "Restaurantfachmann",
  "Verkäufer",
  "Filialleiter",
];

const fallbackLocalities = [
  { name: "Berlin", state: "Berlin" },
  { name: "Hamburg", state: "Hamburg" },
  { name: "München", state: "Bayern" },
  { name: "Köln", state: "Nordrhein-Westfalen" },
  { name: "Frankfurt am Main", state: "Hessen" },
  { name: "Stuttgart", state: "Baden-Württemberg" },
  { name: "Düsseldorf", state: "Nordrhein-Westfalen" },
  { name: "Dortmund", state: "Nordrhein-Westfalen" },
  { name: "Essen", state: "Nordrhein-Westfalen" },
  { name: "Leipzig", state: "Sachsen" },
  { name: "Bremen", state: "Bremen" },
  { name: "Dresden", state: "Sachsen" },
  { name: "Hannover", state: "Niedersachsen" },
  { name: "Nürnberg", state: "Bayern" },
  { name: "Duisburg", state: "Nordrhein-Westfalen" },
  { name: "Bochum", state: "Nordrhein-Westfalen" },
  { name: "Wuppertal", state: "Nordrhein-Westfalen" },
  { name: "Bielefeld", state: "Nordrhein-Westfalen" },
  { name: "Bonn", state: "Nordrhein-Westfalen" },
  { name: "Mannheim", state: "Baden-Württemberg" },
  { name: "Karlsruhe", state: "Baden-Württemberg" },
  { name: "Wiesbaden", state: "Hessen" },
  { name: "Münster", state: "Nordrhein-Westfalen" },
  { name: "Augsburg", state: "Bayern" },
  { name: "Gelsenkirchen", state: "Nordrhein-Westfalen" },
  { name: "Aachen", state: "Nordrhein-Westfalen" },
  { name: "Braunschweig", state: "Niedersachsen" },
  { name: "Kiel", state: "Schleswig-Holstein" },
  { name: "Magdeburg", state: "Sachsen-Anhalt" },
  { name: "Freiburg im Breisgau", state: "Baden-Württemberg" },
];

const locationSuggestionCache = new Map();
const localityCollator = new Intl.Collator("de-DE");

function normalizeLocalityText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const clientLocalitySuggestions = fallbackLocalities
  .map((entry) => ({
    value: entry.name,
    label: entry.state && entry.state !== entry.name ? `${entry.name}, ${entry.state}` : entry.name,
    state: entry.state,
    normalized: normalizeLocalityText(`${entry.name} ${entry.state || ""}`),
  }))
  .sort((left, right) => localityCollator.compare(left.label, right.label));

export function getClientLocationSuggestions(query: string, limit = 40) {
  const normalizedQuery = normalizeLocalityText(query);
  const items = !normalizedQuery
    ? clientLocalitySuggestions
    : clientLocalitySuggestions.filter((entry) => entry.normalized.includes(normalizedQuery));

  return items.slice(0, limit).map(({ value, label, state }) => ({
    value,
    label,
    state,
  }));
}

async function requestJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(data?.detail || data || `Anfrage fehlgeschlagen mit Status ${response.status}`);
  }
  return data;
}

async function requestLocationSuggestions(query: string, limit = 10) {
  const cacheKey = `${query.trim().toLocaleLowerCase("de-DE")}:${limit}`;
  if (locationSuggestionCache.has(cacheKey)) return locationSuggestionCache.get(cacheKey);

  const params = new URLSearchParams({
    query,
    limit: String(limit),
  });
  const data = await requestJson(`/api/locations/autocomplete?${params.toString()}`);
  const items = Array.isArray(data?.items) && data.items.length ? data.items : getClientLocationSuggestions(query, limit);
  locationSuggestionCache.set(cacheKey, items);
  return items;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function getVisibleSuggestions(query: string, suggestions: string[], showAll: boolean) {
  if (showAll) return suggestions;
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  if (!normalizedQuery) return suggestions;
  return suggestions.filter((suggestion) => suggestion.toLocaleLowerCase("de-DE").includes(normalizedQuery));
}

function extractSalaryValue(job: any) {
  const values = String(job.salary || "")
    .match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/g)
    ?.map((entry) => Number(entry.replaceAll(".", "").replace(",", ".")))
    .filter((entry) => Number.isFinite(entry));
  if (!values?.length) return 0;
  return Math.max(...values);
}

function sortJobs(jobs: any[], sortBy: string) {
  const copy = [...jobs];
  copy.sort((left, right) => {
    if (sortBy === "salary") return extractSalaryValue(right) - extractSalaryValue(left);
    if (sortBy === "title") return left.title.localeCompare(right.title, "de");
    if (sortBy === "employer") return left.employer.localeCompare(right.employer, "de");
    return 0;
  });
  return copy;
}

export function buildSalaryBuckets(jobs: any[]) {
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

function getCityMarketSignal(count: number) {
  if (count >= 8) return "Marche tres actif";
  if (count >= 4) return "Flux regulier";
  return "Selection ciblee";
}

function mergePayload(currentPayload: any, nextPayload: any) {
  const currentItems = extractJobItems(currentPayload);
  const nextItems = extractJobItems(nextPayload);
  return {
    ...nextPayload,
    ergebnisliste: [...currentItems, ...nextItems],
  };
}

function formatLastUpdated(value: number | null) {
  if (!value) return "Noch keine Suche";
  const diffMs = Date.now() - value;
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes <= 1) return "Gerade eben aktualisiert";
  if (minutes < 60) return `Vor ${minutes} Minuten aktualisiert`;
  const hours = Math.round(minutes / 60);
  return `Vor ${hours} Stunde${hours === 1 ? "" : "n"} aktualisiert`;
}

interface UseSearchParams {
  favorites: Record<string, any>;
  updateFavoriteField: (reference: string, updates: any) => void;
  agency: any;
  platformInsights: any;
  pushToast: (type: string, message: string, persist?: boolean) => string;
  appendConsole: (message: string) => void;
  setIsConsoleOpen: (open: boolean) => void;
}

export function useSearch({
  favorites,
  updateFavoriteField,
  agency,
  platformInsights,
  pushToast,
  appendConsole,
  setIsConsoleOpen,
}: UseSearchParams) {
  const [keyword, setKeyword] = useState("Softwareentwickler");
  const [location, setLocation] = useState("Berlin");
  const [openSuggest, setOpenSuggest] = useState<string | null>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(true);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [exactLocation, setExactLocation] = useState(true);
  const [payload, setPayload] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchAt, setLastSearchAt] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [salaryBucket, setSalaryBucket] = useState("all");
  const [selectedMapCity, setSelectedMapCity] = useState("");

  const locationFetchVersion = useRef(0);

  const rawJobs = useMemo(() => extractJobItems(payload).map((job) => normalizeJob(job, { capitalized: false })), [payload]);

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

  const cityGuide = useMemo(() => {
    const grouped = new Map();
    for (const job of jobsWithClientFilters) {
      const cityName = extractPrimaryCity(job.location);
      const cityKey = normalizeCityKey(cityName);
      if (!cityKey) continue;
      const current = grouped.get(cityKey) || {
        cityKey,
        cityName,
        jobs: [],
      };
      current.jobs.push(job);
      grouped.set(cityKey, current);
    }

    return [...grouped.values()]
      .map((entry) => ({
        ...entry,
        count: entry.jobs.length,
        note: (CITY_MARKET_NOTES as Record<string, string>)[entry.cityKey] || "Opportunites transverses et vivier local",
        signal: getCityMarketSignal(entry.jobs.length),
      }))
      .sort((left, right) => right.count - left.count || left.cityName.localeCompare(right.cityName, "de-DE"));
  }, [jobsWithClientFilters]);

  useEffect(() => {
    if (!cityGuide.length) {
      if (selectedMapCity !== ALL_MAP_CITIES) setSelectedMapCity(ALL_MAP_CITIES);
      return;
    }

    const hasSelection = cityGuide.some((entry) => entry.cityName === selectedMapCity);
    if (!selectedMapCity || (!hasSelection && selectedMapCity !== ALL_MAP_CITIES)) {
      setSelectedMapCity(ALL_MAP_CITIES);
    }
  }, [cityGuide, selectedMapCity]);

  const selectedCityGuide = useMemo(
    () => cityGuide.find((entry) => entry.cityName === selectedMapCity) || null,
    [cityGuide, selectedMapCity],
  );

  const mapJobs = selectedCityGuide?.jobs?.length ? selectedCityGuide.jobs : jobsWithClientFilters;

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
                name: "Bundesagentur für Arbeit",
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

  useEffect(() => {
    if (openSuggest !== "location") return undefined;

    const requestId = locationFetchVersion.current + 1;
    locationFetchVersion.current = requestId;
    setLoadingLocationSuggestions(true);

    const timer = window.setTimeout(() => {
      requestLocationSuggestions(showAllSuggestions ? "" : location, showAllSuggestions ? 120 : 40)
        .then((items) => {
          if (locationFetchVersion.current !== requestId) return;
          setLocationSuggestions(items);
        })
        .catch(() => {
          if (locationFetchVersion.current !== requestId) return;
          setLocationSuggestions(getClientLocationSuggestions(showAllSuggestions ? "" : location, showAllSuggestions ? 120 : 40));
        })
        .finally(() => {
          if (locationFetchVersion.current === requestId) setLoadingLocationSuggestions(false);
        });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [location, openSuggest, showAllSuggestions]);

  async function simulateConsoleBeforeFetch(pageNumber = 1) {
    setIsConsoleOpen(true);
    appendConsole("Verbindung zur Bundesagentur für Arbeit wird aufgebaut...");
    await sleep(220);
    appendConsole(`Recherche für Suchprofil "${keyword || "alle"}" und Standort "${location || "Deutschland"}" vorbereitet...`);
    await sleep(180);
    appendConsole(`Trefferseite ${pageNumber} wird geladen...`);
    await sleep(180);
    appendConsole("Vergütung, Arbeitgeber und Standortdaten werden aufbereitet...");
  }

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setHasSearched(true);
    setPage(1);
    pushToast("loading", "Recherche wird gestartet...", true);
    await simulateConsoleBeforeFetch(1);
    try {
      const params = new URLSearchParams({ keyword, location, page: "1", size: "25", exactLocation: String(exactLocation) });
      const shareParams = new URLSearchParams({ keyword, location, exactLocation: String(exactLocation) });
      window.history.replaceState(null, "", `?${shareParams.toString()}`);
      const result = await requestJson(`/api/jobs/search?${params.toString()}`);
      const normalized = extractJobItems(result).map((job) => normalizeJob(job, { capitalized: false }));
      setPayload(result);
      setLastSearchAt(Date.now());
      normalized.forEach((job) => {
        if (job.reference && favorites[job.reference]) {
          updateFavoriteField(job.reference, { job });
        }
      });
      appendConsole(`${normalized.length} Stellenanzeigen erfolgreich geladen.`);
      trackEvent("search_completed", {
        keyword,
        location,
        exactLocation,
        resultCount: normalized.length,
      });
      pushToast("success", normalized.length ? `${normalized.length} relevante Stellenanzeigen geladen` : "Keine passenden Stellenanzeigen gefunden");
    } catch (err: any) {
      setPayload(null);
      const message = err.message || "Suche fehlgeschlagen";
      setError(message);
      appendConsole(`Fehler: ${message}`);
      pushToast("error", `Recherchefehler: ${message}`);
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
      const nextCount = extractJobItems(result).length;
      setPayload((current: any) => mergePayload(current, result));
      setPage(nextPage);
      setLastSearchAt(Date.now());
      appendConsole(`${nextCount} weitere Treffer wurden ergänzt.`);
      pushToast("success", nextCount ? `${nextCount} weitere Treffer geladen` : "Keine weiteren Treffer gefunden");
    } catch (err: any) {
      const message = err.message || "Suche fehlgeschlagen";
      setError(message);
      appendConsole(`Fehler: ${message}`);
      pushToast("error", `Recherchefehler: ${message}`);
    } finally {
      setLoadingMore(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
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
          ? `CSV-Export heruntergeladen. Ihr Agentur-Zugang enthält bis zu ${exportLimit} Treffer pro Export.`
          : `Starter-Export heruntergeladen. Ohne Agentur-Zugang sind bis zu ${exportLimit} Treffer enthalten.`,
      );
      trackEvent("csv_export_completed", { keyword, location, exactLocation });
    } catch (err: any) {
      setError(err.message || "CSV-Export fehlgeschlagen");
      trackEvent("csv_export_failed", { keyword, location, exactLocation });
    } finally {
      setExporting(false);
    }
  }

  function applyQuickSearch(nextKeyword: string, nextLocation: string) {
    setKeyword(nextKeyword);
    setLocation(nextLocation);
    setExactLocation(true);
    setOpenSuggest(null);
    setShowAllSuggestions(true);
  }

  function runQuickSearch(nextKeyword: string, nextLocation: string) {
    applyQuickSearch(nextKeyword, nextLocation);
    window.setTimeout(() => {
      document.querySelector(".search-panel-prominent")?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }, 0);
  }

  const trustItems = useMemo(
    () => [
      { label: "Datenbasis", value: "Bundesagentur für Arbeit" },
      { label: "Recherchestatus", value: hasSearched ? `${totalResults || rawJobs.length} Treffer verfügbar` : "Bereit für die erste Suche" },
      { label: "Letzte Aktualisierung", value: hasSearched ? formatLastUpdated(lastSearchAt) : platformInsights?.lastActivityLabel || "Noch keine Aktivität" },
      { label: "Workflow", value: "Filter, Export, Alerts, Tracker" },
      { label: "Treffer diese Woche", value: `${platformInsights?.searchHitsWeek || 0} Datensätze erfasst` },
    ],
    [hasSearched, rawJobs.length, lastSearchAt, totalResults, platformInsights?.lastActivityLabel, platformInsights?.searchHitsWeek],
  );

  const liveSearchStatus = useMemo(() => {
    if (loading) {
      return {
        badge: "Aktiv",
        title: "Recherchestatus",
        summary: "Die Suche läuft. Aktuelle BA-Stellenanzeigen werden geladen.",
        meta: "Live-Aktualisierung aktiv",
      };
    }

    if (error) {
      return {
        badge: "Störung",
        title: "Recherchestatus",
        summary: "Die letzte Recherche konnte nicht vollständig geladen werden.",
        meta: "Bitte erneut ausführen",
      };
    }

    if (hasSearched) {
      const resultCount = jobsWithClientFilters.length || rawJobs.length;
      return {
        badge: "Abgeschlossen",
        title: "Recherchestatus",
        summary: `${resultCount} passende Stellenanzeigen gefunden.`,
        meta: `Zuletzt aktualisiert: ${formatLastUpdated(lastSearchAt)}`,
      };
    }

    return {
      badge: "Bereit",
      title: "Recherchestatus",
      summary: "Starten Sie eine Suche, um passende BA-Stellenanzeigen direkt auszuwerten.",
      meta: "Bereit für die nächste Recherche",
    };
  }, [loading, error, hasSearched, jobsWithClientFilters.length, rawJobs.length, lastSearchAt]);

  return {
    keyword,
    setKeyword,
    location,
    setLocation,
    openSuggest,
    setOpenSuggest,
    showAllSuggestions,
    setShowAllSuggestions,
    locationSuggestions,
    exactLocation,
    setExactLocation,
    payload,
    setPayload,
    page,
    setPage,
    loading,
    loadingMore,
    exporting,
    error,
    setError,
    hasSearched,
    setHasSearched,
    lastSearchAt,
    setLastSearchAt,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    salaryBucket,
    setSalaryBucket,
    selectedMapCity,
    setSelectedMapCity,
    rawJobs,
    jobsWithClientFilters,
    cityGuide,
    selectedCityGuide,
    mapJobs,
    jobPostingJsonLd,
    totalResults,
    canLoadMore,
    visibleKeywordSuggestions,
    loadingLocationSuggestions,
    handleSearch,
    handleLoadMore,
    handleExport,
    applyQuickSearch,
    runQuickSearch,
    trustItems,
    liveSearchStatus,
  };
}
