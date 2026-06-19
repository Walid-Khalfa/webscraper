import { describe, expect, it } from "vitest";
import { agencyCreateSchema, parseWithSchema, searchQuerySchema, subscriptionCreateSchema } from "../../app/api/_lib/validation";

describe("validation schemas", () => {
  it("normalizes search query params", () => {
    const parsed = parseWithSchema(searchQuerySchema, {
      keyword: " Softwareentwickler ",
      location: " Berlin ",
      page: "2",
      size: "50",
      exactLocation: "true",
    });

    expect(parsed).toEqual({
      keyword: "Softwareentwickler",
      location: "Berlin",
      page: 2,
      size: 50,
      exactLocation: true,
    });
  });

  it("rejects invalid agency payloads", () => {
    expect(() => parseWithSchema(agencyCreateSchema, { name: "A", email: "bad-email" })).toThrow(/Agenturname|E-Mail-Adresse/i);
  });

  it("clamps subscription payload shape through schema rules", () => {
    const parsed = parseWithSchema(subscriptionCreateSchema, {
      keyword: "Recruiter",
      location: "Hamburg",
      max_results: 15,
    });

    expect(parsed.max_results).toBe(15);
    expect(parsed.frequency).toBe("daily");
  });
});

