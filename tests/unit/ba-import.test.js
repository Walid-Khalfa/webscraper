import { describe, expect, it } from "vitest";
import { collectSearchResults } from "../../app/api/_lib/ba-import";
import { normalizeImportedJob } from "../../app/api/_lib/ba-import-normalizer";

describe("ba import collector", () => {
  it("collects paginated results until an empty page is reached", async () => {
    const pages = {
      1: { maxErgebnisse: 250, ergebnisliste: [{ referenznummer: "A-1" }, { referenznummer: "A-2" }] },
      2: { maxErgebnisse: 250, ergebnisliste: [{ referenznummer: "A-3" }] },
      3: { maxErgebnisse: 250, ergebnisliste: [] },
    };

    const result = await collectSearchResults(
      { keyword: "dev", location: "Berlin" },
      {
        mode: "full",
        maxPages: 3,
        fetchPage: async ({ page }) => pages[page] || { maxErgebnisse: 250, ergebnisliste: [] },
      },
    );

    expect(result.items).toHaveLength(3);
    expect(result.stats.pagesFetched).toBe(3);
    expect(result.stats.stoppedBecause).toBe("empty_page");
  });

  it("stops when the upstream repeats the same page payload", async () => {
    const repeated = { maxErgebnisse: 999, ergebnisliste: [{ referenznummer: "A-1" }] };
    const result = await collectSearchResults(
      { keyword: "dev", location: "Berlin" },
      {
        mode: "test",
        fetchPage: async () => repeated,
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.stats.stoppedBecause).toBe("duplicate_page");
  });

  it("supports offset blocks by startPage", async () => {
    const visited = [];
    await collectSearchResults(
      { keyword: "dev", location: "Berlin" },
      {
        mode: "test",
        startPage: 11,
        maxPages: 2,
        fetchPage: async ({ page }) => {
          visited.push(page);
          return { maxErgebnisse: 5000, ergebnisliste: page === 11 ? [{ referenznummer: "X-11" }] : [] };
        },
      },
    );

    expect(visited[0]).toBe(11);
  });
});

describe("ba import normalizer", () => {
  it("builds a stable imported job with official identifiers when available", () => {
    const normalized = normalizeImportedJob({
      referenznummer: "REF-123",
      stellenangebotsId: "BA-123",
      titel: "Senior Recruiter",
      arbeitgeber: "Muster GmbH",
      arbeitsort: { ort: "Berlin" },
      plz: "10115",
      verguetungsangabe: "Jahr",
      festgehalt: 70000,
      beruf: "Recruiting",
      datumErsteVeroeffentlichung: "2026-07-01",
      veroeffentlichungszeitraum: { bis: "2026-07-30" },
    });

    expect(normalized.sourceKey).toBe("bundesagentur:BA-123");
    expect(normalized.reference).toBe("REF-123");
    expect(normalized.city).toBe("Berlin");
    expect(normalized.status).toBe("ACTIVE");
  });

  it("marks expired jobs as expired", () => {
    const normalized = normalizeImportedJob({
      titel: "Developer",
      arbeitgeber: "Test GmbH",
      arbeitsort: { ort: "Hamburg" },
      veroeffentlichungszeitraum: { bis: "2020-01-01" },
    });

    expect(normalized.status).toBe("EXPIRED");
  });

  it("infers remote mode from textual payload", () => {
    const normalized = normalizeImportedJob({
      titel: "Backend Engineer",
      arbeitgeber: "Remote GmbH",
      arbeitsort: { ort: "München" },
      stellenbeschreibung: "100% Remote möglich, Homeoffice willkommen",
    });

    expect(normalized.remoteMode).toBe("remote");
  });
});
