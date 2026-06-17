export function trackEvent(event, properties = {}) {
  if (typeof window === "undefined") return;

  let distinctId;

  try {
    distinctId = window.localStorage.getItem("agencyAnalyticsId");
    if (!distinctId) {
      distinctId = crypto.randomUUID();
      window.localStorage.setItem("agencyAnalyticsId", distinctId);
    }
  } catch {}

  const payload = JSON.stringify({
    event,
    properties,
    url: window.location.href,
    path: window.location.pathname,
    distinctId: distinctId || undefined,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/analytics", blob);
    return;
  }

  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}
