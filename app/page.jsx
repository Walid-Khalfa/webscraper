"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Download,
  KeyRound,
  LoaderCircle,
  Mail,
  Plus,
  Search,
  Send,
} from "lucide-react";
import JobCard from "../components/JobCard";
import JobCardSkeleton from "../components/JobCardSkeleton";
import ToastStack from "../components/ToastStack";

const preferredListKeys = ["ergebnisliste", "stellenangebote", "angebote", "jobs", "items", "results", "content", "data"];

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(data?.detail || data || `Anfrage fehlgeschlagen mit Status ${response.status}`);
  }
  return data;
}

function extractJobs(payload) {
  if (Array.isArray(payload)) return payload.filter((item) => item && typeof item === "object");
  if (!payload || typeof payload !== "object") return [];
  for (const key of preferredListKeys) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
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

function formatEuro(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: number % 1 === 0 ? 0 : 2,
    style: "currency",
    currency: "EUR",
  }).format(number);
}

function normalizeSalary(item) {
  const type = readPath(item, ["verguetungsangabe"]);
  const fixed = readPath(item, ["festgehalt"]);
  const from = readPath(item, ["gehaltsspanneVon"]);
  const to = readPath(item, ["gehaltsspanneBis"]);
  const unit = String(type || readPath(item, ["artDerVerguetung"]) || "").toLocaleLowerCase("de-DE");
  const suffix = unit.includes("stunde") ? "/Std." : unit.includes("jahr") ? "/Jahr" : "";

  if (from || to) return `${from ? formatEuro(from) : ""}${from && to ? " - " : ""}${to ? formatEuro(to) : ""} ${suffix}`.trim();
  if (fixed) return `${formatEuro(fixed)} ${suffix}`.trim();
  return "Keine Gehaltsangabe";
}

function normalizeJob(item) {
  const reference = readPath(item, ["referenznummer", "refnr", "refNr", "reference", "id", "hashId", "stellenangebotsId"]);
  const title = readPath(item, ["titel", "title", "stellenangebotsTitel", "stellenbezeichnung", "beruf", "jobtitel"]);
  const employer = readPath(item, ["arbeitgeber", "arbeitgebername", "firma", "unternehmen", "company", "betrieb.name"]);
  const location = readPath(item, ["arbeitsort", "arbeitsorte", "stellenlokationen.adresse.ort", "ort", "standort", "adresse.ort"]);
  const occupation = readPath(item, ["beruf", "berufsbezeichnung", "hauptberuf", "occupation", "berufsfeld", "branche"]);
  const url = flatten(readPath(item, ["url", "link", "externeURL", "stellenangebotUrl", "detailUrl", "externalUrl"]));
  const referenceText = flatten(reference);
  return {
    reference: referenceText,
    title: flatten(title) || "Stellenangebot ohne Titel",
    employer: flatten(employer) || "Arbeitgeber nicht angegeben",
    location: flatten(location) || "Ort nicht angegeben",
    occupation: flatten(occupation),
    salary: normalizeSalary(item),
    url: url || (referenceText ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${referenceText}` : ""),
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

function getErrorMessage(error, action) {
  return error.message || `${action} fehlgeschlagen`;
}

export default function Home() {
  const [keyword, setKeyword] = useState("Softwareentwickler");
  const [location, setLocation] = useState("Berlin");
  const [exactLocation, setExactLocation] = useState(true);
  const [payload, setPayload] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agency, setAgency] = useState(null);
  const [agencyForm, setAgencyForm] = useState({ name: "Berlin Talent Partners", email: "agency@example.com", plan: "starter" });
  const [alertForm, setAlertForm] = useState({ keyword: "Softwareentwickler", location: "Berlin", frequency: "daily", max_results: 25 });
  const [subscriptions, setSubscriptions] = useState([]);
  const [saasStatus, setSaasStatus] = useState("");
  const [saasLoading, setSaasLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const jobs = useMemo(() => extractJobs(payload).map(normalizeJob), [payload]);
  const totalResults = payload?.exactLocation ? 0 : Number(payload?.maxErgebnisse || 0);
  const canLoadMore = hasSearched && !loading && jobs.length > 0 && (totalResults ? jobs.length < totalResults : true);

  function pushToast(type, message, persist = false) {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.filter((toast) => toast.type !== "loading"), { id, type, message }].slice(-3));
    if (!persist) {
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4200);
    }
    return id;
  }

  function mergePayload(currentPayload, nextPayload) {
    const currentItems = extractJobs(currentPayload);
    const nextItems = extractJobs(nextPayload);
    return {
      ...nextPayload,
      ergebnisliste: [...currentItems, ...nextItems],
    };
  }

  useEffect(() => {
    const stored = localStorage.getItem("agencyProfile");
    if (stored) setAgency(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!agency?.api_key) return;
    requestJson("/api/alerts/subscriptions", { headers: { "X-Agency-Key": agency.api_key } })
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]));
  }, [agency?.api_key]);

  async function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setHasSearched(true);
    setPage(1);
    pushToast("loading", "Suche laeuft...", true);
    try {
      const params = new URLSearchParams({ keyword, location, page: "1", size: "25", exactLocation: String(exactLocation) });
      const result = await requestJson(`/api/jobs/search?${params.toString()}`);
      setPayload(result);
      const count = extractJobs(result).length;
      pushToast(count ? "success" : "success", count ? `${count} Stellenangebote gefunden` : "Keine passenden Stellenangebote gefunden");
    } catch (err) {
      setPayload(null);
      const message = getErrorMessage(err, "Suche");
      setError(message);
      pushToast("error", `API-Fehler: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    setError("");
    pushToast("loading", "Weitere Stellenangebote werden geladen...", true);
    try {
      const params = new URLSearchParams({ keyword, location, page: String(nextPage), size: "25", exactLocation: String(exactLocation) });
      const result = await requestJson(`/api/jobs/search?${params.toString()}`);
      const nextCount = extractJobs(result).length;
      setPayload((current) => mergePayload(current, result));
      setPage(nextPage);
      pushToast(nextCount ? "success" : "success", nextCount ? `${nextCount} weitere Stellenangebote geladen` : "Keine weiteren Stellenangebote gefunden");
    } catch (err) {
      const message = getErrorMessage(err, "Suche");
      setError(message);
      pushToast("error", `API-Fehler: ${message}`);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams({ keyword, location, exactLocation: String(exactLocation) });
      const response = await fetch(`/api/jobs/export/csv?${params.toString()}`);
      if (!response.ok) throw new Error((await response.json()).detail || "CSV-Export fehlgeschlagen");
      const safeKeyword = (keyword || "alle").trim().replace(/\s+/g, "-");
      const safeLocation = (location || "deutschland").trim().replace(/\s+/g, "-");
      downloadBlob(await response.blob(), `stellenangebote-${safeKeyword}-${safeLocation}.csv`);
    } catch (err) {
      setError(getErrorMessage(err, "CSV-Export"));
    } finally {
      setExporting(false);
    }
  }

  async function handleCreateAgency(event) {
    event.preventDefault();
    setSaasLoading(true);
    setSaasStatus("");
    try {
      const created = await requestJson("/api/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agencyForm),
      });
      setAgency(created);
      localStorage.setItem("agencyProfile", JSON.stringify(created));
      setSaasStatus("Agentur-Arbeitsbereich erstellt. Speichern Sie den Agentur-Schluessel, bevor Sie dieses Geraet verlassen.");
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Agentur-Erstellung"));
    } finally {
      setSaasLoading(false);
    }
  }

  async function refreshSubscriptions(apiKey = agency?.api_key) {
    if (!apiKey) return;
    setSubscriptions(await requestJson("/api/alerts/subscriptions", { headers: { "X-Agency-Key": apiKey } }));
  }

  async function handleCreateAlert(event) {
    event.preventDefault();
    if (!agency?.api_key) {
      setSaasStatus("Erstellen Sie zuerst einen Agentur-Arbeitsbereich, bevor Sie E-Mail-Benachrichtigungen anlegen.");
      return;
    }
    setSaasLoading(true);
    setSaasStatus("");
    try {
      await requestJson("/api/alerts/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Agency-Key": agency.api_key },
        body: JSON.stringify(alertForm),
      });
      await refreshSubscriptions(agency.api_key);
      setSaasStatus("E-Mail-Benachrichtigung erstellt. Sie kann jetzt manuell oder per geplantem Job ausgefuehrt werden.");
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Benachrichtigungserstellung"));
    } finally {
      setSaasLoading(false);
    }
  }

  async function handleSendNow(subscriptionId) {
    setSaasLoading(true);
    setSaasStatus("");
    try {
      const result = await requestJson(`/api/alerts/subscriptions/${subscriptionId}/send-now`, {
        method: "POST",
        headers: { "X-Agency-Key": agency.api_key },
      });
      await refreshSubscriptions(agency.api_key);
      setSaasStatus(
        result.dry_run
          ? `Zusammenfassung fuer ${result.recipient} vorbereitet. Konfigurieren Sie SMTP, um echte E-Mails zu versenden.`
          : `Zusammenfassung mit ${result.job_count} Stellenangeboten an ${result.recipient} gesendet.`,
      );
    } catch (err) {
      setSaasStatus(getErrorMessage(err, "Versand der Zusammenfassung"));
    } finally {
      setSaasLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <ToastStack toasts={toasts} />
      <aside className="registry-rail" aria-label="Anwendungsidentitaet">
        <span>BA</span>
        <span>LIVE</span>
        <span>SAAS</span>
      </aside>

      <section className="workspace">
        <header className="masthead">
          <div>
            <p className="eyebrow">Oeffentliche Suche der Bundesagentur fuer Arbeit</p>
            <h1>Deutsches Stellenregister</h1>
          </div>
          <div className="sync-badge">
            <Clock size={18} aria-hidden="true" />
            Live-API
          </div>
        </header>

        <form className="search-panel" onSubmit={handleSearch}>
          <label>
            <span>Suchbegriff</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Softwareentwickler" />
          </label>
          <label>
            <span>Ort</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Berlin" />
          </label>
          <label className="exact-location-toggle">
            <input type="checkbox" checked={exactLocation} onChange={(event) => setExactLocation(event.target.checked)} />
            <span>Nur exakter Ort</span>
          </label>
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />}
            Suchen
          </button>
          <button className="secondary-action" type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />}
            CSV exportieren
          </button>
        </form>

        {error ? (
          <div className="error-banner error-panel" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>Die Suche konnte nicht geladen werden.</strong>
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        <section className="results-header" aria-live="polite">
          <div>
            <p className="eyebrow">Ergebnisse</p>
            <h2>
              {loading
                ? "Stellenangebote werden geladen..."
                : hasSearched
                  ? `${jobs.length} Angebote${totalResults ? ` von ${totalResults}` : ""}`
                  : "Starten Sie Ihre Suche"}
            </h2>
          </div>
          <p>{loading ? "Wir fragen die Bundesagentur-API ab." : "Der CSV-Export laedt bis zu 200 Live-Ergebnisse serverseitig."}</p>
        </section>

        <div className="filter-note">
          Die Bundesagentur-API kann Ergebnisse aus dem Umkreis liefern. Mit "Nur exakter Ort" werden nur Angebote aus dem eingegebenen Ort angezeigt und exportiert.
        </div>

        {loading ? (
          <section className="results-grid" aria-label="Stellenangebote werden geladen">
            {Array.from({ length: 6 }).map((_, index) => (
              <JobCardSkeleton key={index} />
            ))}
          </section>
        ) : jobs.length > 0 ? (
          <>
            <section className="results-grid">
              {jobs.map((job, index) => (
                <JobCard job={job} key={`${job.reference || job.title}-${index}`} />
              ))}
            </section>
            <div className="pagination-row">
              <button className="secondary-action" type="button" onClick={handleLoadMore} disabled={loadingMore || !canLoadMore}>
                {loadingMore ? <LoaderCircle className="spin" size={19} /> : <Plus size={19} />}
                Weitere laden
              </button>
            </div>
          </>
        ) : hasSearched && !error ? (
          <div className="zero-state" aria-live="polite">
            <div className="zero-illustration" aria-hidden="true">
              <AlertTriangle size={42} />
            </div>
            <h3>Keine passenden Stellenangebote gefunden</h3>
            <p>Die Suche war erfolgreich, aber die aktuellen Filter liefern keine Treffer.</p>
            <ul className="zero-actions">
              <li>Pruefen Sie die Schreibweise des Ortes.</li>
              <li>Entfernen Sie "Nur exakter Ort", wenn auch umliegende Orte relevant sind.</li>
              <li>Verwenden Sie einen allgemeineren Suchbegriff.</li>
            </ul>
          </div>
        ) : (
          <div className="zero-state" aria-live="polite">
            <div className="zero-illustration" aria-hidden="true">
              <Search size={42} />
            </div>
            <h3>Bereit fuer die erste Suche</h3>
            <p>Geben Sie einen Beruf und einen Ort ein. Die Ergebnisse erscheinen hier als exportierbare Stellenkarten.</p>
          </div>
        )}

        <section className="saas-section secondary-zone">
          <div className="saas-header">
            <div>
              <p className="eyebrow">SaaS-Benachrichtigungen fuer Agenturen</p>
              <h2>Abonnierte Agenturen erhalten aktuelle Stellenangebote per E-Mail.</h2>
            </div>
            <button className="secondary-action" type="button" onClick={() => setAgentOpen((open) => !open)} aria-expanded={agentOpen}>
              <Mail size={18} aria-hidden="true" />
              {agentOpen ? "Agent ausblenden" : "Agent konfigurieren"}
            </button>
          </div>

          {agentOpen ? (
            <div className="agent-body">
              <div className="agent-summary">
                <strong>Taegliche Zusammenfassung um 06:00 Uhr</strong>
                <span>Der Cron-Endpunkt bereitet passende BA-Stellenangebote fuer jede gespeicherte Benachrichtigung vor.</span>
              </div>
              <div className="saas-grid">
                <form className="saas-panel" onSubmit={handleCreateAgency}>
                  <div className="panel-title">
                    <KeyRound size={19} aria-hidden="true" />
                    <h3>Agentur-Arbeitsbereich</h3>
                  </div>
                  <label>
                    <span>Agenturname</span>
                    <input value={agencyForm.name} onChange={(event) => setAgencyForm({ ...agencyForm, name: event.target.value })} placeholder="KhalfaJobs" />
                  </label>
                  <label>
                    <span>Rechnungs-E-Mail</span>
                    <input type="email" value={agencyForm.email} onChange={(event) => setAgencyForm({ ...agencyForm, email: event.target.value })} placeholder="agentur@beispiel.de" />
                  </label>
                  <button className="primary-action" type="submit" disabled={saasLoading}>
                    {saasLoading ? <LoaderCircle className="spin" size={19} /> : <Plus size={19} />}
                    Agentur erstellen
                  </button>
                  {agency ? (
                    <div className="api-key-box">
                      <span>Agentur-Schluessel</span>
                      <code>{agency.api_key}</code>
                    </div>
                  ) : null}
                </form>

                <form className="saas-panel" onSubmit={handleCreateAlert}>
                  <div className="panel-title">
                    <Mail size={19} aria-hidden="true" />
                    <h3>E-Mail-Benachrichtigung</h3>
                  </div>
                  <label>
                    <span>Suchbegriff</span>
                    <input value={alertForm.keyword} onChange={(event) => setAlertForm({ ...alertForm, keyword: event.target.value })} placeholder="Pflegefachkraft" />
                  </label>
                  <label>
                    <span>Ort</span>
                    <input value={alertForm.location} onChange={(event) => setAlertForm({ ...alertForm, location: event.target.value })} placeholder="Muenchen" />
                  </label>
                  <p className="form-hint">E-Mail-Agenten verwenden immer den exakten Ort, damit keine umliegenden Gemeinden in die Zusammenfassung geraten.</p>
                  <button className="secondary-action" type="submit" disabled={saasLoading || !agency}>
                    <Plus size={19} />
                    Benachrichtigung anlegen
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {saasStatus ? <div className="status-banner">{saasStatus}</div> : null}

          <div className="subscription-list">
            {subscriptions.map((subscription) => (
              <article className="subscription-row" key={subscription.id}>
                <div>
                  <strong>{subscription.keyword}</strong>
                  <span>{subscription.location}</span>
                </div>
                <span>{subscription.frequency}</span>
                <button className="secondary-action" type="button" onClick={() => handleSendNow(subscription.id)} disabled={saasLoading}>
                  <Send size={18} />
                  Jetzt senden
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
