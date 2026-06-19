import { beforeEach, describe, expect, it } from "vitest";
import { assertRateLimit } from "../../app/api/_lib/rate-limit";

function makeRequest(ip = "127.0.0.1") {
  return {
    headers: {
      get(name) {
        if (name === "x-forwarded-for") return ip;
        return null;
      },
    },
  };
}

describe("assertRateLimit", () => {
  beforeEach(() => {
    globalThis.__khalfaRateLimitBuckets?.clear();
  });

  it("allows requests under the configured limit", () => {
    const request = makeRequest();
    expect(() => assertRateLimit(request, "search", { max: 2, windowMs: 60_000 })).not.toThrow();
    expect(() => assertRateLimit(request, "search", { max: 2, windowMs: 60_000 })).not.toThrow();
  });

  it("blocks requests above the configured limit", () => {
    const request = makeRequest();
    assertRateLimit(request, "search", { max: 1, windowMs: 60_000 });
    expect(() => assertRateLimit(request, "search", { max: 1, windowMs: 60_000 })).toThrow(/Zu viele Anfragen/i);
  });
});

