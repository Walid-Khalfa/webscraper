export const DEFAULT_IMPORT_KEYWORDS = [
  "Softwareentwickler",
  "Frontend-Entwickler",
  "Backend-Entwickler",
  "Full Stack Entwickler",
  "DevOps Engineer",
  "Data Engineer",
  "Pflegefachkraft",
  "Elektriker",
  "Mechatroniker",
  "Projektmanager",
  "Recruiter",
  "Buchhalter",
];

export const DEFAULT_IMPORT_LOCATIONS = [
  "",
  "Berlin",
  "Hamburg",
  "München",
  "Köln",
  "Frankfurt am Main",
  "Stuttgart",
  "Düsseldorf",
  "Leipzig",
  "Dresden",
];

export function buildDefaultImportQueries() {
  const queries = [];
  for (const keyword of DEFAULT_IMPORT_KEYWORDS) {
    for (const location of DEFAULT_IMPORT_LOCATIONS) {
      queries.push({
        keyword,
        location,
      });
    }
  }

  return queries;
}

export function getImportRuntimeConfig(mode = "full") {
  const isTestMode = mode === "test";

  return {
    pageSize: Math.min(Math.max(Number(process.env.BA_IMPORT_PAGE_SIZE || 100), 1), 100),
    maxPagesPerQuery: isTestMode
      ? Math.min(Math.max(Number(process.env.BA_IMPORT_TEST_MAX_PAGES || 2), 1), 10)
      : Math.min(Math.max(Number(process.env.BA_IMPORT_MAX_PAGES || 40), 1), 200),
    maxItemsPerQuery: isTestMode
      ? Math.min(Math.max(Number(process.env.BA_IMPORT_TEST_MAX_ITEMS || 200), 1), 500)
      : Math.min(Math.max(Number(process.env.BA_IMPORT_MAX_ITEMS || 4000), 1), 20000),
    retryAttempts: Math.min(Math.max(Number(process.env.BA_IMPORT_RETRY_ATTEMPTS || 3), 1), 6),
    retryDelayMs: Math.min(Math.max(Number(process.env.BA_IMPORT_RETRY_DELAY_MS || 700), 100), 5000),
    interPageDelayMs: Math.min(Math.max(Number(process.env.BA_IMPORT_INTER_PAGE_DELAY_MS || 150), 0), 3000),
    queryConcurrency: isTestMode
      ? Math.min(Math.max(Number(process.env.BA_IMPORT_TEST_CONCURRENCY || 1), 1), 2)
      : Math.min(Math.max(Number(process.env.BA_IMPORT_CONCURRENCY || 2), 1), 6),
    markMissingAsRemoved: !isTestMode,
  };
}
