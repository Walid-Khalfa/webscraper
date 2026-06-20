import { countGermanLocalities, searchGermanLocalities } from "../../app/api/_lib/localities";

describe("German locality autocomplete", () => {
  it("returns a substantial Germany-only locality dataset", () => {
    expect(countGermanLocalities()).toBeGreaterThan(7000);
  });

  it("finds prefix matches for major cities", () => {
    const results = searchGermanLocalities("berl", 5);
    expect(results.some((entry) => entry.value === "Berlin")).toBe(true);
  });

  it("matches umlaut variants typed in ascii", () => {
    const results = searchGermanLocalities("muench", 5);
    expect(results.some((entry) => entry.value === "München")).toBe(true);
  });
});
