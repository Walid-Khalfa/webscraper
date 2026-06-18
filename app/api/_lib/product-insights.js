import { prisma } from "./prisma";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek() {
  const now = new Date();
  const currentDay = now.getDay() || 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDay + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function relativeFrom(date) {
  if (!date) return "Noch keine Aktivitaet";
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes <= 1) return "Vor weniger als 1 Minute";
  if (minutes < 60) return `Vor ${minutes} Minuten`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Vor ${hours} Stunde${hours === 1 ? "" : "n"}`;
  const days = Math.round(hours / 24);
  return `Vor ${days} Tag${days === 1 ? "" : "en"}`;
}

export async function recordProductEvent({ event, distinctId, path, url, properties = {} }) {
  if (!event) return null;

  return prisma.productEvent.create({
    data: {
      event: String(event),
      distinctId: distinctId ? String(distinctId) : null,
      path: path ? String(path) : null,
      url: url ? String(url) : null,
      properties,
    },
  });
}

export async function getPlatformInsights() {
  try {
    const today = startOfToday();
    const weekStart = startOfWeek();

    const [
      activeAgencies,
      activeAlerts,
      searchesToday,
      exportsToday,
      alertsSentToday,
      weeklySearchEvents,
      latestEvent,
      latestDelivery,
      latestSubscription,
    ] = await Promise.all([
      prisma.agency.count({ where: { isActive: true } }),
      prisma.searchSubscription.count({ where: { isActive: true } }),
      prisma.productEvent.count({
        where: {
          event: "search_completed",
          createdAt: { gte: today },
        },
      }),
      prisma.productEvent.count({
        where: {
          event: "csv_export_completed",
          createdAt: { gte: today },
        },
      }),
      prisma.emailDelivery.count({
        where: {
          status: "sent",
          createdAt: { gte: today },
        },
      }),
      prisma.productEvent.findMany({
        where: {
          event: "search_completed",
          createdAt: { gte: weekStart },
        },
        select: { properties: true },
      }),
      prisma.productEvent.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.emailDelivery.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.searchSubscription.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const lastActivity = [latestEvent?.createdAt, latestDelivery?.createdAt, latestSubscription?.createdAt]
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
    const searchHitsWeek = weeklySearchEvents.reduce((sum, entry) => {
      const resultCount = Number(entry?.properties?.resultCount || 0);
      return sum + (Number.isFinite(resultCount) ? resultCount : 0);
    }, 0);

    return {
      activeAgencies,
      activeAlerts,
      searchesToday,
      exportsToday,
      alertsSentToday,
      searchHitsWeek,
      lastActivityLabel: relativeFrom(lastActivity),
    };
  } catch {
    return {
      activeAgencies: 0,
      activeAlerts: 0,
      searchesToday: 0,
      exportsToday: 0,
      alertsSentToday: 0,
      searchHitsWeek: 0,
      lastActivityLabel: "Noch keine Aktivitaet",
    };
  }
}
