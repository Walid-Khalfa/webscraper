import rawLocalities from "./german-localities.json";

const collator = new Intl.Collator("de-DE");

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function createSearchTerms(value) {
  const raw = String(value || "").toLocaleLowerCase("de-DE");
  const variants = new Set([
    normalizeText(raw),
    normalizeText(
      raw
        .replaceAll("ä", "ae")
        .replaceAll("ö", "oe")
        .replaceAll("ü", "ue")
        .replaceAll("ß", "ss"),
    ),
  ]);
  return [...variants].filter(Boolean);
}

function buildLabel(name, state) {
  if (!state || name === state) return name;
  return `${name}, ${state}`;
}

const popularLocations = [
  "Berlin",
  "Hamburg",
  "Muenchen",
  "Koeln",
  "Frankfurt am Main",
  "Stuttgart",
  "Duesseldorf",
  "Leipzig",
  "Dortmund",
  "Essen",
];

const indexedLocalities = rawLocalities.map((entry) => ({
  ...entry,
  label: buildLabel(entry.name, entry.state),
  nameTerms: createSearchTerms(entry.name),
  searchTerms: createSearchTerms(`${entry.name} ${entry.state}`),
}));

const popularLocalities = popularLocations
  .map((name) => indexedLocalities.find((entry) => normalizeText(entry.name) === normalizeText(name)))
  .filter(Boolean);

function scoreMatch(entry, query) {
  const queryTerms = createSearchTerms(query);
  let bestScore = 0;

  for (const normalizedQuery of queryTerms) {
    if (!normalizedQuery) continue;
    if (entry.nameTerms.some((term) => term === normalizedQuery)) bestScore = Math.max(bestScore, 1100);
    if (entry.nameTerms.some((term) => term.startsWith(normalizedQuery))) bestScore = Math.max(bestScore, 900);
    if (entry.searchTerms.some((term) => term === normalizedQuery)) bestScore = Math.max(bestScore, 850);
    if (entry.searchTerms.some((term) => term.startsWith(normalizedQuery))) bestScore = Math.max(bestScore, 700);
    if (entry.searchTerms.some((term) => term.includes(normalizedQuery))) bestScore = Math.max(bestScore, 500);
  }

  return bestScore;
}

export function searchGermanLocalities(query, limit = 10) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return popularLocalities.slice(0, limit).map((entry) => ({
      value: entry.name,
      label: entry.label,
      state: entry.state,
    }));
  }

  return indexedLocalities
    .map((entry) => ({
      entry,
      score: scoreMatch(entry, query),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.entry.name.length !== right.entry.name.length) return left.entry.name.length - right.entry.name.length;
      return collator.compare(left.entry.label, right.entry.label);
    })
    .slice(0, limit)
    .map(({ entry }) => ({
      value: entry.name,
      label: entry.label,
      state: entry.state,
    }));
}

export function countGermanLocalities() {
  return indexedLocalities.length;
}
