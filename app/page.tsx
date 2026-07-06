import JobPortalClient from "../components/JobPortalClient";
import ClientErrorBoundary from "../components/ClientErrorBoundary";
import { unstable_cache } from "next/cache";
import { extractJobItems, normalizeJob, searchJobs } from "./api/_lib/ba";
import { getPlatformInsights } from "./api/_lib/product-insights";
import { appUrl, defaultDescription, siteName } from "../lib/site-config";

const showcaseQueries = [
  { keyword: "Softwareentwickler", location: "Berlin" },
  { keyword: "Pflegefachkraft", location: "Hamburg" },
  { keyword: "Elektriker", location: "Köln" },
  { keyword: "Projektmanager", location: "Frankfurt am Main" },
];

export const metadata = {
  title: "KhalfaJobs – BA-Stellenanzeigen für Recruiting-Agenturen effizient recherchieren",
  description: defaultDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "KhalfaJobs – BA-Stellenanzeigen effizient recherchieren und überwachen",
    description: defaultDescription,
    url: "/",
    siteName,
    locale: "de_DE",
    type: "website",
  },
};

function structuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${appUrl}/#organization`,
        name: siteName,
        url: appUrl,
        email: "alerts@khalfajobs.me",
      },
      {
        "@type": "WebSite",
        "@id": `${appUrl}/#website`,
        name: siteName,
        url: appUrl,
        publisher: { "@id": `${appUrl}/#organization` },
        inLanguage: "de-DE",
        potentialAction: {
          "@type": "SearchAction",
          target: `${appUrl}/?keyword={search_term_string}&location={search_location}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

async function getShowcaseData() {
  if (process.env.CI === "true" || process.env.PLAYWRIGHT === "true") {
    return {
      jobs: [] as any[],
      positions: showcaseQueries.map((entry) => `${entry.keyword} in ${entry.location}`),
      regions: ["Berlin", "Hamburg", "Köln", "Frankfurt am Main"],
      trends: [] as string[],
      metrics: {
        activeProfiles: showcaseQueries.length,
        sampleHits: 0,
        activeRegions: 4,
      },
    };
  }

  try {
    const payloads = await Promise.all(
      showcaseQueries.map((query) =>
        searchJobs({
          keyword: query.keyword,
          location: query.location,
          page: 1,
          size: 6,
        }),
      ),
    );

    const grouped = payloads.map((payload, index) => ({
      ...showcaseQueries[index],
      count: extractJobItems(payload).length,
    }));

    const jobs = payloads
      .flatMap(extractJobItems)
      .map(normalizeJob)
      .filter((job) => job.Referenz || job.Titel) // Fixed references to match capitalized keys from ba.js
      .filter((job, index, list) => list.findIndex((entry) => entry.Referenz === job.Referenz || entry.Titel === job.Titel) === index)
      .slice(0, 6)
      .map((job) => ({
        reference: job.Referenz,
        title: job.Titel || "Stellenprofil ohne Titel",
        employer: job.Arbeitgeber || "Arbeitgeber nicht genannt",
        location: job.Ort || "Standort nicht genannt",
        occupation: job.Beruf || "",
        salary: job.Gehalt || "Keine Vergütung angegeben",
        url: job.URL || "",
      }));

    const regions = [...new Set(jobs.map((job) => job.location).filter(Boolean))].slice(0, 6);

    return {
      jobs,
      positions: showcaseQueries.map((entry) => `${entry.keyword} in ${entry.location}`),
      regions,
      trends: grouped
        .sort((left, right) => right.count - left.count)
        .map((entry) => `${entry.keyword} in ${entry.location}: ${entry.count} Treffer`)
        .slice(0, 4),
      metrics: {
        activeProfiles: showcaseQueries.length,
        sampleHits: grouped.reduce((sum, entry) => sum + entry.count, 0),
        activeRegions: regions.length,
      },
    };
  } catch {
    return {
      jobs: [] as any[],
      positions: showcaseQueries.map((entry) => `${entry.keyword} in ${entry.location}`),
      regions: ["Berlin", "Hamburg", "Köln", "Frankfurt am Main"],
      trends: [] as string[],
      metrics: {
        activeProfiles: showcaseQueries.length,
        sampleHits: 0,
        activeRegions: 4,
      },
    };
  }
}

const getCachedShowcaseData = unstable_cache(getShowcaseData, ["homepage-showcase"], {
  revalidate: 300,
});

const getCachedPlatformInsights = unstable_cache(getPlatformInsights, ["homepage-platform-insights"], {
  revalidate: 120,
});

export default async function Page() {
  const [showcase, platformInsights] = await Promise.all([getCachedShowcaseData(), getCachedPlatformInsights()]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
      />
      <ClientErrorBoundary
        title="Die Rechercheoberfläche konnte nicht vollständig geladen werden."
        description="Der Fehler wurde auf die Portalansicht begrenzt. Bitte laden Sie diesen Bereich erneut oder prüfen Sie das Deployment-Protokoll."
      >
        <JobPortalClient initialShowcase={showcase} platformInsights={platformInsights} />
      </ClientErrorBoundary>
    </>
  );
}
