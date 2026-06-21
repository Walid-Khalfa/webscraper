import { expect, test } from "@playwright/test";

test("topbar navigation and mocked search flow work", async ({ page }) => {
  await page.route("**/api/jobs/search?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        maxErgebnisse: 1,
        ergebnisliste: [
          {
            referenznummer: "TEST-123",
            titel: "Senior Softwareentwickler (m/w/d)",
            arbeitgeber: "KhalfaJobs Testfirma",
            arbeitsort: "Berlin",
            plz: "10115",
            beruf: "Softwareentwickler/in",
            url: "https://www.arbeitsagentur.de/jobsuche/jobdetail/TEST-123",
          },
        ],
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("link", { name: "Suche" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ergebnisse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Job-Alarm" })).toBeVisible();

  await page.getByRole("button", { name: /Stellen finden/i }).click();

  await expect(page.getByRole("heading", { name: /1 Stellenangebote/i })).toBeVisible();
  await expect(page.getByText("KhalfaJobs Testfirma").first()).toBeVisible();
});

