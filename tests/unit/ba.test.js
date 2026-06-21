import { describe, expect, it } from "vitest";
import { extractJobItems, valueAt, flatten, normalizeJob, filterJobsByExactLocation, toCsv } from "../../app/api/_lib/ba";

describe("ba helper library", () => {
  it("extracts job items from different nested shapes", () => {
    const payload = { ergebnisliste: [{ id: 1 }, { id: 2 }] };
    expect(extractJobItems(payload)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("handles empty or null payloads when extracting job items", () => {
    expect(extractJobItems(null)).toEqual([]);
    expect(extractJobItems(undefined)).toEqual([]);
    expect(extractJobItems({})).toEqual([]);
  });

  it("gets nested valueAt correctly", () => {
    const item = { a: { b: { c: "hello" } } };
    expect(valueAt(item, ["a.b.c"])).toBe("hello");
    expect(valueAt(item, ["x.y", "a.b.c"])).toBe("hello");
  });

  it("flattens arrays and objects into search/display strings", () => {
    expect(flatten("  test  ")).toBe("test");
    expect(flatten(["a", "b"])).toBe("a, b");
    expect(flatten({ name: "Berlin", plz: "10115" })).toBe("Berlin, 10115");
  });

  it("normalizes job field mappings", () => {
    const rawJob = {
      referenznummer: "123-ABC",
      titel: "Web Developer",
      arbeitgeber: "Test Agency",
      arbeitsort: { ort: "München" },
      plz: "80331",
      verguetungsangabe: "Jahr",
      festgehalt: 60000,
      beruf: "Developer",
    };
    const normalized = normalizeJob(rawJob);
    expect(normalized.Referenz).toBe("123-ABC");
    expect(normalized.Titel).toBe("Web Developer");
    expect(normalized.Arbeitgeber).toBe("Test Agency");
    expect(normalized.Ort).toBe("München");
    expect(normalized.Postleitzahl).toBe("80331");
    expect(normalized.Gehalt).toContain("60.000");
    expect(normalized.Gehalt).toContain("Jahr");
    expect(normalized.Beruf).toBe("Developer");
    expect(normalized.URL).toBe("https://www.arbeitsagentur.de/jobsuche/jobdetail/123-ABC");
  });

  it("filters jobs by exact location including accents/umlauts", () => {
    const jobs = [
      { stellenlokationen: [{ adresse: { ort: "München" } }] },
      { stellenlokationen: [{ adresse: { ort: "Berlin" } }] },
    ];
    const filtered = filterJobsByExactLocation(jobs, "muenchen");
    expect(filtered.length).toBe(1);
    expect(filtered[0].stellenlokationen[0].adresse.ort).toBe("München");
  });

  it("converts rows to CSV with proper CSV escaping and BOM", () => {
    const rows = [
      { Referenz: "1", Titel: "Developer; C++", Arbeitgeber: 'A "Big" Company', Ort: "Berlin", Postleitzahl: "10115", Gehalt: "None", Beruf: "Dev", URL: "" }
    ];
    const csv = toCsv(rows);
    expect(csv).toContain("\uFEFF");
    expect(csv).toContain('"Developer; C++"');
    expect(csv).toContain('"A ""Big"" Company"');
  });
});
