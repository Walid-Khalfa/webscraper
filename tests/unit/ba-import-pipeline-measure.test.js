// tests/unit/ba-import-pipeline-measure.test.js
// Round-5 pipeline measurement: walks all (keyword × location) combinations
// through collectSearchResults with a synthetic BA-shaped mock (cluster ×
// city modulated yields) and writes per-query + per-cluster stats to
// /tmp/ba_import_test_run.json. Acts as a permanent regression smoke test.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import { collectSearchResults } from "../../app/api/_lib/ba-import";
import {
  DEFAULT_IMPORT_KEYWORDS,
  DEFAULT_IMPORT_LOCATIONS,
  getImportRuntimeConfig,
} from "../../app/api/_lib/ba-import-config";

function clusterOf(keyword) {
  const k = keyword.toLowerCase();
  if (
    k.includes("entwickler") ||
    k.includes("engineer") ||
    k.includes("scientist") ||
    k.includes("berater") ||
    k.includes("architekt") ||
    k.includes("spezialist") ||
    k.includes("sap-")
  ) return "IT";
  if (
    k.includes("ingenieur") ||
    k.includes("elektriker") ||
    k.includes("mechat") ||
    k.includes("servicetechnik") ||
    k.includes("konstrukteur")
  ) return "Engineering";
  if (
    k.includes("pflege") ||
    k.includes("arzt") ||
    k.includes("krankenschwester") ||
    k.includes("fachangestellte") ||
    k.includes("physiotherapeut")
  ) return "Healthcare";
  if (
    k.includes("projekt") ||
    k.includes("recruiter") ||
    k.includes("buchhalter") ||
    k.includes("sachbearbeiter") ||
    k.includes("controller") ||
    k.includes("vertrieb") ||
    k.includes("office")
  ) return "Business";
  if (k.includes("koch") || k.includes("kellner") || k.includes("hotelkaufmann")) return "Hospitality";
  return "Other";
}

// Synthetic BA-shaped yield model: per-cluster base × per-city multiplier ×
// national-multiplier (only when location === ""). Numbers approximate the
// orders-of-magnitude observed by recruiters familiar with the BA REST API.
function syntheticYield(keyword, location) {
  const k = keyword.toLowerCase();
  let base = 400;
  if (k.includes("entwickler") || k.includes("engineer")) base = 4500;
  else if (k.includes("pflege") || k.includes("arzt")) base = 2800;
  else if (k.includes("ingenieur") || k.includes("elektriker") || k.includes("mechat") || k.includes("service")) base = 1800;
  else if (k.includes("berater") || k.includes("architekt") || k.includes("data") || k.includes("scientist")) base = 1100;
  else if (k.includes("projekt") || k.includes("recruiter") || k.includes("buchhalter") || k.includes("controller") || k.includes("vertrieb")) base = 800;
  else if (k.includes("koch")) base = 500;
  else if (k.includes("medizinische") || k.includes("krankenschwester") || k.includes("physiotherapeut")) base = 1200;
  else if (k.includes("sachbearbeiter")) base = 2200;

  const cityMultiplier = {
    "Berlin": 2.4,
    "Hamburg": 1.5,
    "München": 1.9,
    "Köln": 1.3,
    "Frankfurt am Main": 1.5,
    "Stuttgart": 1.2,
    "Düsseldorf": 1.3,
    "Leipzig": 1.0,
    "Dresden": 0.95,
    "Bonn": 1.0,
    "Bremen": 0.95,
    "Dortmund": 0.85,
    "Essen": 0.95,
    "Hannover": 1.0,
    "Nürnberg": 0.95,
    "Duisburg": 0.85,
    "Mannheim": 0.95,
    "Bielefeld": 0.85,
    "Bochum": 0.8,
  }[location] ?? 1.0;
  const nationalMult = location === "" ? 6.0 : 1.0;
  return Math.max(50, Math.round(base * cityMultiplier * nationalMult));
}

// Mock ba.js inline inside the vi.mock factory (avoids TDZ: vi.mock hoists
// its factory above `const` declarations, so referencing a top-level
// `const mockSearchJobs` from the factory triggers a TDZ ReferenceError).
vi.mock("../../app/api/_lib/ba", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    searchJobs: vi.fn(async ({ keyword, location, page = 1, size = 100 }) => {
      const maxErgebnisse = syntheticYield(keyword, location);
      const startIdx = (page - 1) * size + 1;
      const available = maxErgebnisse - (page - 1) * size;
      if (available <= 0) return { maxErgebnisse, ergebnisliste: [] };
      const count = Math.min(size, available);
      const ergebnisliste = [];
      for (let i = 0; i < count; i += 1) {
        const idx = startIdx + i;
        const safeKeyword = keyword.replace(/\W+/g, "");
        ergebnisliste.push({
          referenznummer: `${safeKeyword}-${location || "DE"}-${idx}`,
          stellenangebotsId: `BA-${safeKeyword}-${location || "DE"}-${idx}`.slice(0, 64),
          titel: `${keyword} job in ${location || "Deutschland"} #${idx}`,
          arbeitgeber: `Arbeitgeber #${idx}`,
          arbeitsort: { ort: location || "Berlin" },
          plz: "10115",
          beruf: keyword,
          verguetungsangabe: "Jahr",
          festgehalt: 60000 + i * 500,
          veroeffentlichungszeitraum: { bis: "2026-12-31" },
        });
      }
      return { maxErgebnisse, ergebnisliste };
    }),
  };
});

describe("BA import pipeline measurement (round 5)", () => {
  it("measures the full (keyword × location) matrix in test mode and writes a JSON report", async () => {
    const queries = [];
    for (const k of DEFAULT_IMPORT_KEYWORDS) {
      for (const l of DEFAULT_IMPORT_LOCATIONS) {
        queries.push({ keyword: k, location: l });
      }
    }

    const config = getImportRuntimeConfig("test");
    const results = [];
    let totalFetched = 0;
    let totalFoundSum = 0;
    const stoppedBecauseCounts = {};
    const errors = [];

    for (let qIdx = 0; qIdx < queries.length; qIdx += 1) {
      const query = queries[qIdx];
      try {
        const r = await collectSearchResults(query, { mode: "test" });
        const rec = {
          idx: qIdx,
          keyword: query.keyword,
          location: query.location,
          cluster: clusterOf(query.keyword),
          pagesFetched: r.stats.pagesFetched,
          totalFetched: r.stats.totalFetched,
          totalFound: r.stats.totalFound,
          stoppedBecause: r.stats.stoppedBecause,
        };
        results.push(rec);
        totalFetched += r.stats.totalFetched;
        totalFoundSum += r.stats.totalFound;
        stoppedBecauseCounts[r.stats.stoppedBecause] =
          (stoppedBecauseCounts[r.stats.stoppedBecause] || 0) + 1;
      } catch (e) {
        errors.push({ query, message: e?.message ?? String(e) });
      }
    }

    const clusterAgg = {};
    for (const r of results) {
      const c = r.cluster;
      if (!clusterAgg[c]) {
        clusterAgg[c] = { queries: 0, totalFetched: 0, totalFoundSum: 0, pagesSum: 0 };
      }
      clusterAgg[c].queries += 1;
      clusterAgg[c].totalFetched += r.totalFetched;
      clusterAgg[c].totalFoundSum += r.totalFound;
      clusterAgg[c].pagesSum += r.pagesFetched;
    }

    const out = {
      mode: "test",
      config,
      keywordCount: DEFAULT_IMPORT_KEYWORDS.length,
      locationCount: DEFAULT_IMPORT_LOCATIONS.length,
      queriesCount: queries.length,
      totalFetchedRaw: totalFetched,
      totalFoundSum,
      errorsCount: errors.length,
      errorsSample: errors.slice(0, 5),
      stoppedBecauseCounts,
      clusterAgg,
      results,
    };

    fs.writeFileSync("/tmp/ba_import_test_run.json", JSON.stringify(out, null, 2));

    expect(queries.length).toBe(DEFAULT_IMPORT_KEYWORDS.length * DEFAULT_IMPORT_LOCATIONS.length);
    expect(results.length).toBe(queries.length);
    expect(errors.length).toBe(0);
  }, 120_000);
});
