const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://app.posthog.com";

function normalizeUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

async function sendToPostHog(event, distinctId, properties) {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return false;

  const payload = {
    api_key: apiKey,
    event,
    distinct_id: distinctId || "anonymous",
    properties,
  };

  const response = await fetch(`${normalizeUrl(POSTHOG_HOST)}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  return response.ok;
}

async function sendToPlausible(event, url, properties) {
  const domain = process.env.PLAUSIBLE_DOMAIN;
  if (!domain) return false;

  const response = await fetch("https://plausible.io/api/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "KhalfaJobs Analytics Proxy",
    },
    body: JSON.stringify({
      domain,
      name: event,
      url,
      props: properties,
    }),
    cache: "no-store",
  });

  return response.ok;
}

export async function captureEvent({ event, distinctId, url, properties = {} }) {
  const cleanEvent = String(event || "").trim();
  if (!cleanEvent) return { sent: false, provider: "none" };

  const sentToPostHog = await sendToPostHog(cleanEvent, distinctId, properties).catch(() => false);
  const sentToPlausible = await sendToPlausible(cleanEvent, url, properties).catch(() => false);

  if (sentToPostHog) return { sent: true, provider: "posthog" };
  if (sentToPlausible) return { sent: true, provider: "plausible" };
  return { sent: false, provider: "none" };
}
