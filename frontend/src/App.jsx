import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Clock,
  Download,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Mail,
  MapPin,
  Plus,
  Search,
  Send,
} from "lucide-react";
import "./App.css";
import {
  createAgency,
  createSubscription,
  exportJobsCsv,
  listSubscriptions,
  searchJobs,
  sendSubscriptionNow,
} from "./api";

const preferredListKeys = [
  "ergebnisliste",
  "stellenangebote",
  "angebote",
  "jobs",
  "items",
  "results",
  "content",
  "data",
];

function extractJobs(payload) {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === "object");
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  for (const key of preferredListKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter((item) => item && typeof item === "object");
    }
    if (value && typeof value === "object") {
      const nested = extractJobs(value);
      if (nested.length) return nested;
    }
  }

  return Object.values(payload).reduce((best, value) => {
    const nested = extractJobs(value);
    return nested.length > best.length ? nested : best;
  }, []);
}

function readPath(item, paths) {
  for (const path of paths) {
    let current = item;
    for (const part of path.split(".")) {
      if (Array.isArray(current)) {
        current = current
          .map((entry) => (entry && typeof entry === "object" ? entry[part] : undefined))
          .filter((value) => value !== undefined && value !== null && value !== "");
      } else {
        current = current && typeof current === "object" ? current[part] : undefined;
      }
      if (current === undefined || current === null) break;
    }
    if (current !== undefined && current !== null && current !== "") return current;
  }
  return "";
}

function flatten(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const preferred = ["name", "bezeichnung", "ort", "plz", "strasse", "region"];
    const parts = preferred.map((key) => flatten(value[key])).filter(Boolean);
    return parts.length ? parts.join(", ") : Object.values(value).map(flatten).filter(Boolean).join(", ");
  }
  return String(value);
}

function normalizeJob(item) {
  const reference = readPath(item, [
    "referenznummer",
    "refnr",
    "refNr",
    "reference",
    "id",
    "hashId",
    "stellenangebotsId",
  ]);
  const title = readPath(item, [
    "titel",
    "title",
    "stellenangebotsTitel",
    "stellenbezeichnung",
    "beruf",
    "jobtitel",
    "berufsbezeichnung",
  ]);
  const employer = readPath(item, [
    "arbeitgeber",
    "arbeitgebername",
    "firma",
    "unternehmen",
    "company",
    "betrieb.name",
  ]);
  const location = readPath(item, [
    "arbeitsort",
    "arbeitsorte",
    "stellenlokationen.adresse.ort",
    "ort",
    "standort",
    "location",
    "adresse.ort",
  ]);
  const occupation = readPath(item, [
    "beruf",
    "berufsbezeichnung",
    "hauptberuf",
    "occupation",
    "berufsfeld",
    "branche",
  ]);
  const url = flatten(readPath(item, ["url", "link", "externeURL", "stellenangebotUrl", "detailUrl", "externalUrl"]));

  return {
    reference: flatten(reference),
    title: flatten(title) || "Untitled offer",
    employer: flatten(employer) || "Employer not listed",
    location: flatten(location) || "Location not listed",
    occupation: flatten(occupation),
    url,
  };
}

function downloadBlob(blob, filename) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function getRequestErrorMessage(err, action) {
  if (err.code === "ECONNABORTED") {
    return `${action} timed out. Check that the backend is running and reachable.`;
  }

  if (err.code === "ERR_NETWORK" || !err.response) {
    return `Backend unavailable. Start FastAPI on http://localhost:8000, then try again.`;
  }

  return err.response?.data?.detail || err.message || `${action} failed`;
}

export default function App() {
  const [keyword, setKeyword] = useState("Softwareentwickler");
  const [location, setLocation] = useState("Berlin");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [agency, setAgency] = useState(() => {
    const stored = localStorage.getItem("agencyProfile");
    return stored ? JSON.parse(stored) : null;
  });
  const [agencyForm, setAgencyForm] = useState({
    name: "Berlin Talent Partners",
    email: "agency@example.com",
    plan: "starter",
  });
  const [alertForm, setAlertForm] = useState({
    keyword: "Softwareentwickler",
    location: "Berlin",
    frequency: "daily",
    max_results: 25,
  });
  const [subscriptions, setSubscriptions] = useState([]);
  const [saasStatus, setSaasStatus] = useState("");
  const [saasLoading, setSaasLoading] = useState(false);

  const jobs = useMemo(() => extractJobs(payload).map(normalizeJob), [payload]);

  useEffect(() => {
    if (!agency?.api_key) return;

    let cancelled = false;
    listSubscriptions(agency.api_key)
      .then((items) => {
        if (!cancelled) setSubscriptions(items);
      })
      .catch(() => {
        if (!cancelled) setSubscriptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [agency?.api_key]);

  async function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const data = await searchJobs({ keyword, location, page: 1, size: 25 });
      setPayload(data);
    } catch (err) {
      setPayload(null);
      setError(getRequestErrorMessage(err, "Search"));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");

    try {
      const blob = await exportJobsCsv({ keyword, location });
      const safeKeyword = (keyword || "all").trim().replace(/\s+/g, "-");
      const safeLocation = (location || "germany").trim().replace(/\s+/g, "-");
      downloadBlob(blob, `jobs-${safeKeyword}-${safeLocation}.csv`);
    } catch (err) {
      setError(getRequestErrorMessage(err, "CSV export"));
    } finally {
      setExporting(false);
    }
  }

  async function handleCreateAgency(event) {
    event.preventDefault();
    setSaasLoading(true);
    setSaasStatus("");

    try {
      const created = await createAgency(agencyForm);
      setAgency(created);
      localStorage.setItem("agencyProfile", JSON.stringify(created));
      setSaasStatus("Agency workspace created. Save the agency key before leaving this device.");
    } catch (err) {
      setSaasStatus(getRequestErrorMessage(err, "Agency creation"));
    } finally {
      setSaasLoading(false);
    }
  }

  async function refreshSubscriptions(apiKey = agency?.api_key) {
    if (!apiKey) return;
    const items = await listSubscriptions(apiKey);
    setSubscriptions(items);
  }

  async function handleCreateAlert(event) {
    event.preventDefault();
    if (!agency?.api_key) {
      setSaasStatus("Create an agency workspace before adding email alerts.");
      return;
    }

    setSaasLoading(true);
    setSaasStatus("");
    try {
      await createSubscription(agency.api_key, alertForm);
      await refreshSubscriptions(agency.api_key);
      setSaasStatus("Email alert created. It can now be triggered manually or by a scheduled job.");
    } catch (err) {
      setSaasStatus(getRequestErrorMessage(err, "Alert creation"));
    } finally {
      setSaasLoading(false);
    }
  }

  async function handleSendNow(subscriptionId) {
    setSaasLoading(true);
    setSaasStatus("");
    try {
      const result = await sendSubscriptionNow(agency.api_key, subscriptionId);
      await refreshSubscriptions(agency.api_key);
      setSaasStatus(
        result.dry_run
          ? `Digest prepared for ${result.recipient}. Configure SMTP to send real emails.`
          : `Digest sent to ${result.recipient} with ${result.job_count} offers.`,
      );
    } catch (err) {
      setSaasStatus(getRequestErrorMessage(err, "Digest delivery"));
    } finally {
      setSaasLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Application identity">
        <span>BA</span>
        <span>LIVE</span>
        <span>CSV</span>
      </aside>

      <section className="workspace">
        <header className="masthead">
          <div>
            <p className="eyebrow">Bundesagentur fuer Arbeit public search</p>
            <h1>German job offer registry</h1>
          </div>
          <div className="sync-badge">
            <Clock size={18} aria-hidden="true" />
            Live API
          </div>
        </header>

        <form className="search-panel" onSubmit={handleSearch}>
          <label>
            <span>Keyword</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Softwareentwickler"
              autoComplete="off"
            />
          </label>
          <label>
            <span>Location</span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Berlin"
              autoComplete="off"
            />
          </label>
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />}
            Search
          </button>
          <button className="secondary-action" type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />}
            Export CSV
          </button>
        </form>

        {error ? (
          <div className="error-banner" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="results-header" aria-live="polite">
          <div>
            <p className="eyebrow">Results</p>
            <h2>{hasSearched ? `${jobs.length} offers on this page` : "Ready to search"}</h2>
          </div>
          <p>CSV export fetches up to 200 live results using two pages of 100.</p>
        </section>

        <section className="results-grid">
          {jobs.map((job, index) => (
            <article className="job-card" key={`${job.reference || job.title}-${index}`}>
              <div className="job-card-top">
                <span className="reference">{job.reference || `Result ${index + 1}`}</span>
                {job.url ? (
                  <a href={job.url} target="_blank" rel="noreferrer" aria-label="Open job detail">
                    <ExternalLink size={18} />
                  </a>
                ) : null}
              </div>
              <h3>{job.title}</h3>
              <div className="meta-line">
                <Building2 size={18} aria-hidden="true" />
                <span>{job.employer}</span>
              </div>
              <div className="meta-line">
                <MapPin size={18} aria-hidden="true" />
                <span>{job.location}</span>
              </div>
              {job.occupation ? <p className="occupation">{job.occupation}</p> : null}
            </article>
          ))}
        </section>

        {hasSearched && !loading && !error && jobs.length === 0 ? (
          <div className="empty-state">No displayable offers were found in the API response.</div>
        ) : null}

        <section className="saas-section">
          <div className="saas-header">
            <div>
              <p className="eyebrow">SaaS agency alerts</p>
              <h2>Subscribed agencies receive fresh offers by email.</h2>
            </div>
            <div className="sync-badge">
              <Mail size={18} aria-hidden="true" />
              Daily digest
            </div>
          </div>

          <div className="saas-grid">
            <form className="saas-panel" onSubmit={handleCreateAgency}>
              <div className="panel-title">
                <KeyRound size={19} aria-hidden="true" />
                <h3>Agency workspace</h3>
              </div>
              <label>
                <span>Agency name</span>
                <input
                  value={agencyForm.name}
                  onChange={(event) => setAgencyForm({ ...agencyForm, name: event.target.value })}
                  placeholder="Berlin Talent Partners"
                />
              </label>
              <label>
                <span>Billing email</span>
                <input
                  value={agencyForm.email}
                  onChange={(event) => setAgencyForm({ ...agencyForm, email: event.target.value })}
                  placeholder="agency@example.com"
                  type="email"
                />
              </label>
              <button className="primary-action" type="submit" disabled={saasLoading}>
                {saasLoading ? <LoaderCircle className="spin" size={19} /> : <Plus size={19} />}
                Create agency
              </button>
              {agency ? (
                <div className="api-key-box">
                  <span>Agency key</span>
                  <code>{agency.api_key}</code>
                </div>
              ) : null}
            </form>

            <form className="saas-panel" onSubmit={handleCreateAlert}>
              <div className="panel-title">
                <Mail size={19} aria-hidden="true" />
                <h3>Email alert</h3>
              </div>
              <label>
                <span>Keyword</span>
                <input
                  value={alertForm.keyword}
                  onChange={(event) => setAlertForm({ ...alertForm, keyword: event.target.value })}
                  placeholder="Softwareentwickler"
                />
              </label>
              <label>
                <span>Location</span>
                <input
                  value={alertForm.location}
                  onChange={(event) => setAlertForm({ ...alertForm, location: event.target.value })}
                  placeholder="Berlin"
                />
              </label>
              <button className="secondary-action" type="submit" disabled={saasLoading || !agency}>
                <Plus size={19} />
                Add alert
              </button>
            </form>
          </div>

          {saasStatus ? <div className="status-banner">{saasStatus}</div> : null}

          <div className="subscription-list">
            {subscriptions.map((subscription) => (
              <article className="subscription-row" key={subscription.id}>
                <div>
                  <strong>{subscription.keyword}</strong>
                  <span>{subscription.location}</span>
                </div>
                <span>{subscription.frequency}</span>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => handleSendNow(subscription.id)}
                  disabled={saasLoading}
                >
                  <Send size={18} />
                  Send now
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
