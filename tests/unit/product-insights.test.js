import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Replace @prisma/client with a deterministic fake so product-insights.js can
// be exercised without opening a real PG connection. Importantly, the fake
// MUST expose `$extends` because app/api/_lib/prisma.js calls it
// unconditionally at module-init to wrap the client with the
// concurrency-throttle extension — otherwise the import itself throws.
vi.mock("@prisma/client", () => {
  function makePrismaPromise(value, error = null) {
    const thenable = {
      then(onFulfilled, onRejected) {
        return (error ? Promise.reject(error) : Promise.resolve(value)).then(onFulfilled, onRejected);
      },
      catch(onRejected) {
        return (error ? Promise.reject(error) : Promise.resolve(value)).catch(onRejected);
      },
      finally(onFinally) {
        return (error ? Promise.reject(error) : Promise.resolve(value)).finally(onFinally);
      },
    };
    return thenable;
  }

  const counts = vi.fn(() => makePrismaPromise(0));
  const findManyRoster = [{ properties: { resultCount: 25 } }, { properties: { resultCount: 13 } }];
  const findMany = vi.fn(() => makePrismaPromise(findManyRoster));
  const findFirst = vi.fn(() => makePrismaPromise({ createdAt: new Date(Date.now() - 60_000) }));

  const agency = { count: counts };
  const searchSubscription = { count: counts, findFirst };
  const productEvent = { count: counts, findMany, findFirst };
  const emailDelivery = { count: counts, findFirst };

  class FakePrismaClient {
    constructor() {
      this.agency = agency;
      this.searchSubscription = searchSubscription;
      this.productEvent = productEvent;
      this.emailDelivery = emailDelivery;
    }

    async $transaction(input) {
      if (Array.isArray(input)) return Promise.all(input);
      if (typeof input === "function") return input(this);
      throw new Error("FakePrismaClient: unsupported $transaction input");
    }

    // The production prisma.js unconditionally calls `baseClient.$extends(...)`
    // to wrap the client with the concurrency-throttle extension. In tests
    // the throttle is a no-op (mocked fetches resolve without contention), so
    // returning `this` preserves the same model surface and let-through
    // semantics.
    $extends(_extension) {
      return this;
    }
  }

  return { PrismaClient: FakePrismaClient };
});

async function loadProductInsights() {
  vi.resetModules();
  return import("../../app/api/_lib/product-insights");
}

// Helper to pull the [insights] tier=... messages logged from a single
// `getPlatformInsights` call. We strip the standard `[insights] ` logger
// prefix here so callers can assert against the structured payload
// (`tier=memory ttl=Nms`) directly via regex / array equality.
//
// Vitest's `console.info` spy stores each call's args verbatim, so a single
// string arg produces `mock.calls = [["msg"]]`. We project to `callArgs[0]`
// (the message itself); the `callArgs[1]` index would silently return
// `undefined` for every call.
const INSIGHTS_LOG_PREFIX = "[insights] ";

function tierLogFor(consoleInfoSpy) {
  return consoleInfoSpy.mock.calls
    .map((callArgs) => callArgs[0])
    .filter(
      (msg) => typeof msg === "string" && msg.startsWith(`${INSIGHTS_LOG_PREFIX}tier=`),
    )
    .map((msg) => msg.slice(INSIGHTS_LOG_PREFIX.length));
}

describe("getPlatformInsights", () => {
  const originalEnv = { ...process.env };

  // beforeEach intentionally does NOT pre-seed `globalThis.__khalfajobsPlatformInsightsCache`
  // — tests that need a particular entry must seed it BEFORE calling
  // `loadProductInsights()` so the module's init-time capture picks it up.
  beforeEach(() => {
    vi.resetModules();
    delete process.env.SKIP_DB_DURING_BUILD;
    delete process.env.SKIP_DB;
    delete globalThis.__khalfajobsPlatformInsightsCache;
    delete globalThis.__khalfaPrisma;
    // No-op the info-level cache-tier log so test output stays clean and so
    // each test can install a fresh spy on `console.info` as needed.
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    delete globalThis.__khalfajobsPlatformInsightsCache;
    delete globalThis.__khalfaPrisma;
    vi.restoreAllMocks();
  });

  it("returns the cached value without re-running $transaction when the cache is fresh", async () => {
    const cachedAt = Date.now() - 5_000;
    // Seed BEFORE loading so the module's init-time captured reference
    // holds the seeded cache. `storedAt` matches production `writeInsightsCache`.
    globalThis.__khalfajobsPlatformInsightsCache = {
      entry: {
        activeAgencies: 99,
        activeAlerts: 88,
        searchesToday: 77,
        exportsToday: 66,
        alertsSentToday: 55,
        searchHitsWeek: 1234,
        lastActivityLabel: "cached",
      },
      storedAt: cachedAt,
      expiresAt: Date.now() + 60_000,
    };

    const { getPlatformInsights } = await loadProductInsights();
    const result = await getPlatformInsights();

    expect(result.activeAgencies).toBe(99);
    expect(result.activeAlerts).toBe(88);
    expect(result.lastActivityLabel).toBe("cached");

    // Returned object is a fresh clone (not the cached reference).
    expect(result).not.toBe(globalThis.__khalfajobsPlatformInsightsCache.entry);

    // Tier log: memory hit, ttl ≈ INSIGHTS_TTL_MS - (Date.now() - cachedAt),
    // which at 5s in is ~25000ms ± a few ticks of CI clock skew.
    expect(console.info).toHaveBeenCalled();
    const tierMessages = tierLogFor(console.info);
    expect(tierMessages.length).toBe(1);
    expect(tierMessages[0]).toMatch(/^tier=memory ttl_ms=\d+$/);
    const loggedTtl = Number(tierMessages[0].match(/ttl_ms=(\d+)/)[1]);
    expect(loggedTtl).toBeGreaterThan(20_000);
    expect(loggedTtl).toBeLessThanOrEqual(25_000);
  });

  it("runs $transaction on cache miss and caches the result for the next call", async () => {
    // No seeding → module init captures a fresh empty cache → first call is a miss.
    const { getPlatformInsights } = await loadProductInsights();

    const first = await getPlatformInsights();
    expect(first).toMatchObject({
      activeAgencies: 0,
      activeAlerts: 0,
      searchesToday: 0,
      exportsToday: 0,
      alertsSentToday: 0,
      searchHitsWeek: 25 + 13,
    });

    // Cache was populated with the first call's computed value, including
    // the wall-clock `storedAt` we use to compute remaining TTL on the
    // next read.
    expect(globalThis.__khalfajobsPlatformInsightsCache.entry).toEqual(first);
    expect(globalThis.__khalfajobsPlatformInsightsCache.storedAt).toBeGreaterThan(0);
    expect(globalThis.__khalfajobsPlatformInsightsCache.storedAt).toBeLessThanOrEqual(Date.now());
    expect(globalThis.__khalfajobsPlatformInsightsCache.expiresAt).toBeGreaterThan(Date.now());

    // Second call: cache hit. Same data, but a fresh object (clone).
    const second = await getPlatformInsights();
    expect(second).toEqual(first);
    expect(second).not.toBe(first);

    // Per-call tier log: first call → prisma (full TTL), second call →
    // memory (remaining TTL, slightly smaller). Both calls fire exactly
    // one info-level line.
    const tierMessages = tierLogFor(console.info);
    expect(tierMessages).toEqual([
      expect.stringMatching(/^tier=prisma ttl_ms=30000$/),
      expect.stringMatching(/^tier=memory ttl_ms=\d+$/),
    ]);
  });

  it("returns a fresh object on every call so callers cannot corrupt the cache", async () => {
    const { getPlatformInsights } = await loadProductInsights();

    const first = await getPlatformInsights();
    first.activeAgencies = 999;
    first.lastActivityLabel = "tampered";

    const second = await getPlatformInsights();
    expect(second.activeAgencies).not.toBe(999);
    expect(second.lastActivityLabel).not.toBe("tampered");
  });

  it("re-runs $transaction when the cached entry's TTL has expired", async () => {
    // Seed with an already-stale entry (expiresAt in the past) BEFORE the
    // module init captures the reference.
    globalThis.__khalfajobsPlatformInsightsCache = {
      entry: {
        activeAgencies: 99,
        activeAlerts: 99,
        searchesToday: 99,
        exportsToday: 99,
        alertsSentToday: 99,
        searchHitsWeek: 99,
        lastActivityLabel: "stale",
      },
      storedAt: Date.now() - 60_000,
      expiresAt: Date.now() - 1000,
    };

    const { getPlatformInsights } = await loadProductInsights();
    const result = await getPlatformInsights();

    // The TTL check rejected the stale entry — live (mock) data wins.
    expect(result.activeAgencies).toBe(0);
    expect(result.lastActivityLabel).not.toBe("stale");

    // Cache is now populated with the fresh value.
    expect(globalThis.__khalfajobsPlatformInsightsCache.entry?.lastActivityLabel).not.toBe("stale");
    expect(globalThis.__khalfajobsPlatformInsightsCache.expiresAt).toBeGreaterThan(Date.now());

    // Stale TTL → re-fetch path → tier=prisma log fires.
    const tierMessages = tierLogFor(console.info);
    expect(tierMessages).toEqual([expect.stringMatching(/^tier=prisma ttl_ms=30000$/)]);
  });

  it("falls back to zero defaults when $transaction throws", async () => {
    const { getPlatformInsights } = await loadProductInsights();

    // Spy AFTER loadProductInsights so the dependency is explicit:
    // product-insights.js imports `prisma` from `./prisma`, and prisma.js
    // exports `prisma` as the same object cached at globalThis.__khalfaPrisma.
    // Spying here guarantees we install on the instance that's actually in use.
    vi.spyOn(globalThis.__khalfaPrisma, "$transaction").mockImplementation(async () => {
      throw new Error("simulated db outage");
    });

    const result = await getPlatformInsights();

    expect(result).toEqual({
      activeAgencies: 0,
      activeAlerts: 0,
      searchesToday: 0,
      exportsToday: 0,
      alertsSentToday: 0,
      searchHitsWeek: 0,
      lastActivityLabel: "Noch keine Aktivität",
    });

    // Error path skips the tier log — operators see the error through
    // their normal channels, not the cache-effectiveness metric.
    expect(tierLogFor(console.info)).toEqual([]);
  });

  describe("with Redis tier", () => {
    const REDIS_URL = "https://redis.example.invalid";

    function mockRedisFetch({ redisGet = null } = {}) {
      // Routes only the Redis HTTP traffic; Prisma calls go through the
      // @prisma/client mock and never touch fetch.
      return vi.fn(async (url, init = {}) => {
        if (url.includes("/get/")) {
          if (redisGet) {
            return new Response(JSON.stringify({ result: JSON.stringify(redisGet) }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ result: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url === `${REDIS_URL}/` && init?.method === "POST") {
          return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
        }
        throw new Error("Unexpected fetch URL in test: " + url);
      });
    }

    it("queries Redis when the microcache is empty and accepts the cached value", async () => {
      process.env.UPSTASH_REDIS_REST_URL = REDIS_URL;
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

      const cachedPayload = {
        activeAgencies: 42,
        activeAlerts: 21,
        searchesToday: 11,
        exportsToday: 5,
        alertsSentToday: 3,
        searchHitsWeek: 99,
        lastActivityLabel: "from-redis",
      };
      // Production Redis shape: `{ payload, storedAt }`. `storedAt` is the
      // wall-clock time the original invocation wrote the entry; the log
      // layer uses it to compute remaining TTL on this read.
      const redisStoredAt = Date.now() - 5000;

      const fetchMock = mockRedisFetch({ redisGet: { payload: cachedPayload, storedAt: redisStoredAt } });
      vi.stubGlobal("fetch", fetchMock);

      const { getPlatformInsights } = await loadProductInsights();
      await getPlatformInsights();
      // Flush microtasks so the fire-and-forget Redis SET (write path) fires
      // and any in-flight resolves settle.
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Redis GET was called with the encoded "insights:v1" key.
      const getCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/get/"));
      expect(getCalls.length).toBeGreaterThanOrEqual(1);
      expect(String(getCalls[0][0])).toMatch(/get\/insights/);

      // Microcache entry exists. Final value depends on the race winner —
      //   * Redis wins → cache-hit short-circuit, microcache holds Redis data.
      //   * Prisma wins → writeInsightsCache fires and overwrites with Prisma data.
      // Both outcomes are valid; we only verify that the entry exists and is
      // one of the two payloads (no spurious other value).
      const cached = globalThis.__khalfajobsPlatformInsightsCache.entry;
      expect(cached).not.toBeNull();
      expect([0, 42]).toContain(cached.activeAgencies);

      // Second call hits the microcache fast path — no new Redis GET,
      // and writeInsightsCache is skipped via the cache-hit short-circuit.
      const callsBeforeSecond = fetchMock.mock.calls.length;
      await getPlatformInsights();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const getCallsAfterSecond = fetchMock.mock.calls.filter(([u]) => String(u).includes("/get/"));
      expect(getCallsAfterSecond.length).toBe(getCalls.length);
      expect(fetchMock.mock.calls.length).toBe(callsBeforeSecond);

      // Tier log semantics depend on who won the race:
      //   * Redis-wins path → tier=redis, ttl ≈ INSIGHTS_TTL_MS - (now - redisStoredAt).
      //   * Prisma-wins path → tier=prisma (full TTL),
      //     then tier=memory on the second call.
      //   * Redis-wins path → tier=redis, then tier=memory on the second.
      // We accept any of these valid combinations; only verify each
      // tier message matches the documented format. Exactly two `getPlatformInsights`
      // calls ran inside this test, so the assert is === 2 — if a future change
      // accidentally emits two logs per call (or zero), this hard-fails.
      const messages = tierLogFor(console.info);
      expect(messages.length).toBe(2);
      for (const msg of messages) {
        expect(msg).toMatch(/^tier=(memory|redis|prisma) ttl_ms=\d+$/);
      }
    });

    it("writes to Redis (fire-and-forget) after a successful Prisma fetch on Redis miss", async () => {
      process.env.UPSTASH_REDIS_REST_URL = REDIS_URL;
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

      const fetchMock = mockRedisFetch({ redisGet: null });
      vi.stubGlobal("fetch", fetchMock);

      const { getPlatformInsights } = await loadProductInsights();
      const result = await getPlatformInsights();

      // Prisma computed (mock returns 0 + 25+13 = 38 searchHitsWeek).
      expect(result.searchHitsWeek).toBe(38);
      expect(result.activeAgencies).toBe(0);

      // GET hit Redis miss → null → fell through to Prisma → SET fired.
      // Allow the SET to flush via microtask pump (fire-and-forget path).
      await new Promise((resolve) => setTimeout(resolve, 0));

      const postCalls = fetchMock.mock.calls;
      expect(postCalls.length).toBeGreaterThanOrEqual(2);
      expect(String(postCalls[0][0])).toContain("/get/");
      const setCall = postCalls.find(([u]) => u === `${REDIS_URL}/`);
      expect(setCall).toBeDefined();
      expect(setCall[1].method).toBe("POST");

      // SET body is the JSON-array command form with the same key/TTL shape
      // used elsewhere in the codebase. Production wraps the payload in
      // `{ payload, storedAt }` so a Redis-read can report real remaining
      // TTL on the next invocation.
      const setBody = JSON.parse(setCall[1].body);
      expect(setBody[0]).toBe("SET");
      expect(setBody[1]).toBe("insights:v1");
      expect(setBody[3]).toBe("PX");
      expect(typeof setBody[4]).toBe("number");
      expect(setBody[4]).toBeGreaterThan(0);
      const storedEnvelope = JSON.parse(setBody[2]);
      expect(storedEnvelope).toMatchObject({ payload: { activeAgencies: 0, searchHitsWeek: 38 } });
      expect(typeof storedEnvelope.storedAt).toBe("number");
      expect(storedEnvelope.storedAt).toBeGreaterThan(0);

      // Tier log reflects the prisma-then-memory sequence (first call ran
      // $transaction; subsequent reads in this test don't re-run fetch).
      const messages = tierLogFor(console.info);
      expect(messages).toEqual([expect.stringMatching(/^tier=prisma ttl_ms=30000$/)]);
    });

    it("returns the in-memory cached value without hitting Redis when the microcache is fresh", async () => {
      process.env.UPSTASH_REDIS_REST_URL = REDIS_URL;
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

      // Seed microcache BEFORE loadProductInsights so the module captures it.
      globalThis.__khalfajobsPlatformInsightsCache = {
        entry: {
          activeAgencies: 7,
          activeAlerts: 0,
          searchesToday: 0,
          exportsToday: 0,
          alertsSentToday: 0,
          searchHitsWeek: 0,
          lastActivityLabel: "memory-only",
        },
        storedAt: Date.now() - 1000,
        expiresAt: Date.now() + 60_000,
      };

      const fetchMock = mockRedisFetch({ redisGet: { somethingElse: true } });
      vi.stubGlobal("fetch", fetchMock);

      const { getPlatformInsights } = await loadProductInsights();
      const result = await getPlatformInsights();

      expect(result).toMatchObject({ activeAgencies: 7, lastActivityLabel: "memory-only" });

      // Memory hit shortcut — Redis was never queried.
      expect(fetchMock).not.toHaveBeenCalled();

      // Memory-hit tier log fires exactly once with remaining TTL.
      const messages = tierLogFor(console.info);
      expect(messages).toEqual([expect.stringMatching(/^tier=memory ttl_ms=\d+$/)]);
      const ttl = Number(messages[0].match(/ttl_ms=(\d+)/)[1]);
      expect(ttl).toBeGreaterThan(20_000);
      expect(ttl).toBeLessThanOrEqual(30_000);
    });
  });
});
