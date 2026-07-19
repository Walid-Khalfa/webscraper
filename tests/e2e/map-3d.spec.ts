import { expect, test } from "@playwright/test";

// E2E visual test for the 3D map coach experience.
//
// We don't need to hit the real BA API here: the auto-fit, the fly-to,
// the coach overlay, the 3D markers and the city popups are entirely
// driven by client state. We mock /api/jobs/search with a synthetic
// payload distributed across 4 German cities to cover all 3 marker
// tiers (peak/mid/low).

type MockJob = {
  referenznummer: string;
  titel: string;
  arbeitgeber: string;
  arbeitsort: { ort: string };
  beruf: string;
  verguetungsangabe?: "Jahr" | "Stunde";
  festgehalt?: number;
};

function buildMockJobs(): MockJob[] {
  // 15 jobs distributed to match the 3D map tier thresholds:
  //   • Berlin  = 8  (peak  – top market, glossy "Top-Markt" ribbon)
  //   • München = 4  (mid   – 3 to 7 treffer, standard pillar)
  //   • Hamburg = 2  (low   – fewer than 3 treffer, slim pin)
  //   • Köln    = 1  (low   – single-stelle pin)
  // This guarantees all three tiers render so the reviewer can validate
  // the parametric 3D hierarchy visually.
  return [
    { referenznummer: "REF-DE-001", titel: "Senior Full-Stack Engineer", arbeitgeber: "Khalfa Labs", arbeitsort: { ort: "Berlin" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 78000 },
    { referenznummer: "REF-DE-002", titel: "Frontend Architect (React)", arbeitgeber: "WebDev AG", arbeitsort: { ort: "Berlin" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 72000 },
    { referenznummer: "REF-DE-003", titel: "Backend Kotlin Developer", arbeitgeber: "BerlinPay", arbeitsort: { ort: "Berlin" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 68000 },
    { referenznummer: "REF-DE-004", titel: "DevOps / SRE", arbeitgeber: "CloudOps GmbH", arbeitsort: { ort: "Berlin" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 75000 },
    { referenznummer: "REF-DE-005", titel: "Data Platform Engineer", arbeitgeber: "SignalsCo", arbeitsort: { ort: "Berlin" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 71000 },
    { referenznummer: "REF-DE-006", titel: "Site Reliability Engineer", arbeitgeber: "EdgeOps", arbeitsort: { ort: "Berlin" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 82000 },
    { referenznummer: "REF-DE-007", titel: "Engineering Manager (Platform)", arbeitgeber: "Helm AG", arbeitsort: { ort: "Berlin" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 95000 },
    { referenznummer: "REF-DE-008", titel: "Tech Lead — Cloud Native", arbeitgeber: "Northcloud", arbeitsort: { ort: "Berlin" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 88000 },
    { referenznummer: "REF-DE-009", titel: "Mobile Lead (iOS/Android)", arbeitgeber: "AppHaus", arbeitsort: { ort: "München" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 80000 },
    { referenznummer: "REF-DE-010", titel: "Embedded SW Engineer", arbeitgeber: "AutoBau AG", arbeitsort: { ort: "München" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 84000 },
    { referenznummer: "REF-DE-011", titel: "Cloud Solutions Architect", arbeitgeber: "BayernCloud", arbeitsort: { ort: "München" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 92000 },
    { referenznummer: "REF-DE-012", titel: "QA Automation Engineer", arbeitgeber: "MünchenSoft", arbeitsort: { ort: "München" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 62000 },
    { referenznummer: "REF-DE-013", titel: "Junior Web Developer", arbeitgeber: "HafenLogistik", arbeitsort: { ort: "Hamburg" }, beruf: "Softwareentwickler" },
    { referenznummer: "REF-DE-014", titel: "Lead .NET Developer", arbeitgeber: "HafenLogistik", arbeitsort: { ort: "Hamburg" }, beruf: "Softwareentwickler", verguetungsangabe: "Jahr", festgehalt: 70000 },
    { referenznummer: "REF-DE-015", titel: "Junior Web Developer", arbeitgeber: "KölnMedia", arbeitsort: { ort: "Köln" }, beruf: "Softwareentwickler" },
  ];
}

test.describe("3D-Karte + Coach-Overlay", () => {
  test("Karte 3D und Coach erscheinen nach einer Berlin-Recherche", async ({ page }) => {
    test.setTimeout(60_000);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    // Step 1 – mock the search endpoint BEFORE navigation so the first
    // hit returns our synthetic distribution.
    await page.route("**/api/jobs/search*", async (route) => {
      const payload = buildMockJobs();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          maxErgebnisse: payload.length,
          ergebnisliste: payload,
        }),
      });
    });

    // Step 2 – wipe any persisted coach state from previous runs so the
    // overlay is guaranteed to appear (defensive against CI contexts
    // that reuse localStorage between test runs).
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        /* private browsing — no-op */
      }
    });

    await page.goto("/");

    // Step 3 – fill the search form. Default values already match our
    // mock payload, but we reset them explicitly to exercise the full UX.
    const keywordInput = page.locator('input[role="combobox"]').first();
    const locationInput = page.locator('input[role="combobox"]').nth(1);
    await keywordInput.fill("Softwareentwickler");
    await locationInput.fill("Berlin");

    // Step 4 – submit the search.
    await page.locator("button:has-text('Recherche starten')").click();

    // Wait until results render. Scope to the results-header section so
    // we don't collide with the empty-state and the alerts h2 elements.
    await expect(
      page.locator(".results-header").getByRole("heading", { level: 2 }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Step 5 – switch to the "Karte" view via the toolbar chip group.
    // Wait for the chip to be visible AND enabled before clicking (defensive
    // against React 18 batching on UI feedback).
    // Scope to the *semantic* parent — the view-mode switcher — so the
    // locator is decoupled from any future refactor of the generic
    // .results-toolbar container. We avoid .first() because the
    // .view-mode-switch parent guarantees the chip is unique.
    const karteChip = page.locator(
      ".view-mode-switch .toolbar-chip",
      { hasText: "Karte" },
    );
    await expect(karteChip).toBeVisible({ timeout: 10_000 });
    await karteChip.click();
    // Verify the chip is now active.
    await expect(karteChip).toHaveClass(/active/);

    // Step 6 – assert the 3D map shell, the coach overlay and at least
    // one peak (Berlin) marker are present. The shell mount is async
    // (Leaflet tiles + useEffect mount flag) so we generously wait.
    await expect(page.locator(".city-map-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".map-coach")).toBeVisible({ timeout: 15_000 });

    // The map renders markers once geocoded – wait for the first peak.
    await expect(page.locator(".city-marker-peak").first()).toBeVisible({ timeout: 15_000 });

    // Tier coverage assertions — peak at least 1, mid at least 1, low at
    // least 1. Our mock distribution (8 / 4 / 2 / 1) yields 1 peak,
    // 1 mid, 2 low markers exactly.
    const peakCount = await page.locator(".city-marker-peak").count();
    const midCount = await page.locator(".city-marker-mid").count();
    const lowCount = await page.locator(".city-marker-low").count();
    expect(peakCount).toBeGreaterThanOrEqual(1);
    expect(midCount).toBeGreaterThanOrEqual(1);
    expect(lowCount).toBeGreaterThanOrEqual(1);

    // Step 7 – click the peak marker (Berlin) to trigger fly-to and
    // spotlight overlay. Using `.city-marker-cap` (inner element) is
    // more robust against the CSS-perspective hit-test than the outer
    // pillar cell.
    await expect(
      page.locator(".city-marker-peak .city-marker-cap").first(),
    ).toBeVisible({ timeout: 10_000 });
    await page
      .locator(".city-marker-peak .city-marker-cap")
      .first()
      .click({ force: true });

    // Hold a moment for the fly-to + popup transition.
    await page.waitForTimeout(800);

    await expect(page.locator(".city-map-shell.spotlight-on")).toBeVisible();
    await expect(page.locator(".city-popup-3d")).toBeVisible();

    // Step 8 – walk through the coach to make sure its 3-step flow works.
    const coachCTA = page.locator(".map-coach-cta");
    await expect(coachCTA).toContainText(/Weiter/);
    await coachCTA.click(); // → step 1 (recommendations)
    await expect(page.locator(".map-coach-recommendations")).toBeVisible();
    await expect(page.locator(".map-coach-chip").first()).toBeVisible();
    await coachCTA.click(); // → step 2 (opportunity)
    await expect(page.locator(".map-coach-opportunity")).toBeVisible();

    // Step 9 – capture the screenshot BEFORE the final "Fertig" click
    // so the glassmorphism panel + 3D markers are both visible in the
    // archive. This is the main vitrine of the feature.
    await page.waitForTimeout(400); // let any pending rAF settle
    await page.screenshot({
      path: "/tmp/khalfajobs-map-3d.png",
      fullPage: false,
    });

    // Cropped screenshot of just the map shell + coach + markers.
    const mapBox = await page.locator(".city-map-shell").boundingBox();
    if (mapBox) {
      await page.screenshot({
        path: "/tmp/khalfajobs-map-3d-crop.png",
        clip: mapBox,
      });
    }

    // Step 10 – finish the coach walk-through (safely archived above).
    await coachCTA.click(); // → "Fertig"
    await expect(page.locator(".map-coach")).not.toBeVisible();

    // Step 11 – hard gate on uncaught exceptions.
    expect(pageErrors).toEqual([]);
    if (consoleErrors.length > 0) {
      console.log("Console errors captured:", consoleErrors.join("\n"));
    }
  });
});
