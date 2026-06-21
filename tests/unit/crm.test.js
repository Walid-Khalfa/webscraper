import { describe, expect, it } from "vitest";
import { parseWithSchema, crmConnectSchema, crmPushSchema } from "../../app/api/_lib/validation";

describe("CRM validation schemas", () => {
  it("parses valid connection payload", () => {
    const parsed = parseWithSchema(crmConnectSchema, {
      provider: "hubspot",
      apiKey: "pat-12345-abcde",
      config: {
        portalId: 98765
      }
    });

    expect(parsed).toEqual({
      provider: "hubspot",
      apiKey: "pat-12345-abcde",
      config: {
        portalId: 98765
      }
    });
  });

  it("rejects invalid connect payloads", () => {
    expect(() => parseWithSchema(crmConnectSchema, {
      provider: "invalid-provider",
      apiKey: "ok"
    })).toThrow();

    expect(() => parseWithSchema(crmConnectSchema, {
      provider: "hubspot",
      apiKey: "" // too short
    })).toThrow();
  });

  it("parses valid push payload", () => {
    const parsed = parseWithSchema(crmPushSchema, {
      provider: "personio",
      reference: "JOB-REF-100"
    });

    expect(parsed).toEqual({
      provider: "personio",
      reference: "JOB-REF-100"
    });
  });
});
