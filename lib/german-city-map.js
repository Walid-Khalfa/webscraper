/**
 * Static lookup table of [latitude, longitude] pairs for German cities,
 * keyed by the canonical `normalizeCityKey` output (lowercased, ASCII-only,
 * trimmed). The JSDoc exposes the type to TypeScript callers so they can
 * index with arbitrary string keys without runtime casts.
 * @type {Record<string, [number, number]>}
 */
export const GERMAN_CITY_COORDS = {
  berlin: [52.52, 13.405],
  hamburg: [53.5511, 9.9937],
  "münchen": [48.1351, 11.582],
  "koln": [50.9375, 6.9603],
  "köln": [50.9375, 6.9603],
  "frankfurt am main": [50.1109, 8.6821],
  stuttgart: [48.7758, 9.1829],
  "düsseldorf": [51.2277, 6.7735],
  dusseldorf: [51.2277, 6.7735],
  leipzig: [51.3397, 12.3731],
  dortmund: [51.5136, 7.4653],
  essen: [51.4556, 7.0116],
  bremen: [53.0793, 8.8017],
  dresden: [51.0504, 13.7373],
  hannover: [52.3759, 9.732],
  "nürnberg": [49.4521, 11.0767],
  nurnberg: [49.4521, 11.0767],
  duisburg: [51.4325, 6.7652],
  bochum: [51.4818, 7.2162],
  wuppertal: [51.2562, 7.1508],
  bielefeld: [52.0302, 8.5325],
  bonn: [50.7374, 7.0982],
  "münster": [51.9607, 7.6261],
  munster: [51.9607, 7.6261],
  karlsruhe: [49.0069, 8.4037],
  mannheim: [49.4875, 8.466],
  augsburg: [48.3715, 10.8985],
  wiesbaden: [50.0782, 8.2398],
  gelsenkirchen: [51.5112, 7.1028],
  "mönchengladbach": [51.1927, 6.4327],
  monchengladbach: [51.1927, 6.4327],
  braunschweig: [52.2689, 10.5268],
  kiel: [54.3233, 10.1228],
  chemnitz: [50.8333, 12.9167],
  aachen: [50.7753, 6.0839],
  halle: [51.4828, 11.9697],
  magdeburg: [52.1205, 11.6276],
  freiburg: [47.999, 7.8421],
  "freiburg im breisgau": [47.999, 7.8421],
  krefeld: [51.3333, 6.5667],
  "lübeck": [53.8655, 10.6866],
  lubeck: [53.8655, 10.6866],
  mainz: [49.9929, 8.2473],
  erfurt: [50.9787, 11.0328],
  oberhausen: [51.47, 6.8646],
  rostock: [54.0924, 12.0991],
  kassel: [51.3127, 9.4797],
  hagen: [51.3671, 7.4633],
  "saarbrücken": [49.2401, 6.9969],
  saarbrucken: [49.2401, 6.9969],
  hamm: [51.6811, 7.818],
  potsdam: [52.3906, 13.0645],
  ludwigshafen: [49.4815, 8.4419],
  "mülheim": [51.4275, 6.8825],
  mulheim: [51.4275, 6.8825],
  oldenburg: [53.1435, 8.2146],
  "osnabrück": [52.2799, 8.0472],
  osnabruck: [52.2799, 8.0472],
  leverkusen: [51.0303, 6.9843],
  heidelberg: [49.3988, 8.6724],
  darmstadt: [49.8728, 8.6512],
};

/**
 * Short market-signal copy per curated city (German-friendly, mostly
 * French-localized UX). Keyed by `normalizeCityKey`. Consumed as
 * fallback copy in `useSearch.ts getCityMarketSignal`.
 * @type {Record<string, string>}
 */
export const CITY_MARKET_NOTES = {
  berlin: "Scale-up, produit et design",
  hamburg: "Logistique, santé et opérations",
  "münchen": "Industrie, data et conseil",
  "frankfurt am main": "Finance, support et ventes B2B",
  "köln": "Médias, support client et commerce",
  stuttgart: "Automobile, production et ingénierie",
  leipzig: "Supply chain et services",
  dresden: "Semi-conducteurs et R&D",
};

// Career focus tags — used by the map coach to recommend where to look
// based on the recruiter's search profile.
/**
 * Curated career-focus tags (e.g. ["tech", "data"]) per city. Keyed by
 * `normalizeCityKey`. Used by the map coach overlay to recommend
 * vertical slices to recruiters. Marked `readonly` because consumers
 * never mutate these lists — they pass them straight through to UI.
 * @type {Record<string, readonly string[]>}
 */
export const CITY_CAREER_FOCUS = {
  berlin: ["tech", "produit", "design", "data"],
  hamburg: ["pflege", "logistik", "operations", "sales"],
  "münchen": ["industrie", "ingenieur", "data", "beratung"],
  "frankfurt am main": ["finance", "sales", "support", "beratung"],
  "köln": ["media", "support", "commerce", "marketing"],
  stuttgart: ["automotive", "industrie", "ingenieur", "produktion"],
  leipzig: ["logistik", "supply", "services", "sales"],
  dresden: ["industrie", "semi-conductor", "rd", "ingenieur"],
  düsseldorf: ["media", "sales", "beratung", "commerce"],
  dortmund: ["industrie", "handwerk", "logistik", "produktion"],
  essen: ["energie", "handwerk", "pflege", "sales"],
  bremen: ["logistik", "produktion", "ingenieur", "handel"],
};

// Friendly German sentence per city for the coach overlay.
/**
 * Long-form coach copy (German sentences) per curated city. Keyed by
 * `normalizeCityKey`. Consumed by `getCityGuideSentence()` which falls
 * back to a generic transversal sentence for un-curated entries.
 * @type {Record<string, string>}
 */
export const CITY_GUIDE_SENTENCES = {
  berlin: "Berlin concentre les profils tech, produit et design : priorisez ces annonces pour vos clients SaaS.",
  hamburg: "Hamburg combine logistique, santé et opérations – votre vivier polyvalent pour les postes support.",
  "münchen": "München concentre industrie, data et conseil – cartez ces profils premium pour vos clients grands comptes.",
  "frankfurt am main": "Frankfurt est le hub finance, B2B et support – exploitez ce bassin pour vos missions commerciales.",
  "köln": "Köln rassemble médias, support client et commerce – un excellent terrain pour les postes customer-facing.",
  stuttgart: "Stuttgart reste le cœur automobile et ingénierie allemande – candidat idéal pour vos missions industrielles.",
  leipzig: "Leipzig émerge fort sur la supply chain et les services – surveillez cette dynamique pour anticiper les ouvertures.",
  dresden: "Dresden concentre les semi-conducteurs et la R&D – rare et haut de gamme pour vos missions cadres.",
  "düsseldorf": "Düsseldorf brille en média, conseil et commerce – bassin dense et accessible pour vos profils hybrides.",
};

export function normalizeCityKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractPrimaryCity(location) {
  return String(location || "")
    .split(",")[0]
    .split("(")[0]
    .trim();
}

// Generic transversal fallback. Object.freeze keeps the OR-boundary
// with CITY_CAREER_FOCUS (typed `readonly string[]` via JSDoc) honest
// at runtime, so consumers can rely on the immutability downstream.
const FALLBACK_CITY_CAREER_FOCUS = Object.freeze([
  "transversal",
  "lokal",
  "vielseitig",
]);

// Resolve the career focus tags for a city, falling back to a generic
// transversal label if we don't have curated guidance for it.
export function getCityCareerFocus(cityKey) {
  const key = normalizeCityKey(cityKey);
  return CITY_CAREER_FOCUS[key] || FALLBACK_CITY_CAREER_FOCUS;
}

export function getCityGuideSentence(cityKey) {
  const key = normalizeCityKey(cityKey);
  return (
    CITY_GUIDE_SENTENCES[key] ||
    `${key || "Cette ville"} est un bassin d'emploi transversal : analysez les annonces pour affiner votre shortlist.`
  );
}
