import crypto from "node:crypto";
import { prisma } from "./prisma";

function hashKey(apiKey) {
  if (!apiKey) return "";
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function mapSubscription(sub) {
  if (!sub) return null;
  return {
    id: sub.id,
    agency_id: sub.agencyId,
    keyword: sub.keyword,
    location: sub.location,
    frequency: sub.frequency,
    max_results: sub.maxResults,
    is_active: sub.isActive,
    double_opt_in_status: sub.doubleOptInStatus,
    confirmed_at: sub.confirmedAt ? sub.confirmedAt.toISOString() : null,
    last_sent_at: sub.lastSentAt ? sub.lastSentAt.toISOString() : null,
    created_at: sub.createdAt.toISOString(),
  };
}

function mapAgency(agency, apiKey = null) {
  if (!agency) return null;
  return {
    id: agency.id,
    name: agency.name,
    email: agency.email,
    plan: agency.plan,
    is_active: agency.isActive,
    email_verified: Boolean(agency.emailVerifiedAt),
    email_verified_at: agency.emailVerifiedAt ? agency.emailVerifiedAt.toISOString() : null,
    verification_email_sent_at: agency.verificationEmailSentAt ? agency.verificationEmailSentAt.toISOString() : null,
    api_key: apiKey,
    created_at: agency.createdAt.toISOString(),
  };
}

function mapAgencyUser(member) {
  if (!member) return null;
  return {
    id: member.id,
    agency_id: member.agencyId,
    email: member.email,
    full_name: member.fullName,
    role: member.role,
    is_active: member.isActive,
    invited_at: member.invitedAt ? member.invitedAt.toISOString() : null,
    accepted_at: member.acceptedAt ? member.acceptedAt.toISOString() : null,
    last_seen_at: member.lastSeenAt ? member.lastSeenAt.toISOString() : null,
    created_at: member.createdAt.toISOString(),
  };
}

function mapAuditLog(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    agency_id: entry.agencyId,
    actor_email: entry.actorEmail,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: entry.metadata || null,
    created_at: entry.createdAt.toISOString(),
  };
}

function mapSearchHistory(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    agency_id: entry.agencyId,
    keyword: entry.keyword,
    location: entry.location,
    exact_location: entry.exactLocation,
    result_count: entry.resultCount,
    exported_count: entry.exportedCount,
    created_at: entry.createdAt.toISOString(),
  };
}

function mapCandidateDossier(dossier) {
  if (!dossier) return null;
  return {
    id: dossier.id,
    agency_id: dossier.agencyId,
    reference: dossier.reference,
    title: dossier.title,
    employer: dossier.employer,
    location: dossier.location,
    status: dossier.status,
    notes: dossier.notes,
    tags: Array.isArray(dossier.tags) ? dossier.tags : [],
    created_at: dossier.createdAt.toISOString(),
    updated_at: dossier.updatedAt.toISOString(),
  };
}

function mapBillingAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    agency_id: account.agencyId,
    status: account.status,
    plan_name: account.planName,
    seats: account.seats,
    customer_ref: account.customerRef,
    trial_ends_at: account.trialEndsAt ? account.trialEndsAt.toISOString() : null,
    current_period_end: account.currentPeriodEnd ? account.currentPeriodEnd.toISOString() : null,
    created_at: account.createdAt.toISOString(),
  };
}

function mapComplianceProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    agency_id: profile.agencyId,
    privacy_accepted_at: profile.privacyAcceptedAt ? profile.privacyAcceptedAt.toISOString() : null,
    terms_accepted_at: profile.termsAcceptedAt ? profile.termsAcceptedAt.toISOString() : null,
    double_opt_in_enabled: profile.doubleOptInEnabled,
    audit_trail_enabled: profile.auditTrailEnabled,
    retention_policy_days: profile.retentionPolicyDays,
    created_at: profile.createdAt.toISOString(),
    updated_at: profile.updatedAt.toISOString(),
  };
}

function mapCrmIntegration(integration) {
  if (!integration) return null;
  return {
    id: integration.id,
    agency_id: integration.agencyId,
    provider: integration.provider,
    display_name: integration.displayName,
    status: integration.status,
    external_account_id: integration.externalAccountId,
    last_sync_at: integration.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
    config: integration.config || null,
    created_at: integration.createdAt.toISOString(),
  };
}

function buildWorkspaceOverview(agencyRecord, apiKey = null, options = {}) {
  const { includeSensitive = false } = options;
  const agency = mapAgency(agencyRecord, apiKey);
  const members = (agencyRecord.members || []).map(mapAgencyUser);
  const searchHistory = (agencyRecord.searchHistory || []).map(mapSearchHistory);
  const candidateDossiers = (agencyRecord.candidateDossiers || []).map(mapCandidateDossier);
  const crmIntegrations = (agencyRecord.crmIntegrations || []).map(mapCrmIntegration);
  const auditLogs = includeSensitive ? (agencyRecord.auditLogs || []).map(mapAuditLog) : [];
  const billingAccount = mapBillingAccount(agencyRecord.billingAccount);
  const complianceProfile = mapComplianceProfile(agencyRecord.complianceProfile);
  const activeSubscriptions = (agencyRecord.subscriptions || []).filter((subscription) => subscription.isActive);

  return {
    agency,
    workspace: {
      members,
      roles: members.map((member) => ({
        email: member.email,
        role: member.role,
      })),
      search_history: searchHistory,
      candidate_dossiers: candidateDossiers,
      crm_integrations: crmIntegrations,
      billing_account: billingAccount,
      compliance_profile: complianceProfile,
      audit_logs: auditLogs,
      reporting: {
        active_members: members.filter((member) => member.is_active).length,
        active_alerts: activeSubscriptions.length,
        recent_searches: searchHistory.length,
        shared_dossiers: candidateDossiers.length,
        connected_integrations: crmIntegrations.filter((integration) => integration.status === "CONNECTED").length,
      },
      trust: {
        gdpr_ready: Boolean(complianceProfile?.privacy_accepted_at && complianceProfile?.terms_accepted_at),
        double_opt_in: Boolean(complianceProfile?.double_opt_in_enabled),
        audit_trail: Boolean(complianceProfile?.audit_trail_enabled),
        verified_sender: Boolean(agency.email_verified),
      },
    },
  };
}

async function getAgencyRecord(apiKey, options = {}) {
  const {
    requireVerified = false,
    include = {},
  } = options;

  if (!apiKey) throw createHttpError("Ungueltiger Agentur-Schluessel", 401);

  const apiKeyHash = hashKey(apiKey);
  const agency = await prisma.agency.findUnique({
    where: { apiKeyHash },
    include,
  });

  if (!agency || !agency.isActive) throw createHttpError("Ungueltiger Agentur-Schluessel", 401);
  if (requireVerified && !agency.emailVerifiedAt) {
    throw createHttpError("Bitte bestaetigen Sie zuerst die E-Mail-Adresse Ihrer Agentur.", 403);
  }

  return agency;
}

export async function recordAuditLog({ agencyId, actorEmail = null, action, entityType, entityId = null, metadata = null }) {
  if (!agencyId || !action || !entityType) return null;

  const entry = await prisma.auditLog.create({
    data: {
      agencyId: Number(agencyId),
      actorEmail,
      action,
      entityType,
      entityId,
      metadata,
    },
  });

  return mapAuditLog(entry);
}

export async function createAgency({ name, email, plan = "starter" }) {
  const existing = await prisma.agency.findUnique({
    where: { email },
  });
  if (existing) {
    throw createHttpError("Eine Agentur mit dieser E-Mail existiert bereits", 409);
  }

  const rawKey = `emp_${crypto.randomBytes(32).toString("base64url")}`;
  const apiKeyHash = hashKey(rawKey);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const agency = await prisma.agency.create({
    data: {
      name,
      email,
      plan,
      apiKeyHash,
      members: {
        create: {
          email,
          fullName: name,
          role: "OWNER",
          invitedAt: now,
          acceptedAt: now,
          lastSeenAt: now,
        },
      },
      billingAccount: {
        create: {
          status: "TRIAL",
          planName: plan === "agentur" ? "Agency" : "Starter",
          seats: plan === "agentur" ? 5 : 1,
          trialEndsAt,
        },
      },
      complianceProfile: {
        create: {
          doubleOptInEnabled: true,
          auditTrailEnabled: true,
          retentionPolicyDays: 180,
        },
      },
      crmIntegrations: {
        create: [
          { provider: "personio", displayName: "Personio", status: "NOT_CONNECTED" },
          { provider: "hubspot", displayName: "HubSpot CRM", status: "NOT_CONNECTED" },
          { provider: "greenhouse", displayName: "Greenhouse ATS", status: "NOT_CONNECTED" },
        ],
      },
    },
    include: {
      members: true,
      billingAccount: true,
      complianceProfile: true,
      crmIntegrations: true,
    },
  });

  await recordAuditLog({
    agencyId: agency.id,
    actorEmail: email,
    action: "agency_created",
    entityType: "agency",
    entityId: String(agency.id),
    metadata: { plan },
  });

  return mapAgency(agency, rawKey);
}

export async function getAgency(apiKey, options = {}) {
  const agency = await getAgencyRecord(apiKey, { requireVerified: options.requireVerified });
  return mapAgency(agency, apiKey);
}

export async function getAgencyWorkspace(apiKey, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 6, 1), 20);
  const agency = await getAgencyRecord(apiKey, {
    include: {
      members: {
        where: { isActive: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
      subscriptions: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
      searchHistory: {
        orderBy: { createdAt: "desc" },
        take: limit,
      },
      candidateDossiers: {
        orderBy: { updatedAt: "desc" },
        take: limit,
      },
      crmIntegrations: {
        orderBy: { displayName: "asc" },
      },
      billingAccount: true,
      complianceProfile: true,
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: limit,
      },
    },
  });

  return buildWorkspaceOverview(agency, apiKey, { includeSensitive: true });
}

export async function createSubscription(apiKey, payload) {
  const agency = await getAgencyRecord(apiKey, { requireVerified: true });
  const now = new Date();
  const subscription = await prisma.searchSubscription.create({
    data: {
      agencyId: agency.id,
      keyword: payload.keyword,
      location: payload.location,
      frequency: payload.frequency || "daily",
      maxResults: Math.min(Math.max(Number(payload.max_results) || 25, 1), 100),
      doubleOptInStatus: "confirmed",
      confirmedAt: now,
    },
  });

  await recordAuditLog({
    agencyId: agency.id,
    actorEmail: agency.email,
    action: "subscription_created",
    entityType: "subscription",
    entityId: String(subscription.id),
    metadata: { keyword: subscription.keyword, location: subscription.location },
  });

  return mapSubscription(subscription);
}

export async function listSubscriptions(apiKey) {
  const agency = await getAgencyRecord(apiKey);
  const subs = await prisma.searchSubscription.findMany({
    where: { agencyId: agency.id, isActive: true },
    orderBy: { id: "desc" },
  });
  return subs.map(mapSubscription);
}

export async function listAllAgencySubscriptions() {
  const subs = await prisma.searchSubscription.findMany({
    where: { isActive: true },
    include: { agency: true },
  });

  return subs
    .map((sub) => {
      if (!sub.agency || !sub.agency.isActive || !sub.agency.emailVerifiedAt) return null;
      return {
        agency: mapAgency(sub.agency),
        subscription: mapSubscription(sub),
      };
    })
    .filter(Boolean);
}

export async function getSubscription(apiKey, id, options = {}) {
  const { requireVerified = false } = options;
  const agency = await getAgencyRecord(apiKey, { requireVerified });
  const sub = await prisma.searchSubscription.findUnique({
    where: { id: Number(id) },
    include: { agency: true },
  });

  if (!sub || sub.agencyId !== agency.id) throw createHttpError("Benachrichtigung nicht gefunden", 404);

  return {
    agency: mapAgency(sub.agency),
    subscription: mapSubscription(sub),
  };
}

export async function removeSubscription(apiKey, id) {
  const agency = await getAgencyRecord(apiKey);
  const { subscription } = await getSubscription(apiKey, id);

  const updated = await prisma.searchSubscription.update({
    where: { id: Number(subscription.id) },
    data: { isActive: false },
  });

  await recordAuditLog({
    agencyId: agency.id,
    actorEmail: agency.email,
    action: "subscription_removed",
    entityType: "subscription",
    entityId: String(updated.id),
    metadata: { keyword: updated.keyword, location: updated.location },
  });

  return mapSubscription(updated);
}

export async function deactivateSubscription(id) {
  const subscription = await prisma.searchSubscription.update({
    where: { id: Number(id) },
    data: { isActive: false },
  });

  await recordAuditLog({
    agencyId: subscription.agencyId,
    action: "subscription_deactivated",
    entityType: "subscription",
    entityId: String(subscription.id),
  });

  return mapSubscription(subscription);
}

export async function recordDelivery(subscription, recipient, subject, status, errorMessage = null) {
  const now = new Date();

  await prisma.searchSubscription.update({
    where: { id: Number(subscription.id) },
    data: { lastSentAt: now },
  });

  const delivery = await prisma.emailDelivery.create({
    data: {
      subscriptionId: Number(subscription.id),
      recipientEmail: recipient,
      subject,
      status,
      errorMessage,
      sentAt: status === "sent" ? now : null,
    },
  });

  await recordAuditLog({
    agencyId: subscription.agency_id,
    actorEmail: recipient,
    action: status === "sent" ? "email_delivery_sent" : "email_delivery_logged",
    entityType: "email_delivery",
    entityId: String(delivery.id),
    metadata: { status, subject },
  });

  return {
    id: delivery.id,
    subscription_id: delivery.subscriptionId,
    recipient_email: delivery.recipientEmail,
    subject: delivery.subject,
    status: delivery.status,
    error_message: delivery.errorMessage,
    created_at: delivery.createdAt.toISOString(),
  };
}

export async function recordSearchHistory(apiKey, payload) {
  if (!apiKey) return null;
  const agency = await getAgencyRecord(apiKey).catch(() => null);
  if (!agency) return null;

  if (Number(payload.exportedCount) > 0) {
    const latestMatching = await prisma.searchHistory.findFirst({
      where: {
        agencyId: agency.id,
        keyword: payload.keyword || "",
        location: payload.location || "",
        exactLocation: Boolean(payload.exactLocation),
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestMatching) {
      const updated = await prisma.searchHistory.update({
        where: { id: latestMatching.id },
        data: {
          resultCount: Math.max(Number(payload.resultCount) || latestMatching.resultCount || 0, 0),
          exportedCount: Math.max(Number(payload.exportedCount) || 0, 0),
        },
      });

      await recordAuditLog({
        agencyId: agency.id,
        actorEmail: agency.email,
        action: "search_export_recorded",
        entityType: "search_history",
        entityId: String(updated.id),
        metadata: {
          keyword: updated.keyword,
          location: updated.location,
          result_count: updated.resultCount,
          exported_count: updated.exportedCount,
        },
      });

      return mapSearchHistory(updated);
    }
  }

  const entry = await prisma.searchHistory.create({
    data: {
      agencyId: agency.id,
      keyword: payload.keyword || "",
      location: payload.location || "",
      exactLocation: Boolean(payload.exactLocation),
      resultCount: Math.max(Number(payload.resultCount) || 0, 0),
      exportedCount: Math.max(Number(payload.exportedCount) || 0, 0),
    },
  });

  await recordAuditLog({
    agencyId: agency.id,
    actorEmail: agency.email,
    action: payload.exportedCount ? "search_export_recorded" : "search_recorded",
    entityType: "search_history",
    entityId: String(entry.id),
    metadata: {
      keyword: entry.keyword,
      location: entry.location,
      result_count: entry.resultCount,
      exported_count: entry.exportedCount,
    },
  });

  return mapSearchHistory(entry);
}

export async function listSearchHistory(apiKey, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 20);
  const agency = await getAgencyRecord(apiKey);
  const entries = await prisma.searchHistory.findMany({
    where: { agencyId: agency.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return entries.map(mapSearchHistory);
}

export async function listCandidateDossiers(apiKey, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 12, 1), 50);
  const agency = await getAgencyRecord(apiKey);
  const dossiers = await prisma.candidateDossier.findMany({
    where: { agencyId: agency.id },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return dossiers.map(mapCandidateDossier);
}

export async function upsertCandidateDossier(apiKey, payload) {
  const agency = await getAgencyRecord(apiKey, { requireVerified: true });
  const dossier = await prisma.candidateDossier.upsert({
    where: {
      agencyId_reference: {
        agencyId: agency.id,
        reference: payload.reference,
      },
    },
    create: {
      agencyId: agency.id,
      reference: payload.reference,
      title: payload.title,
      employer: payload.employer,
      location: payload.location,
      status: payload.status || "interested",
      notes: payload.notes || "",
      tags: payload.tags || [],
    },
    update: {
      title: payload.title,
      employer: payload.employer,
      location: payload.location,
      status: payload.status || "interested",
      notes: payload.notes || "",
      tags: payload.tags || [],
    },
  });

  await recordAuditLog({
    agencyId: agency.id,
    actorEmail: agency.email,
    action: "candidate_dossier_upserted",
    entityType: "candidate_dossier",
    entityId: dossier.reference,
    metadata: { status: dossier.status },
  });

  return mapCandidateDossier(dossier);
}

export async function removeCandidateDossier(apiKey, reference) {
  const agency = await getAgencyRecord(apiKey, { requireVerified: true });
  const dossier = await prisma.candidateDossier.delete({
    where: {
      agencyId_reference: {
        agencyId: agency.id,
        reference,
      },
    },
  });

  await recordAuditLog({
    agencyId: agency.id,
    actorEmail: agency.email,
    action: "candidate_dossier_removed",
    entityType: "candidate_dossier",
    entityId: reference,
  });

  return mapCandidateDossier(dossier);
}

export async function markAgencyVerificationEmailSent(id) {
  const agency = await prisma.agency.update({
    where: { id: Number(id) },
    data: { verificationEmailSentAt: new Date() },
  });

  await recordAuditLog({
    agencyId: agency.id,
    actorEmail: agency.email,
    action: "agency_verification_email_sent",
    entityType: "agency",
    entityId: String(agency.id),
  });

  return mapAgency(agency);
}

export async function verifyAgencyEmail(id) {
  const now = new Date();
  const agency = await prisma.agency.update({
    where: { id: Number(id) },
    data: { emailVerifiedAt: now },
  });

  await prisma.agencyUser.updateMany({
    where: { agencyId: agency.id, email: agency.email },
    data: { acceptedAt: now, lastSeenAt: now },
  });

  await recordAuditLog({
    agencyId: agency.id,
    actorEmail: agency.email,
    action: "agency_email_verified",
    entityType: "agency",
    entityId: String(agency.id),
  });

  return mapAgency(agency);
}
