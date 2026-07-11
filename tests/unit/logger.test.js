import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logError, logInfo, logWarn, __testables } from "../../app/api/_lib/logger";

// We use a fresh spy per test AND clear the accumulator via mockClear() so
// test-isolation doesn't depend on the global mock state. This mirrors what
// `vi.restoreAllMocks()` does in the test files that exercise the logger
// helpers end-to-end (product-insights.test.js, ba-cache.test.js).

function spyConsoleMethod(method) {
  const spy = vi.spyOn(console, method).mockImplementation(() => {});
  spy.mockClear();
  return spy;
}

describe("logger helpers", () => {
  describe("logInfo", () => {
    let infoSpy;

    beforeEach(() => {
      infoSpy = spyConsoleMethod("info");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("emits a single logfmt-shaped line via `console.info`", () => {
      logInfo("ba", { tier: "memory", ttl_ms: 24500 });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0][0]).toBe("[ba] tier=memory ttl_ms=24500");
    });

    it("uses `[<prefix>]` as the operator-visible tag at the start of the line", () => {
      logInfo("insights", { tier: "prisma", ttl_ms: 30000 });

      expect(infoSpy.mock.calls[0][0]).toBe("[insights] tier=prisma ttl_ms=30000");
    });

    it("emits a single tag line when the fields object is empty", () => {
      logInfo("empty", {});

      expect(infoSpy.mock.calls[0][0]).toBe("[empty]");
    });

    it("rejects missing or empty prefix", () => {
      expect(() => logInfo("", { tier: "any" })).toThrow(TypeError);
      expect(() => logInfo(null, { tier: "any" })).toThrow(TypeError);
    });

    it("rejects non-object fields", () => {
      expect(() => logInfo("ba", null)).toThrow(TypeError);
      expect(() => logInfo("ba", "tier=memory")).toThrow(TypeError);
    });
  });

  describe("logWarn", () => {
    let warnSpy;

    beforeEach(() => {
      warnSpy = spyConsoleMethod("warn");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("emits a line that splits operator-readable prose from structured fields", () => {
      logWarn("redis", "Upstash request failed, falling back to in-memory", {
        status: 500,
        path: "/get/k",
        details: "bad request",
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toBe(
        '[redis] Upstash request failed, falling back to in-memory status=500 path=/get/k details="bad request"',
      );
    });

    it("emits prose-only when no fields are passed", () => {
      logWarn("env", "Empfohlene Variablen fehlen");

      expect(warnSpy.mock.calls[0][0]).toBe("[env] Empfohlene Variablen fehlen");
    });

    it("rejects non-string message", () => {
      expect(() => logWarn("ba", null)).toThrow(TypeError);
      expect(() => logWarn("ba", { tier: "memory" })).toThrow(TypeError);
    });
  });

  describe("logError", () => {
    let errorSpy;

    beforeEach(() => {
      errorSpy = spyConsoleMethod("error");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("emits via `console.error` (stderr) with the same shape as logWarn", () => {
      logError("env", "Fehlende Pflichtvariablen erkannt", { missing: ["DATABASE_URL"] });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toBe('[env] Fehlende Pflichtvariablen erkannt missing=["DATABASE_URL"]');
    });
  });

  describe("formatValue", () => {
    it("encodes strings with whitespace, double quote, or `=` via JSON", () => {
      const { formatValue } = __testables;
      expect(formatValue("plain")).toBe("plain");
      expect(formatValue("has space")).toBe('"has space"');
      expect(formatValue('has"quote')).toBe('"has\\"quote"');
      expect(formatValue("has=equals")).toBe('"has=equals"');
    });

    it("renders null and finite numbers faithfully", () => {
      const { formatValue } = __testables;
      expect(formatValue(null)).toBe("null");
      expect(formatValue(undefined)).toBeUndefined();
      expect(formatValue(42)).toBe("42");
      expect(formatValue(0)).toBe("0");
      expect(formatValue(3.14)).toBe("3.14");
      expect(formatValue(true)).toBe("true");
      expect(formatValue(false)).toBe("false");
      expect(formatValue(Infinity)).toBe("null");
      expect(formatValue(NaN)).toBe("null");
    });

    it("JSON-encodes arrays and plain objects so logfmt boundaries stay clean", () => {
      const { formatValue } = __testables;
      expect(formatValue(["a", "b"])).toBe('["a","b"]');
      expect(formatValue({ foo: 1, bar: "x" })).toBe('{"foo":1,"bar":"x"}');
    });

    it("falls back to `null` for values that JSON.stringify cannot represent", () => {
      const { formatValue } = __testables;
      const circular = {};
      circular.self = circular;
      expect(formatValue(circular)).toBe("null");
    });
  });

  describe("formatFields", () => {
    it("joins non-undefined key=value pairs with single spaces", () => {
      const { formatFields } = __testables;
      expect(formatFields({ tier: "memory", ttl_ms: 24500 })).toBe("tier=memory ttl_ms=24500");
    });

    it("filters `undefined` values so callers can pass optional fields", () => {
      const { formatFields } = __testables;
      expect(formatFields({ tier: "memory", ttl_ms: undefined })).toBe("tier=memory");
    });

    it("returns an empty string for null or non-object input", () => {
      const { formatFields } = __testables;
      expect(formatFields(null)).toBe("");
      expect(formatFields(undefined)).toBe("");
      expect(formatFields("tier=memory")).toBe("");
    });
  });
});
