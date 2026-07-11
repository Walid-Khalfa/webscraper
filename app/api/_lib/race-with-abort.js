// Race a cache lookup against a speculative fetch (started under a fresh
// AbortController) so a hot cache hit cancels the in-flight fetch. Generic
// enough to be used by any cache+fetch pair, not just the BA search cache.
//
// Semantics:
//   - cacheRead()  returns T | null. `null` means miss.
//   - fetchStart(signal) returns T. Implementations should tolerate signal
//     aborts by returning `null` (or throwing an AbortError), so the helper
//     can expose a single normalized fetchPromise the caller can `await`
//     regardless of who won the race.
//
// Returns a normalized record: `{ source, value, fetchPromise }`.
//   - source="cache",  value=T (hit)   → fetch was / is being aborted.
//   - source="cache",  value=null (miss) → fetch is still in flight;
//                                        await fetchPromise.
//   - source="fetch",  value=T          → fetch won outright.
//
// fetchPromise always resolves to T or `null` (and never throws AbortError
// because the helper absorbs that case). It still rethrows non-abort errors.
//
// On a fetch rejection BEFORE the cache settles, the helper retries the
// cache one last time; if the cache now reports a hit it is returned,
// otherwise the original fetch error is rethrown.

/**
 * @template T
 * @param {() => Promise<T | null>} cacheRead
 * @param {(signal: AbortSignal) => Promise<T>} fetchStart
 * @returns {Promise<
 *   { source: "cache" | "fetch", value: T | null, fetchPromise: Promise<T | null> }
 * >}
 */
export async function raceCacheWithFetch(cacheRead, fetchStart) {
  const abortController = new AbortController();
  const fetchPromise = fetchStart(abortController.signal);

  // Normalize fetch: return `null` on signal-aborts, rethrow everything else.
  const safeFetch = fetchPromise.then(
    (value) => value,
    (error) => {
      if (error?.name === "AbortError" && abortController.signal.aborted) return null;
      throw error;
    },
  );

  // Wrap cacheRead so a thrown cache error becomes a miss in the race — we
  // want a cache failure to behave like "miss, fall through to fetch"
  // rather than letting Promise.race reject.
  const safeCache = (async () => {
    try { return await cacheRead(); } catch { return null; }
  })();

  try {
    const winner = await Promise.race([
      safeCache.then((value) => ({ source: "cache", value })),
      safeFetch.then((value) => ({ source: "fetch", value })),
    ]);

    if (winner.source === "cache" && winner.value !== null) {
      // Cache hit — cancel the speculative fetch.
      abortController.abort();
    }

    return { ...winner, fetchPromise: safeFetch };
  } catch (error) {
    // Fetch errored before the cache settled. Give the cache one more shot.
    abortController.abort();
    const cached = await safeCache;
    if (cached !== null) {
      return { source: "cache", value: cached, fetchPromise: safeFetch };
    }
    throw error;
  }
}
