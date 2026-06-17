import { extractJobItems, normalizeJob, searchJobs } from "./api/_lib/ba";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://emploi-agences-next.vercel.app";

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
    ...jobUrls,
  ];
}
