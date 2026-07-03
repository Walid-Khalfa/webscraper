import { extractJobItems, searchJobs } from "./ba";
import { mapWithConcurrency } from "./concurrency";
import { buildDefaultImportQueries, getImportRuntimeConfig } from "./ba-import-config";
import { normalizeImportedJob } from "./ba-import-normalizer";
import { countImportedJobs, createImportRun, finalizeImportRun, markStaleImportedJobs, upsertImportedJob } from "./ba-import-store";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createImportError(message, cause = null, context = {}) {
  const error = new Error(message);
  error.cause = cause;
  error.context = context;
  return error;
}

async function searchJobsWithRetry(params, config) {
  let lastError = null;
  for (let attempt = 1; attempt <= config.retryAttempts; attempt += 1) {
    try {
      return await searchJobs(params);
    } catch (error) {
      lastError = error;
      if (attempt >= config.retryAttempts) break;
      await sleep(config.retryDelayMs * attempt);
    }
  }
  throw lastError;
}

export async function collectSearchResults(query, options = {}) {
  const mode = options.mode || "full";
  const config = getImportRuntimeConfig(mode);
  const startPage = Math.max(Number(options.startPage) || 1, 1);
  const maxPages = Math.min(Math.max(Number(options.maxPages) || config.maxPagesPerQuery, 1), config.maxPagesPerQuery);
  const fetchPage = options.fetchPage || searchJobsWithRetry;
  const queryStats = {
    ...query,
    startPage,
    pagesFetched: 0,
    totalFound: 0,
    totalFetched: 0,
    stoppedBecause: "completed",
  };

  const items = [];
  const seenPageFingerprints = new Set();

  for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
    const page = startPage + pageOffset;
    const payload = await fetchPage(
      {
        keyword: query.keyword,
        location: query.location,
        page,
        size: config.pageSize,
      },
      config,
    );

    const pageItems = extractJobItems(payload);
    const totalFound = Math.max(Number(payload.maxErgebnisse || 0), queryStats.totalFound);
    const fingerprint = JSON.stringify(pageItems.slice(0, 5).map((item) => item?.referenznummer || item?.stellenangebotsId || item?.titel || item?.hashId || null));

    queryStats.pagesFetched = page;
    queryStats.totalFound = totalFound;
    queryStats.totalFetched += pageItems.length;

    if (pageItems.length === 0) {
      queryStats.stoppedBecause = "empty_page";
      break;
    }

    if (seenPageFingerprints.has(fingerprint)) {
      queryStats.stoppedBecause = "duplicate_page";
      break;
    }
    seenPageFingerprints.add(fingerprint);

    items.push(...pageItems);

    if (items.length >= config.maxItemsPerQuery) {
      queryStats.stoppedBecause = "max_items";
      break;
    }

    if (page * config.pageSize >= totalFound) {
      queryStats.stoppedBecause = "total_exhausted";
      break;
    }

    if (config.interPageDelayMs > 0) {
      await sleep(config.interPageDelayMs);
    }
  }

  return {
    items: items.slice(0, config.maxItemsPerQuery),
    stats: queryStats,
  };
}

function deduplicateNormalizedJobs(normalizedJobs) {
  const seen = new Set();
  const deduped = [];
  let duplicateCount = 0;

  for (const job of normalizedJobs) {
    if (seen.has(job.sourceKey)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(job.sourceKey);
    deduped.push(job);
  }

  return { deduped, duplicateCount };
}

export async function runBaImport({ mode = "full", queries = null } = {}) {
  const startedAt = Date.now();
  const config = getImportRuntimeConfig(mode);
  const importQueries = Array.isArray(queries) && queries.length ? queries : buildDefaultImportQueries();
  const run = await createImportRun({
    source: "bundesagentur",
    mode,
    sourceUsed: "rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs",
    queriesExecuted: importQueries,
  });

  const report = {
    runId: run.id,
    source: "bundesagentur",
    sourceUsed: "rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs",
    mode,
    totalQueries: importQueries.length,
    totalFound: 0,
    totalFetched: 0,
    newCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    duplicateCount: 0,
    errorCount: 0,
    expiredCount: 0,
    removedCount: 0,
    lastPageFetched: 0,
    queriesExecuted: [],
    recentErrors: [],
  };

  try {
    const settled = await mapWithConcurrency(importQueries, config.queryConcurrency, async (query) => collectSearchResults(query, { mode }));

    const rawItems = [];
    for (const entry of settled) {
      if (entry.status === "fulfilled") {
        rawItems.push(...entry.value.items);
        report.totalFound += entry.value.stats.totalFound;
        report.totalFetched += entry.value.stats.totalFetched;
        report.lastPageFetched = Math.max(report.lastPageFetched, entry.value.stats.pagesFetched);
        report.queriesExecuted.push(entry.value.stats);
      } else {
        report.errorCount += 1;
        report.recentErrors.push({
          message: entry.reason?.message || "Unbekannter Importfehler",
        });
      }
    }

    const normalizedJobs = [];
    for (const rawItem of rawItems) {
      try {
        normalizedJobs.push(normalizeImportedJob(rawItem));
      } catch (error) {
        report.errorCount += 1;
        report.recentErrors.push({
          message: error?.message || "Normalisierung fehlgeschlagen",
        });
      }
    }

    const { deduped, duplicateCount } = deduplicateNormalizedJobs(normalizedJobs);
    report.duplicateCount += duplicateCount;

    const seenAt = new Date();
    for (const job of deduped) {
      const result = await upsertImportedJob(job, seenAt);
      if (result.operation === "created") report.newCount += 1;
      if (result.operation === "updated") report.updatedCount += 1;
      if (result.operation === "unchanged") report.unchangedCount += 1;
      if (job.status === "EXPIRED") report.expiredCount += 1;
    }

    if (config.markMissingAsRemoved) {
      report.removedCount = await markStaleImportedJobs({
        source: "bundesagentur",
        seenAfter: seenAt,
        nextStatus: "REMOVED",
      });
    }

    report.totalStored = await countImportedJobs("bundesagentur");
    report.durationMs = Date.now() - startedAt;

    await finalizeImportRun(run.id, {
      status: "COMPLETED",
      totalFound: report.totalFound,
      totalFetched: report.totalFetched,
      newCount: report.newCount,
      updatedCount: report.updatedCount,
      unchangedCount: report.unchangedCount,
      duplicateCount: report.duplicateCount,
      errorCount: report.errorCount,
      expiredCount: report.expiredCount,
      removedCount: report.removedCount,
      lastPageFetched: report.lastPageFetched,
      durationMs: report.durationMs,
      recentErrors: report.recentErrors.slice(-25),
      notes: {
        total_queries: report.totalQueries,
        total_stored: report.totalStored,
      },
    });

    return report;
  } catch (error) {
    report.durationMs = Date.now() - startedAt;
    report.errorCount += 1;
    report.recentErrors.push({
      message: error?.message || "Import fehlgeschlagen",
    });

    await finalizeImportRun(run.id, {
      status: "FAILED",
      totalFound: report.totalFound,
      totalFetched: report.totalFetched,
      newCount: report.newCount,
      updatedCount: report.updatedCount,
      unchangedCount: report.unchangedCount,
      duplicateCount: report.duplicateCount,
      errorCount: report.errorCount,
      expiredCount: report.expiredCount,
      removedCount: report.removedCount,
      lastPageFetched: report.lastPageFetched,
      durationMs: report.durationMs,
      recentErrors: report.recentErrors.slice(-25),
      notes: {
        total_queries: report.totalQueries,
      },
    });

    throw createImportError("BA-Import fehlgeschlagen", error, report);
  }
}
