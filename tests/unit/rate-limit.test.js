import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertRateLimit } from "../../app/api/_lib/rate-limit";

function makeRequest(ip = "127.0.0.1") {
  return {
    headers: {
      get(name) {
        if (name === "x-forwarded-for") return ip;
        return null;
      },
    },
  };
}

function buildUpstashPipelineResponse(nextCount) {
  // Upstash /pipeline returns { result: [...] } — a flat array of raw command
  // outputs, NOT nested [command, value] tuples. The order matches the body.
  // See https://docs.upstash.com/redis/features/pipeline
  return {
    result: [nextCount, 1],
  };
}

function mockUpstashPipelineSuccess() {
  let count = 0;
  return vi.fn(async (url, init) => {
    if (!url.endsWith("/pipeline")) {
      throw new Error("Unexpected URL in test: " + url);
    }
    count += 1;
    return new Response(JSON.stringify(buildUpstashPipelineResponse(count)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("assertRateLimit", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Note: clearing (not `delete`-ing) the globalThis map keeps the
    // __khalfaRateLimitBuckets reference alive — rate-limit.js captures
    // it into a module-local `const buckets` at module init. If we delete
    // the globalThis entry, the module holds the stale Map (with buckets
    // from previous tests) and clear() on undefined is a no-op.
    globalThis.__khalfaRateLimitBuckets?.clear?.();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.__khalfaRateLimitBuckets?.clear?.();
    vi.unstubAllGlobals();
  });

  it("allows requests under the configured limit (in-memory fallback)", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const request = makeRequest();
    await expect(assertRateLimit(request, "search", { max: 2, windowMs: 60_000 })).resolves.toBeUndefined();
    await expect(assertRateLimit(request, "search", { max: 2, windowMs: 60_000 })).resolves.toBeUndefined();
  });

  it("blocks requests above the configured limit (in-memory fallback)", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const request = makeRequest();
    await assertRateLimit(request, "search", { max: 1, windowMs: 60_000 });
    await expect(assertRateLimit(request, "search", { max: 1, windowMs: 60_000 })).rejects.toThrow(/Zu viele Anfragen/i);
  });

  it("hits Upstash /pipeline when UPSTASH env is set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const fetchMock = mockUpstashPipelineSuccess();
    vi.stubGlobal("fetch", fetchMock);

    const request = makeRequest();
    await assertRateLimit(request, "search", { max: 5, windowMs: 60_000 });
    await assertRateLimit(request, "search", { max: 5, windowMs: 60_000 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain("https://example.invalid/pipeline");
    expect(calledInit.method).toBe("POST");
    expect(calledInit.headers.Authorization).toBe("Bearer test-token");

    const body = JSON.parse(calledInit.body);
    expect(body).toHaveLength(2);
    expect(body[0][0]).toBe("INCR");
    expect(body[0][1]).toMatch(/^rl:search:/);
    expect(body[1][0]).toBe("PEXPIRE");
    expect(body[1][1]).toBe(body[0][1]);
    expect(body[1][2]).toBe(60_000);
    expect(body[1][3]).toBe("NX");
  });

  it("falls back silently to in-memory when Upstash request errors", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));

    const request = makeRequest();
    await expect(assertRateLimit(request, "search", { max: 2, windowMs: 60_000 })).resolves.toBeUndefined();
    await expect(assertRateLimit(request, "search", { max: 2, windowMs: 60_000 })).resolves.toBeUndefined();
    await expect(assertRateLimit(request, "search", { max: 2, windowMs: 60_000 })).rejects.toThrow(/Zu viele Anfragen/i);
  });

  it("tracks counter across calls under and over the limit", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const request = makeRequest();
    await expect(assertRateLimit(request, "search", { max: 3, windowMs: 60_000 })).resolves.toBeUndefined();
    await expect(assertRateLimit(request, "search", { max: 3, windowMs: 60_000 })).resolves.toBeUndefined();
    await expect(assertRateLimit(request, "search", { max: 3, windowMs: 60_000 })).resolves.toBeUndefined();
    await expect(assertRateLimit(request, "search", { max: 3, windowMs: 60_000 })).rejects.toThrow(/Zu viele Anfragen/i);
  });

  // Semantic regression: the parsed counter from Upstash /pipeline must
  // actually gate rate-limit decisions. Any future regression that silently
  // returns null (e.g. wrong envelope unwrap, wrong field) would fall back
  // to the in-memory bucket below, which is pre-seeded with a count that
  // would reject every call — so the test can only pass if Redis is
  // actually driving the counter.
  it("gates rate-limit decisions on the counter returned by Upstash /pipeline", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    // Seed the in-memory fallback with a count so high that any call hitting
    // the fallback path would immediately reject. The bucket key matches
    // rate-limit.js's `${scope}:${clientIp}:${keySuffix}` shape.
    const buckets = globalThis.__khalfaRateLimitBuckets ?? new Map();
    globalThis.__khalfaRateLimitBuckets = buckets;
    buckets.set("search:127.0.0.1:", { count: 9999, resetAt: Date.now() + 60_000 });

    const fetchMock = mockUpstashPipelineSuccess();
    vi.stubGlobal("fetch", fetchMock);

    const request = makeRequest();
    // Mock returns {result:[1,1]}, {result:[2,1]}, {result:[3,1]}. With
    // max=2, calls #1 and #2 resolve (count ≤ max) and call #3 rejects.
    await expect(assertRateLimit(request, "search", { max: 2, windowMs: 60_000 })).resolves.toBeUndefined();
    await expect(assertRateLimit(request, "search", { max: 2, windowMs: 60_000 })).resolves.toBeUndefined();
    await expect(assertRateLimit(request, "search", { max: 2, windowMs: 60_000 })).rejects.toThrow(/Zu viele Anfragen/i);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
