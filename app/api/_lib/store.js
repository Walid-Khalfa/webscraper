import crypto from "node:crypto";
import { prisma } from "./prisma";

function hashKey(apiKey) {
  if (!apiKey) return "";
  return crypto.createHash("sha256").update(apiKey).digest("hex");
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
    last_sent_at: sub.lastSentAt ? sub.lastSentAt.toISOString() : null,
    created_at: sub.createdAt.toISOString(),
  };
}

export async function createAgency({ name, email, plan = "starter" }) {
  const existing = await prisma.agency.findUnique({
    where: { email },
  });
  if (existing) {
    const error = new Error("Eine Agentur mit dieser E-Mail existiert bereits");
    error.status = 409;
    throw error;
  }

  const rawKey = `emp_${crypto.randomBytes(32).toString("base64url")}`;
  const apiKeyHash = hashKey(rawKey);

  const agency = await prisma.agency.create({
    data: {
      name,
      email,
      plan,
      apiKeyHash,
    },
  });

  return {
    id: agency.id,
    name: agency.name,
    email: agency.email,
    plan: agency.plan,
    is_active: agency.isActive,
    api_key: rawKey,
    created_at: agency.createdAt.toISOString(),
  };
}

export async function getAgency(apiKey) {
  if (!apiKey) {
    const error = new Error("Ungueltiger Agentur-Schluessel");
    error.status = 401;
    throw error;
  }

  const apiKeyHash = hashKey(apiKey);
  const agency = await prisma.agency.findUnique({
    where: { apiKeyHash },
  });

  if (!agency || !agency.isActive) {
    const error = new Error("Ungueltiger Agentur-Schluessel");
    error.status = 401;
    throw error;
  }

  return {
    id: agency.id,
    name: agency.name,
    email: agency.email,
    plan: agency.plan,
    is_active: agency.isActive,
    api_key: apiKey,
    created_at: agency.createdAt.toISOString(),
  };
}

export async function createSubscription(apiKey, payload) {
  const agency = await getAgency(apiKey);
  const subscription = await prisma.searchSubscription.create({
    data: {
      agencyId: agency.id,
      keyword: payload.keyword,
      location: payload.location,
      frequency: payload.frequency || "daily",
      maxResults: Math.min(Math.max(Number(payload.max_results) || 25, 1), 100),
    },
  });

  return mapSubscription(subscription);
}

export async function listSubscriptions(apiKey) {
  const agency = await getAgency(apiKey);
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
      if (!sub.agency || !sub.agency.isActive) return null;
      return {
        agency: {
          id: sub.agency.id,
          name: sub.agency.name,
          email: sub.agency.email,
          plan: sub.agency.plan,
          is_active: sub.agency.isActive,
          created_at: sub.agency.createdAt.toISOString(),
        },
        subscription: mapSubscription(sub),
      };
    })
    .filter(Boolean);
}

export async function getSubscription(apiKey, id) {
  const agency = await getAgency(apiKey);
  const sub = await prisma.searchSubscription.findUnique({
    where: { id: Number(id) },
    include: { agency: true },
  });

  if (!sub || sub.agencyId !== agency.id) {
    const error = new Error("Benachrichtigung nicht gefunden");
    error.status = 404;
    throw error;
  }

  return {
    agency: {
      id: sub.agency.id,
      name: sub.agency.name,
      email: sub.agency.email,
      plan: sub.agency.plan,
      is_active: sub.agency.isActive,
      created_at: sub.agency.createdAt.toISOString(),
    },
    subscription: mapSubscription(sub),
  };
}

export async function removeSubscription(apiKey, id) {
  const { subscription } = await getSubscription(apiKey, id);

  const updated = await prisma.searchSubscription.update({
    where: { id: Number(subscription.id) },
    data: { isActive: false },
  });

  return mapSubscription(updated);
}

export async function deactivateSubscription(id) {
  const subscription = await prisma.searchSubscription.update({
    where: { id: Number(id) },
    data: { isActive: false },
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
