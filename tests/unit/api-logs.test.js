import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We mock rate-limit so tests don't depend on Redis (assertRateLimit would
// otherwise hit incrWithExpire). The relay route is tested on the body
// parse + per-event re-emission contract.
vi.mock("../../app/api/_lib/rate-limit.js", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

// Imports go BELOW the vi.mock so vitest resolves the mocked module.
const { POST } = await import("../../app/api/logs/route.js");
const { reEmit } = await import("../../app/api/_lib/log-relay.js");

function makeRequest(body, headers = {}) {
  return new Request("http://localhost/api/logs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      ...headers,
    },
  });
}

describe("client log relay", () => {
  let infoSpy;
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    infoSpy.mockClear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnSpy.mockClear();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("reEmit (per-event contract)", () => {
    it("emits an info-level event through console.info in logfmt shape with origin=browser", () => {
      // Field order in the emitted line: client fields first, then
      // server-augmented fields (`origin=browser`, optional `client_ts`).
      // Server fields are spread after client spread so they win on key
      // collision, which is why `origin=browser` always appears last.
      reEmit({ level: "info", prefix: "browser-jobmap", fields: { layer: "tile", tiles_loaded: 42 } });
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0][0]).toBe(
        "[browser-jobmap] layer=tile tiles_loaded=42 origin=browser",
      );
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("emits a warn-level event through console.warn and routes message into the prose slot", () => {
      // Use a city name with whitespace so formatValue quotes it -- this
      // exercises the JSON.stringify branch of formatterValue and proves
      // the line stays a single logfmt-parseable record.
      reEmit({ level: "warn", prefix: "browser-jobmap", message: "Geocoding failed", fields: { city: "Berlin Mitte" } });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toBe(
        '[browser-jobmap] Geocoding failed city="Berlin Mitte" origin=browser',
      );
      expect(infoSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("emits an error-level event through console.error", () => {
      reEmit({
        level: "error",
        prefix: "browser-ui-boundary",
        message: "React error boundary caught",
        fields: { error_message: "Cannot read property 'x' of undefined" },
      });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toBe(
        '[browser-ui-boundary] React error boundary caught error_message="Cannot read property \'x\' of undefined" origin=browser',
      );
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("forwards client_ts as a field when the client provides a timestamp", () => {
      reEmit({ level: "info", prefix: "browser-x", fields: {}, ts: 1715000000000 });
      const line = infoSpy.mock.calls[0][0];
      expect(line).toMatch(/client_ts=1715000000000/);
    });

    it("omits client_ts when the client omits the timestamp", () => {
      reEmit({ level: "info", prefix: "browser-x", fields: {} });
      expect(infoSpy.mock.calls[0][0]).not.toMatch(/client_ts/);
    });

    it("falls back to '(browser log)' message when warn/error omits message", () => {
      reEmit({ level: "warn", prefix: "browser-x", fields: {} });
      expect(warnSpy.mock.calls[0][0]).toBe("[browser-x] (browser log) origin=browser");
    });

    it("server-augmented origin=browser always wins over a client-supplied origin field", () => {
      // The schema accepts arbitrary string keys, so a hostile client
      // could send `{ origin: "server" }` to evade origin=browser filters.
      // Spread order in reEmit must put server fields AFTER client spread
      // so the filter attribution stays accurate in the unified drain.
      reEmit({ level: "info", prefix: "browser-x", fields: { origin: "server" } });
      const line = infoSpy.mock.calls[0][0];
      expect(line).toContain("origin=browser");
      expect(line).not.toContain('origin="server"');
      expect(line).not.toContain("origin=server");
    });
  });

  describe("POST /api/logs (route-level)", () => {
    it("accepts a multi-event batch and re-emits each in input order", async () => {
      const res = await POST(makeRequest({
        events: [
          { level: "info", prefix: "browser-jobmap", fields: { layer: "tile" } },
          { level: "error", prefix: "browser-ui-boundary", message: "Caught", fields: {} },
        ],
      }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ accepted: 2 });
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("returns the same-prefix line shape that `components/logger.ts` would emit on the client", async () => {
      // The unified-drain contract: the server-relayed line and the
      // client-direct line carry the same structured data (modulo the
      // server-added `origin=browser` field). Drain queries on
      // `prefix="browser-jobmap"` capture both sides regardless of
      // whether `origin=browser` appears before or after the client fields.
      await POST(makeRequest({
        events: [{
          level: "warn",
          prefix: "browser-jobmap",
          message: "Geocoding failed",
          fields: { city: "Berlin Mitte" },
        }],
      }));
      // Client direct:  `[browser-jobmap] Geocoding failed city="Berlin Mitte"`
      // Server relay:   `[browser-jobmap] Geocoding failed city="Berlin Mitte" origin=browser`
      // Same data; the only difference is the server-augmented `origin`
      // marker appended at the end (after the client-field spread).
      expect(warnSpy.mock.calls[0][0]).toBe(
        '[browser-jobmap] Geocoding failed city="Berlin Mitte" origin=browser',
      );
    });

    it("returns 400 with VALIDATION_ERROR code when the prefix does not start with `browser-`", async () => {
      const res = await POST(makeRequest({
        events: [{ level: "info", prefix: "ba" }],
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it("returns 400 when `level` is not one of info|warn|error", async () => {
      const res = await POST(makeRequest({
        events: [{ level: "debug", prefix: "browser-x" }],
      }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when the events array is empty", async () => {
      const res = await POST(makeRequest({ events: [] }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when the batch exceeds 50 events", async () => {
      const hugeEvents = Array.from({ length: 51 }).map((_, i) => ({
        level: "info",
        prefix: `browser-x${i}`,
        fields: {},
      }));
      const res = await POST(makeRequest({ events: hugeEvents }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when the client ts is in the future", async () => {
      const res = await POST(makeRequest({
        events: [{ level: "info", prefix: "browser-x", fields: {}, ts: Date.now() + 10_000_000 }],
      }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when a field value would exceed the 200-char cap", async () => {
      const res = await POST(makeRequest({
        events: [{
          level: "info",
          prefix: "browser-x",
          fields: { bad: "x".repeat(201) },
        }],
      }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when a field value is a nested object (rejected by flat-only schema)", async () => {
      // The Zod schema rejects nested objects at parse time before we
      // ever reach the route's per-event loop, so `infoSpy` should never
      // be called for malformed payloads.
      const res = await POST(makeRequest({
        events: [{
          level: "info",
          prefix: "browser-x",
          fields: { nested: { foo: 1 } },
        }],
      }));
      expect(res.status).toBe(400);
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });
});
