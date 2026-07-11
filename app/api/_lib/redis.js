import { logWarn } from "./logger";

// Shared Upstash Redis REST client. All functions return `null` in any of:
//   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN env vars are unset
//   - network failure / timeout / non-2xx response
// Callers are responsible for falling back to in-memory storage when `null` is
// returned; the BA search cache and the rate-limit middleware both do.
//
// We deliberately do NOT add the `@upstash/redis` SDK dependency:
//   - REST calls into Upstash are stable and small enough to hand-write
//   - dropping the dep keeps the cold-start surface / package size smaller
//   - the existing rate-limit module already uses raw REST calls
//
// All `fetch` calls honor an 800ms timeout via AbortController so a slow /
// unreachable Redis cannot stall a Vercel function past its budget.

const DEFAULT_TIMEOUT_MS = 800;

function getConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

function isConfigMissing() {
  return getConfig() === null;
}

async function upstashRequest(path, init = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const config = getConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.url}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      logWarn(
        "redis",
        "Upstash request failed, falling back to in-memory",
        { status: response.status, path, details: details.slice(0, 200) },
      );
      return null;
    }

    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      logWarn("redis", "Upstash request timed out, falling back to in-memory", { path });
    } else {
      logWarn("redis", "Upstash request errored, falling back to in-memory", { path, error: error?.message || String(error) });
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- Key-value -----------------------------------------------------------

/**
 * Returns the parsed JSON value at `key`, or `null` on miss / failure / config-missing.
 * Stores JSON in a single string slot; clients pass a typed schema defensively.
 */
export async function getJson(key) {
  if (isConfigMissing()) return null;
  const result = await upstashRequest(`/get/${encodeURIComponent(key)}`);
  if (!result || typeof result.result !== "string" || !result.result.length) return null;
  try {
    return JSON.parse(result.result);
  } catch (error) {
    logWarn("redis", "getJson value not valid JSON, treating as miss", { key, error: error?.message || String(error) });
    return null;
  }
}

/**
 * Stores `value` as JSON at `key` with an absolute TTL in milliseconds.
 * Returns `true` on success, `false` on any failure / config-missing.
 *
 * Uses Upstash's root `POST /` form with a JSON-array command body — this is
 * the canonical, generic way to express any Redis command including TTL
 * options. It also dodges Vercel / NgINX / Upstash URL-length caps (~8 KB)
 * that would otherwise trip up large BA search payloads (100 jobs ≈ 50 KB).
 */
export async function setJson(key, value, ttlMs) {
  if (isConfigMissing()) return false;
  if (!Number.isFinite(Number(ttlMs)) || Number(ttlMs) <= 0) {
    throw new TypeError("redis.setJson requires a positive ttlMs (milliseconds)");
  }
  const body = JSON.stringify([
    "SET",
    String(key),
    JSON.stringify(value),
    "PX",
    Math.round(Number(ttlMs)),
  ]);
  const result = await upstashRequest("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return Boolean(result && (result.result === "OK" || result === "OK"));
}

/**
 * Delete a key. Returns `true` if Upstash reported removal; `false` otherwise.
 * Never throws.
 */
export async function del(key) {
  if (isConfigMissing()) return false;
  const result = await upstashRequest(`/del/${encodeURIComponent(key)}`, { method: "POST" });
  return Boolean(result && typeof result.result === "number" && result.result >= 0);
}

// --- Counters / rate-limit -----------------------------------------------

/**
 * Increment a counter. Returns the post-increment value, or `null` on failure.
 * Combined with `pexpire(key, ms, { NX: true })` to implement sliding-window
 * counters without resetting an existing TTL on every increment.
 *
 * @see {@link incrWithExpire} for an atomic single-call form.
 */
export async function incr(key) {
  if (isConfigMissing()) return null;
  const result = await upstashRequest(`/incr/${encodeURIComponent(key)}`, { method: "POST" });
  if (!result || typeof result.result !== "number") return null;
  return result.result;
}

/**
 * Set a millisecond TTL on `key`. With `nx: true`, refuses to overwrite an
 * existing TTL — useful for sliding-window counters (the first increment sets
 * the window, later increments don't extend it).
 */
export async function pexpire(key, ttlMs, { nx = false } = {}) {
  if (isConfigMissing()) return null;
  const tail = nx ? "/NX" : "";
  const path = `/pexpire/${encodeURIComponent(key)}/${Math.round(Number(ttlMs))}${tail}`;
  const result = await upstashRequest(path, { method: "POST" });
  if (!result || typeof result.result !== "number") return null;
  // Upstash returns 1 on success, 0 if NX rejected. Both indicate "command
  // executed" so we don't filter by value here.
  return result.result;
}

/**
 * Atomic INCR + PEXPIRE-with-NX via Upstash `/pipeline`. Returns the
 * post-increment counter value, or `null` on any failure.
 *
 * This is the preferred form for rate-limit sliding windows because it
 * eliminates the orphan-bucket race condition (a transient failure between the
 * increment and the pexpire calls would leave a counter without TTL).
 *
 * @see https://upstash.com/docs/redis/features/pipeline
 */
export async function incrWithExpire(key, ttlMs) {
  if (isConfigMissing()) return null;
  if (!Number.isFinite(Number(ttlMs)) || Number(ttlMs) <= 0) {
    throw new TypeError("redis.incrWithExpire requires a positive ttlMs (milliseconds)");
  }
  const body = JSON.stringify([
    ["INCR", key],
    ["PEXPIRE", key, Math.round(Number(ttlMs)), "NX"],
  ]);
  const result = await upstashRequest("/pipeline", {
    method: "POST",
    body,
  });
  if (!result || !result.result || !Array.isArray(result.result)) return null;
  // Upstash /pipeline returns { result: [...] } — a flat array of raw
  // command outputs (not nested [command, value] tuples). The first command
  // is INCR, so result.result[0] is the post-increment count.
  // See https://docs.upstash.com/redis/features/pipeline
  const count = result.result[0];
  if (typeof count !== "number") return null;
  return count;
}

// --- Introspection (test/diagnostics) ------------------------------------

/**
 * Returns the cached config (or null). Used for diagnostics / tests to assert
 * the active configuration without exposing secrets. Never log or surface in
 * operator messages — secrets leak risk.
 */
export function _getConfigForDiagnostics() {
  const c = getConfig();
  if (!c) return null;
  return { url: c.url, token: c.token.slice(0, 4) + "…" };
}
