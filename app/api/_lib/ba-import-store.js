import { prisma } from "./prisma";

function toPlainImportRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    source: run.source,
    mode: run.mode,
    status: run.status,
    source_used: run.sourceUsed,
    queries_executed: run.queriesExecuted || [],
    total_found: run.totalFound,
    total_fetched: run.totalFetched,
    new_count: run.newCount,
    updated_count: run.updatedCount,
    unchanged_count: run.unchangedCount,
    duplicate_count: run.duplicateCount,
    error_count: run.errorCount,
    expired_count: run.expiredCount,
    removed_count: run.removedCount,
    last_page_fetched: run.lastPageFetched,
    duration_ms: run.durationMs,
    recent_errors: run.recentErrors || [],
    notes: run.notes || null,
    started_at: run.startedAt?.toISOString() || null,
    completed_at: run.completedAt?.toISOString() || null,
    created_at: run.createdAt?.toISOString() || null,
    updated_at: run.updatedAt?.toISOString() || null,
  };
}

function toPlainImportedJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    source: job.source,
    source_key: job.sourceKey,
    external_id: job.externalId,
    reference: job.reference,
    title: job.title,
    employer: job.employer,
    location: job.location,
    postal_code: job.postalCode,
    city: job.city,
    country: job.country,
    contract_type: job.contractType,
    work_time: job.workTime,
    salary: job.salary,
    published_at: job.publishedAt?.toISOString() || null,
    expires_at: job.expiresAt?.toISOString() || null,
    description: job.description,
    source_url: job.sourceUrl,
    source_name: job.sourceName,
    remote_mode: job.remoteMode,
    category: job.category,
    experience_level: job.experienceLevel,
    status: job.status,
    first_imported_at: job.firstImportedAt?.toISOString() || null,
    last_imported_at: job.lastImportedAt?.toISOString() || null,
    last_updated_at_source: job.lastUpdatedAtSource?.toISOString() || null,
    last_seen_at: job.lastSeenAt?.toISOString() || null,
    removed_at: job.removedAt?.toISOString() || null,
  };
}

export async function createImportRun({ source = "bundesagentur", mode = "full", sourceUsed = null, queriesExecuted = [] }) {
  const run = await prisma.importRun.create({
    data: {
      source,
      mode,
      status: "RUNNING",
      sourceUsed,
      queriesExecuted,
    },
  });

  return toPlainImportRun(run);
}

export async function finalizeImportRun(id, payload) {
  const run = await prisma.importRun.update({
    where: { id: Number(id) },
    data: {
      status: payload.status || "COMPLETED",
      totalFound: payload.totalFound ?? 0,
      totalFetched: payload.totalFetched ?? 0,
      newCount: payload.newCount ?? 0,
      updatedCount: payload.updatedCount ?? 0,
      unchangedCount: payload.unchangedCount ?? 0,
      duplicateCount: payload.duplicateCount ?? 0,
      errorCount: payload.errorCount ?? 0,
      expiredCount: payload.expiredCount ?? 0,
      removedCount: payload.removedCount ?? 0,
      lastPageFetched: payload.lastPageFetched ?? 0,
      durationMs: payload.durationMs ?? null,
      recentErrors: payload.recentErrors || [],
      notes: payload.notes || null,
      completedAt: new Date(),
    },
  });

  return toPlainImportRun(run);
}

export async function getLatestImportRun(source = "bundesagentur") {
  const run = await prisma.importRun.findFirst({
    where: { source },
    orderBy: { startedAt: "desc" },
  });

  return toPlainImportRun(run);
}

export async function countImportedJobs(source = "bundesagentur") {
  return prisma.importedJob.count({
    where: { source },
  });
}

export async function listRecentImportedJobs({ source = "bundesagentur", limit = 10 } = {}) {
  const jobs = await prisma.importedJob.findMany({
    where: { source },
    orderBy: { lastImportedAt: "desc" },
    take: Math.min(Math.max(Number(limit) || 10, 1), 50),
  });

  return jobs.map(toPlainImportedJob);
}

export async function upsertImportedJob(job, seenAt = new Date()) {
  const existing = await prisma.importedJob.findUnique({
    where: { sourceKey: job.sourceKey },
  });

  if (!existing) {
    const created = await prisma.importedJob.create({
      data: {
        ...job,
        firstImportedAt: seenAt,
        lastImportedAt: seenAt,
        lastSeenAt: seenAt,
        removedAt: null,
      },
    });
    return { operation: "created", job: toPlainImportedJob(created) };
  }

  const hasChanged = existing.contentHash !== job.contentHash || existing.status !== job.status;
  const updated = await prisma.importedJob.update({
    where: { sourceKey: job.sourceKey },
    data: {
      ...job,
      lastImportedAt: seenAt,
      lastSeenAt: seenAt,
      removedAt: job.status === "REMOVED" ? seenAt : null,
    },
  });

  return { operation: hasChanged ? "updated" : "unchanged", job: toPlainImportedJob(updated) };
}

export async function markStaleImportedJobs({ source = "bundesagentur", seenAfter, nextStatus = "REMOVED" }) {
  if (!seenAfter) return 0;
  const result = await prisma.importedJob.updateMany({
    where: {
      source,
      status: { not: nextStatus },
      lastSeenAt: { lt: seenAfter },
    },
    data: {
      status: nextStatus,
      removedAt: new Date(),
    },
  });
  return result.count || 0;
}
