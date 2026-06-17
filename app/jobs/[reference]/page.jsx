import { notFound } from "next/navigation";
import { Building2, BriefcaseBusiness, CalendarDays, ExternalLink, MapPin, WalletCards } from "lucide-react";
import { findJobByReference, flatten, normalizeJob, valueAt } from "../../api/_lib/ba";

export const runtime = "nodejs";
export const revalidate = 300;

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://emploi-agences-next.vercel.app";

function toIsoDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function getDate(raw, paths) {
  return toIsoDate(flatten(valueAt(raw, paths)));
}

function getEmploymentType(raw) {
  const values = [];
  if (valueAt(raw, ["arbeitszeitVollzeit"])) values.push("FULL_TIME");
  if (
    valueAt(raw, ["arbeitszeitTeilzeitVormittag"]) ||
    valueAt(raw, ["arbeitszeitTeilzeitNachmittag"]) ||
    valueAt(raw, ["arbeitszeitTeilzeitAbend"]) ||
    valueAt(raw, ["arbeitszeitTeilzeitFlexibel"])
  ) {
    values.push("PART_TIME");
  }
  return values.length ? values : undefined;
}

function buildDescription(job, raw) {
  return [
    `${job.Titel || "Stellenangebot"} bei ${job.Arbeitgeber || "Arbeitgeber nicht angegeben"} in ${job.Ort || "Deutschland"}.`,
    job.Beruf ? `Beruf: ${job.Beruf}.` : "",
    job.Gehalt && job.Gehalt !== "Keine Gehaltsangabe" ? `Verguetung: ${job.Gehalt}.` : "",
    flatten(valueAt(raw, ["stellenangebotsart"])) ? `Angebotsart: ${flatten(valueAt(raw, ["stellenangebotsart"]))}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildJobPosting({ job, raw, reference }) {
  const street = flatten(valueAt(raw, ["stellenlokationen.adresse.strasse"]));
  const region = flatten(valueAt(raw, ["stellenlokationen.adresse.region"]));
  const canonicalUrl = `${appUrl}/jobs/${encodeURIComponent(reference)}`;

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.Titel,
    description: buildDescription(job, raw),
    identifier: {
      "@type": "PropertyValue",
      name: "Bundesagentur fuer Arbeit",
      value: reference,
    },
    datePosted: getDate(raw, ["datumErsteVeroeffentlichung", "veroeffentlichungszeitraum.von", "aenderungsdatum"]),
    validThrough: getDate(raw, ["veroeffentlichungszeitraum.bis"]),
    employmentType: getEmploymentType(raw),
    hiringOrganization: {
      "@type": "Organization",
      name: job.Arbeitgeber || "Arbeitgeber nicht angegeben",
      sameAs: job.URL || undefined,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: street || undefined,
        postalCode: job.Postleitzahl || undefined,
        addressLocality: job.Ort || undefined,
        addressRegion: region || undefined,
        addressCountry: "DE",
      },
    },
    occupationalCategory: job.Beruf || undefined,
    directApply: false,
    url: canonicalUrl,
  };
}

async function getJob(reference) {
  const raw = await findJobByReference(reference);
  if (!raw) return null;
  return { raw, job: normalizeJob(raw) };
}

export async function generateMetadata({ params }) {
  const reference = decodeURIComponent(params.reference);
  const result = await getJob(reference);
  if (!result) {
    return {
      title: "Stellenangebot nicht gefunden",
      robots: { index: false, follow: true },
    };
  }

  const { job, raw } = result;
  const title = `${job.Titel || "Stellenangebot"} in ${job.Ort || "Deutschland"}`;
  const description = buildDescription(job, raw).slice(0, 155);
  const canonicalUrl = `${appUrl}/jobs/${encodeURIComponent(reference)}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      siteName: "KhalfaJobs",
      locale: "de_DE",
    },
  };
}

export default async function JobDetailPage({ params }) {
  const reference = decodeURIComponent(params.reference);
  const result = await getJob(reference);
  if (!result) notFound();

  const { job, raw } = result;
  const officialUrl = job.URL || `https://www.arbeitsagentur.de/jobsuche/jobdetail/${reference}`;
  const jsonLd = buildJobPosting({ job, raw, reference });
  const datePosted = getDate(raw, ["datumErsteVeroeffentlichung", "veroeffentlichungszeitraum.von", "aenderungsdatum"]);
  const startDate = getDate(raw, ["eintrittszeitraum.von"]);

  return (
    <main className="app-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <aside className="registry-rail" aria-label="Anwendungsidentitaet">
        <span>BA</span>
        <span>SEO</span>
        <span>JOB</span>
      </aside>
      <article className="workspace job-detail-page">
        <a className="back-link" href="/">
          Zurueck zur Suche
        </a>
        <header className="job-detail-hero">
          <p className="eyebrow">Google Jobs optimierte Detailseite</p>
          <h1>{job.Titel || "Stellenangebot"}</h1>
          <p>{buildDescription(job, raw)}</p>
          <div className="job-detail-actions">
            <a className="primary-action apply-link-large" href={officialUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={19} aria-hidden="true" />
              Offizielle Bewerbung oeffnen
            </a>
          </div>
        </header>

        <section className="job-detail-grid" aria-label="Stellendetails">
          <div className="job-detail-card">
            <Building2 size={22} aria-hidden="true" />
            <span>Arbeitgeber</span>
            <strong>{job.Arbeitgeber || "Nicht angegeben"}</strong>
          </div>
          <div className="job-detail-card">
            <MapPin size={22} aria-hidden="true" />
            <span>Arbeitsort</span>
            <strong>{[job.Postleitzahl, job.Ort].filter(Boolean).join(" ") || "Nicht angegeben"}</strong>
          </div>
          <div className="job-detail-card">
            <WalletCards size={22} aria-hidden="true" />
            <span>Gehalt</span>
            <strong>{job.Gehalt || "Keine Gehaltsangabe"}</strong>
          </div>
          <div className="job-detail-card">
            <BriefcaseBusiness size={22} aria-hidden="true" />
            <span>Beruf</span>
            <strong>{job.Beruf || "Nicht angegeben"}</strong>
          </div>
          <div className="job-detail-card">
            <CalendarDays size={22} aria-hidden="true" />
            <span>Veroeffentlicht</span>
            <strong>{datePosted || "Nicht angegeben"}</strong>
          </div>
          <div className="job-detail-card">
            <CalendarDays size={22} aria-hidden="true" />
            <span>Eintritt</span>
            <strong>{startDate || "Nach Vereinbarung"}</strong>
          </div>
        </section>

        <section className="job-detail-section">
          <h2>Referenz und Quelle</h2>
          <p>
            Referenznummer: <strong>{reference}</strong>
          </p>
          <p>
            Diese Seite bereitet die oeffentlichen Daten der Bundesagentur fuer Arbeit fuer Suchmaschinen strukturiert auf. Die Bewerbung erfolgt ueber die offizielle Quelle.
          </p>
        </section>
      </article>
    </main>
  );
}
