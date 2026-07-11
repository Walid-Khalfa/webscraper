import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clientPrefix,
  logError,
  logInfo,
  logWarn,
  __testables,
} from "../../components/logger";

const { formatValue, formatFields, postEvent, NAVIGATOR_SEND_BEACON } = __testables;

// We use a fresh spy per test AND clear the accumulator via mockClear() so
// test isolation doesn't depend on the global mock state.

function spyConsoleMethod(method) {
  const spy = vi.spyOn(console, method).mockImplementation(() => {});
  spy.mockClear();
  return spy;
}

describe("client logger", () => {
  describe("clientPrefix", () => {
    it("stamps a `browser-` prefix so a unified drain can group client events", () => {
      expect(clientPrefix("jobmap")).toBe("browser-jobmap");
      expect(clientPrefix("ui-boundary")).toBe("browser-ui-boundary");
    });

    it("rejects missing or empty tag", () => {
      expect(() => clientPrefix("")).toThrow(TypeError);
      expect(() => clientPrefix(null)).toThrow(TypeError);
    });
  });

  describe("logInfo / logWarn / logError", () => {
    let infoSpy;
    let warnSpy;
    let errorSpy;

    beforeEach(() => {
      infoSpy = spyConsoleMethod("info");
      warnSpy = spyConsoleMethod("warn");
      errorSpy = spyConsoleMethod("error");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("logInfo emits via console.info in the same logfmt shape as the server logger", () => {
      logInfo(clientPrefix("jobmap"), { layer: "tile", tiles_loaded: 42 });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0][0]).toBe("[browser-jobmap] layer=tile tiles_loaded=42");
    });

    it("logWarn splits operator-readable prose from structured fields", () => {
      logWarn(clientPrefix("jobmap"), "Geocoding failed", {
        city: "Berlin Mitte",
        error_message: "rate limit",
      });

      expect(warnSpy.mock.calls[0][0]).toBe('[browser-jobmap] Geocoding failed city="Berlin Mitte" error_message="rate limit"');
    });

    it("logWarn emits prose-only when no fields are passed", () => {
      logWarn(clientPrefix("ui-boundary"), "Section un-mounted");

      expect(warnSpy.mock.calls[0][0]).toBe("[browser-ui-boundary] Section un-mounted");
    });

    it("logError emits via console.error with the same shape as logWarn", () => {
      logError(clientPrefix("ui-boundary"), "React error boundary caught", {
        error_message: "Cannot read property 'x' of undefined",
        error_name: "TypeError",
        component_stack: "    at Component\n    at render",
      });

      expect(errorSpy.mock.calls[0][0]).toBe(
        '[browser-ui-boundary] React error boundary caught error_message="Cannot read property \'x\' of undefined" error_name=TypeError component_stack="    at Component\\n    at render"',
      );
    });

    it("rejects non-object fields", () => {
      expect(() => logInfo(clientPrefix("x"), null)).toThrow(TypeError);
      expect(() => logInfo(clientPrefix("x"), "plain string")).toThrow(TypeError);
    });

    it("rejects non-string message on logWarn / logError", () => {
      expect(() => logWarn(clientPrefix("x"), null)).toThrow(TypeError);
      expect(() => logError(clientPrefix("x"), { kind: "obj" })).toThrow(TypeError);
    });

    it("emits a single tag line when fields are empty", () => {
      logInfo(clientPrefix("empty"), {});

      expect(infoSpy.mock.calls[0][0]).toBe("[browser-empty]");
    });
  });

  describe("formatValue edge cases", () => {
    const { formatValue } = __testables;

    it("JSON-encodes whitespace/quote/= inside strings so the logfmt boundaries stay clean", () => {
      expect(formatValue("plain")).toBe("plain");
      expect(formatValue("has space")).toBe('"has space"');
      expect(formatValue('has"quote')).toBe('"has\\"quote"');
      expect(formatValue("has=equals")).toBe('"has=equals"');
    });

    it("renders numbers and booleans safely", () => {
      expect(formatValue(0)).toBe("0");
      expect(formatValue(42)).toBe("42");
      expect(formatValue(true)).toBe("true");
      expect(formatValue(false)).toBe("false");
      expect(formatValue(NaN)).toBe("null");
      expect(formatValue(Infinity)).toBe("null");
      expect(formatValue(null)).toBe("null");
      expect(formatValue(undefined)).toBeUndefined();
    });

    it("JSON-encodes arrays and objects (matches server logger.test.js)", () => {
      expect(formatValue([1, 2])).toBe("[1,2]");
      expect(formatValue({ key: "value" })).toBe('{"key":"value"}');
    });
  });

  describe("formatFields", () => {
    const { formatFields } = __testables;

    it("joins non-undefined key=value pairs with single spaces", () => {
      expect(formatFields({ tier: "memory", ttl_ms: 24500 })).toBe("tier=memory ttl_ms=24500");
    });

    it("filters `undefined` values so callers can pass optional fields", () => {
      expect(formatFields({ tier: "memory", ttl_ms: undefined })).toBe("tier=memory");
    });

    it("returns empty string for null or non-object input", () => {
      expect(formatFields(null)).toBe("");
      expect(formatFields(undefined)).toBe("");
      expect(formatFields("key=value")).toBe("");
    });
  });

  // ------------------------------------------------------------------
  // Relay transport — wire each emit over fetch(keepalive) or sendBeacon
  // depending on level and beacon availability. The unified Vercel drain
  // captures both sides so an operator can roll browser + server logs in
  // a single query.
  // ------------------------------------------------------------------
  describe("relay transport (POST /api/logs)", () => {
    let fetchSpy;
    let beaconSpy;
    let infoSpy;
    let warnSpy;
    let errorSpy;
    let originalWindow;

    beforeEach(() => {
      // The end-to-end test below exercises logInfo/logWarn/logError
      // which call console.* before we check the transport spies.
      infoSpy = spyConsoleMethod("info");
      warnSpy = spyConsoleMethod("warn");
      errorSpy = spyConsoleMethod("error");

      fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      beaconSpy = vi.fn().mockReturnValue(true);

      // Snapshot only `window` because vi.stubGlobal handles its own
      // restoration. `fetch` and `navigator` in modern Node (20+) are
      // getter-only globals — assignment back via globalThis.X = orig
      // throws "has only a getter". vi.unstubAllGlobals() in afterEach
      // is the correct restoration path for stubbed globals.
      originalWindow = globalThis.window;

      // Stand-in browser globals. The typeof window === "undefined"
      // check on globalThis.window controls the SSR-skip branch.
      vi.stubGlobal("window", { fetch: fetchSpy });
      vi.stubGlobal("fetch", fetchSpy);
      vi.stubGlobal("navigator", { sendBeacon: beaconSpy });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      // Restore the window snapshot we took in beforeEach so the
      // SSR-skip test (which deletes globalThis.window) doesn't leak.
      if (originalWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = originalWindow;
      }
      vi.restoreAllMocks();
    });

    it("info events fetch POST to /api/logs with keepalive + JSON content-type", () => {
      postEvent({ level: "info", prefix: "browser-jobmap", fields: { layer: "tile" } });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(beaconSpy).not.toHaveBeenCalled();
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("/api/logs");
      expect(init.method).toBe("POST");
      expect(init.keepalive).toBe(true);
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(init.cache).toBe("no-store");
      expect(init.credentials).toBe("same-origin");
      const parsed = JSON.parse(init.body);
      expect(parsed).toEqual({
        events: [{ level: "info", prefix: "browser-jobmap", fields: { layer: "tile" } }],
      });
    });

    it("warn events also use fetch keepalive (only error-level prefers beacon)", () => {
      postEvent({
        level: "warn",
        prefix: "browser-jobmap",
        message: "Geocoding failed",
        fields: { city: "Berlin Mitte" },
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(beaconSpy).not.toHaveBeenCalled();
    });

    it("error events use sendBeacon with a Blob typed application/json", () => {
      postEvent({
        level: "error",
        prefix: "browser-ui-boundary",
        message: "React error boundary caught",
        fields: { error_message: "Cannot read property 'x' of undefined" },
      });

      expect(beaconSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();
      const [url, blob] = beaconSpy.mock.calls[0];
      expect(url).toBe("/api/logs");
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/json");
    });

    it("error events fall back to fetch keepalive when navigator lacks sendBeacon", () => {
      // Re-stub navigator without sendBeacon and assert the fallback
      // path picks fetch. The postEvent transport-detection re-runs
      // `detectSendBeacon()` at each call (not the cached module-load
      // constant) so this stub is honored immediately.
      vi.stubGlobal("navigator", { /* no sendBeacon */ });

      postEvent({
        level: "error",
        prefix: "browser-x",
        message: "fallback path",
        fields: {},
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(beaconSpy).not.toHaveBeenCalled();
    });

    it("postEvent skips entirely when window is undefined (SSR / Node script)", () => {
      // Simulate SSR by removing window. The postEvent early-returns
      // before constructing JSON, so neither fetch nor beacon is called.
      delete globalThis.window;

      postEvent({ level: "info", prefix: "browser-x", fields: {} });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(beaconSpy).not.toHaveBeenCalled();
    });

    it("postEvent skips when window.fetch is missing (no browser fetch support)", () => {
      // Some test runners / older runtimes have window but no fetch.
      vi.stubGlobal("window", { /* no fetch */ });

      postEvent({ level: "info", prefix: "browser-x", fields: {} });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(beaconSpy).not.toHaveBeenCalled();
    });

    it("public logInfo / logWarn / logError route the same wire envelope end-to-end", () => {
      logInfo(clientPrefix("jobmap"), { layer: "tile", tiles_loaded: 42 });
      logWarn(clientPrefix("jobmap"), "Geocoding failed", { city: "Berlin Mitte" });
      logError(clientPrefix("ui-boundary"), "React error boundary caught", { error_message: "boom" });

      // Two fetch calls (info, warn) + one beacon call (error).
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(beaconSpy).toHaveBeenCalledTimes(1);

      const fetchBodies = fetchSpy.mock.calls.map(([, init]) => JSON.parse(init.body));
      expect(fetchBodies[0]).toEqual({
        events: [{ level: "info", prefix: "browser-jobmap", fields: { layer: "tile", tiles_loaded: 42 } }],
      });
      expect(fetchBodies[1]).toEqual({
        events: [{
          level: "warn",
          prefix: "browser-jobmap",
          message: "Geocoding failed",
          fields: { city: "Berlin Mitte" },
        }],
      });

      const [, beaconBlob] = beaconSpy.mock.calls[0];
      expect(beaconBlob).toBeInstanceOf(Blob);
      expect(beaconBlob.type).toBe("application/json");
    });

    it("NAVIGATOR_SEND_BEACON is a public informational boolean (snapshot at module load)", () => {
      // NOTE: the captured-at-module-load value is environment-dependent.
      // In a vitest/Node 20+ runner, `navigator.sendBeacon` is absent at
      // import time, so the captured constant evaluates to `false`. That
      // is *expected* \u2014 the public constant is informational only. The
      // transport path calls `detectSendBeacon()` per emit so test stubs
      // (and runtime feature-flag toggles) are honored live. Callers
      // that want to know "does this browser natively support beacon?"
      // can read this const; callers that need to *route* an emit
      // should not rely on it \u2014 always go through `logX` / `postEvent`.
      expect(typeof NAVIGATOR_SEND_BEACON).toBe("boolean");
    });
  });
});
