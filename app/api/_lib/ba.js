const PUBLIC_SEARCH_URL = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs";

const BA_HEADERS = {
  Accept: "application/json, text/plain, */*",
  Origin: "https://www.arbeitsagentur.de",
  Referer: "https://www.arbeitsagentur.de/jobsuche/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "X-API-Key": "jobboerse-jobsuche",
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const BA_TIMEOUT_MS = Number(process.env.BA_TIMEOUT_MS || 12000);
const responseCache = globalThis.__baSearchCache ?? new Map();
globalThis.__baSearchCache = responseCache;

let oauthToken = globalThis.__baOauthToken ?? null;

function createAppError(message, status = 500, code = "BA_API_ERROR") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BA_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createAppError(
        "Die Bundesagentur-API hat nicht rechtzeitig geantwortet. Bitte versuchen Sie es in wenigen Sekunden erneut.",
        504,
        "BA_TIMEOUT",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function getOAuthToken() {
  const clientId = process.env.BA_CLIENT_ID;
  const clientSecret = process.env.BA_CLIENT_SECRET;
  const tokenUrl = process.env.BA_TOKEN_URL;

  if (!clientId || !clientSecret || !tokenUrl) return null;
  if (oauthToken?.accessToken && oauthToken.expiresAt > Date.now() + 30_000) return oauthToken.accessToken;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetchWithTimeout(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw createAppError(`BA OAuth token request failed with ${response.status}`, 502, "BA_OAUTH_FAILED");
  }

  const payload = await response.json();
  oauthToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(Number(payload.expires_in || 300) - 30, 30) * 1000,
  };
  globalThis.__baOauthToken = oauthToken;
  return oauthToken.accessToken;
}

async function getBaHeaders() {
  const token = await getOAuthToken();
  if (!token) return BA_HEADERS;

  const { "X-API-Key": _apiKey, ...headers } = BA_HEADERS;
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

export async function searchJobs({ keyword, location, page = 1, size = 25 }) {
  if (process.env.PLAYWRIGHT === "true" && process.env.NODE_ENV !== "production") {
    if (keyword && (keyword.includes("NonExistant") || keyword.includes("Nowhere") || location?.includes("Nowhere"))) {
      return { maxErgebnisse: 0, ergebnisliste: [] };
    }
    const count = Number(size) || 25;
    return {
      maxErgebnisse: 350,
      ergebnisliste: Array.from({ length: count }).map((_, i) => ({
        referenznummer: `MOCK-BA-REF-${(page - 1) * size + i + 1}`,
        titel: `Developer Job ${(page - 1) * size + i + 1}`,
        arbeitgeber: `BA Company ${(page - 1) * size + i + 1}`,
        arbeitsort: { ort: location || "Berlin" },
        verguetungsangabe: "Jahr",
        festgehalt: 60000 + i * 1000,
        beruf: keyword || "Softwareentwickler",
      })),
    };
  }

  const params = new URLSearchParams({
    page: String(Math.max(Number(page) || 1, 1)),
    size: String(Math.min(Math.max(Number(size) || 25, 1), 100)),
  });

  if (keyword) params.set("was", keyword);
  if (location) params.set("wo", location);

  const url = `${PUBLIC_SEARCH_URL}?${params.toString()}`;
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return clonePayload(cached.payload);

  let response = await fetchWithTimeout(url, {
    headers: await getBaHeaders(),
    cache: "no-store",
  });

  if (response.status === 401 && oauthToken) {
    oauthToken = null;
    globalThis.__baOauthToken = null;
    response = await fetchWithTimeout(url, {
      headers: await getBaHeaders(),
      cache: "no-store",
    });
  }

  if (!response.ok) {
    const text = await response.text();
    const status = [401, 403].includes(response.status) ? 502 : response.status >= 500 ? 503 : 502;
    const message =
      response.status >= 500
        ? "Die Bundesagentur-API ist momentan nicht verfügbar. Bitte versuchen Sie es später erneut."
        : "Die Bundesagentur-API konnte die Anfrage nicht erfolgreich verarbeiten.";
    throw createAppError(`${message} (${response.status}) ${text.slice(0, 180)}`.trim(), status, "BA_UPSTREAM_ERROR");
  }

  const payload = await response.json();
  responseCache.set(url, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
  return clonePayload(payload);
}

export async function findJobByReference(reference) {
  const safeReference = String(reference || "").trim();
  if (!safeReference) return null;

  const payload = await searchJobs({ keyword: safeReference, page: 1, size: 10 });
  return extractJobItems(payload).find((item) => normalizeJob(item).Referenz === safeReference) || null;
}

export function extractJobItems(payload) {
  if (Array.isArray(payload)) return payload.filter((item) => item && typeof item === "object");
  if (!payload || typeof payload !== "object") return [];

  const keys = ["ergebnisliste", "stellenangebote", "angebote", "jobs", "items", "results", "content", "data"];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
    if (value && typeof value === "object") {
      const nested = extractJobItems(value);
      if (nested.length) return nested;
    }
  }

  return Object.values(payload).reduce((best, value) => {
    const nested = extractJobItems(value);
    return nested.length > best.length ? nested : best;
  }, []);
}

export function valueAt(item, paths) {
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

export function flatten(value) {
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
  const type = valueAt(item, ["verguetungsangabe"]);
  const fixed = valueAt(item, ["festgehalt"]);
  const from = valueAt(item, ["gehaltsspanneVon"]);
  const to = valueAt(item, ["gehaltsspanneBis"]);
  const unit = String(type || valueAt(item, ["artDerVerguetung"]) || "").toLocaleLowerCase("de-DE");
  const suffix = unit.includes("stunde") ? "/Std." : unit.includes("jahr") ? "/Jahr" : "";

  if (from || to) return `${from ? formatEuro(from) : ""}${from && to ? " - " : ""}${to ? formatEuro(to) : ""} ${suffix}`.trim();
  if (fixed) return `${formatEuro(fixed)} ${suffix}`.trim();
  return "Keine Vergütung angegeben";
}

function collectUniqueStrings(values) {
  const seen = new Set();
  const items = [];

  for (const value of values) {
    const text = flatten(value);
    if (!text) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    items.push(text);
  }

  return items;
}

function getLocationCandidates(item) {
  const directCandidates = collectUniqueStrings([
    valueAt(item, ["arbeitsort.ort", "ort", "standort", "adresse.ort", "stellenlokationen.adresse.ort"]),
  ]);

  const locationEntries = Array.isArray(item?.stellenlokationen)
    ? item.stellenlokationen.flatMap((entry) => [entry?.adresse?.ort, entry?.adresse?.gemeinde, entry?.adresse?.kreis])
    : [];

  return collectUniqueStrings([...directCandidates, ...locationEntries]);
}

export function normalizeJob(item) {
  const reference = valueAt(item, ["referenznummer", "refnr", "refNr", "reference", "id", "hashId", "stellenangebotsId"]);
  const title = valueAt(item, ["titel", "title", "stellenangebotsTitel", "stellenbezeichnung", "beruf", "jobtitel"]);
  const employer = valueAt(item, ["arbeitgeber", "arbeitgebername", "firma", "unternehmen", "company", "betrieb.name"]);
  const location = valueAt(item, ["arbeitsort", "arbeitsorte", "stellenlokationen.adresse.ort", "ort", "standort", "adresse.ort"]);
  const postalCode = valueAt(item, ["plz", "postleitzahl", "stellenlokationen.adresse.plz", "arbeitsort.plz", "adresse.plz"]);
  const occupation = valueAt(item, ["beruf", "berufsbezeichnung", "hauptberuf", "occupation", "berufsfeld", "branche"]);
  const url = flatten(valueAt(item, ["url", "link", "externeURL", "stellenangebotUrl", "detailUrl", "externalUrl"]));
  const referenceText = flatten(reference);

  return {
    Referenz: referenceText,
    Titel: flatten(title),
    Arbeitgeber: flatten(employer),
    Ort: getLocationCandidates(item)[0] || flatten(location),
    Postleitzahl: flatten(postalCode),
    Gehalt: normalizeSalary(item),
    Beruf: flatten(occupation),
    URL: url || (referenceText ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${referenceText}` : ""),
  };
}

function normalizeLocationName(value) {
  return String(value || "")
    .toLocaleLowerCase("de-DE")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function isExactLocationMatch(candidate, expectedLocation) {
  const normalizedCandidate = normalizeLocationName(candidate);
  if (!normalizedCandidate) return false;
  if (normalizedCandidate === expectedLocation) return true;

  const primarySegment = normalizedCandidate.split(",")[0]?.trim() || "";
  if (primarySegment === expectedLocation) return true;

  return normalizedCandidate.startsWith(`${expectedLocation},`) || normalizedCandidate.startsWith(`${expectedLocation} (`);
}

export function filterJobsByExactLocation(items, location) {
  const expectedLocation = normalizeLocationName(location);
  if (!expectedLocation) return items;

  return items.filter((item) => getLocationCandidates(item).some((candidate) => isExactLocationMatch(candidate, expectedLocation)));
}

export function toCsv(rows) {
  const headers = ["Referenz", "Titel", "Arbeitgeber", "Ort", "Postleitzahl", "Gehalt", "Beruf", "URL"];
  const escapeCell = (value) => {
    const text = String(value ?? "");
    return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [headers.join(";"), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(";"))];
  return `\uFEFF${lines.join("\r\n")}`;
}
