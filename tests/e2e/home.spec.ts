import { expect, test } from "@playwright/test";

test("application smoke endpoints respond as expected", async ({ request }) => {
  test.setTimeout(20_000);

  const homeResponse = await request.get("/");
  expect(homeResponse.ok()).toBeTruthy();
  await expect(homeResponse.text()).resolves.toContain("KhalfaJobs");

  const healthResponse = await request.get("/health");
  expect(healthResponse.status()).toBe(200);
  await expect(healthResponse.json()).resolves.toMatchObject({ status: "ok" });

  const cronResponse = await request.get("/api/cron/agents");
  expect(cronResponse.status()).toBe(401);
  await expect(cronResponse.json()).resolves.toMatchObject({
    detail: "Ungueltiger Cron-Schluessel",
  });
});
