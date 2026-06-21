import { expect, test } from "@playwright/test";

test.describe("Search Functionality", () => {
  test("performs search with valid inputs and displays results", async ({ page }) => {
    // Mock the search API
    await page.route("**/api/jobs/search?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          maxErgebnisse: 2,
          ergebnisliste: [
            {
              referenznummer: "QA-100",
              titel: "QA Engineer (m/w/d)",
              arbeitgeber: "TestCorp Inc.",
              arbeitsort: "Munich",
              plz: "80331",
              beruf: "Quality Assurance",
              url: "https://www.arbeitsagentur.de/jobsuche/jobdetail/QA-100",
            },
            {
              referenznummer: "QA-101",
              titel: "Senior QA Automation Engineer",
              arbeitgeber: "Automation GmbH",
              arbeitsort: "Munich",
              plz: "80333",
              beruf: "Quality Assurance",
              url: "https://www.arbeitsagentur.de/jobsuche/jobdetail/QA-101",
            },
          ],
        }),
      });
    });

    await page.goto("/");

    // Fill the search form
    await page.getByLabel("Gesuchte Position oder Suchbegriff").fill("QA Engineer");
    await page.getByRole("textbox", { name: "Standort" }).fill("Munich");

    // Submit search
    await page.getByRole("button", { name: "Stellen finden" }).click();

    // Verify results count
    await expect(page.getByRole("heading", { name: /2 Stellenangebote/i })).toBeVisible();

    // Verify result details are present
    await expect(page.getByText("QA Engineer (m/w/d)")).toBeVisible();
    await expect(page.getByText("TestCorp Inc.").first()).toBeVisible();
    await expect(page.getByText("Senior QA Automation Engineer")).toBeVisible();
    await expect(page.getByText("Automation GmbH").first()).toBeVisible();
  });

  test("handles empty search results gracefully", async ({ page }) => {
    // Mock the search API to return empty
    await page.route("**/api/jobs/search?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          maxErgebnisse: 0,
          ergebnisliste: [],
        }),
      });
    });

    await page.goto("/");

    await page.getByLabel("Gesuchte Position oder Suchbegriff").fill("NonExistentJob123");
    await page.getByRole("button", { name: "Stellen finden" }).click();

    // Verify it shows 0 results or an empty state message
    await expect(page.getByRole("heading", { name: /0 Stellenangebote/i })).toBeVisible();
  });

  test("handles API errors gracefully", async ({ page }) => {
    // Mock the search API to return a 500 error
    await page.route("**/api/jobs/search?**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
    });

    await page.goto("/");

    await page.getByLabel("Gesuchte Position oder Suchbegriff").fill("Developer");
    await page.getByRole("button", { name: "Stellen finden" }).click();

    // Check for error toast or message on the screen
    await expect(page.getByText(/API-Fehler/i)).toBeVisible();
  });
});
