import { extractJobItems, normalizeJob, searchJobs } from "./api/_lib/ba";
import { appUrl } from "../lib/site-config";

export default async function sitemap() {
  const now = new Date();
  let jobUrls = [];

  try {
    const payload = await searchJobs({ keyword: "Softwareentwickler", location: "Berlin", page: 1, size: 50 });
    jobUrls = extractJobItems(payload)
      .map(normalizeJob)
      .filter((job) => job.Referenz)
      .map((job) => ({
        url: `${appUrl}/jobs/${encodeURIComponent(job.Referenz)}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      }));
  } catch {
    jobUrls = [];
  }

  return [
    {
      url: appUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${appUrl}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${appUrl}/datenquelle`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${appUrl}/impressum`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${appUrl}/datenschutz`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${appUrl}/kontakt`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...jobUrls,
  ];
}
