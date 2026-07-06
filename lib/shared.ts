export const BA_PATHS = {
  reference: ["referenznummer", "refnr", "refNr", "reference", "id", "hashId", "stellenangebotsId"],
  title: ["titel", "title", "stellenangebotsTitel", "stellenbezeichnung", "beruf", "jobtitel"],
  employer: ["arbeitgeber", "arbeitgebername", "firma", "unternehmen", "company", "betrieb.name"],
  location: ["arbeitsort", "arbeitsorte", "stellenlokationen.adresse.ort", "ort", "standort", "adresse.ort"],
  postalCode: ["plz", "postleitzahl", "stellenlokationen.adresse.plz", "arbeitsort.plz", "adresse.plz"],
  occupation: ["beruf", "berufsbezeichnung", "hauptberuf", "occupation", "berufsfeld", "branche"],
  url: ["url", "link", "externeURL", "stellenangebotUrl", "detailUrl", "externalUrl"],
  salaryType: ["verguetungsangabe"],
  salaryFixed: ["festgehalt"],
  salaryFrom: ["gehaltsspanneVon"],
  salaryTo: ["gehaltsspanneBis"],
  salaryUnit: ["artDerVerguetung"],
};

const preferredListKeys = ["ergebnisliste", "stellenangebote", "angebote", "jobs", "items", "results", "content", "data"];

export function extractJobItems(payload: any): any[] {
  if (Array.isArray(payload)) return payload.filter((item) => item && typeof item === "object");
  if (!payload || typeof payload !== "object") return [];
  for (const key of preferredListKeys) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
    if (value && typeof value === "object") {
      const nested = extractJobItems(value);
      if (nested.length) return nested;
    }
  }
  return Object.values(payload).reduce((best: any[], value: any) => {
    const nested = extractJobItems(value);
    return nested.length > best.length ? nested : best;
  }, []);
}

export function valueAt(item: any, paths: string[]): any {
  for (const path of paths) {
    let current = item;
    for (const part of path.split(".")) {
      if (Array.isArray(current)) {
        current = current
          .map((entry) => (entry && typeof entry === "object" ? entry[part] : undefined))
          .filter((value) => value !== undefined && value !== null && value !== "");
      } else {
        current = current && typeof current === "object" ? current[part] : undefined;
      }
      if (current === undefined || current === null) break;
    }
    if (current !== undefined && current !== null && current !== "") return current;
  }
  return "";
}

export function flatten(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const preferred = ["name", "bezeichnung", "ort", "plz", "strasse", "region"];
    const parts = preferred.map((key) => flatten(value[key])).filter(Boolean);
    return parts.length ? parts.join(", ") : Object.values(value).map(flatten).filter(Boolean).join(", ");
  }
  return String(value);
}

export function formatEuro(value: any): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: number % 1 === 0 ? 0 : 2,
    style: "currency",
    currency: "EUR",
  }).format(number);
}

export function normalizeSalary(item: any): string {
  const type = valueAt(item, BA_PATHS.salaryType);
  const fixed = valueAt(item, BA_PATHS.salaryFixed);
  const from = valueAt(item, BA_PATHS.salaryFrom);
  const to = valueAt(item, BA_PATHS.salaryTo);
  const unit = String(type || valueAt(item, BA_PATHS.salaryUnit) || "").toLocaleLowerCase("de-DE");
  const suffix = unit.includes("stunde") ? "/Std." : unit.includes("jahr") ? "/Jahr" : "";

  if (from || to) return `${from ? formatEuro(from) : ""}${from && to ? " - " : ""}${to ? formatEuro(to) : ""} ${suffix}`.trim();
  if (fixed) return `${formatEuro(fixed)} ${suffix}`.trim();
  return "Keine Vergütung angegeben";
}

export function collectUniqueStrings(values: any[]): string[] {
  const seen = new Set();
  const items = [];
  for (const value of values) {
    const text = flatten(value);
    if (!text) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    items.push(text);
  }
  return items;
}

export function getLocationCandidates(item: any): string[] {
  const directCandidates = collectUniqueStrings([
    valueAt(item, ["arbeitsort.ort", "ort", "standort", "adresse.ort", "stellenlokationen.adresse.ort"]),
  ]);
  const locationEntries = Array.isArray(item?.stellenlokationen)
    ? item.stellenlokationen.flatMap((entry: any) => [entry?.adresse?.ort, entry?.adresse?.gemeinde, entry?.adresse?.kreis])
    : [];
  return collectUniqueStrings([...directCandidates, ...locationEntries]);
}

export function normalizeJob(item: any, options: { capitalized?: boolean } = {}) {
  const reference = valueAt(item, BA_PATHS.reference);
  const title = valueAt(item, BA_PATHS.title);
  const employer = valueAt(item, BA_PATHS.employer);
  const location = valueAt(item, BA_PATHS.location);
  const postalCode = valueAt(item, BA_PATHS.postalCode);
  const occupation = valueAt(item, BA_PATHS.occupation);
  const url = flatten(valueAt(item, BA_PATHS.url));
  const referenceText = flatten(reference);

  const Gehalt = normalizeSalary(item);
  const URL = url || (referenceText ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${referenceText}` : "");

  if (options.capitalized) {
    return {
      Referenz: referenceText,
      Titel: flatten(title) || "Stellenprofil ohne Titel",
      Arbeitgeber: flatten(employer) || "Arbeitgeber nicht genannt",
      Ort: getLocationCandidates(item)[0] || flatten(location) || "Standort nicht genannt",
      Postleitzahl: flatten(postalCode),
      Gehalt,
      Beruf: flatten(occupation),
      URL,
    };
  }

  return {
    reference: referenceText,
    title: flatten(title) || "Stellenprofil ohne Titel",
    employer: flatten(employer) || "Arbeitgeber nicht genannt",
    location: getLocationCandidates(item)[0] || flatten(location) || "Standort nicht genannt",
    postalCode: flatten(postalCode),
    occupation: flatten(occupation),
    salary: Gehalt,
    url: URL,
  };
}

export function toCsv(rows: any[]): string {
  const headers = ["Referenz", "Titel", "Arbeitgeber", "Ort", "Postleitzahl", "Gehalt", "Beruf", "URL"];
  const escapeCell = (value: any) => {
    let text = String(value ?? "");
    // Prepend ' for cells starting with formula characters to prevent CSV injection
    if (/^[=\+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }
    return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [headers.join(";"), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(";"))];
  return `\uFEFF${lines.join("\r\n")}`;
}
