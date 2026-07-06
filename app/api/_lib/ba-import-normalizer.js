import crypto from "node:crypto";
import { flatten, normalizeJob, valueAt } from "../../../lib/shared";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeKeyPart(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstNonEmptyValue(item, paths) {
  for (const path of paths) {
    const value = flatten(valueAt(item, [path]));
    if (value) return value;
  }
  return "";
}

function getRemoteMode(item) {
  const haystack = [
    firstNonEmptyValue(item, ["arbeitsort", "arbeitsorte", "arbeitsmodell", "arbeitszeitmodell", "stellenbeschreibung"]),
    flatten(item),
  ]
    .join(" ")
    .toLocaleLowerCase("de-DE");

  if (haystack.includes("homeoffice") || haystack.includes("remote")) return "remote";
  if (haystack.includes("hybrid")) return "hybrid";
  if (haystack) return "onsite";
  return null;
}

function getWorkTime(item) {
  const fields = [];
  if (valueAt(item, ["arbeitszeitVollzeit"])) fields.push("full_time");
  if (
    valueAt(item, ["arbeitszeitTeilzeitVormittag"]) ||
    valueAt(item, ["arbeitszeitTeilzeitNachmittag"]) ||
    valueAt(item, ["arbeitszeitTeilzeitAbend"]) ||
    valueAt(item, ["arbeitszeitTeilzeitFlexibel"])
  ) {
    fields.push("part_time");
  }
  if (!fields.length) {
    const explicit = firstNonEmptyValue(item, ["arbeitszeitmodell", "arbeitszeit", "arbeitszeitText"]);
    return explicit || null;
  }
  return fields.join(",");
}

function getSourceUpdatedAt(item) {
  return (
    toDate(firstNonEmptyValue(item, ["aenderungsdatum", "modifikationsTimestamp", "aktualisiertAm"])) ||
    toDate(firstNonEmptyValue(item, ["datumErsteVeroeffentlichung", "veroeffentlichungszeitraum.von"]))
  );
}

function createFallbackKey({ title, employer, city, publishedAt, sourceUrl }) {
  return [
    normalizeKeyPart(title),
    normalizeKeyPart(employer),
    normalizeKeyPart(city),
    publishedAt ? publishedAt.toISOString().slice(0, 10) : "",
    normalizeKeyPart(sourceUrl),
  ]
    .filter(Boolean)
    .join(":");
}

export function normalizeImportedJob(rawItem, source = "bundesagentur") {
  const base = normalizeJob(rawItem);
  const externalId = normalizeText(
    firstNonEmptyValue(rawItem, ["stellenangebotsId", "hashId", "referenznummer", "id", "refnr", "refNr"]),
  );
  const city = normalizeText(base.location);
  const title = normalizeText(base.title || "Stellenprofil ohne Titel");
  const employer = normalizeText(base.employer || "Arbeitgeber nicht genannt");
  const sourceUrl = normalizeText(base.url);
  const publishedAt =
    toDate(firstNonEmptyValue(rawItem, ["datumErsteVeroeffentlichung", "veroeffentlichungszeitraum.von", "erstelltAm"])) ||
    null;
  const expiresAt = toDate(firstNonEmptyValue(rawItem, ["veroeffentlichungszeitraum.bis", "ablaufdatum"])) || null;
  const sourceUpdatedAt = getSourceUpdatedAt(rawItem);
  const fallbackKey = createFallbackKey({
    title,
    employer,
    city,
    publishedAt,
    sourceUrl,
  });
  const sourceKey = `${source}:${externalId || fallbackKey || crypto.createHash("sha1").update(JSON.stringify(rawItem)).digest("hex")}`;
  const description = firstNonEmptyValue(rawItem, [
    "stellenbeschreibung",
    "jobdetails.beschreibung",
    "beschreibung",
    "taetigkeitsbeschreibung",
  ]);
  const contractType = firstNonEmptyValue(rawItem, ["stellenangebotsart", "vertragsart", "befristung"]);
  const category = firstNonEmptyValue(rawItem, ["berufsfeld", "branche", "beruf"]);
  const experienceLevel = firstNonEmptyValue(rawItem, ["berufserfahrung", "erfahrungsniveau", "qualifikation"]);
  const remoteMode = getRemoteMode(rawItem);
  const workTime = getWorkTime(rawItem);
  const status = expiresAt && expiresAt.getTime() < Date.now() ? "EXPIRED" : "ACTIVE";

  const contentHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        title,
        employer,
        city,
        salary: base.salary,
        contractType,
        workTime,
        sourceUrl,
        description,
        publishedAt: publishedAt?.toISOString() || null,
        expiresAt: expiresAt?.toISOString() || null,
      }),
    )
    .digest("hex");

  return {
    source,
    sourceKey,
    externalId: externalId || null,
    reference: normalizeText(base.reference) || null,
    title,
    employer: employer || null,
    location: city || null,
    postalCode: normalizeText(base.postalCode) || null,
    city: city || null,
    country: "DE",
    contractType: contractType || null,
    workTime: workTime || null,
    salary: normalizeText(base.salary) || null,
    publishedAt,
    expiresAt,
    description: description || null,
    sourceUrl: sourceUrl || null,
    sourceName: "Bundesagentur für Arbeit",
    remoteMode,
    category: category || null,
    experienceLevel: experienceLevel || null,
    status,
    contentHash,
    rawPayload: rawItem,
    lastUpdatedAtSource: sourceUpdatedAt,
  };
}
