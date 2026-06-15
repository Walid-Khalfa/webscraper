import crypto from "node:crypto";

const globalStore = globalThis.__emploiAgencyStore ?? {
  agencies: new Map(),
  subscriptions: new Map(),
  deliveries: [],
  agencySeq: 1,
  subscriptionSeq: 1,
};

globalThis.__emploiAgencyStore = globalStore;

export function createAgency({ name, email, plan = "starter" }) {
  const existing = [...globalStore.agencies.values()].find((agency) => agency.email === email);
  if (existing) {
    const error = new Error("Eine Agentur mit dieser E-Mail existiert bereits");
    error.status = 409;
    throw error;
  }

  const apiKey = `emp_${crypto.randomBytes(32).toString("base64url")}`;
  const agency = {
    id: globalStore.agencySeq++,
    name,
    email,
    plan,
    is_active: true,
    api_key: apiKey,
    created_at: new Date().toISOString(),
  };
  globalStore.agencies.set(apiKey, agency);
  return agency;
}

export function getAgency(apiKey) {
  if (!apiKey || !globalStore.agencies.has(apiKey)) {
    const error = new Error("Ungueltiger Agentur-Schluessel");
    error.status = 401;
    throw error;
  }
  return globalStore.agencies.get(apiKey);
}

export function createSubscription(apiKey, payload) {
  const agency = getAgency(apiKey);
  const subscription = {
    id: globalStore.subscriptionSeq++,
    agency_id: agency.id,
    keyword: payload.keyword,
    location: payload.location,
    frequency: payload.frequency || "daily",
    max_results: Math.min(Math.max(Number(payload.max_results) || 25, 1), 100),
    is_active: true,
    last_sent_at: null,
    created_at: new Date().toISOString(),
  };
  globalStore.subscriptions.set(subscription.id, subscription);
  return subscription;
}

export function listSubscriptions(apiKey) {
  const agency = getAgency(apiKey);
  return [...globalStore.subscriptions.values()]
    .filter((subscription) => subscription.agency_id === agency.id)
    .sort((a, b) => b.id - a.id);
}

export function listAllAgencySubscriptions() {
  return [...globalStore.subscriptions.values()]
    .filter((subscription) => subscription.is_active)
    .map((subscription) => {
      const agency = [...globalStore.agencies.values()].find((entry) => entry.id === subscription.agency_id);
      return agency ? { agency, subscription } : null;
    })
    .filter(Boolean);
}

export function getSubscription(apiKey, id) {
  const agency = getAgency(apiKey);
  const subscription = globalStore.subscriptions.get(Number(id));
  if (!subscription || subscription.agency_id !== agency.id) {
    const error = new Error("Benachrichtigung nicht gefunden");
    error.status = 404;
    throw error;
  }
  return { agency, subscription };
}

export function recordDelivery(subscription, recipient, subject, status) {
  subscription.last_sent_at = new Date().toISOString();
  const delivery = {
    id: globalStore.deliveries.length + 1,
    subscription_id: subscription.id,
    recipient_email: recipient,
    subject,
    status,
    created_at: new Date().toISOString(),
  };
  globalStore.deliveries.push(delivery);
  return delivery;
}
