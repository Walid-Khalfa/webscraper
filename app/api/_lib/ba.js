import { getJson as redisGetJson, setJson as redisSetJson } from "./redis";
import { logInfo, logWarn } from "./logger";
import { raceCacheWithFetch } from "./race-with-abort";
import {
  extractJobItems as sharedExtractJobItems,
  valueAt as sharedValueAt,
  flatten as sharedFlatten,
  normalizeJob as sharedNormalizeJob,
  toCsv as sharedToCsv,
  getLocationCandidates as sharedGetLocationCandidates,
} from "../../../lib/shared";
import crypto from "node:crypto";

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

// Two-tier cache: Upstash Redis (distributed, survives cold starts) + a small
// process-local Map (microcache for the lifetime of a single Vercel Lambda).
// Lookups go: memory → Redis → upstream. Writes go to both on success.
//
// `globalThis.__baSearchCache` keeps its identity across Next.js dev HMR
// reloads so the microcache state doesn't leak. On Vercel cold starts the
// Map starts empty but Redis hits keep warm results alive.
//
// Lookups on cache miss race the Redis GET against the upstream BA fetch so
// a slow / dead Redis (up to 800ms timeout in _lib/redis.js) doesn't gate
// the API response. A Redis hit cancels the speculative upstream call to
// spare BA API tokens; a Redis miss lets the already-in-flight upstream
// request finish.
//
// Each cache entry carries a wall-clock `storedAt` so the log layer can
// report remaining TTL per tier and operators can see cache effectiveness
// across Lambda invocations.
const responseCache = globalThis.__baSearchCache ?? new Map();
globalThis.__baSearchCache = responseCache;

let oauthToken = globalThis.__baOauthToken ?? null;

function createAppError(message, status = 500, code = "BA_API_ERROR") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

// `fetchWithTimeout` distinguishes between an ABORT we triggered ourselves
// (the BA request hit BA_TIMEOUT_MS — surface as BA_TIMEOUT AppError) and
// an abort triggered by an external signal passed via `options.signal`
// (the cache race winner was Redis — rethrow the raw AbortError so the
// caller can treat it as "we got cancelled, ignore me").
async function fetchWithTimeout(url, options = {}) {
  const { signal: externalSignal, ...rest } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, BA_TIMEOUT_MS);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      if (timedOut) {
        throw createAppError(
          "Die Bundesagentur-API hat nicht rechtzeitig geantwortet. Bitte versuchen Sie es in wenigen Sekunden erneut.",
          504,
          "BA_TIMEOUT",
        );
      }
      // External abort — let the caller decide what to do.
      throw error;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Wraps the upstream BA fetch with the OAuth / 401-retry / error-text
// handling previously inlined in `searchJobs`. Returns `null` (instead of
// throwing) when the external signal aborted the request — that lets the
// race winner in `searchJobs` discard the cancelled upstream without
// unhandled-rejection noise.
async function fetchUpstream(url, signal) {
  try {
    let response = await fetchWithTimeout(url, {
      signal,
      headers: await getBaHeaders(),
      cache: "no-store",
    });

    if (response.status === 401 && oauthToken) {
      oauthToken = null;
      globalThis.__baOauthToken = null;
      response = await fetchWithTimeout(url, {
        signal,
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
      throw createAppError(
        `${message} (${response.status}) ${text.slice(0, 180)}`.trim(),
        status,
        "BA_UPSTREAM_ERROR",
      );
    }

    return await response.json();
  } catch (error) {
    // The race lost — Redis already gave us the answer. Cancel noisily.
    if (error?.name === "AbortError" && signal?.aborted) return null;
    throw error;
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

function hashCacheKey(url) {
  return crypto.createHash("sha256").update(String(url)).digest("hex");
}

function logBaCacheOutcome(tier, storedAt) {
  // `tier="upstream"` entries are brand-new — they own the full TTL window
  // for the next reader. All other tiers report remaining TTL based on the
  // `storedAt` they were tagged with at write-time. We clamp to ≥0 to absorb
  // up to a few hundred ms of clock skew between writer and reader without
  // shouting a negative TTL louder than the real signal.
  const ttlMs =
    tier === "upstream"
      ? CACHE_TTL_MS
      : Math.max(0, CACHE_TTL_MS - (Date.now() - storedAt));
  logInfo("ba", { tier, ttl_ms: ttlMs });
}

// Returns `{ payload, tier: "redis", storedAt } | null` for the race-with-abort
// helper. We deliberately do NOT check memory inside this function — the
// caller (`searchJobs`) handles the memory fast path inline before entering
// the race, so by the time we get here memory has definitely missed.
//
// We tolerate two on-disk shapes for forward-compat during a rolling deploy:
//   * New envelope: { payload: <BA>, storedAt: <number> }.
//   * Legacy entry: raw BA payload (no envelope) — written before the
//     structured cache landed. Treated as a hit with storedAt=Date.now()
//     because we have no real timestamp; the log line will reflect a
//     full-TTL entry, which is honest enough vs. an unjustified miss.
//
// The envelope check requires both `payload` and `storedAt` to be present
// in canonical types — without the `storedAt` requirement, a future BA
// response containing a sub-object named "payload" (rather than the
// envelope) would be silently mis-extracted as the BA payload.
async function readRedisCachedEntry(url) {
  const redisKey = `ba:search:${hashCacheKey(url)}`;
  const redisEntry = await redisGetJson(redisKey);
  if (!redisEntry || typeof redisEntry !== "object") return null;

  const isEnvelopeShape =
    typeof redisEntry.storedAt === "number" &&
    "payload" in redisEntry &&
    redisEntry.payload &&
    typeof redisEntry.payload === "object";
  const payload = isEnvelopeShape ? redisEntry.payload : redisEntry;
  const storedAt = isEnvelopeShape ? redisEntry.storedAt : Date.now();

  return { payload: clonePayload(payload), tier: "redis", storedAt };
}

// Refresh the microcache after a Redis hit during the race. We preserve the
// Redis-supplied `storedAt` (rather than re-stamping with Date.now()) so
// subsequent in-Lambda memory hits report the true cache age, not a phantom
// "just refreshed" — operators care about data age, not write-time.
function refreshMicrocacheFromRedis(url, payload, storedAt) {
  responseCache.set(url, {
    payload: clonePayload(payload),
    storedAt,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// Writes the upstream-fresh payload to both memory (synchronous) and Redis
// (fire-and-forget). Memory's `storedAt` is the wall-clock time of the fetch
// resolution — operators see "fresh entry; full TTL" in the next tier log.
function writeCacheEntry(url, payload) {
  const storedAt = Date.now();
  responseCache.set(url, {
    payload: clonePayload(payload),
    storedAt,
    expiresAt: storedAt + CACHE_TTL_MS,
  });

  const redisKey = `ba:search:${hashCacheKey(url)}`;
  redisSetJson(redisKey, { payload, storedAt }, CACHE_TTL_MS).catch((error) => {
    if (error?.name === "TypeError") {
      logWarn("ba", "Bad cache TTL; skipping Redis write", { error: error.message });
    }
  });
}

export async function searchJobs({ keyword, location, page = 1, size = 25 }) {
  if (process.env.PLAYWRIGHT === "true") {
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

  // Microcache fast path. Returns early without entering the race-with-abort
  // helper because the speculative upstream fetch would be wasted work — the
  // helper exists to cancel that fetch when Redis wins, but we already know
  // memory won. We log `tier=memory` with the entry's own `storedAt` so the
  // report reflects true data age, including entries written by a previous
  // Lambda invocation (via the Redis-refresh branch below).
  const memEntry = responseCache.get(url);
  if (memEntry && memEntry.expiresAt > Date.now()) {
    const storedAt = typeof memEntry.storedAt === "number" ? memEntry.storedAt : Date.now();
    logBaCacheOutcome("memory", storedAt);
    return clonePayload(memEntry.payload);
  }

  // Race Redis GET vs upstream BA fetch. The race-with-abort helper handles
  // all four outcomes (cache hit, cache miss + await fetch, fetch wins,
  // fetch error before cache settles) and exposes a single normalized
  // `fetchPromise` we can `await` regardless of who won.
  //   * cache hit  → helper aborts the speculative fetch; we refresh the
  //                  microcache from Redis (preserving Redis-supplied
  //                  `storedAt`), log `tier=redis`, and return.
  //   * cache miss → fetch wins or is in-flight; we cache+return its payload
  //                  and log `tier=upstream`.
  //   * fetch wins → same as cache-miss path; we cache+return and log
  //                  `tier=upstream`.
  //   * fetch rejects before cache resolves → helper retries cache; rethrow
  //     the upstream error if cache still misses.
  const raceResult = await raceCacheWithFetch(
    () => readRedisCachedEntry(url),
    (signal) => fetchUpstream(url, signal),
  );

  if (raceResult.source === "cache" && raceResult.value !== null) {
    const { payload, tier, storedAt } = raceResult.value;
    refreshMicrocacheFromRedis(url, payload, storedAt);
    logBaCacheOutcome(tier, storedAt);
    return clonePayload(payload);
  }

  // Either fetch won outright (source="fetch") or cache missed (source="cache",
  // value=null). In both cases await the (post-abort-normalized) fetchPromise
  // and cache + return its payload. The helper absorbs AbortError to null so
  // this throws only on real upstream failures (502/503/etc).
  const fetched = await raceResult.fetchPromise;
  if (fetched == null) {
    throw createAppError(
      "Die Bundesagentur-API hat nicht rechtzeitig geantwortet. Bitte versuchen Sie es in wenigen Sekunden erneut.",
      504,
      "BA_TIMEOUT",
    );
  }
  writeCacheEntry(url, fetched);
  logBaCacheOutcome("upstream", Date.now());
  return clonePayload(fetched);
}

export async function findJobByReference(reference) {
  const safeReference = String(reference || "").trim();
  if (!safeReference) return null;

  const payload = await searchJobs({ keyword: safeReference, page: 1, size: 10 });
  return extractJobItems(payload).find((item) => normalizeJob(item).Referenz === safeReference) || null;
}

export const extractJobItems = sharedExtractJobItems;
export const valueAt = sharedValueAt;
export const flatten = sharedFlatten;
export const toCsv = sharedToCsv;
export const getLocationCandidates = sharedGetLocationCandidates;

export function normalizeJob(item) {
  return sharedNormalizeJob(item, { capitalized: true });
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

  return items.filter((item) =>
    getLocationCandidates(item).some((candidate) => isExactLocationMatch(candidate, expectedLocation)),
  );
}
