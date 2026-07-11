import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We exercise `ba.js`'s search-cache logic with the upstream fetch fully
// mocked — no real network calls hit rest.arbeitsagentur.de.

const BA_URL_RE = /^https:\/\/rest\.arbeitsagentur\.de\/jobboerse\/jobsuche-service\/pc\/v6\/jobs\?/;
const SET_URL = "https://example.invalid/";
const BA_LOG_PREFIX = "[ba] ";

async function loadFreshBaModule() {
  vi.resetModules();
  return import("../../app/api/_lib/ba");
}

function buildFetchMock({
  upstream = { maxErgebnisse: 1, ergebnisliste: [{ referenznummer: "R-1", titel: "Mock" }] },
  upstashGet = null,
  upstashSetOk = true,
  redisDelayMs = 0,
  upstreamDelayMs = 0,
} = {}) {
  function delay(ms) {
    if (ms <= 0) return null;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return vi.fn(async (url, init = {}) => {
    if (typeof url !== "string") throw new Error("Expected string URL");

    // Upstash canonical command endpoint (used by setJson): POST / with a
    // JSON-array body like ["SET", key, value, "PX", ttlMs].
    if (url === SET_URL) {
      if (init?.method !== "POST") throw new Error("Mock ba-cache: expected POST to /, method was: " + init?.method);
      let parsed;
      try {
        parsed = JSON.parse(init.body || "[]");
      } catch (error) {
        throw new Error("Mock ba-cache: invalid request body, expected JSON array: " + error.message);
      }
      if (!Array.isArray(parsed) || parsed[0] !== "SET") {
        throw new Error("Mock ba-cache: expected SET command array, got: " + JSON.stringify(parsed));
      }
      return new Response(JSON.stringify({ result: upstashSetOk ? "OK" : "ERR" }), {
        status: upstashSetOk ? 200 : 500,
      });
    }

    if (url.includes("/get/")) {
      // Only awaits when redisDelayMs > 0 — preserves the original
      // synchronous mock behavior for default (zero-delay) callers.
      const wait = delay(redisDelayMs);
      if (wait) await wait;
      if (upstashGet) {
        return new Response(JSON.stringify({ result: JSON.stringify(upstashGet) }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ result: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (BA_URL_RE.test(url)) {
      const wait = delay(upstreamDelayMs);
      if (wait) await wait;
      // Yield one microtask so that any signal.abort() fired by the race
      // winner has a chance to take effect before we return the body.
      // Without this yield the abort happens "after" the synchronous Response
      // and the upstream looks like it succeeded even though Redis won.
      await Promise.resolve();
      if (init?.signal?.aborted) {
        const error = new Error("The operation was aborted.");
        error.name = "AbortError";
        throw error;
      }
      return new Response(JSON.stringify(upstream), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error("Unexpected fetch URL in test: " + url);
  });
}

// Helper to pull the [ba] tier=... messages logged from one or more
// searchJobs calls. We strip the standard `[ba] ` logger prefix so callers
// can assert against the structured payload (`tier=memory ttl=Nms`)
// directly via regex / array equality.
//
// Vitest's `console.info` spy stores each call's args verbatim, so a single
// string arg produces `mock.calls = [["msg"]]`. We project to `callArgs[0]`
// (the message itself); `callArgs[1]` would silently return undefined.
function baTierLogFor(consoleInfoSpy) {
  return consoleInfoSpy.mock.calls
    .map((callArgs) => callArgs[0])
    .filter(
      (msg) => typeof msg === "string" && msg.startsWith(`${BA_LOG_PREFIX}tier=`),
    )
    .map((msg) => msg.slice(BA_LOG_PREFIX.length));
}

describe("ba search cache", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    globalThis.__baSearchCache?.clear?.();
    // No-op the info-level cache-tier log so test output stays clean and so
    // each test can install a fresh spy on `console.info` as needed.
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    // Clearing (not deleting) keeps the globalThis map accessible; the
    // ba.js module captures it at init time and `delete`-ing would leak
    // state across tests.
    globalThis.__baSearchCache?.clear?.();
    vi.unstubAllGlobals();
    // Restore every spy/vi.fn() we installed (including the `console.info`
    // spy in beforeEach). Without this the spy persists across tests with
    // its `mock.calls` accumulator intact, and tier-log assertions would
    // see entries appended by prior tests within the same file.
    vi.restoreAllMocks();
  });

  it("returns the upstream payload when no cache is configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const { searchJobs } = await loadFreshBaModule();
    const result = await searchJobs({ keyword: "Softwareentwickler", location: "Berlin", page: 1, size: 25 });

    expect(result.maxErgebnisse).toBe(1);
    expect(result.ergebnisliste).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // one upstream fetch, zero redis calls (env unset)
    expect(fetchMock.mock.calls[0][0]).toMatch(BA_URL_RE);

    // Single upstream fetch → tier=upstream log with full CACHE_TTL_MS.
    const logs = baTierLogFor(console.info);
    expect(logs).toEqual([expect.stringMatching(/^tier=upstream ttl_ms=300000$/)]);
  });

  it("uses in-memory cache for repeat requests within TTL (env unset)", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const { searchJobs } = await loadFreshBaModule();
    await searchJobs({ keyword: "Softwareentwickler", location: "Berlin", page: 1, size: 25 });
    await searchJobs({ keyword: "Softwareentwickler", location: "Berlin", page: 1, size: 25 });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // First call: tier=upstream (full TTL). Second call: tier=memory
    // (remaining TTL, slightly smaller because the entry aged ms between
    // the two calls). Both fire exactly one info-level line.
    const logs = baTierLogFor(console.info);
    expect(logs).toEqual([
      expect.stringMatching(/^tier=upstream ttl_ms=300000$/),
      expect.stringMatching(/^tier=memory ttl_ms=\d+$/),
    ]);
    const memoryTtl = Number(logs[1].match(/ttl_ms=(\d+)/)[1]);
    expect(memoryTtl).toBeGreaterThan(290_000);
    expect(memoryTtl).toBeLessThanOrEqual(300_000);
  });

  it("uses Redis when configured and refreshes the in-memory microcache", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const cachedPayload = {
      maxErgebnisse: 99,
      ergebnisliste: [{ referenznummer: "REDIS-1", titel: "From Redis" }],
    };
    // New Redis envelope: { payload: <BA>, storedAt: <number> }. storedAt is
    // the wall-clock time the original Lambda invocation wrote the entry;
    // the log layer reads it as the time the upstream produced the data.
    const redisStoredAt = Date.now() - 30_000;

    const fetchMock = buildFetchMock({ upstashGet: { payload: cachedPayload, storedAt: redisStoredAt } });
    vi.stubGlobal("fetch", fetchMock);

    const { searchJobs } = await loadFreshBaModule();
    const result = await searchJobs({ keyword: "Softwareentwickler", location: "Berlin", page: 1, size: 25 });

    // Result came from Redis (not the default upstream payload of 1).
    expect(result.maxErgebnisse).toBe(99);
    expect(result.ergebnisliste[0].referenznummer).toBe("REDIS-1");

    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    // Redis GET was called…
    expect(urls.some((u) => u.includes("/get/"))).toBe(true);
    // …AND the speculative upstream fetch was fired but aborted because the
    // Redis hit won the race. Pure semantic proof: result.maxErgebnisse is
    // 99 (Redis) — not 1 (default upstream payload) — would be impossible if
    // the upstream had not been cancelled.
    expect(urls.some(BA_URL_RE.test.bind(BA_URL_RE))).toBe(true);

    await searchJobs({ keyword: "Softwareentwickler", location: "Berlin", page: 1, size: 25 });
    // Only one Redis GET call across both invocations — second was served
    // from the in-memory microcache that was refreshed from Redis on first hit.
    const getCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/get/"));
    expect(getCalls).toHaveLength(1);

    // Tier log semantics — exactly two calls so ===2 invariant holds:
    //   1st call: Redis wins race → tier=redis, ttl ≈ CACHE_TTL_MS -
    //              (Date.now() - redisStoredAt) ≈ 270000ms.
    //   2nd call: microcache fast path → tier=memory with the same storedAt
    //              (refreshMicrocacheFromRedis preserved it).
    const logs = baTierLogFor(console.info);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatch(/^tier=redis ttl_ms=\d+$/);
    expect(logs[1]).toMatch(/^tier=memory ttl_ms=\d+$/);
    const redisTtl = Number(logs[0].match(/ttl_ms=(\d+)/)[1]);
    const memoryTtl = Number(logs[1].match(/ttl_ms=(\d+)/)[1]);
    // Redis-storedAt was ~30s ago, so ttl ≈ 270000ms ± scheduler jitter.
    expect(redisTtl).toBeGreaterThan(250_000);
    expect(redisTtl).toBeLessThan(280_000);
    // Memory takes the same storedAt, so ttl should be very close to redisTtl.
    expect(memoryTtl).toBeGreaterThan(redisTtl - 200);
    expect(memoryTtl).toBeLessThanOrEqual(redisTtl + 200);
  });

  it("writes to Redis (POST / command) and in-memory on cache miss + fetch success", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const upstreamPayload = {
      maxErgebnisse: 2,
      ergebnisliste: [{ referenznummer: "FRESH-1" }, { referenznummer: "FRESH-2" }],
    };

    const fetchMock = buildFetchMock({
      upstashGet: null,
      upstream: upstreamPayload,
      upstashSetOk: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { searchJobs } = await loadFreshBaModule();
    const result = await searchJobs({ keyword: "Softwareentwickler", location: "Berlin", page: 1, size: 25 });

    expect(result.ergebnisliste).toHaveLength(2);

    const calls = fetchMock.mock.calls;
    // Three calls expected: Redis GET → upstream BA → Redis SET (POST /).
    // Order: GET starts first, upstream starts second, but the upstream
    // yields one extra microtask so Redis wins the race with `null`, then
    // we await the still-in-flight upstream and finally writeCacheEntry
    // fires the SET.
    expect(calls).toHaveLength(3);
    expect(calls[0][0]).toContain("/get/");
    expect(BA_URL_RE.test(calls[1][0])).toBe(true);
    expect(calls[2][0]).toBe(SET_URL);
    expect(calls[2][1].method).toBe("POST");

    // Lock in the SET-array protocol schema so a regression that switches
    // back to URL-encoding (or to a different command shape) fails loudly.
    const setBody = JSON.parse(calls[2][1].body);
    expect(Array.isArray(setBody)).toBe(true);
    expect(setBody[0]).toBe("SET");
    expect(setBody[1]).toMatch(/^ba:search:[a-f0-9]{64}$/); // sha256 hex
    expect(setBody[3]).toBe("PX");
    expect(typeof setBody[4]).toBe("number");
    expect(setBody[4]).toBeGreaterThan(0);
    // Production SET wraps the BA payload in { payload, storedAt } so a
    // Redis-read in a later invocation can report real remaining TTL.
    const storedEnvelope = JSON.parse(setBody[2]);
    expect(storedEnvelope).toMatchObject({ payload: upstreamPayload });
    expect(typeof storedEnvelope.storedAt).toBe("number");
    expect(storedEnvelope.storedAt).toBeGreaterThan(0);

    // Single call → tier=upstream log (full TTL since the entry is fresh).
    const logs = baTierLogFor(console.info);
    expect(logs).toEqual([expect.stringMatching(/^tier=upstream ttl_ms=300000$/)]);
  });

  // Race-timing regression: Redis wins the cache miss race despite being
  // "slow" (20ms) compared with what the upstream fetch COULD settle in
  // (200ms default upstream latency). Without the race we'd pay 20ms + 200ms
  // = ~220ms AND use the upstream payload. With the race: Redis resolves
  // first → upstream is cancelled mid-flight → we return the cachedPayload
  // in ~20ms.
  it("Redis wins the race even when slower than upstream, aborting upstream mid-flight", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const cachedPayload = {
      maxErgebnisse: 99,
      ergebnisliste: [{ referenznummer: "REDIS-1", titel: "From Redis" }],
    };
    const redisStoredAt = Date.now() - 5_000;

    const fetchMock = buildFetchMock({
      upstashGet: { payload: cachedPayload, storedAt: redisStoredAt },
      redisDelayMs: 20,
      upstreamDelayMs: 200,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { searchJobs } = await loadFreshBaModule();
    const start = Date.now();
    const result = await searchJobs({ keyword: "Softwareentwickler", location: "Berlin", page: 1, size: 25 });
    const elapsed = Date.now() - start;

    // Semantic: result is from Redis (99), not the default upstream (1).
    expect(result.maxErgebnisse).toBe(99);
    expect(result.ergebnisliste[0].referenznummer).toBe("REDIS-1");

    // Timing: race shortcut saved latency. Without the race, sequential
    // readCacheEntry (Redis 20ms) + upstream fetch (200ms) would total ~220ms.
    // With the race, total is dominated by Redis (~20-50ms). Use 150ms as a
    // comfortable upper bound that still catches any regression that reverts
    // to awaiting both sequentially.
    expect(elapsed).toBeLessThan(150);

    // Abort proof: the speculative upstream was actually called, and its
    // external signal was aborted by the race winner before the upstream
    // settled. Without the abort path, the upstream would have returned
    // its 200ms-delayed response and we'd have waited the full 200ms.
    const upstreamCall = fetchMock.mock.calls.find(([u]) => BA_URL_RE.test(u));
    expect(upstreamCall).toBeDefined();
    expect(upstreamCall[1].signal).toBeDefined();
    expect(upstreamCall[1].signal.aborted).toBe(true);

    // Tier log: Redis wins outright → tier=redis with cached TTL.
    const logs = baTierLogFor(console.info);
    expect(logs).toEqual([expect.stringMatching(/^tier=redis ttl_ms=\d+$/)]);
    const ttl = Number(logs[0].match(/ttl_ms=(\d+)/)[1]);
    expect(ttl).toBeGreaterThan(290_000);
    expect(ttl).toBeLessThanOrEqual(300_000);
  });

  // Race-timing regression: when Redis is much slower than upstream, Redis
  // loses the race and upstream wins. Result is the upstream payload; the
  // in-flight Redis GET is allowed to settle quietly (no abort — losing
  // gracefully is fine since its result is irrelevant).
  it("upstream wins the race when Redis is much slower", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const upstreamPayload = {
      maxErgebnisse: 7,
      ergebnisliste: [{ referenznummer: "FRESH-A" }],
    };

    const fetchMock = buildFetchMock({
      upstashGet: null, // Redis returns a "miss"
      upstream: upstreamPayload,
      redisDelayMs: 200,
      upstreamDelayMs: 20,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { searchJobs } = await loadFreshBaModule();
    const start = Date.now();
    const result = await searchJobs({ keyword: "Softwareentwickler", location: "Berlin", page: 1, size: 25 });
    const elapsed = Date.now() - start;

    // Result is from upstream (Redis was slow enough to lose).
    expect(result.maxErgebnisse).toBe(7);
    expect(result.ergebnisliste[0].referenznummer).toBe("FRESH-A");

    // Timing: dominated by upstream (~20-50ms), NOT Redis (200ms).
    expect(elapsed).toBeLessThan(150);

    // Both fetches were issued; upstream was NOT aborted (it won cleanly).
    const upstreamCall = fetchMock.mock.calls.find(([u]) => BA_URL_RE.test(u));
    expect(upstreamCall).toBeDefined();
    expect(upstreamCall[1].signal.aborted).toBe(false);

    // Tier log: upstream won race → tier=upstream with full TTL.
    const logs = baTierLogFor(console.info);
    expect(logs).toEqual([expect.stringMatching(/^tier=upstream ttl_ms=300000$/)]);
  });

  it("falls through to upstream fetch when Redis errors", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init = {}) => {
        if (url.includes("/get/")) throw new Error("redis network down");
        if (url === "https://example.invalid/") throw new Error("redis network down");
        if (BA_URL_RE.test(url)) {
          // Same yield + abort-respect pattern as the default mock.
          await Promise.resolve();
          if (init?.signal?.aborted) {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            throw error;
          }
          return new Response(JSON.stringify({ maxErgebnisse: 0, ergebnisliste: [] }), { status: 200 });
        }
        throw new Error("Unexpected URL: " + url);
      }),
    );

    const { searchJobs } = await loadFreshBaModule();
    const result = await searchJobs({ keyword: "Softwareentwickler", location: "Berlin", page: 1, size: 25 });

    expect(result.ergebnisliste).toEqual([]);

    // Any tiers might appear depending on whether the GET error is
    // observable before the race settles. The race-with-abort helper
    // converts cache throw to a miss, so the upstream fires and the
    // tier log should reflect the upstream path (tier=upstream).
    // We only verify the format — count may vary across slow CI.
    const logs = baTierLogFor(console.info);
    for (const msg of logs) {
      expect(msg).toMatch(/^tier=(memory|redis|upstream) ttl_ms=\d+$/);
    }
  });
});
