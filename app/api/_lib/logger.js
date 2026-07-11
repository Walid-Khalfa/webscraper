// Single source of truth for server-side log lines emitted by `_lib/*`
// modules and API routes. Every helper here produces ONE line per call —
// `[<prefix>] <key>=<value> <key>=<value>` in logfmt shape — so Vercel's
// log drain can parse it without regex hackery and dashboards can group
// by tag (`prefix`) without colliding with structured data.
//
// The logfmt formatting primitives (`formatValue`, `formatFields`,
// `buildInfoLine`, `buildWarnOrErrorLine`) live in
// `/workspaces/webscraper/lib/logger-format.js` so the browser-side parallel
// (`/workspaces/webscraper/components/logger.ts`) can share the same
// implementation. Editing one fixes both surfaces; that's the whole point
// of this refactor.

import {
  buildInfoLine,
  buildWarnOrErrorLine,
  formatFields,
  formatValue,
} from "../../../lib/logger-format.js";

// `.js` extension on the import above is deliberate: `next.config.mjs`
// transitively evaluates `validateStartupEnvironment`, which loads this
// module via Node's strict ESM resolver that does NOT auto-append `.js`.
// Other `_lib/*` modules use extensionless imports because they're loaded
// through webpack (Next's runtime/cli) or Vite (vitest), both of which
// auto-resolve.

/**
 * Emit one structured info-level line to stdout. Use this for cache
 * effectiveness metrics, instrumented startup events, and other
 * observability events where the operator cares about the structured
 * fields more than a free-form message.
 *
 * @example logInfo("ba", { tier: "memory", ttl_ms: 24500 });
 *          // → [ba] tier=memory ttl_ms=24500
 */
export function logInfo(prefix, fields) {
  if (typeof prefix !== "string" || !prefix.length) {
    throw new TypeError("logger.logInfo requires a non-empty prefix string");
  }
  if (!fields || typeof fields !== "object") {
    throw new TypeError("logger.logInfo requires a fields object");
  }
  console.info(buildInfoLine(prefix, fields));
}

/**
 * Emit one warn-level line. `message` is human-readable prose; optional
 * `fields` are appended as `key=value` pairs so dashboards can still
 * segment without regex.
 *
 * @example logWarn("redis", "Upstash request failed, falling back to in-memory", { status: 500, path: "/get/k" });
 *          // → [redis] Upstash request failed, falling back to in-memory status=500 path="/get/k"
 */
export function logWarn(prefix, message, fields = null) {
  if (typeof prefix !== "string" || !prefix.length) {
    throw new TypeError("logger.logWarn requires a non-empty prefix string");
  }
  if (typeof message !== "string") {
    throw new TypeError("logger.logWarn requires a string message");
  }
  console.warn(buildWarnOrErrorLine(prefix, message, fields));
}

/**
 * Emit one error-level line. Same shape as `logWarn` but writes to stderr
 * via `console.error`.
 */
export function logError(prefix, message, fields = null) {
  if (typeof prefix !== "string" || !prefix.length) {
    throw new TypeError("logger.logError requires a non-empty prefix string");
  }
  if (typeof message !== "string") {
    throw new TypeError("logger.logError requires a string message");
  }
  console.error(buildWarnOrErrorLine(prefix, message, fields));
}

// Re-export the shared formatting primitives through this module's test
// surface so the existing `tests/unit/logger.test.js` does not need to be
// rewritten when the shared helper moves or shapes change.
export const __testables = { formatValue, formatFields };
