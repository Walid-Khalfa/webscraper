// Shared logfmt formatting primitives for both the server and client loggers.
// Extracted to a single source of truth so a future fix (NaN handling,
// circular refs, whitespace escaping, logfmt `=` boundary rules, …) lands
// in one place instead of drifting between two parallel implementations.
//
// Pure, zero-deps, no console.* calls — safe to import from anywhere
// (Node ESM strict mode, webpack, Vite) without special-case prelude.
//
// Consumers:
//   - /workspaces/webscraper/app/api/_lib/logger.js  (server; uses .js extension)
//   - /workspaces/webscraper/components/logger.ts    (client/React; extensionless)
//
// We deliberately keep this in JS rather than TS because the server logger
// itself is .js (no TS consumers), and a shared `.ts` helper would force
// both surfaces to import across the JS/TS boundary for no real benefit.
// JSDoc `@param` tags below document the contract; TypeScript honors them
// only when `checkJs: true` is enabled. Each consumer's surface API is
// responsibly-typed at its `.ts` boundary.

/**
 * Coerce any value into a logfmt-safe string fragment.
 *
 * - `undefined`  → `undefined` (caller-side filter; use to skip the field)
 * - `null`       → `"null"`
 * - finite number / boolean → raw `String(value)`
 * - non-finite number (`NaN`, `Infinity`) → `"null"` (avoid corrupt log lines)
 * - string with whitespace, `"`, or `=` → JSON-encoded (parser-safe)
 * - other string → raw
 * - array / object / cyclic → best-effort `JSON.stringify` (cyclic → `"null"`)
 *
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function formatValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return "null";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") {
    // Whitespace, double quote, or `=` in a value would break the logfmt
    // parser that the Vercel drain uses; fall back to JSON so the value is
    // still queryable (escaped, but unambiguous).
    if (/[\s"=]/.test(value)) return JSON.stringify(value);
    return value;
  }
  // Arrays + objects + Map/Set always serialize via JSON.
  try {
    return JSON.stringify(value);
  } catch {
    return "null";
  }
}

/**
 * Build a `key=value key=value …` pair string from a fields object.
 * Filters out any field whose value coerces to `undefined` so callers
 * can pass `{ tier: maybeTier, ttl: maybeTtl }` without worrying about
 * empty entries poisoning the output.
 *
 * @param {Record<string, unknown> | null | undefined} fields
 * @returns {string}
 */
export function formatFields(fields) {
  if (!fields || typeof fields !== "object") return "";
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    const formatted = formatValue(value);
    if (formatted === undefined) continue;
    parts.push(`${key}=${formatted}`);
  }
  return parts.join(" ");
}

/**
 * Build the body of a `[<prefix>] <kv>` info-level line. Returns just the
 * tag (`[<prefix>]`) when there are no fields to render.
 *
 * @param {string} prefix
 * @param {Record<string, unknown> | null | undefined} fields
 * @returns {string}
 */
export function buildInfoLine(prefix, fields) {
  const body = formatFields(fields);
  return body ? `[${prefix}] ${body}` : `[${prefix}]`;
}

/**
 * Build `[<prefix>] <message> [kv kv …]` for warn/error levels. When there
 * are no structured fields, the line is `[<prefix>] <message>`.
 *
 * @param {string} prefix
 * @param {string} message
 * @param {Record<string, unknown> | null | undefined} fields
 * @returns {string}
 */
export function buildWarnOrErrorLine(prefix, message, fields) {
  const tail = formatFields(fields);
  return tail ? `[${prefix}] ${message} ${tail}` : `[${prefix}] ${message}`;
}
