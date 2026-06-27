import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to generate mock jobs
function generateMockJobs(count: number) {
  const jobs = [];
  for (let i = 1; i <= count; i++) {
    let salaryObj = {};
    if (i % 3 === 1) {
      salaryObj = { verguetungsangabe: "Jahr", festgehalt: 50000 + i * 1000 };
    } else if (i % 3 === 2) {
      salaryObj = { verguetungsangabe: "Stunde", festgehalt: 20 + i };
    } else {
      salaryObj = {}; // No salary info
    }

    jobs.push({
      referenznummer: `REF-JOB-${i}`,
      titel: `Mock Job Titel ${i}`,
      arbeitgeber: `Mock Arbeitgeber ${i}`,
      arbeitsort: { ort: "Berlin" },
      beruf: "Softwareentwickler",
      ...salaryObj,
    });
  }
  return jobs;
}

test.describe("Campagne de Test E2E - Emploi Agences App", () => {
  // Reset database before all tests
  test.beforeAll(async () => {
    // Nettoyer la BDD de test pour éviter les interférences
    await prisma.emailDelivery.deleteMany({});
    await prisma.searchSubscription.deleteMany({});
    await prisma.searchHistory.deleteMany({});
    await prisma.candidateDossier.deleteMany({});
    await prisma.agencyUser.deleteMany({});
    await prisma.agency.deleteMany({});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test.describe("1. Flux de Recherche & Filtres (IHM Visiteur)", () => {
    test("TC_E2E_01 & TC_E2E_02 - Recherche nominale et normalisation salariale", async ({ page }) => {
      // Mock de l'API de recherche pour retourner 3 offres spécifiques
      const mockJobs = [
        {
          referenznummer: "REF-101",
          titel: "Node.js Entwickler",
          arbeitgeber: "Khalfa Corp",
          arbeitsort: { ort: "Berlin" },
          beruf: "Softwareentwickler",
          verguetungsangabe: "Jahr",
          festgehalt: 65000,
        },
        {
          referenznummer: "REF-102",
          titel: "React Expert",
          arbeitgeber: "WebDev AG",
          arbeitsort: { ort: "Berlin" },
          beruf: "Softwareentwickler",
          verguetungsangabe: "Stunde",
          festgehalt: 32.50,
        },
        {
          referenznummer: "REF-103",
          titel: "Python Intern",
          arbeitgeber: "AI Labs",
          arbeitsort: { ort: "Berlin" },
          beruf: "Softwareentwickler",
          // Pas de salaire renseigné
        }
      ];

      await page.route("**/api/jobs/search*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            maxErgebnisse: 3,
            ergebnisliste: mockJobs,
          }),
        });
      });

      // Étape 1 : Accéder à la page d'accueil
      await page.goto("/");

      // Étape 2 : Lancer la recherche
      await page.locator('input[role="combobox"]').first().fill("Softwareentwickler");
      await page.locator('input[role="combobox"]').nth(1).fill("Berlin");
      await page.click("button:has-text('Stellen finden')");

      // Résultats attendus TC_E2E_01 :
      // - Liste des jobs visible
      await expect(page.locator("text=Node.js Entwickler")).toBeVisible();
      await expect(page.locator("text=React Expert")).toBeVisible();
      await expect(page.locator("text=Python Intern")).toBeVisible();

      // Résultats attendus TC_E2E_02 (Normalisation salariale) :
      // - Vérifier le formatage en EUR
      await expect(page.locator("text=65.000")).toBeVisible(); // 65.000,00 € /Jahr
      await expect(page.locator("text=32,50")).toBeVisible();  // 32,50 € /Std.
      await expect(page.locator("text=Keine Verguetung angegeben")).toBeVisible();
    });

    test("TC_E2E_03 - Pagination des offres", async ({ page }) => {
      // Mock retournant 35 résultats (taille de page par défaut = 25)
      const allMockJobs = generateMockJobs(35);

      await page.route("**/api/jobs/search*", async (route) => {
        const url = new URL(route.request().url());
        const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
        const sizeParam = parseInt(url.searchParams.get("size") || "25", 10);

        const start = (pageParam - 1) * sizeParam;
        const end = start + sizeParam;
        const pageJobs = allMockJobs.slice(start, end);

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            maxErgebnisse: 35,
            ergebnisliste: pageJobs,
          }),
        });
      });

      await page.goto("/");
      await page.locator('input[role="combobox"]').first().fill("PythonDeveloper");
      await page.locator('input[role="combobox"]').nth(1).fill("Munich");
      await page.click("button:has-text('Stellen finden')");

      // Attendre que la première page se charge (25 éléments)
      await expect(page.getByText("Mock Job Titel 1", { exact: true })).toBeVisible();
      await expect(page.getByText("Mock Job Titel 25", { exact: true })).toBeVisible();
      await expect(page.getByText("Mock Job Titel 26", { exact: true })).not.toBeVisible();

      // Cliquer sur le bouton de chargement
      const loadMoreButton = page.getByRole("button", { name: /mehr laden|weitere laden/i });
      if (await loadMoreButton.isVisible()) {
        await loadMoreButton.click();
        // Vérifier que la page suivante s'affiche
        await expect(page.getByText("Mock Job Titel 26", { exact: true })).toBeVisible();
        await expect(page.getByText("Mock Job Titel 35", { exact: true })).toBeVisible();
      }
    });

    test("TC_E2E_04 - Résilience sur panne de l'API BA", async ({ page }) => {
      // Configurer le mock pour renvoyer une erreur 500
      await page.route("**/api/jobs/search*", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Verbindung zur BA fehlgeschlagen" }),
        });
      });

      await page.goto("/");
      await page.locator('input[role="combobox"]').first().fill("JavaDeveloper");
      await page.locator('input[role="combobox"]').nth(1).fill("Frankfurt");
      await page.click("button:has-text('Stellen finden')");

      // Vérifier le message d'erreur de l'UI
      await expect(page.locator("text=Die Suche konnte nicht geladen werden")).toBeVisible();
    });
  });

  test.describe("2. Flux d'Export CSV", () => {
    test("TC_E2E_05 - Export CSV nominal - Visiteur (Starter, limite 25)", async ({ page }) => {
      // Mock de la recherche et de l'export pour le navigateur
      const mockJobs = generateMockJobs(30);
      await page.route("**/api/jobs/search*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            maxErgebnisse: 30,
            ergebnisliste: mockJobs,
          }),
        });
      });

      await page.goto("/");
      await page.locator('input[role="combobox"]').first().fill("DevOpsDeveloper");
      await page.locator('input[role="combobox"]').nth(1).fill("Hamburg");
      await page.click("button:has-text('Stellen finden')");

      // Attendre que la liste soit affichée
      await expect(page.getByText("Mock Job Titel 1", { exact: true })).toBeVisible();

      // Clic sur l'export CSV et capture du téléchargement
      const downloadPromise = page.waitForEvent("download");
      await page.click("button:has-text('CSV exportieren')");
      const download = await downloadPromise;

      expect(download.suggestedFilename().toLowerCase()).toContain("stellenangebote-devopsdeveloper-hamburg.csv");
      
      const path = await download.path();
      expect(path).not.toBeNull();
    });

    test("TC_E2E_06 - Export CSV nominal - Agence (Agentur, limite 200)", async ({ request }) => {
      // Créer d'abord une agence en base de données pour avoir une clé d'agence
      const agencyName = "Test Export Agency";
      const agencyEmail = "export-test@khalfajobs.de";
      
      const createResponse = await request.post("/api/agencies", {
        data: {
          name: agencyName,
          email: agencyEmail,
          plan: "agentur",
        }
      });
      expect(createResponse.status()).toBe(201);
      const agencyData = await createResponse.json();
      const apiKey = agencyData.api_key;
      expect(apiKey).toBeDefined();

      // Mettre à jour l'agence pour la marquer vérifiée afin qu'elle puisse utiliser l'export étendu
      await prisma.agency.update({
        where: { email: agencyEmail },
        data: { emailVerifiedAt: new Date() }
      });

      // Lancer l'export CSV avec la clé d'agence en header
      const exportResponse = await request.get("/api/jobs/export/csv?keyword=Softwareentwickler&location=Berlin", {
        headers: {
          "X-Agency-Key": apiKey,
        }
      });

      if (exportResponse.status() !== 200) {
        console.error("TC_E2E_06 Export Error Content:", await exportResponse.text());
      }
      expect(exportResponse.status()).toBe(200);
      expect(exportResponse.headers()["x-khalfajobs-export-tier"]).toBe("agentur");
      expect(exportResponse.headers()["content-type"]).toContain("text/csv");
      
      const text = await exportResponse.text();
      const lines = text.split("\r\n").filter(Boolean);
      
      // La ligne d'en-tête plus jusqu'à 200 offres
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toBe("\uFEFFReferenz;Titel;Arbeitgeber;Ort;Postleitzahl;Gehalt;Beruf;URL");
    });

    test("TC_E2E_07 - Export CSV avec jeu de données vide", async ({ request }) => {
      // Appel direct à l'export pour un mot-clé improbable retournant 0 résultat
      const exportResponse = await request.get("/api/jobs/export/csv?keyword=XyzNonExistant&location=Nowhere");
      if (exportResponse.status() !== 200) {
        console.error("TC_E2E_07 Export Error Content:", await exportResponse.text());
      }
      expect(exportResponse.status()).toBe(200);

      const text = await exportResponse.text();
      const lines = text.split("\r\n").filter(Boolean);
      
      // Vérification : Exactement une seule ligne (l'en-tête), aucun saut de ligne superflu
      expect(lines.length).toBe(1);
      expect(lines[0]).toBe("\uFEFFReferenz;Titel;Arbeitgeber;Ort;Postleitzahl;Gehalt;Beruf;URL");
    });

    test("TC_E2E_08 - Limitation de débit sur l'export", async ({ request }) => {
      // Effectuer 21 requêtes d'export consécutives pour la même clé IP / Clé d'agence
      // (Pour simplifier, on appelle sans clé pour déclencher le rate limit par IP ou clé vide)
      let lastStatus = 200;
      for (let i = 0; i < 22; i++) {
        const response = await request.get("/api/jobs/export/csv?keyword=Softwareentwickler&location=Berlin");
        lastStatus = response.status();
        if (lastStatus === 429) {
          break;
        }
      }
      // Au moins l'une des requêtes (la 21e ou 22e) doit être bloquée
      expect(lastStatus).toBe(429);
    });
  });

  test.describe("3. Flux de Gestion des Agences & Alertes (API REST)", () => {
    test("TC_E2E_09 - Création nominale d'une Agence", async ({ request }) => {
      const email = `agency-${Date.now()}@khalfajobs.de`;
      const response = await request.post("/api/agencies", {
        data: {
          name: "E2E Agency Inc.",
          email: email,
          plan: "starter",
        }
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.name).toBe("E2E Agency Inc.");
      expect(data.email).toBe(email);
      expect(data.api_key).toContain("emp_");
      expect(data.verification_delivery_status).toBeDefined();
    });

    test("TC_E2E_10 - Validation à la création d'agence", async ({ request }) => {
      const response = await request.post("/api/agencies", {
        data: {
          name: "A", // Trop court (min 2)
          email: "invalid-email-address", // Non valide
          plan: "starter",
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    test("TC_E2E_11 - Création nominale d'un abonnement", async ({ request }) => {
      // 1. Créer une agence
      const email = `agency-sub-${Date.now()}@khalfajobs.de`;
      const agencyRes = await request.post("/api/agencies", {
        data: {
          name: "Sub Agency",
          email: email,
          plan: "agentur",
        }
      });
      const agencyData = await agencyRes.json();
      const apiKey = agencyData.api_key;

      // Mettre à jour l'agence pour la marquer vérifiée en base de données
      await prisma.agency.update({
        where: { email: email },
        data: { emailVerifiedAt: new Date() }
      });

      // 2. Créer l'abonnement
      const subRes = await request.post("/api/alerts/subscriptions", {
        headers: {
          "X-Agency-Key": apiKey,
        },
        data: {
          keyword: "Frontend Developer",
          location: "Berlin",
          frequency: "daily",
          max_results: 15,
        }
      });

      expect(subRes.status()).toBe(201);
      const subData = await subRes.json();
      expect(subData.keyword).toBe("Frontend Developer");
      expect(subData.location).toBe("Berlin");
      expect(subData.max_results).toBe(15);
    });

    test("TC_E2E_12 - Création d'abonnement non authentifiée", async ({ request }) => {
      const response = await request.post("/api/alerts/subscriptions", {
        headers: {
          "X-Agency-Key": "emp_bad_key_12345",
        },
        data: {
          keyword: "Designer",
          location: "München",
          frequency: "daily",
          max_results: 10,
        }
      });

      // Doit retourner 401 ou 403
      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe("4. Flux du Cron / Tâche Planifiée", () => {
    test("TC_E2E_13 - Déclenchement nominal du Cron", async ({ request }) => {
      // S'assurer qu'au moins un abonnement actif existe pour une agence vérifiée
      const email = `cron-agency-${Date.now()}@khalfajobs.de`;
      const agencyRes = await request.post("/api/agencies", {
        data: {
          name: "Cron Testing Agency",
          email: email,
          plan: "agentur",
        }
      });
      const agencyData = await agencyRes.json();
      const apiKey = agencyData.api_key;

      // Marquer l'agence comme vérifiée
      await prisma.agency.update({
        where: { email: email },
        data: { emailVerifiedAt: new Date() }
      });

      // Créer un abonnement
      await request.post("/api/alerts/subscriptions", {
        headers: {
          "X-Agency-Key": apiKey,
        },
        data: {
          keyword: "Developer",
          location: "Berlin",
          frequency: "daily",
          max_results: 5,
        }
      });

      const response = await request.get("/api/cron/agents", {
        headers: {
          Authorization: "Bearer my_secret_cron_passphrase",
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.processed).toBeGreaterThan(0);
    });

    test("TC_E2E_14 - Rejet d'accès au Cron", async ({ request }) => {
      const response = await request.get("/api/cron/agents", {
        headers: {
          Authorization: "Bearer bad_secret",
        }
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.detail).toBe("Ungueltiger Cron-Schluessel");
    });
  });
});
