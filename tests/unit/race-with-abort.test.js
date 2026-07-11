import { describe, expect, it } from "vitest";
import { raceCacheWithFetch } from "../../app/api/_lib/race-with-abort";

// A "fetchStart" that simulates a fetch with optional delay and abort handling.
function makeFetch({ value = "fetch-payload", delayMs = 0, returnNullOnAbort = true } = {}) {
  return async (signal) => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (signal.aborted && returnNullOnAbort) return null;
    if (signal.aborted) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    return value;
  };
}

describe("raceCacheWithFetch", () => {
  it("returns cache hit and aborts the speculative fetch", async () => {
    let fetchAbortFired = false;
    const cacheRead = async () => "cache-payload";
    const fetchStart = (signal) => {
      signal.addEventListener("abort", () => { fetchAbortFired = true; });
      return makeFetch({ value: "fetch-payload", delayMs: 200 })(signal);
    };

    const result = await raceCacheWithFetch(cacheRead, fetchStart);

    expect(result.source).toBe("cache");
    expect(result.value).toBe("cache-payload");
    expect(fetchAbortFired).toBe(true);

    // fetchPromise is normalized: AbortError → null (not throws)
    await expect(result.fetchPromise).resolves.toBeNull();
  });

  it("returns fetch value when fetch wins outright", async () => {
    // Fetch is FAST and cache is SLOW (with a miss); fetch wins the race.
    // This is the actual "fetch wins" semantic — distinct from "cache missed
    // and we had to fall through to the in-flight fetch" (covered separately).
    const cacheRead = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return null;
    };
    const fetchStart = makeFetch({ value: "fetch-payload", delayMs: 5 });

    const result = await raceCacheWithFetch(cacheRead, fetchStart);

    expect(result.source).toBe("fetch");
    expect(result.value).toBe("fetch-payload");
    await expect(result.fetchPromise).resolves.toBe("fetch-payload");
  });

  it("falls through to fetch when cache misses (race resolved with cache=null)", async () => {
    // Cache "misses" fast, fetch is slow — race resolves with cache+null,
    // then we await the still-in-flight fetch via fetchPromise.
    const cacheRead = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return null;
    };
    const fetchStart = makeFetch({ value: "fetch-payload", delayMs: 50 });

    const result = await raceCacheWithFetch(cacheRead, fetchStart);

    expect(result.source).toBe("cache");
    expect(result.value).toBeNull();
    // fetchPromise surfaces the not-yet-finished fetch's real value
    await expect(result.fetchPromise).resolves.toBe("fetch-payload");
  });

  it("recovers via cache hit when fetch rejects before cache settles", async () => {
    // Fetch rejects fast; cache (slow but valid) eventually returns a hit.
    // Helper catches fetch error and waits for cache.
    const cacheRead = async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "cache-payload";
    };
    const fetchStart = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error("real fetch error");
    };

    const result = await raceCacheWithFetch(cacheRead, fetchStart);

    expect(result.source).toBe("cache");
    expect(result.value).toBe("cache-payload");
  });

  it("rethrows fetch error when fetch rejects AND cache misses", async () => {
    const cacheRead = async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return null;
    };
    const fetchStart = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error("real fetch error");
    };

    await expect(raceCacheWithFetch(cacheRead, fetchStart)).rejects.toThrow(/real fetch error/);
  });

  it("treats thrown cacheRead errors as misses (lets fetch win)", async () => {
    const cacheRead = async () => {
      throw new Error("cache blew up");
    };
    const fetchStart = makeFetch({ value: "fetch-payload" });

    const result = await raceCacheWithFetch(cacheRead, fetchStart);

    expect(result.source).toBe("fetch");
    expect(result.value).toBe("fetch-payload");
  });

  it("fetchPromise swallows AbortError even when fetch throws raw abort", async () => {
    const cacheRead = async () => "cache-payload";
    const fetchStart = makeFetch({ returnNullOnAbort: false, delayMs: 200 });

    const result = await raceCacheWithFetch(cacheRead, fetchStart);

    expect(result.value).toBe("cache-payload");
    // Aborted fetch throws raw AbortError; helper absorbs it to null.
    await expect(result.fetchPromise).resolves.toBeNull();
  });
});
