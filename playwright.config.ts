import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    // SKIP_DB_DURING_BUILD=true is INLINED on the build subcommand so the
    // `next build` phase stubs Prisma writes (no real DB call needed during
    // route-shape & SSR pre-rendering), but the `next start` runtime phase
    // does NOT carry that flag forward — otherwise app/api/_lib/prisma.js
    // would block every runtime write (`prisma.agency.create()` etc.) with
    // a PRISMA_BUILD_STUB error and every agency-facing test would 500.
    command: "SKIP_DB_DURING_BUILD=true npm run build && npm run start -- --hostname localhost --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      PLAYWRIGHT: "true",
    },
  },
});
