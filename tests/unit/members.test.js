import { describe, expect, it } from "vitest";
import { parseWithSchema, inviteMemberSchema } from "../../app/api/_lib/validation";

describe("Team member invitation schema", () => {
  it("parses valid invitation payload", () => {
    const parsed = parseWithSchema(inviteMemberSchema, {
      email: "recruiter@khalfajobs.me",
      fullName: "Walid Khalfa",
      role: "RECRUITER"
    });

    expect(parsed).toEqual({
      email: "recruiter@khalfajobs.me",
      fullName: "Walid Khalfa",
      role: "RECRUITER"
    });
  });

  it("rejects invalid invitation payloads", () => {
    // Invalid email
    expect(() => parseWithSchema(inviteMemberSchema, {
      email: "bad-email",
      fullName: "Walid Khalfa",
      role: "RECRUITER"
    })).toThrow();

    // Invalid role
    expect(() => parseWithSchema(inviteMemberSchema, {
      email: "recruiter@khalfajobs.me",
      fullName: "Walid Khalfa",
      role: "SUPER_ADMIN"
    })).toThrow();

    // Name too short
    expect(() => parseWithSchema(inviteMemberSchema, {
      email: "recruiter@khalfajobs.me",
      fullName: "W",
      role: "VIEWER"
    })).toThrow();
  });
});
