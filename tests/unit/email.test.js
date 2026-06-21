import { describe, expect, it } from "vitest";
import { createAgencyVerificationToken, createUnsubscribeToken, verifyAgencyVerificationToken, verifyUnsubscribeToken } from "../../app/api/_lib/email";

describe("email link token signatures", () => {
  it("creates and verifies a valid unsubscribe token", () => {
    const subscriptionId = 12345;
    const token = createUnsubscribeToken(subscriptionId);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const verifiedId = verifyUnsubscribeToken(token);
    expect(verifiedId).toBe(subscriptionId);
  });

  it("returns null for an invalid or tampered unsubscribe token", () => {
    expect(verifyUnsubscribeToken(null)).toBeNull();
    expect(verifyUnsubscribeToken(undefined)).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken("12345.fakesig")).toBeNull();
    expect(verifyUnsubscribeToken("12345")).toBeNull();
  });

  it("creates and verifies a valid agency verification token", () => {
    const agencyId = 9876;
    const token = createAgencyVerificationToken(agencyId);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const verifiedId = verifyAgencyVerificationToken(token);
    expect(verifiedId).toBe(agencyId);
  });

  it("returns null for an invalid or tampered agency verification token", () => {
    expect(verifyAgencyVerificationToken(null)).toBeNull();
    expect(verifyAgencyVerificationToken(undefined)).toBeNull();
    expect(verifyAgencyVerificationToken("abc.signature")).toBeNull();
  });
});
