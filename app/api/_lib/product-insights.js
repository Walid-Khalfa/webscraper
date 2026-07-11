import { prisma } from "./prisma";
import { raceCacheWithFetch } from "./race-with-abort";
import { getJson as redisGetJson, setJson as redisSetJson } from "./redis";
import { logInfo, logWarn } from "./logger";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek() {
  const now = new Date();
  const currentDay = now.getDay() || 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDay + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function relativeFrom(date) {
  if (!date) return "Noch keine Aktivität";
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes <= 1) return "Vor weniger als 1 Minute";
  if (minutes < 60) return `Vor ${minutes} Minuten`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Vor ${hours} Stunde${hours === 1 ? "" : "n"}`;
  const days = Math.round(hours / 24);
  return `Vor ${days} Tag${days === 1 ? "" : "en"}`;
}

export async function recordProductEvent({ event, distinctId, path, url, properties = {} }) {
  if (!event) return null;

  return prisma.productEvent.create({
    data: {
      event: String(event),
      distinctId: distinctId ? String(distinctId) : null,
      path: path ? String(path) : null,
      url: url ? String(url) : null,
      properties,
    },
  });
}

// Dashboard counts lag slightly (30s) — appropriate for this surface, but
// still short enough to feel fresh on the operator view.
const INSIGHTS_TTL_MS = 30 * 1000;

// Single shared Redis key for the platform-insights snapshot. Stale data
// self-expires via TTL (no daily rollover needed for this surface).
const INSIGHTS_REDIS_KEY = "insights:v1";

// Process-local microcache identity preserved across Next.js dev HMR reloads
// via globalThis. JSON-cloned on every read + write so callers can mutate
// the returned object without polluting the cached entry. `storedAt` is the
// wall-clock timestamp we computed the payload; the log layer uses it with
// INSIGHTS_TTL_MS to report remaining TTL on every cache hit.
const insightsCache = globalThis.__khalfajobsPlatformInsightsCache ?? {
  entry: null,
  storedAt: 0,
  expiresAt: 0,
};
globalThis.__khalfajobsPlatformInsightsCache = insightsCache;

function cloneInsights(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function logInsightsCacheOutcome(tier, storedAt) {
  // Tier="prisma" entries are brand new — they own the full TTL window. All
  // other tiers report remaining TTL based on `storedAt`. We clamp to ≥0
  // because a 50ms clock skew between writer and reader can otherwise show
  // a negative TTL louder than the real signal.
  const ttlMs =
    tier === "prisma"
      ? INSIGHTS_TTL_MS
      : Math.max(0, INSIGHTS_TTL_MS - (Date.now() - storedAt));
  logInfo("insights", { tier, ttl_ms: ttlMs });
}

async function readInsightsCache() {
  // 1) Process-local microcache: instant, no network.
  if (insightsCache.entry && insightsCache.expiresAt > Date.now()) {
    return {
      payload: cloneInsights(insightsCache.entry),
      tier: "memory",
      storedAt: insightsCache.storedAt,
    };
  }

  // 2) Distributed cache: Upstash Redis. Falls back to `null` on any failure
  //    (env unset, network, malformed JSON). A Redis hit refreshes the
  //    microcache so subsequent reads in the same Lambda invocation skip
  //    the network call. The storedAt we read may have been written by a
  //    different invocation — fall back to `Date.now()` if it's missing
  //    (e.g. legacy cache entry from a previous deployment).
  const redisEntry = await redisGetJson(INSIGHTS_REDIS_KEY);
  if (redisEntry && redisEntry.payload) {
    const storedAt =
      typeof redisEntry.storedAt === "number" ? redisEntry.storedAt : Date.now();
    insightsCache.entry = cloneInsights(redisEntry.payload);
    insightsCache.storedAt = storedAt;
    insightsCache.expiresAt = Date.now() + INSIGHTS_TTL_MS;
    return {
      payload: cloneInsights(redisEntry.payload),
      tier: "redis",
      storedAt,
    };
  }

  return null;
}

function writeInsightsCache(value) {
  const storedAt = Date.now();

  // Always write the in-memory microcache synchronously so future reads in
  // the same Lambda invocation skip both Redis and Prisma.
  insightsCache.entry = cloneInsights(value);
  insightsCache.storedAt = storedAt;
  insightsCache.expiresAt = storedAt + INSIGHTS_TTL_MS;

  // Fire-and-forget the Redis SET so an Upstash outage (up to 800ms timeout
  // in _lib/redis.js) doesn't gate the API response. Other Lambda
  // invocations within the same 30s window will hit warm Redis instead of
  // all racing the Prisma $transaction. We wrap the payload alongside its
  // storedAt so a Redis-read in another invocation can report the real
  // remaining TTL instead of pretending the entry is brand-new.
  redisSetJson(
    INSIGHTS_REDIS_KEY,
    { payload: value, storedAt },
    INSIGHTS_TTL_MS,
  ).catch((error) => {
    if (error?.name === "TypeError") {
      logWarn("insights", "Bad cache TTL; skipping Redis write", { error: error.message });
    }
  });
}

// Fresh object every call so the catch path (and any test) can mutate
// without affecting the cache or other callers.
function zeroFallback() {
  return {
    activeAgencies: 0,
    activeAlerts: 0,
    searchesToday: 0,
    exportsToday: 0,
    alertsSentToday: 0,
    searchHitsWeek: 0,
    lastActivityLabel: "Noch keine Aktivität",
  };
}

async function computePlatformInsights(_signal) {
  // `_signal` is plumbing for the race-with-abort helper. Prisma doesn't
  // natively honor AbortSignal, so the abort is effectively a no-op for the
  // underlying query — but the race still cuts a round-trip on warm
  // sessions because the cache hit side shortcuts the wait before the
  // transaction even completes.
  const today = startOfToday();
  const weekStart = startOfWeek();

  const [
    activeAgencies,
    activeAlerts,
    searchesToday,
    exportsToday,
    alertsSentToday,
    weeklySearchEvents,
    latestEvent,
    latestDelivery,
    latestSubscription,
  ] = await prisma.$transaction([
    prisma.agency.count({ where: { isActive: true } }),
    prisma.searchSubscription.count({ where: { isActive: true } }),
    prisma.productEvent.count({
      where: {
        event: "search_completed",
        createdAt: { gte: today },
      },
    }),
    prisma.productEvent.count({
      where: {
        event: "csv_export_completed",
        createdAt: { gte: today },
      },
    }),
    prisma.emailDelivery.count({
      where: {
        status: "sent",
        createdAt: { gte: today },
      },
    }),
    prisma.productEvent.findMany({
      where: {
        event: "search_completed",
        createdAt: { gte: weekStart },
      },
      select: { properties: true },
    }),
    prisma.productEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.emailDelivery.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.searchSubscription.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const lastActivity = [latestEvent?.createdAt, latestDelivery?.createdAt, latestSubscription?.createdAt]
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  const searchHitsWeek = weeklySearchEvents.reduce((sum, entry) => {
    const resultCount = Number(entry?.properties?.resultCount || 0);
    return sum + (Number.isFinite(resultCount) ? resultCount : 0);
    }, 0);

  return {
    activeAgencies,
    activeAlerts,
    searchesToday,
    exportsToday,
    alertsSentToday,
    searchHitsWeek,
    lastActivityLabel: relativeFrom(lastActivity),
  };
}

export async function getPlatformInsights() {
  try {
    const raceResult = await raceCacheWithFetch(
      readInsightsCache,
      (signal) => computePlatformInsights(signal),
    );

    if (raceResult.source === "cache" && raceResult.value !== null) {
      // readInsightsCache returns a `{ payload, tier, storedAt }` wrapper
      // so operators get a single info-level line per cache hit in
      // production. Tier is the layer that served the lookup (memory or
      // redis); storedAt lets us report the actual remaining TTL.
      const { payload, tier, storedAt } = raceResult.value;
      logInsightsCacheOutcome(tier, storedAt);
      return payload;
    }

    // Either cache missed (race resolved with source="cache", value=null) or
    // fetch won outright. The fetchPromise is normalized so AbortError becomes
    // null and non-abort errors propagate via the outer try/catch.
    const fetched = await raceResult.fetchPromise;
    if (fetched == null) return zeroFallback();
    writeInsightsCache(fetched);
    logInsightsCacheOutcome("prisma", Date.now());
    return cloneInsights(fetched);
  } catch {
    return zeroFallback();
  }
}
