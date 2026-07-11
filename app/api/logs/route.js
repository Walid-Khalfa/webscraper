// Client-side log relay — POST `/api/logs` accepts a batch of log events
// emitted by the browser-side `components/logger.ts` and re-emits each one
// via the server `app/api/_lib/logger.js`. The re-emitted lines flow to
// stdout/stderr and Vercel's log drain auto-collects them, so a unified drain
// sees BOTH `[browser-*]` (relayed) and `<server-prefix>` (server-local)
// events without regex extraction.
//
// Defense-in-depth:
//   - `assertRateLimit` (60 events/min/IP) caps amplified relay.
//   - `clientLogEventSchema`-required `browser-` prefix invariant refuses
//     events that don't claim a browser origin (so a forged `[ba] …` line
//     can't impersonate a server event).
//   - Strictly flat `fields` schema — nested JSON would JSON.stringify to
//     multi-line blobs that defeat logfmt's single-line invariant and lock
//     the request thread on cyclic inputs.
//   - No CORS headers — the browser's own same-origin enforcement blocks
//     cross-origin POSTs at the preflight layer; Node-side scripts can
//     POST but are rate-limited and prefix-checked.
//
// We deliberately do NOT add a shared-secret token here. Same-origin +
// rate-limit + prefix-invariant is sufficient for v1; v2 could layer HMAC.

import { errorResponse, json } from "../_lib/http";
import { assertRateLimit } from "../_lib/rate-limit";
import { reEmit } from "../_lib/log-relay";
import { parseWithSchema, clientLogsBatchSchema } from "../_lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    await assertRateLimit(request, "client-log-relay", {
      max: 60,
      windowMs: 60_000,
    });
    const body = parseWithSchema(clientLogsBatchSchema, await request.json());
    for (const event of body.events) {
      reEmit(event);
    }
    return json({ accepted: body.events.length });
  } catch (error) {
    return errorResponse(error);
  }
}
