CREATE TYPE "AgencyRole" AS ENUM ('OWNER', 'ADMIN', 'RECRUITER', 'VIEWER');
CREATE TYPE "BillingStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'ERROR');

ALTER TABLE "search_subscriptions"
ADD COLUMN "double_opt_in_status" TEXT NOT NULL DEFAULT 'confirmed',
ADD COLUMN "double_opt_in_token_hash" TEXT,
ADD COLUMN "confirmed_at" TIMESTAMP(3);

CREATE TABLE "agency_users" (
    "id" SERIAL NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "AgencyRole" NOT NULL DEFAULT 'RECRUITER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invited_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "agency_id" INTEGER,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "search_history" (
    "id" SERIAL NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "keyword" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "exact_location" BOOLEAN NOT NULL DEFAULT true,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "exported_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_dossiers" (
    "id" SERIAL NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "employer" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'interested',
    "notes" TEXT NOT NULL DEFAULT '',
    "tags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_dossiers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_integrations" (
    "id" SERIAL NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "external_account_id" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_accounts" (
    "id" SERIAL NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'TRIAL',
    "plan_name" TEXT NOT NULL DEFAULT 'Starter',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "customer_ref" TEXT,
    "trial_ends_at" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agency_compliance_profiles" (
    "id" SERIAL NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "privacy_accepted_at" TIMESTAMP(3),
    "terms_accepted_at" TIMESTAMP(3),
    "double_opt_in_enabled" BOOLEAN NOT NULL DEFAULT true,
    "audit_trail_enabled" BOOLEAN NOT NULL DEFAULT true,
    "retention_policy_days" INTEGER NOT NULL DEFAULT 180,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_compliance_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agency_users_agency_id_email_key" ON "agency_users"("agency_id", "email");
CREATE INDEX "agency_users_agency_id_role_idx" ON "agency_users"("agency_id", "role");

CREATE INDEX "audit_logs_agency_id_created_at_idx" ON "audit_logs"("agency_id", "created_at");
CREATE INDEX "search_history_agency_id_created_at_idx" ON "search_history"("agency_id", "created_at");

CREATE UNIQUE INDEX "candidate_dossiers_agency_id_reference_key" ON "candidate_dossiers"("agency_id", "reference");
CREATE INDEX "candidate_dossiers_agency_id_status_idx" ON "candidate_dossiers"("agency_id", "status");

CREATE UNIQUE INDEX "crm_integrations_agency_id_provider_key" ON "crm_integrations"("agency_id", "provider");
CREATE UNIQUE INDEX "billing_accounts_agency_id_key" ON "billing_accounts"("agency_id");
CREATE UNIQUE INDEX "agency_compliance_profiles_agency_id_key" ON "agency_compliance_profiles"("agency_id");

ALTER TABLE "agency_users"
ADD CONSTRAINT "agency_users_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "search_history"
ADD CONSTRAINT "search_history_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_dossiers"
ADD CONSTRAINT "candidate_dossiers_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_integrations"
ADD CONSTRAINT "crm_integrations_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_accounts"
ADD CONSTRAINT "billing_accounts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agency_compliance_profiles"
ADD CONSTRAINT "agency_compliance_profiles_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
