// Browser-side parallel of `app/api/_lib/logger.js`. Same single-line logfmt
// shape so a unified Vercel log drain can group `[browser]` and `[server]`
// events without per-side custom parsing.
//
// Beyond emitting to DevTools via `console.*`, each emit is ALSO relayed to
// `/api/logs` so the unified server-side drain captures browser events
// alongside server-local ones. Transport strategy:
//
//   - level === "error" AND `navigator.sendBeacon` is available in this
//     browser:
//     use sendBeacon with a `Blob` typed `application/json`. Beacon
//     delivery is best-effort but survives page-unload (`pagehide`,
//     beforeunload), which is exactly when the most-valuable
//     observability events (uncaught exceptions, error-boundary catches)
//     tend to fire.
//   - otherwise (info/warn, OR error without beacon):
//     use `fetch()` with `keepalive: true`. keepalive lets the request
//     survive a same-tab navigation away from the current page; without
//     it the browser cancels in-flight fetches on unload.
//
// Both paths are fire-and-forget. We swallow the rejection on fetch
// because the relayed event is best-effort — the server's 60 events/min/IP
// rate limit and the strict `clientLogEventSchema` are the backstops, and
// the caller should not block on observability.
//
// The shared formatter `/workspaces/webscraper/lib/logger-format.js`
// provides `formatValue`, `formatFields`, `buildInfoLine`, and
// `buildWarnOrErrorLine` so the server logger and this one never drift
// on edge cases (NaN, circular refs, whitespace escaping).

import {
  buildInfoLine,
  buildWarnOrErrorLine,
  formatFields,
  formatValue,
} from "../lib/logger-format";

// Extensionless import above is intentional: TS via Vite/Next.js resolves
// `../lib/logger-format` to `../lib/logger-format.js` automatically. The
// server logger's `.js`-extension import is needed only for the
// next.config.mjs strict-ESM chain (Node native).

export type LogFields = Record<string, unknown> | undefined;

type WireLevel = "info" | "warn" | "error";

interface WireLogEvent {
  level: WireLevel;
  prefix: string;
  message?: string;
  fields: LogFields;
  ts?: number;
}

/**
 * Fresh feature-detection: evaluates at call time so test-mocks of
 * `navigator.sendBeacon` (or runtime feature-flag toggles) are honored
 * even if the module was first imported in a different environment.
 */
function detectSendBeacon(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function";
}

/**
 * Public feature-detection flag (snapshot at module load).
 *
 * `true` when the running environment has a working `navigator.sendBeacon`.
 * When true, error-level emits prefer beacon (so they survive page-unload).
 * When false, all emits fall through to `fetch()` with `keepalive`.
 *
 * Components / tests can branch on this for support diagnostics. The
 * module's transport path uses a fresh `detectSendBeacon()` check at
 * each call so a runtime feature change (e.g. test mock) takes effect
 * immediately rather than being frozen at module-load.
 *
 * @example
 *   if (NAVIGATOR_SEND_BEACON) {
 *     // browser supports beacon — error fidelity guaranteed over unload
 *   }
 */
export const NAVIGATOR_SEND_BEACON = detectSendBeacon();

// Path on the server-side relay. Same-origin enforced via the route's
// missing CORS headers; keepalive only works on same-origin POSTs.
const RELAY_URL = "/api/logs";

/**
 * Internal: relay a single event to `/api/logs`. No-op in non-browser
 * environments (SSR, plain Node scripts) where `window` is undefined.
 *
 * Exposed via `__testables` so the unit test can drive the transport
 * decision (beacon vs fetch) without going through the public logX path.
 */
function postEvent(event: WireLogEvent): void {
  // SSR / Node-script safety: skip relay entirely if there is no fetch.
  // Without this guard an SSR-rendered component that fires a logError
  // would crash the request with `window is not defined`.
  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }

  const body = JSON.stringify({ events: [event] });

  // Path 1: error level + beacon available. Survives page-unload.
  // Re-detect at call time (not via the cached module-load constant)
  // so test mocks and runtime feature toggles can flip the path.
  if (event.level === "error" && detectSendBeacon()) {
    try {
      // Wrap in a Blob typed `application/json` so the server's
      // `await request.json()` parses correctly (sendBeacon defaults to
      // `text/plain` if you pass a raw string, which would still parse
      // but is technically incorrect content-type).
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(RELAY_URL, blob);
      return;
    } catch {
      // Old browsers / edge cases where Blob or sendBeacon throws.
      // Fall through to the fetch path below.
    }
  }

  // Path 2: keepalive fetch — survives in-tab navigation, not hard unload.
  void fetch(RELAY_URL, {
    method: "POST",
    body,
    keepalive: true,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  }).catch(() => {
    // Suppress unhandled-rejection noise. The server rate-limits at
    // 60 events/min/IP; one dropped event is just one dropped line.
  });
}

/**
 * Tag-stamping helper. Use this at every browser callsite so the line emits
 * as `[browser-<tag>] …` — keeps a unified drain able to group `[browser]`
 * vs `[server]` events without second-guessing which side produced the line.
 *
 * Refuses re-stamping when the caller already passed a tag beginning with
 * `browser-` to prevent `[browser-browser-…]` accidents during refactors.
 *
 * @example logWarn(clientPrefix("jobmap"), "Geocoding failed", { city });
 *          // → [browser-jobmap] Geocoding failed city="Berlin"
 */
export function clientPrefix(tag: string): string {
  if (typeof tag !== "string" || !tag.length) {
    throw new TypeError("clientPrefix requires a non-empty string tag");
  }
  if (tag.startsWith("browser-")) {
    throw new TypeError(
      `clientPrefix received "${tag}" — already starts with "browser-"; pass the unprefixed tag instead`,
    );
  }
  return `browser-${tag}`;
}

/**
 * Emit one structured info-level line to DevTools AND relay to `/api/logs`.
 * Use sparingly — most user actions are analytics track-worthy, not
 * logger-worthy.
 */
export function logInfo(prefix: string, fields: LogFields): void {
  if (typeof prefix !== "string" || !prefix.length) {
    throw new TypeError("logger.logInfo requires a non-empty prefix string");
  }
  if (!fields || typeof fields !== "object") {
    throw new TypeError("logger.logInfo requires a fields object");
  }
  console.info(buildInfoLine(prefix, fields));
  postEvent({ level: "info", prefix, fields });
}

/**
 * Emit one warn-level line and relay. Prose message + optional logfmt fields.
 */
export function logWarn(prefix: string, message: string, fields: LogFields = undefined): void {
  if (typeof prefix !== "string" || !prefix.length) {
    throw new TypeError("logger.logWarn requires a non-empty prefix string");
  }
  if (typeof message !== "string") {
    throw new TypeError("logger.logWarn requires a string message");
  }
  console.warn(buildWarnOrErrorLine(prefix, message, fields));
  postEvent({ level: "warn", prefix, message, fields });
}

/**
 * Emit one error-level line and relay via sendBeacon (when available) so
 * the event survives page-unload. Same shape as `logWarn` but writes via
 * `console.error` so error-tracking browser extensions (Sentry, etc.) pick
 * up the level correctly.
 */
export function logError(prefix: string, message: string, fields: LogFields = undefined): void {
  if (typeof prefix !== "string" || !prefix.length) {
    throw new TypeError("logger.logError requires a non-empty prefix string");
  }
  if (typeof message !== "string") {
    throw new TypeError("logger.logError requires a string message");
  }
  console.error(buildWarnOrErrorLine(prefix, message, fields));
  postEvent({ level: "error", prefix, message, fields });
}

// Exposed for the unit test so it can exercise the building blocks without
// an attached `console.*` spy — keeping the production surface minimal while
// still letting tests verify edge-case behavior.
export const __testables = {
  formatValue,
  formatFields,
  clientPrefix,
  postEvent,
  NAVIGATOR_SEND_BEACON,
};
