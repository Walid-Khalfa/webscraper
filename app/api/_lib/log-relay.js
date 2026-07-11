// Pure-logic emitter for the client-side log relay. Lives in `_lib/` rather
// than the route file because Next.js App Router enforces a strict export
// shape on `route.js` files: only HTTP method handlers (`POST`, `GET`, …)
// and config named-exports (`runtime`, `dynamic`, `revalidate`) are
// permitted. Exposing `__testables` from the route itself provokes a
// build-time type error ("__testables is not a valid Route export field"),
// so the testable surface lives here and the route imports from this lib.
//
// The re-emission contract is preserved verbatim from the prior route.js
// inline implementation:
//   - per-event level routing (info → logInfo, warn → logWarn, error → logError)
//     so Vercel's drain segments stdout vs stderr and downstream error-metric
//     rollups see the right level.
//   - server-augmented fields (`origin=browser`, optional `client_ts`) are
//     spread AFTER the client-supplied fields so they win on key collision.
//     A hostile client sending `{ fields: { origin: "server" } }` cannot
//     override the server-attributed origin in the unified Vercel drain.

import { logError, logInfo, logWarn } from "./logger.js";

export function reEmit(event) {
  const safeFields = {
    ...(event.fields || {}),
    origin: "browser",
    ...(typeof event.ts === "number" ? { client_ts: event.ts } : {}),
  };

  if (event.level === "info") {
    logInfo(event.prefix, safeFields);
    return;
  }
  const message = event.message || "(browser log)";
  if (event.level === "warn") {
    logWarn(event.prefix, message, safeFields);
    return;
  }
  logError(event.prefix, message, safeFields);
}

// Surface `reEmit` for unit tests. Tests can call `reEmit` directly
// without going through the rate limit + JSON body parse path of the
// route handler. Kept on a regular `_lib/` module (not a Route file)
// so the Next.js App Router type-checker doesn't reject it.
export const __testables = { reEmit };
