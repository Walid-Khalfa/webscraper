-- CreateEnum
CREATE TYPE "ImportedJobStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REMOVED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "imported_jobs" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'bundesagentur',
    "source_key" TEXT NOT NULL,
    "external_id" TEXT,
    "reference" TEXT,
    "title" TEXT NOT NULL,
    "employer" TEXT,
    "location" TEXT,
    "postal_code" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "contract_type" TEXT,
    "work_time" TEXT,
    "salary" TEXT,
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "description" TEXT,
    "source_url" TEXT,
    "source_name" TEXT NOT NULL DEFAULT 'Bundesagentur für Arbeit',
    "remote_mode" TEXT,
    "category" TEXT,
    "experience_level" TEXT,
    "status" "ImportedJobStatus" NOT NULL DEFAULT 'UNKNOWN',
    "content_hash" TEXT NOT NULL,
    "raw_payload" JSONB,
    "first_imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at_source" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'bundesagentur',
    "mode" TEXT NOT NULL DEFAULT 'full',
    "status" "ImportRunStatus" NOT NULL DEFAULT 'RUNNING',
    "source_used" TEXT,
    "queries_executed" JSONB,
    "total_found" INTEGER NOT NULL DEFAULT 0,
    "total_fetched" INTEGER NOT NULL DEFAULT 0,
    "new_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "unchanged_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "expired_count" INTEGER NOT NULL DEFAULT 0,
    "removed_count" INTEGER NOT NULL DEFAULT 0,
    "last_page_fetched" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "recent_errors" JSONB,
    "notes" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imported_jobs_source_key_key" ON "imported_jobs"("source_key");

-- CreateIndex
CREATE INDEX "imported_jobs_source_status_idx" ON "imported_jobs"("source", "status");

-- CreateIndex
CREATE INDEX "imported_jobs_last_seen_at_idx" ON "imported_jobs"("last_seen_at");

-- CreateIndex
CREATE INDEX "imported_jobs_reference_idx" ON "imported_jobs"("reference");

-- CreateIndex
CREATE INDEX "imported_jobs_city_idx" ON "imported_jobs"("city");

-- CreateIndex
CREATE INDEX "import_runs_source_started_at_idx" ON "import_runs"("source", "started_at");

-- CreateIndex
CREATE INDEX "import_runs_status_started_at_idx" ON "import_runs"("status", "started_at");
