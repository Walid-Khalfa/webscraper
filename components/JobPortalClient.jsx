"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { trackEvent } from "./analytics";
import ClientErrorBoundary from "./ClientErrorBoundary";
import { pricingPlans, recruitingBenefits, recruitingUseCases } from "../lib/site-config";
import { CITY_MARKET_NOTES, extractPrimaryCity, normalizeCityKey } from "../lib/german-city-map";

const Dashboard = dynamic(() => import("./Dashboard"));
const KanbanBoard = dynamic(() => import("./KanbanBoard"), {
  loading: () => null,
});
const JobMap = dynamic(() => import("./JobMap"), {
  ssr: false,
  loading: () => <div style={{ height: "400px", width: "100%", background: "#f0f0f0", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>Karte wird geladen...</div>,
});
const AlertManager = dynamic(() => import("./AlertManager"), {
  loading: () => null,
});
const EmailDigestPreview = dynamic(() => import("./EmailDigestPreview"), {
  loading: () => null,
});

const preferredListKeys = ["ergebnisliste", "stellenangebote", "angebote", "jobs", "items", "results", "content", "data"];
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
const quickSearches = [
  { keyword: "Softwareentwickler", location: "Berlin" },
  { keyword: "Pflegefachkraft", location: "Hamburg" },
  { keyword: "Elektriker", location: "Köln" },
  { keyword: "Projektmanager", location: "Frankfurt am Main" },
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
const statusCycle = ["interested", "applied", "interview", "closed"];
const statusLabels = {
  interested: "Interessiert",
  applied: "Beworben",
  interview: "Interview",
  closed: "Abgelehnt / Angebot",
};
const viewModes = [
  { id: "grid", label: "Gitter", icon: LayoutGrid },
  { id: "list", label: "Liste", icon: List },
  { id: "map", label: "Karte", icon: MapIcon },
  { id: "kanban", label: "Job-Tracker", icon: Columns3 },
];
const defaultEmailTemplate = {
  subject: "",
  agencyName: "",
  greeting: "Guten Morgen",
  intro: "hier sind Ihre neuesten relevanten Stellenangebote für heute.",
  showSalary: true,
  showLocation: true,
  showApplyLink: true,
};
const ALL_MAP_CITIES = "__all_map_cities__";

const locationSuggestionCache = new Map();
const localityCollator = new Intl.Collator("de-DE");

function normalizeLocalityText(value) {
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

function getClientLocationSuggestions(query, limit = 40) {
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

async function requestLocationSuggestions(query, limit = 10) {
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
  return "Keine Vergütung angegeben";
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
  if (normalized === "daily") return "Täglich";
  if (normalized === "weekly") return "Wöchentlich";
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

function getCityMarketSignal(count) {
  if (count >= 8) return "Marche tres actif";
  if (count >= 4) return "Flux regulier";
  return "Selection ciblee";
}

export default function Home({ initialShowcase, platformInsights }) {
  const [keyword, setKeyword] = useState("Softwareentwickler");
  const [location, setLocation] = useState("Berlin");
  const [openSuggest, setOpenSuggest] = useState(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(true);
  const [agentSuggest, setAgentSuggest] = useState(null);
  const [showAllAgentSuggestions, setShowAllAgentSuggestions] = useState(true);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [agentLocationSuggestions, setAgentLocationSuggestions] = useState([]);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [loadingAgentLocationSuggestions, setLoadingAgentLocationSuggestions] = useState(false);
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
  const [authMode, setAuthMode] = useState("register");
  const [loginKey, setLoginKey] = useState("");
  const [alertForm, setAlertForm] = useState({ keyword: "", location: "", frequency: "daily", max_results: 25 });
  const [subscriptions, setSubscriptions] = useState([]);
  const [workspaceOverview, setWorkspaceOverview] = useState(null);
  const [connectingCrm, setConnectingCrm] = useState(null);
  const [crmApiKey, setCrmApiKey] = useState("");
  const [crmActionLoading, setCrmActionLoading] = useState(false);
  const [syncingCrmCandidate, setSyncingCrmCandidate] = useState({});
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("RECRUITER");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [saasStatus, setSaasStatus] = useState("");
  const [saasLoading, setSaasLoading] = useState(false);
  const [verificationSending, setVerificationSending] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [favorites, setFavorites] = useState({});
  const [activeFavoriteRef, setActiveFavoriteRef] = useState(null);
  const [draggingRef, setDraggingRef] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [salaryBucket, setSalaryBucket] = useState("all");
  const [emailTemplateOpts, setEmailTemplateOpts] = useState(defaultEmailTemplate);
  const [simulatingEmail, setSimulatingEmail] = useState(false);
  const locationFetchVersion = useRef(0);
  const agentLocationFetchVersion = useRef(0);

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
        note: CITY_MARKET_NOTES[entry.cityKey] || "Opportunites transverses et vivier local",
        signal: getCityMarketSignal(entry.jobs.length),
      }))
      .sort((left, right) => right.count - left.count || left.cityName.localeCompare(right.cityName, "de-DE"));
  }, [jobsWithClientFilters]);
  const [selectedMapCity, setSelectedMapCity] = useState("");

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
  const visibleLocationSuggestions = locationSuggestions;
  const visibleAgentKeywordSuggestions = useMemo(
    () => getVisibleSuggestions(alertForm.keyword, keywordSuggestions, agentSuggest === "keyword" && showAllAgentSuggestions),
    [alertForm.keyword, agentSuggest, showAllAgentSuggestions],
  );
  const visibleAgentLocationSuggestions = agentLocationSuggestions;
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
      { label: "Datenquelle", value: "Bundesagentur für Arbeit" },
      { label: "Suchstatus", value: hasSearched ? `${totalResults || rawJobs.length} Treffer verfügbar` : "Bereit für Ihre Recherche" },
      { label: "Aktualisierung", value: hasSearched ? formatLastUpdated(lastSearchAt) : platformInsights?.lastActivityLabel || "Noch keine Aktivität" },
      { label: "Recruiting-Tools", value: "CSV-Export, Job-Tracker, Job-Alarme" },
      { label: "Synchronisierte Treffer diese Woche", value: `${platformInsights?.searchHitsWeek || 0} Treffer erfasst` },
    ],
    [hasSearched, rawJobs.length, lastSearchAt, totalResults, platformInsights?.lastActivityLabel, platformInsights?.searchHitsWeek],
  );
  const liveSearchStatus = useMemo(() => {
    if (loading) {
      return {
        badge: "Aktiv",
        title: "Suchstatus",
        summary: "Die Suche läuft. Aktuelle BA-Stellenangebote werden gerade geladen.",
        meta: "Live-Aktualisierung läuft",
      };
    }

    if (error) {
      return {
        badge: "Störung",
        title: "Suchstatus",
        summary: "Die letzte Suche konnte nicht vollständig geladen werden.",
        meta: "Bitte erneut versuchen",
      };
    }

    if (hasSearched) {
      const resultCount = jobsWithClientFilters.length || rawJobs.length;
      return {
        badge: "Abgeschlossen",
        title: "Suchstatus",
        summary: `${resultCount} passende Stellenangebote gefunden.`,
        meta: `Zuletzt aktualisiert: ${formatLastUpdated(lastSearchAt)}`,
      };
    }

    return {
      badge: "Bereit",
      title: "Suchstatus",
      summary: "Starten Sie eine Suche, um passende Stellenangebote direkt anzuzeigen.",
      meta: "Bereit für die nächste Suche",
    };
  }, [loading, error, hasSearched, jobsWithClientFilters.length, rawJobs.length]);
  const workspaceData = workspaceOverview?.workspace || null;
  const workspaceMembers = workspaceData?.members || [];
  const workspaceSearchHistory = workspaceData?.search_history || [];
  const workspaceDossiers = workspaceData?.candidate_dossiers || [];
  const workspaceIntegrations = workspaceData?.crm_integrations || [];
  const workspaceBilling = workspaceData?.billing_account || null;
  const workspaceTrust = workspaceData?.trust || null;
  const workspaceReporting = workspaceData?.reporting || null;
  const commercialInsights = useMemo(
    () => [
      ...recruitingBenefits,
      {
        label: "Job-Alarm",
        value: platformInsights?.activeAlerts ? `${platformInsights.activeAlerts} aktiv` : "Sofort einrichtbar",
        description: "Wiederkehrende Recherchen lassen sich per E-Mail automatisch überwachen.",
      },
      {
        label: "Standortfilter",
        value: "Exakt oder regional",
        description: "Ergebnisse können streng nach Ort oder breiter für Marktbeobachtung bewertet werden.",
      },
      {
        label: "CSV-Export",
        value: "Bis zu 200 Treffer",
        description: "Trefferlisten lassen sich für Outreach, Shortlists und internes Reporting exportieren.",
      },
    ],
    [platformInsights?.activeAlerts],
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

  function buildDossierPayload(entry) {
    if (!entry?.job?.reference) return null;
    return {
      reference: entry.job.reference,
      title: entry.job.title || "Unbenannte Stelle",
      employer: entry.job.employer || "Arbeitgeber nicht genannt",
      location: entry.job.location || "Standort nicht genannt",
      status: entry.status || "interested",
      notes: entry.notes || "",
      tags: Array.isArray(entry.tags) ? entry.tags : [],
    };
  }

  function mergeFavoritesFromDossiers(dossiers) {
    if (!Array.isArray(dossiers) || !dossiers.length) return;
    const next = { ...favorites };
    dossiers.forEach((dossier) => {
      const current = next[dossier.reference];
      next[dossier.reference] = {
        ...current,
        status: dossier.status || current?.status || "interested",
        notes: dossier.notes || current?.notes || "",
        tags: Array.isArray(dossier.tags) ? dossier.tags : current?.tags || [],
        job:
          current?.job ||
          {
            reference: dossier.reference,
            title: dossier.title,
            employer: dossier.employer,
            location: dossier.location,
            occupation: "",
            salary: "",
            url: dossier.reference ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${dossier.reference}` : "",
          },
      };
    });
    saveFavorites(next);
  }

  function updateWorkspaceDossier(snapshot) {
    if (!snapshot) return;
    setWorkspaceOverview((current) => {
      if (!current?.workspace) return current;
      const currentDossiers = Array.isArray(current.workspace.candidate_dossiers) ? current.workspace.candidate_dossiers : [];
      const nextDossiers = [snapshot, ...currentDossiers.filter((entry) => entry.reference !== snapshot.reference)].slice(0, 12);
      return {
        ...current,
        workspace: {
          ...current.workspace,
          candidate_dossiers: nextDossiers,
          reporting: {
            ...current.workspace.reporting,
            shared_dossiers: nextDossiers.length,
          },
        },
      };
    });
  }

  function removeWorkspaceDossier(reference) {
    if (!reference) return;
    setWorkspaceOverview((current) => {
      if (!current?.workspace) return current;
      const nextDossiers = (current.workspace.candidate_dossiers || []).filter((entry) => entry.reference !== reference);
      return {
        ...current,
        workspace: {
          ...current.workspace,
          candidate_dossiers: nextDossiers,
          reporting: {
            ...current.workspace.reporting,
            shared_dossiers: nextDossiers.length,
          },
        },
      };
    });
  }

  async function persistFavoriteEntry(entry) {
    const payload = buildDossierPayload(entry);
    if (!agency?.api_key || !payload) return;

    try {
      const saved = await requestJson("/api/agencies/dossiers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agency-Key": agency.api_key,
        },
        body: JSON.stringify(payload),
      });
      updateWorkspaceDossier(saved);
    } catch {}
  }

  async function deleteFavoriteFromWorkspace(reference) {
    if (!agency?.api_key || !reference) return;
    try {
      await requestJson(`/api/agencies/dossiers/${encodeURIComponent(reference)}`, {
        method: "DELETE",
        headers: {
          "X-Agency-Key": agency.api_key,
        },
      });
      removeWorkspaceDossier(reference);
    } catch {}
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
    void persistFavoriteEntry(next);
    return next;
  }

  function toggleFavorite(job) {
    if (!job?.reference) return;
    if (favorites[job.reference]) {
      const next = { ...favorites };
      delete next[job.reference];
      saveFavorites(next);
      void deleteFavoriteFromWorkspace(job.reference);
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
    const next = { ...favorites, [reference]: { ...current, status: nextStatus } };
    saveFavorites(next);
    void persistFavoriteEntry(next[reference]);
    pushToast("success", `Status auf ${statusLabels[nextStatus]} gesetzt.`);
  }

  function updateFavoriteField(reference, updates) {
    const current = favorites[reference];
    if (!current) return;
    const next = { ...favorites, [reference]: { ...current, ...updates } };
    saveFavorites(next);
    void persistFavoriteEntry(next[reference]);
  }

  function moveFavoriteToStatus(reference, status) {
    const current = favorites[reference];
    if (!current) return;
    const next = { ...favorites, [reference]: { ...current, status } };
    saveFavorites(next);
    void persistFavoriteEntry(next[reference]);
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
    const storedView = localStorage.getItem("jobViewMode");
    const storedEmailTemplate = localStorage.getItem("emailTemplateOpts");

    if (storedAgency) {
      setAgency(JSON.parse(storedAgency));
      setAgentOpen(true);
    }
    if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
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
    if (!agency?.api_key) return;
    requestJson("/api/agencies/me", { headers: { "X-Agency-Key": agency.api_key } })
      .then((freshAgency) => {
        setAgency(freshAgency);
        localStorage.setItem("agencyProfile", JSON.stringify(freshAgency));
      })
      .catch(() => {});
  }, [agency?.api_key]);

  useEffect(() => {
    if (!agency?.api_key) {
      setWorkspaceOverview(null);
      return;
    }
    void loadWorkspace(agency.api_key);
  }, [agency?.api_key]);

  useEffect(() => {
    localStorage.setItem("jobViewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("emailTemplateOpts", JSON.stringify(emailTemplateOpts));
  }, [emailTemplateOpts]);

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

  useEffect(() => {
    if (agentSuggest !== "location") return undefined;

    const requestId = agentLocationFetchVersion.current + 1;
    agentLocationFetchVersion.current = requestId;
    setLoadingAgentLocationSuggestions(true);

    const timer = window.setTimeout(() => {
      requestLocationSuggestions(showAllAgentSuggestions ? "" : alertForm.location, showAllAgentSuggestions ? 120 : 40)
        .then((items) => {
          if (agentLocationFetchVersion.current !== requestId) return;
          setAgentLocationSuggestions(items);
        })
        .catch(() => {
          if (agentLocationFetchVersion.current !== requestId) return;
          setAgentLocationSuggestions(getClientLocationSuggestions(showAllAgentSuggestions ? "" : alertForm.location, showAllAgentSuggestions ? 120 : 40));
        })
        .finally(() => {
          if (agentLocationFetchVersion.current === requestId) setLoadingAgentLocationSuggestions(false);
        });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [alertForm.location, agentSuggest, showAllAgentSuggestions]);

  useEffect(() => {
    if (!agency?.api_key) return;
    requestJson("/api/alerts/subscriptions", { headers: { "X-Agency-Key": agency.api_key } })
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]));
  }, [agency?.api_key]);

  useEffect(() => {
    if (loading) {
      setIsConsoleOpen(false);
      return;
    }

    if (hasSearched && !error) {
      setIsConsoleOpen(false);
    }
  }, [loading, hasSearched, error]);

  async function simulateConsoleBeforeFetch(pageNumber = 1) {
    setIsConsoleOpen(true);
    setConsoleLogs([]);
    appendConsole("Verbindung zur Bundesagentur für Arbeit wird aufgebaut...");
    await sleep(220);
    appendConsole(`Abfrage für Beruf "${keyword || "alle"}" und Ort "${location || "deutschland"}" vorbereitet...`);
    await sleep(180);
    appendConsole(`Stellenangebote Seite ${pageNumber} werden geladen...`);
    await sleep(180);
    appendConsole("Vergütungsfelder werden normalisiert und Ergebnisstruktur aufgebaut...");
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
          ? `CSV-Export heruntergeladen. Ihr Agentur-Zugang enthält bis zu ${exportLimit} Treffer pro Export.`
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
      await loadWorkspace(created.api_key);
      setEmailTemplateOpts((current) => ({ ...current, agencyName: current.agencyName || created.name }));
      setSaasStatus("Der Agentur-Zugang wurde eingerichtet. Bitte bestätigen Sie jetzt zuerst die E-Mail-Adresse, bevor Job-Alarme aktiviert werden.");
      trackEvent("agency_created", { plan: created.plan });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Agentur-Erstellung"));
    } finally {
      setSaasLoading(false);
    }
  }

  async function handleLoginAgency(event) {
    event.preventDefault();
    if (!loginKey.trim()) return;
    setSaasLoading(true);
    setSaasStatus("");
    try {
      const freshAgency = await requestJson("/api/agencies/me", {
        headers: { "X-Agency-Key": loginKey.trim() },
      });
      setAgency(freshAgency);
      localStorage.setItem("agencyProfile", JSON.stringify(freshAgency));
      await loadWorkspace(freshAgency.api_key);
      setEmailTemplateOpts((current) => ({ ...current, agencyName: current.agencyName || freshAgency.name }));
      setSaasStatus("Erfolgreich mit Agentur-Schlüssel eingeloggt!");
      trackEvent("agency_logged_in", { plan: freshAgency.plan });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Login-Fehler"));
    } finally {
      setSaasLoading(false);
    }
  }

  function handleForgetAgency() {
    localStorage.removeItem("agencyProfile");
    setAgency(null);
    setSubscriptions([]);
    setWorkspaceOverview(null);
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

  async function loadWorkspace(apiKey = agency?.api_key) {
    if (!apiKey) return;
    setWorkspaceLoading(true);
    try {
      const data = await requestJson("/api/agencies/workspace?limit=6", {
        headers: { "X-Agency-Key": apiKey },
      });
      setWorkspaceOverview(data);
      mergeFavoritesFromDossiers(data?.workspace?.candidate_dossiers || []);
    } catch {
      setWorkspaceOverview(null);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function handleConnectCrm(e) {
    e.preventDefault();
    if (!connectingCrm || !agency?.api_key) return;
    setCrmActionLoading(true);
    try {
      await requestJson("/api/agencies/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agency-Key": agency.api_key,
        },
        body: JSON.stringify({
          provider: connectingCrm.provider,
          apiKey: crmApiKey,
        }),
      });
      pushToast("success", `${connectingCrm.display_name} erfolgreich verbunden.`);
      setConnectingCrm(null);
      setCrmApiKey("");
      await loadWorkspace();
    } catch (err) {
      pushToast("error", `Verbindung fehlgeschlagen: ${err.message}`);
    } finally {
      setCrmActionLoading(false);
    }
  }

  async function handleDisconnectCrm(provider, displayName) {
    if (!agency?.api_key) return;
    if (!confirm(`Moechten Sie die Integration mit ${displayName} wirklich trennen?`)) return;
    try {
      await requestJson(`/api/agencies/integrations?provider=${provider}`, {
        method: "DELETE",
        headers: {
          "X-Agency-Key": agency.api_key,
        },
      });
      pushToast("success", `Verbindung mit ${displayName} getrennt.`);
      await loadWorkspace();
    } catch (err) {
      pushToast("error", `Trennung failed: ${err.message}`);
    }
  }

  async function handlePushToCrm(provider, reference, displayName) {
    if (!agency?.api_key) return;
    setSyncingCrmCandidate((current) => ({
      ...current,
      [`${reference}:${provider}`]: true,
    }));
    try {
      const res = await requestJson("/api/agencies/integrations/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agency-Key": agency.api_key,
        },
        body: JSON.stringify({ provider, reference }),
      });
      pushToast("success", res.message || `Candidat erfolgreich zu ${displayName} exportiert.`);
      await loadWorkspace();
    } catch (err) {
      pushToast("error", `Export failed: ${err.message}`);
    } finally {
      setSyncingCrmCandidate((current) => ({
        ...current,
        [`${reference}:${provider}`]: false,
      }));
    }
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    if (!agency?.api_key) return;
    setInviteLoading(true);
    try {
      await requestJson("/api/agencies/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agency-Key": agency.api_key,
        },
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteName,
          role: inviteRole,
        }),
      });
      pushToast("success", `Einladung an ${inviteName} erfolgreich gesendet.`);
      setShowInviteForm(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("RECRUITER");
      await loadWorkspace();
    } catch (err) {
      pushToast("error", `Einladung fehlgeschlagen: ${err.message}`);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRemoveMember(memberId, name) {
    if (!agency?.api_key) return;
    if (!confirm(`Moechten Sie das Mitglied ${name} wirklich aus der Agentur entfernen?`)) return;
    try {
      await requestJson(`/api/agencies/members?id=${memberId}`, {
        method: "DELETE",
        headers: {
          "X-Agency-Key": agency.api_key,
        },
      });
      pushToast("success", `Mitglied ${name} wurde entfernt.`);
      await loadWorkspace();
    } catch (err) {
      pushToast("error", `Entfernen failed: ${err.message}`);
    }
  }

  async function handleCreateAlert(event) {
    event.preventDefault();
    if (!agency?.api_key) {
      setSaasStatus("Richten Sie zuerst einen Agentur-Zugang ein, bevor Sie einen Job-Alarm anlegen.");
      pushToast("error", "Richten Sie zuerst einen Agentur-Zugang ein (Schritt 1).");
      trackEvent("alert_creation_failed", { reason: "missing_agency_access", keyword: alertForm.keyword, location: alertForm.location });
      return;
    }
    if (!agency?.email_verified) {
      setSaasStatus("Bitte bestätigen Sie zuerst die E-Mail-Adresse Ihrer Agentur. Erst danach können Job-Alarme aktiviert werden.");
      pushToast("error", "Bitte bestätigen Sie zuerst die E-Mail-Adresse Ihrer Agentur.");
      trackEvent("alert_creation_failed", { reason: "agency_email_not_verified", keyword: alertForm.keyword, location: alertForm.location });
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
      await loadWorkspace(agency.api_key);
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
    if (!agency?.email_verified) {
      setSaasStatus("Der manuelle Versand ist erst nach bestätigter E-Mail-Adresse verfügbar.");
      return;
    }
    setSaasLoading(true);
    setSaasStatus("");
    try {
      const result = await requestJson(`/api/alerts/subscriptions/${subscriptionId}/send-now`, {
        method: "POST",
        headers: { "X-Agency-Key": agency.api_key },
      });
      await refreshSubscriptions(agency.api_key);
      await loadWorkspace(agency.api_key);
      setSaasStatus(
        result.dry_run
          ? `Die Zusammenfassung für ${result.recipient} wurde vorbereitet. Hinterlegen Sie einen Mail-Dienst, um reale Zustellungen zu aktivieren.`
          : `Die Zusammenfassung mit ${result.job_count} Treffern wurde an ${result.recipient} gesendet.`,
      );
      trackEvent("agency_alert_send_now", { subscriptionId, jobCount: result.job_count || 0, dryRun: Boolean(result.dry_run) });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Versand des Job-Alarms"));
    } finally {
      setSaasLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!agency?.api_key || agency?.email_verified) return;
    setVerificationSending(true);
    try {
      const result = await requestJson("/api/agencies/resend-verification", {
        method: "POST",
        headers: { "X-Agency-Key": agency.api_key },
      });
      setSaasStatus(result.message || "Die Verifizierungs-E-Mail wurde erneut versendet.");
      pushToast("success", result.message || "Die Verifizierungs-E-Mail wurde erneut versendet.");
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Versand der Verifizierungs-E-Mail"));
    } finally {
      setVerificationSending(false);
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
      await loadWorkspace(agency.api_key);
      setSaasStatus("Der Job-Alarm wurde entfernt.");
      trackEvent("agency_alert_deleted", { subscriptionId });
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Löschen des Job-Alarms"));
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
      <svg viewBox="0 0 360 180" className="chart-svg" role="img" aria-label="Vergütungsverteilung">
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
    <main className="app-shell" id="top">
      {jobPostingJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }} /> : null}
      <ToastStack toasts={toasts} />

      {activeFavorite ? (
        <aside className="favorite-drawer" aria-label="Favoriten und Notizen">
          <div className="favorite-drawer-header">
            <div>
              <p className="eyebrow">Favorit bearbeiten</p>
              <h3>{activeFavorite.job?.title || activeFavoriteRef}</h3>
            </div>
            <button className="icon-button" type="button" onClick={() => setActiveFavoriteRef(null)} aria-label="Seitenpanel schließen">
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

          {workspaceIntegrations.some((integration) => integration.status === "CONNECTED") ? (
            <div style={{ marginTop: "24px", borderTop: "2px solid #1f1d1a", paddingTop: "18px" }}>
              <p className="eyebrow" style={{ marginBottom: "8px" }}>ATS / CRM Synchronisation</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {workspaceIntegrations
                  .filter((integration) => integration.status === "CONNECTED")
                  .map((integration) => {
                    const key = `${activeFavoriteRef}:${integration.provider}`;
                    const isSyncing = syncingCrmCandidate[key];
                    return (
                      <button
                        key={integration.id}
                        type="button"
                        className="button"
                        disabled={isSyncing}
                        onClick={() => handlePushToCrm(integration.provider, activeFavoriteRef, integration.display_name)}
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
          title="Die Topbar konnte nicht geladen werden."
          description="Die Hauptnavigation ist temporär nicht verfügbar."
        >
          <ProductTopbar
            onToggleWorkspace={() => {
              setAgentOpen(true);
              trackEvent("agent_configurator_opened");
            }}
          />
        </ClientErrorBoundary>

        <header className="masthead hero-layout" style={{ marginBottom: "12px" }}>
          <div className="hero-primary" style={{ gap: "4px" }}>
            <p className="eyebrow">Jobsuche für Recruiting-Agenturen</p>
            <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", lineHeight: "1.15" }}>
              Relevante Stellenangebote für Ihr Recruiting
            </h1>
            <p className="hero-copy" style={{ margin: "4px 0 0", fontSize: "15px" }}>
              Durchsuchen Sie aktuelle BA-Stellenangebote, speichern Sie relevante Treffer und exportieren Sie Shortlists für Kundenmandate, Marktbeobachtung und Active Sourcing.
            </p>
          </div>
          <div className="hero-proof" style={{ gap: "8px" }}>
            <div className="sync-badge" style={{ padding: "6px 10px" }}>
              <Clock size={16} aria-hidden="true" />
              Live-Daten der BA
            </div>
            <p style={{ fontSize: "13px", margin: 0 }}>
              Für Recruiting-Teams, Personalberater und HR-Dienstleister entwickelt.
              <br />
              Klare Suche, exportierbare Ergebnisse und strukturierte Job-Alarme.
            </p>
          </div>
        </header>

        <ClientErrorBoundary
          compact
          title="Die Suchoberflaeche konnte nicht geladen werden."
          description="Bitte laden Sie nur diesen Bereich neu, um die Suche fortzusetzen."
        >
          <SearchPanel
            form={(
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
                    role="combobox"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    aria-expanded={openSuggest === "keyword"}
                    aria-controls="keyword-suggestion-list"
                  />
                  <button className="suggest-toggle" type="button" aria-label="Berufsvorschläge anzeigen" aria-expanded={openSuggest === "keyword"} onMouseDown={(event) => event.preventDefault()} onClick={() => {
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
                    role="combobox"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    aria-expanded={openSuggest === "location"}
                    aria-controls="location-suggestion-list"
                  />
                  <button className="suggest-toggle" type="button" aria-label="Standortvorschläge anzeigen" aria-expanded={openSuggest === "location"} onMouseDown={(event) => event.preventDefault()} onClick={() => {
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
                    {loadingLocationSuggestions ? (
                      <button className="suggest-option" type="button" disabled>
                        <LoaderCircle size={16} className="spin-icon" />
                        Orte werden geladen...
                      </button>
                    ) : visibleLocationSuggestions.length ? (
                      visibleLocationSuggestions.map((suggestion) => (
                        <button className="suggest-option suggest-option-rich" type="button" key={suggestion.label} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                          setLocation(suggestion.value);
                          setOpenSuggest(null);
                          setShowAllSuggestions(true);
                        }}>
                          <span>{suggestion.value}</span>
                          {suggestion.state && suggestion.state !== suggestion.value ? <small>{suggestion.state}</small> : null}
                        </button>
                      ))
                    ) : (
                      <button className="suggest-option" type="button" disabled>
                        Kein passender Standort gefunden
                      </button>
                    )}
                  </div>
                ) : null}
              </label>

              <label className="exact-location-toggle">
                <input type="checkbox" checked={exactLocation} onChange={(event) => setExactLocation(event.target.checked)} />
                <span className={`toggle-switch-track${exactLocation ? " active" : ""}`} aria-hidden="true">
                  <span className="toggle-switch-thumb" />
                </span>
                <span>Nur exakte Standorte</span>
              </label>
              <button className="primary-action" type="submit" disabled={loading}>
                {loading ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />}
                Stellen finden
              </button>
              </form>
            )}
            trustItems={trustItems}
            quickSearches={quickSearches}
            onQuickSearch={applyQuickSearch}
            isStatusOpen={isConsoleOpen}
            loading={loading}
            consoleLogs={consoleLogs}
            liveSearchStatus={liveSearchStatus}
            onToggleStatus={() => setIsConsoleOpen((value) => !value)}
            hasSearched={hasSearched}
          />
        </ClientErrorBoundary>

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
            <section className="results-header" id="ergebnisse" aria-live="polite">
              <div>
                <p className="eyebrow">Ergebnisse</p>
                <h2>{loading ? "Aktuelle Stellenangebote werden geladen..." : `${jobsWithClientFilters.length} Stellenangebote${totalResults ? ` von ${totalResults}` : ""}`}</h2>
              </div>
              <div className="results-actions">
                <p>{loading ? "Die offiziellen BA-Daten werden live geladen." : "Filtern, sortieren, tracken und exportieren Sie relevante Treffer direkt für Ihr Recruiting-Team."}</p>
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
                    <option value="salary">Vergütung</option>
                    <option value="title">Titel</option>
                    <option value="employer">Arbeitgeber</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="filter-note">
              Die Bundesagentur für Arbeit kann Treffer aus dem Umkreis liefern. Mit "Nur exakte Standorte" werden nur Stellenangebote für den eingegebenen Ort angezeigt und exportiert.
            </div>

            {rawJobs.length ? (
              <ClientErrorBoundary
                compact
                title="Die Recruiting-Analyse ist temporär nicht verfügbar."
                description="Die Ergebnisliste bleibt nutzbar. Laden Sie die Analytik bei Bedarf separat neu."
              >
                <Dashboard>
                  <article className="dashboard-card">
                    <div className="dashboard-card-header">
                      <div>
                        <p className="eyebrow">Vergütungsverteilung</p>
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
                </Dashboard>
              </ClientErrorBoundary>
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
              <ClientErrorBoundary
                compact
                title="Der Job-Tracker konnte nicht geladen werden."
                description="Wechseln Sie zur Gitter- oder Listenansicht, waehrend der Tracker neu initialisiert wird."
              >
                <KanbanBoard
                  columns={kanbanJobs}
                  statusLabels={statusLabels}
                  draggingRef={draggingRef}
                  onDropCard={(status) => moveFavoriteToStatus(draggingRef, status)}
                  onStartDrag={setDraggingRef}
                  onEndDrag={() => setDraggingRef(null)}
                  onToggleFavorite={toggleFavorite}
                  onOpenFavorite={setActiveFavoriteRef}
                  onCycleStatus={cycleFavoriteStatus}
                />
              </ClientErrorBoundary>
            ) : viewMode === "map" ? (
              <section className="map-explorer" aria-label="Guide des villes allemandes">
                <div className="map-explorer-shell">
                  <aside className="map-guide-panel">
                    <div className="map-guide-header">
                      <p className="eyebrow">Guide villes DE</p>
                      <h3>Reperez les marches ou il faut candidater vite</h3>
                      <p>Vue inspiree d&apos;une carte de repertoire: la carte donne la densite, le panneau vous aide a choisir la bonne ville allemande.</p>
                    </div>

                    <div className="map-guide-stats">
                      <div className="map-guide-stat">
                        <span>Villes visibles</span>
                        <strong>{cityGuide.length}</strong>
                      </div>
                      <div className="map-guide-stat">
                        <span>Offres cartographiees</span>
                        <strong>{jobsWithClientFilters.length}</strong>
                      </div>
                    </div>

                    <div className="map-city-list" role="list">
                      <button
                        type="button"
                        className={`map-city-card map-city-card-overview${selectedMapCity === ALL_MAP_CITIES ? " active" : ""}`}
                        onClick={() => setSelectedMapCity(ALL_MAP_CITIES)}
                      >
                        <span className="map-city-rank">DE</span>
                        <div className="map-city-copy">
                          <strong>Toute l&apos;Allemagne</strong>
                          <span>Vue generale pour comparer les bassins d&apos;emploi avant de cibler une ville.</span>
                        </div>
                        <span className="map-city-signal">{cityGuide.length} villes actives</span>
                      </button>
                      {cityGuide.map((entry) => (
                        <button
                          key={entry.cityKey}
                          type="button"
                          className={`map-city-card${selectedMapCity === entry.cityName ? " active" : ""}`}
                          onClick={() => setSelectedMapCity(entry.cityName)}
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
                      <h3>Trouvez les bons bassins d&apos;emploi allemands.</h3>
                      <p>Selectionnez une ville pour afficher les offres associees et prioriser vos candidatures.</p>
                    </div>

                    <div className="map-stage-overlay map-stage-overlay-right">
                      <div className="map-search-pill">
                        <Search size={18} />
                        <span>{keyword || "Recherche libre"} · {selectedMapCity === ALL_MAP_CITIES ? "Allemagne" : (selectedMapCity || location || "Allemagne")}</span>
                      </div>
                      <div className="map-stage-toggles">
                        <span className="map-stage-chip">Carte live</span>
                        <span className="map-stage-chip">{selectedCityGuide ? `${selectedCityGuide.count} offres` : `${jobsWithClientFilters.length} offres`}</span>
                      </div>
                    </div>

                    <div className="results-map-container">
                      <JobMap jobs={jobsWithClientFilters} selectedCity={selectedMapCity} onSelectCity={setSelectedMapCity} />
                    </div>

                    <div className="map-results-panel">
                      <div className="map-results-header">
                        <div>
                          <p className="eyebrow">Ville focus</p>
                          <h3>{selectedCityGuide?.cityName || "Toutes les villes"}</h3>
                          <p>{selectedCityGuide?.note || "Les offres disponibles pour votre recherche actuelle."}</p>
                        </div>
                        {selectedCityGuide ? (
                          <button className="toolbar-chip" type="button" onClick={() => setSelectedMapCity(ALL_MAP_CITIES)}>
                            Reinitialiser
                          </button>
                        ) : null}
                      </div>

                      <div className="map-results-grid">
                        {mapJobs.slice(0, 6).map((job, index) => (
                          <JobCard
                            job={job}
                            key={`${job.reference || job.title}-${index}`}
                            viewMode="list"
                            isFavorite={Boolean(favorites[job.reference])}
                            favoriteData={favorites[job.reference]}
                            onToggleFavorite={toggleFavorite}
                            onOpenFavorite={setActiveFavoriteRef}
                            onCycleStatus={cycleFavoriteStatus}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
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
            <p>Die Suche wurde erfolgreich ausgeführt, liefert mit den aktuellen Kriterien jedoch keine passenden Treffer.</p>
            <ul className="zero-actions">
              <li>Prüfen Sie die Schreibweise von Beruf und Standort.</li>
              <li>Deaktivieren Sie "Nur exakte Standorte", wenn auch angrenzende Orte relevant sind.</li>
              <li>Verwenden Sie einen allgemeineren Suchbegriff für eine breitere Recherche.</li>
            </ul>
          </div>
        ) : (
          <section className="showcase-stack" aria-live="polite">
            <div className="zero-state">
              <div className="zero-illustration" aria-hidden="true">
                <Search size={42} />
              </div>
              <h3>Aktuelle Stellenangebote</h3>
              <p>Starten Sie eine Suche nach Beruf und Standort, um relevante Stellenangebote sofort zu prüfen, zu exportieren, als Favorit zu speichern oder per Job-Alarm zu verfolgen.</p>
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
                    {(initialShowcase?.trends?.length ? initialShowcase.trends : ["Live-Daten stehen für Ihre Recruiting-Suche bereit."]).map((entry) => (
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
            <p className="eyebrow">Für Recruiting-Workflows</p>
            <h2>Für Recruiting-Teams, Personalberater und HR-Dienstleister entwickelt</h2>
            <p>Statt generischer Versprechen zeigt die Plattform konkrete Einsatzfälle für Recherche, Marktbeobachtung und exportierbare Shortlists.</p>
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
            <p className="eyebrow">Preise</p>
            <h2>Klare Pakete für Suche, Alerts und Export</h2>
            <p>Alle Pakete sind auf Recruiting-Workflows ausgerichtet. Die Agentur-Variante bleibt absichtlich individuell, wenn Teamgröße oder Integrationen abgestimmt werden müssen.</p>
          </div>
          <div className="plan-grid">
            {pricingPlans.map((plan) => (
              <article key={plan.name} className={`plan-card${plan.highlighted ? " is-highlighted" : ""}`}>
                <div>
                  {plan.highlighted ? <span className="plan-badge">Empfohlen</span> : null}
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
          title="Der Job-Alarm-Bereich ist temporär gestört."
          description="Die Suche und der CSV-Export bleiben nutzbar. Laden Sie den Alarm-Bereich separat neu."
        >
          <AlertManager
            agentOpen={agentOpen}
            onToggle={() => {
              setAgentOpen((open) => {
                const next = !open;
                if (next) trackEvent("agent_configurator_opened");
                return next;
              });
            }}
            statusBanner={saasStatus ? <div className="status-banner">{saasStatus}</div> : null}
            subscriptions={(
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
                        Löschen
                      </button>
                      <button className="secondary-action" type="button" onClick={() => handleSendNow(subscription.id)} disabled={saasLoading}>
                        <Send size={18} />
                        Jetzt versenden
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
                <span>Legen Sie zuerst Ihren Agentur-Zugang an, definieren Sie anschließend Beruf und Standort und prüfen Sie direkt die Vorschau Ihres täglichen E-Mail-Digests.</span>
              </div>

              <div className="saas-grid">
                <div className="saas-panel saas-panel-primary">
                  <div className="view-mode-switch" style={{ marginBottom: "14px", display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className={`theme-chip${authMode === "register" ? " active" : ""}`}
                      onClick={() => setAuthMode("register")}
                      style={{ flex: 1, minHeight: "34px", fontSize: "0.78rem" }}
                    >
                      Zugang erstellen
                    </button>
                    <button
                      type="button"
                      className={`theme-chip${authMode === "login" ? " active" : ""}`}
                      onClick={() => setAuthMode("login")}
                      style={{ flex: 1, minHeight: "34px", fontSize: "0.78rem" }}
                    >
                      Einloggen
                    </button>
                  </div>

                  {authMode === "register" ? (
                    <form onSubmit={handleCreateAgency} style={{ display: "grid", gap: "14px" }}>
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
                    </form>
                  ) : (
                    <form onSubmit={handleLoginAgency} style={{ display: "grid", gap: "14px" }}>
                      <div className="panel-title">
                        <KeyRound size={19} aria-hidden="true" />
                        <h3>Agentur-Schlüssel eingeben</h3>
                      </div>
                      <label>
                        <span>Agentur-Schlüssel (API-Key)</span>
                        <input
                          type="password"
                          required
                          placeholder="emp_..."
                          value={loginKey}
                          onChange={(event) => setLoginKey(event.target.value)}
                        />
                      </label>
                      <button className="primary-action" type="submit" disabled={saasLoading}>
                        {saasLoading ? <LoaderCircle className="spin" size={19} /> : <KeyRound size={19} />}
                        Einloggen
                      </button>
                    </form>
                  )}

                  {agency ? (
                    <div className="agency-summary-card" style={{ marginTop: "16px" }}>
                      <div>
                        <span>Aktiver Agentur-Zugang</span>
                        <strong>{agency.name}</strong>
                        <p style={{ margin: 0 }}>{agency.email}</p>
                        <p style={{ margin: "4px 0 0 0", fontSize: "13px" }}>{agency.email_verified ? "E-Mail-Adresse bestätigt" : "E-Mail-Adresse noch nicht bestätigt"}</p>
                        <details style={{ marginTop: "8px", fontSize: "12px", cursor: "pointer" }}>
                          <summary style={{ color: "var(--muted)" }}>Schlüssel anzeigen</summary>
                          <code style={{ display: "block", marginTop: "4px", padding: "4px", backgroundColor: "var(--paper)", wordBreak: "break-all" }}>{agency.api_key}</code>
                        </details>
                      </div>
                      <div className="agency-summary-actions">
                        {!agency.email_verified ? (
                          <button className="secondary-action" type="button" onClick={handleResendVerification} disabled={verificationSending}>
                            {verificationSending ? <LoaderCircle className="spin" size={17} /> : <Mail size={17} />}
                            Verifizierung erneut senden
                          </button>
                        ) : null}
                        <button className="secondary-action" type="button" onClick={handleForgetAgency}>
                          <LogOut size={17} />
                          Zugang entfernen
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <form className="saas-panel saas-panel-secondary" onSubmit={handleCreateAlert} onBlur={(event) => {
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
                        role="combobox"
                        aria-autocomplete="list"
                        aria-haspopup="listbox"
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
                        role="combobox"
                        aria-autocomplete="list"
                        aria-haspopup="listbox"
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
                        {loadingAgentLocationSuggestions ? (
                          <button className="suggest-option" type="button" disabled>
                            <LoaderCircle size={16} className="spin-icon" />
                            Orte werden geladen...
                          </button>
                        ) : visibleAgentLocationSuggestions.length ? (
                          visibleAgentLocationSuggestions.map((suggestion) => (
                            <button className="suggest-option suggest-option-rich" type="button" key={suggestion.label} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                              setAlertForm({ ...alertForm, location: suggestion.value });
                              setAgentSuggest(null);
                              setShowAllAgentSuggestions(true);
                            }}>
                              <span>{suggestion.value}</span>
                              {suggestion.state && suggestion.state !== suggestion.value ? <small>{suggestion.state}</small> : null}
                            </button>
                          ))
                        ) : (
                          <button className="suggest-option" type="button" disabled>
                            Kein passender Standort gefunden
                          </button>
                        )}
                      </div>
                    ) : null}
                  </label>
                  <p className="form-hint">Der Job-Alarm arbeitet mit exakten Standorten, damit nur wirklich relevante Treffer in Ihrer täglichen Zusammenfassung erscheinen.</p>
                  <button className="secondary-action" type="submit" disabled={saasLoading}>
                    <Plus size={19} />
                    Job-Alarm erstellen
                  </button>
                  <div className="alarm-trust-line">Datenquelle: Bundesagentur für Arbeit · Versand nur nach bestätigter Agentur-E-Mail · Starter = 1 Alarm, Agentur-Zugang = bis zu 200 CSV-Treffer</div>
                </form>
              </div>

              {agency ? (
                <section className="workspace-command-grid" aria-label="Agentur-Workspace">
                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">Authentifizierung und Team</p>
                        <h3>Multi-Agentur-Zugang mit Rollenmodell</h3>
                      </div>
                      <Users size={18} />
                    </div>
                    {workspaceLoading ? <p className="workspace-muted">Workspace wird geladen...</p> : null}
                    <div className="workspace-kpis">
                      <div>
                        <span>Aktive Mitglieder</span>
                        <strong>{workspaceReporting?.active_members || 0}</strong>
                      </div>
                      <div>
                        <span>Bestätigte Absenderadresse</span>
                        <strong>{agency.email_verified ? "Ja" : "Ausstehend"}</strong>
                      </div>
                    </div>
                    <ul className="workspace-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {workspaceMembers.length ? workspaceMembers.map((member) => {
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
                                  onClick={() => handleRemoveMember(member.id, member.full_name)}
                                  style={{ padding: "4px", color: "#b5361f", border: "none", cursor: "pointer", background: "none" }}
                                  title="Mitglied entfernen"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : null}
                            </div>
                          </li>
                        );
                      }) : <li><span>Der erste Owner wird bei der Agentur-Anlage automatisch erzeugt.</span></li>}
                    </ul>

                    {/* Seat Limit Warning or Invite Controls */}
                    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "2px solid #1f1d1a" }}>
                      {workspaceMembers.length >= (workspaceBilling?.seats || 1) ? (
                        <p style={{ fontSize: "12px", color: "#b5361f", margin: 0 }}>
                          ⚠️ Maximale Anzahl an Sitzplätzen ({workspaceBilling?.seats || 1}) erreicht. Bitte upgraden Sie Ihren Billing-Plan, um mehr Mitglieder einzuladen.
                        </p>
                      ) : (
                        <div>
                          {showInviteForm ? (
                            <form onSubmit={handleInviteMember} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "bold" }}>Name:</span>
                                <input
                                  type="text"
                                  required
                                  value={inviteName}
                                  onChange={(e) => setInviteName(e.target.value)}
                                  placeholder="Name des Mitglieds..."
                                  style={{ padding: "6px", fontSize: "13px", border: "1px solid #1f1d1a", backgroundColor: "#fffaf1" }}
                                />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "bold" }}>E-Mail:</span>
                                <input
                                  type="email"
                                  required
                                  value={inviteEmail}
                                  onChange={(e) => setInviteEmail(e.target.value)}
                                  placeholder="recruiter@agency.de..."
                                  style={{ padding: "6px", fontSize: "13px", border: "1px solid #1f1d1a", backgroundColor: "#fffaf1" }}
                                />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "bold" }}>Rolle:</span>
                                <select
                                  value={inviteRole}
                                  onChange={(e) => setInviteRole(e.target.value)}
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
                                  disabled={inviteLoading}
                                  style={{ padding: "6px 14px", fontSize: "12px", backgroundColor: "#ffce45", border: "1px solid #1f1d1a" }}
                                >
                                  {inviteLoading ? "Einladen..." : "Einladung senden"}
                                </button>
                                <button
                                  type="button"
                                  className="button button-secondary"
                                  onClick={() => setShowInviteForm(false)}
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
                              onClick={() => setShowInviteForm(true)}
                              style={{ width: "100%", padding: "8px", fontSize: "13px", border: "1px solid #1f1d1a", backgroundColor: "#ffce45" }}
                            >
                              Mitglied einladen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">Billing SaaS</p>
                        <h3>Plan, Sitzplätze und Laufzeit</h3>
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
                    <p className="workspace-muted">Die Billing-Struktur ist für spätere Stripe- oder Paddle-Anbindung vorbereitet.</p>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">Suche und Reporting</p>
                        <h3>Historie und Business-Metriken</h3>
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
                      {workspaceSearchHistory.length ? workspaceSearchHistory.map((entry) => (
                        <li key={entry.id}>
                          <strong>{entry.keyword || "Allgemeine Suche"}</strong>
                          <span>{entry.location || "Deutschland"} · {entry.result_count} Treffer</span>
                        </li>
                      )) : <li><span>Noch keine gespeicherte Suchhistorie vorhanden.</span></li>}
                    </ul>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">Pipeline und Kandidatendossiers</p>
                        <h3>Geteilte Recruiting-Pipeline</h3>
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
                      {workspaceDossiers.length ? workspaceDossiers.map((dossier) => (
                        <li key={dossier.reference}>
                          <strong>{dossier.title}</strong>
                          <span>{dossier.location}</span>
                          <em>{statusLabels[dossier.status] || dossier.status}</em>
                        </li>
                      )) : <li><span>Favoriten aus dem Job-Tracker werden hier als gemeinsame Dossiers gespeichert.</span></li>}
                    </ul>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <p className="eyebrow">DSGVO und E-Mail-Governance</p>
                        <h3>Vertrauen, Audit Trail und Double Opt-in</h3>
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
                        <p className="eyebrow">CRM / ATS Integrationen</p>
                        <h3>Verbindungsstatus für externe Systeme</h3>
                      </div>
                      <History size={18} />
                    </div>
                    <ul className="workspace-list workspace-list-compact">
                      {workspaceIntegrations.length ? workspaceIntegrations.map((integration) => (
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
                                <span style={{ fontSize: "11px", color: "#6b665c" }}>Bisher keine Syncs</span>
                              )}
                              <button
                                type="button"
                                className="button button-secondary"
                                style={{ padding: "4px 8px", fontSize: "12px", border: "1px solid #1f1d1a" }}
                                onClick={() => handleDisconnectCrm(integration.provider, integration.display_name)}
                              >
                                Trennen
                              </button>
                            </div>
                          ) : (
                            <div>
                              {connectingCrm?.provider === integration.provider ? (
                                <form onSubmit={handleConnectCrm} style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px", width: "100%" }}>
                                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <span style={{ fontSize: "12px", fontWeight: "bold" }}>API-Schlüssel eingeben:</span>
                                    <input
                                      type="password"
                                      required
                                      placeholder="Schlüssel eingeben..."
                                      value={crmApiKey}
                                      onChange={(e) => setCrmApiKey(e.target.value)}
                                      style={{ padding: "6px", fontSize: "13px", border: "1px solid #1f1d1a", backgroundColor: "#fffaf1" }}
                                    />
                                  </label>
                                  <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                      type="submit"
                                      className="button"
                                      disabled={crmActionLoading}
                                      style={{ padding: "4px 12px", fontSize: "12px", backgroundColor: "#ffce45", border: "1px solid #1f1d1a" }}
                                    >
                                      Aktivieren
                                    </button>
                                    <button
                                      type="button"
                                      className="button button-secondary"
                                      onClick={() => { setConnectingCrm(null); setCrmApiKey(""); }}
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
                                  onClick={() => setConnectingCrm(integration)}
                                >
                                  Verbinden
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      )) : <li><span>Personio, HubSpot und Greenhouse können als Integrationsziele vorbereitet werden.</span></li>}
                    </ul>
                    <p className="workspace-muted">Diese Integrationen sind als SaaS-Fundament angelegt. Sie können diese hier direkt verbinden und aktivieren.</p>
                  </article>
                </section>
              ) : null}

              <ClientErrorBoundary
                compact
                title="Die E-Mail-Vorschau konnte nicht geladen werden."
                description="Der Agentur-Bereich bleibt verfügbar. Laden Sie nur die Digest-Vorschau neu."
              >
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
              </ClientErrorBoundary>
            </div>
          ) : null}
          </AlertManager>
        </ClientErrorBoundary>

        <section className="data-source-section" id="datenquelle" aria-label="Datenquelle">
          <div className="section-heading">
            <p className="eyebrow">Datenquelle</p>
            <h2>Recherche auf Basis der Bundesagentur für Arbeit</h2>
            <p>Die Plattform strukturiert öffentliche BA-Stellenangebote für Recruiting-Workflows. Die Originalanzeige bleibt dabei die maßgebliche Primärquelle.</p>
          </div>
          <div className="data-source-grid">
            <article className="use-case-card">
              <ShieldCheck size={20} aria-hidden="true" />
              <h3>Öffentliche Primärquelle</h3>
              <p>Suchanfragen werden live gegen die BA-Daten verarbeitet, statt mit statischen Beispielinhalten zu arbeiten.</p>
            </article>
            <article className="use-case-card">
              <Download size={20} aria-hidden="true" />
              <h3>Export für Shortlists</h3>
              <p>Treffer können gespeichert, bewertet und als CSV für Kundenprojekte oder interne Recherchen exportiert werden.</p>
            </article>
            <article className="use-case-card">
              <Mail size={20} aria-hidden="true" />
              <h3>Job-Alarm für Monitoring</h3>
              <p>Wiederkehrende Suchen lassen sich über E-Mail-Digests überwachen, sobald Agenturzugang und Versand eingerichtet sind.</p>
            </article>
          </div>
        </section>

        <SiteFooter />
      </section>
    </main>
  );
}
