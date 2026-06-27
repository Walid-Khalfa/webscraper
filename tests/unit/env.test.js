import { describe, expect, it } from "vitest";
import { getEnvironmentReport } from "../../app/api/_lib/env";

describe("startup environment validation", () => {
  it("reports missing production requirements", () => {
    const report = getEnvironmentReport({
      NODE_ENV: "production",
      CI: "false",
      NEXT_PHASE: "",
      SKIP_DB_DURING_BUILD: "false",
    });

    expect(report.ok).toBe(false);
    expect(report.missingRequired.map((item) => item.name)).toEqual(
      expect.arrayContaining(["DATABASE_URL", "CRON_SECRET", "EMAIL_LINK_SECRET"]),
    );
  });

  it("accepts build mode when database access is intentionally skipped", () => {
    const report = getEnvironmentReport({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      SKIP_DB_DURING_BUILD: "true",
      CRON_SECRET: "secret",
      EMAIL_LINK_SECRET: "email-secret",
    });

    expect(report.ok).toBe(true);
    expect(report.missingRequired).toHaveLength(0);
  });
});
