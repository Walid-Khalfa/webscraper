import JobPortalClient from "../components/JobPortalClient";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://emploi-agences-next.vercel.app";

export const metadata = {
  title: "Deutsches Stellenregister | KhalfaJobs",
  description:
    "Durchsuchen Sie Live-Stellenangebote der Bundesagentur fuer Arbeit, exportieren Sie CSV-Dateien und abonnieren Sie taegliche Job Alerts fuer Agenturen.",
  alternates: {
    canonical: appUrl,
  },
  openGraph: {
    title: "Deutsches Stellenregister | KhalfaJobs",
    description:
      "Live-Suche, CSV-Export und E-Mail-Agenten fuer Stellenangebote der Bundesagentur fuer Arbeit.",
    url: appUrl,
    siteName: "KhalfaJobs",
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
        name: "KhalfaJobs",
        url: appUrl,
        email: "alerts@khalfajobs.me",
      },
      {
        "@type": "WebSite",
        "@id": `${appUrl}/#website`,
        name: "KhalfaJobs",
        url: appUrl,
        publisher: { "@id": `${appUrl}/#organization` },
        inLanguage: "de-DE",
        potentialAction: {
          "@type": "SearchAction",
          target: `${appUrl}/?keyword={search_term_string}&location={search_location}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "WebApplication",
        name: "Deutsches Stellenregister",
        url: appUrl,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
        },
      },
    ],
  };
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
      />
      <JobPortalClient />
    </>
  );
}
