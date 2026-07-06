import { vi, describe, expect, it } from "vitest";
import { GET as searchGet } from "../../app/api/jobs/search/route";
import { GET as exportGet } from "../../app/api/jobs/export/csv/route";

vi.mock("../../app/api/_lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../app/api/_lib/store", () => ({
  recordSearchHistory: vi.fn().mockResolvedValue(undefined),
  getAgency: vi.fn().mockImplementation((key) => {
    if (key === "valid-key") {
      return Promise.resolve({ id: 1, name: "Test Agency", plan: "agentur" });
    }
    return Promise.reject(new Error("Invalid agency key"));
  }),
}));

vi.mock("../../app/api/_lib/ba-import", () => ({
  collectSearchResults: vi.fn().mockResolvedValue({
    items: [
      {
        referenznummer: "123",
        titel: "Software Developer",
        arbeitgeber: "Example Corp",
        arbeitsort: { ort: "Berlin" },
        festgehalt: 80000,
        verguetungsangabe: "Jahr",
        beruf: "Software Developer",
      },
      {
        referenznummer: "456",
        titel: "Nurse",
        arbeitgeber: "Clinic",
        arbeitsort: { ort: "Hamburg" },
        festgehalt: 45000,
        verguetungsangabe: "Jahr",
        beruf: "Nurse",
      },
    ],
    stats: {
      totalFound: 2,
      pagesFetched: 1,
    },
  }),
}));

function makeRequest(url) {
  const nextUrl = new URL(url);
  return {
    nextUrl,
    headers: {
      get(name) {
        if (name === "x-forwarded-for") return "127.0.0.1";
        if (name === "x-agency-key") return nextUrl.searchParams.get("agencyKey") || null;
        return null;
      },
    },
  };
}

describe("API search route", () => {
  it("returns search results without filtering for exactLocation=false", async () => {
    const req = makeRequest("http://localhost/api/jobs/search?keyword=dev&location=Berlin&page=1&exactLocation=false");
    const response = await searchGet(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ergebnisliste).toHaveLength(2);
    expect(body.exactLocation).toBeUndefined();
  });

  it("filters search results by location for exactLocation=true", async () => {
    const req = makeRequest("http://localhost/api/jobs/search?keyword=dev&location=Berlin&page=1&exactLocation=true");
    const response = await searchGet(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ergebnisliste).toHaveLength(1);
    expect(body.ergebnisliste[0].referenznummer).toBe("123");
    expect(body.exactLocation).toBe(true);
  });
});

describe("API export route", () => {
  it("exports CSV nominal with starter tier limits (limit 25)", async () => {
    const req = makeRequest("http://localhost/api/jobs/export/csv?keyword=dev&location=Berlin&exactLocation=false");
    const response = await exportGet(req);
    const csvContent = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("X-KhalfaJobs-Export-Tier")).toBe("starter");
    expect(response.headers.get("X-KhalfaJobs-Export-Limit")).toBe("25");
    expect(csvContent).toContain("Software Developer");
    expect(csvContent).toContain("Nurse");
  });

  it("exports CSV with agency tier limit (limit 200) when a valid agency key is supplied", async () => {
    const req = makeRequest("http://localhost/api/jobs/export/csv?keyword=dev&location=Berlin&exactLocation=false&agencyKey=valid-key");
    const response = await exportGet(req);
    const csvContent = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-KhalfaJobs-Export-Tier")).toBe("agentur");
    expect(response.headers.get("X-KhalfaJobs-Export-Limit")).toBe("200");
    expect(csvContent).toContain("Software Developer");
  });

  it("filters export by exactLocation when specified", async () => {
    const req = makeRequest("http://localhost/api/jobs/export/csv?keyword=dev&location=Berlin&exactLocation=true");
    const response = await exportGet(req);
    const csvContent = await response.text();

    expect(response.status).toBe(200);
    expect(csvContent).toContain("Software Developer");
    expect(csvContent).not.toContain("Nurse");
  });

  it("escapes formula injection characters in CSV fields", async () => {
    // Modify mock to return a job title starting with an injection character
    const mockBaImport = await import("../../app/api/_lib/ba-import");
    mockBaImport.collectSearchResults.mockResolvedValueOnce({
      items: [
        {
          referenznummer: "789",
          titel: "=1+1",
          arbeitgeber: "Inject Corp",
          arbeitsort: { ort: "Berlin" },
        },
      ],
      stats: { totalFound: 1 },
    });

    const req = makeRequest("http://localhost/api/jobs/export/csv?keyword=dev&location=Berlin&exactLocation=false");
    const response = await exportGet(req);
    const csvContent = await response.text();

    expect(response.status).toBe(200);
    expect(csvContent).toContain("'\u003D1+1"); // Expect escaped '='
  });
});
