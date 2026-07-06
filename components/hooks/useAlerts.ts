import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { trackEvent } from "../analytics";
import { getClientLocationSuggestions } from "./useSearch";

async function requestJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(data?.detail || data || `Anfrage fehlgeschlagen mit Status ${response.status}`);
  }
  return data;
}

const locationSuggestionCache = new Map();

async function requestLocationSuggestions(query: string, limit = 10) {
  const cacheKey = `${query.trim().toLocaleLowerCase("de-DE")}:${limit}`;
  if (locationSuggestionCache.has(cacheKey)) return locationSuggestionCache.get(cacheKey);

  const params = new URLSearchParams({
    query,
    limit: String(limit),
  });
  const data = await requestJson(`/api/locations/autocomplete?${params.toString()}`);
  const items = Array.isArray(data?.items) && data.items.length ? data.items : getClientLocationSuggestions(query, limit);
  locationSuggestionCache.set(cacheKey, items);
  return items;
}

const keywordSuggestions = [
  "Softwareentwickler",
  "Frontend-Entwickler",
  "Backend-Entwickler",
  "Full-Stack-Entwickler",
  "DevOps Engineer",
  "Data Analyst",
  "Data Engineer",
  "IT-Systemadministrator",
  "Pflegefachkraft",
  "Krankenpfleger",
  "Gesundheits- und Krankenpfleger",
  "Altenpfleger",
  "Kinderkrankenpfleger",
  "Pflegehelfer",
  "MFA",
  "Medizinischer Fachangestellter",
  "Hebamme",
  "Physiotherapeut",
  "Ergotherapeut",
  "Logopäde",
  "Radiologieassistent",
  "Notfallsanitäter",
  "Rettungssanitäter",
  "Apotheker",
  "Elektriker",
  "Mechatroniker",
  "Industriemechaniker",
  "Zerspanungsmechaniker",
  "Maschinenbauingenieur",
  "Produktionsmitarbeiter",
  "Schlosser",
  "CNC-Fachkraft",
  "Qualitätsmanager",
  "Servicetechniker",
  "Anlagenmechaniker",
  "Kfz-Mechatroniker",
  "Buchhalter",
  "Steuerfachangestellter",
  "Controller",
  "Finanzbuchhalter",
  "Sachbearbeiter",
  "Personalreferent",
  "Recruiter",
  "HR-Manager",
  "Vertriebsmitarbeiter",
  "Projektmanager",
  "Projektleiter",
  "Account Manager",
  "Key Account Manager",
  "Einkäufer",
  "Marketing Manager",
  "Customer Success Manager",
  "Fachinformatiker",
  "Bauleiter",
  "Architekt",
  "Tischler",
  "Maler und Lackierer",
  "Dachdecker",
  "Maurer",
  "Bauingenieur",
  "Lagerarbeiter",
  "Fachkraft für Lagerlogistik",
  "Kommissionierer",
  "Staplerfahrer",
  "Berufskraftfahrer",
  "Disponent",
  "Koch",
  "Restaurantfachmann",
  "Verkäufer",
  "Filialleiter",
];

export function getVisibleSuggestions(query: string, suggestions: string[], showAll: boolean) {
  if (showAll) return suggestions;
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  if (!normalizedQuery) return suggestions;
  return suggestions.filter((suggestion) => suggestion.toLocaleLowerCase("de-DE").includes(normalizedQuery));
}

interface UseAlertsParams {
  agency: any;
  pushToast: (type: string, message: string) => string;
  setSaasStatus: (status: string) => void;
  loadWorkspace: (apiKey?: string) => Promise<void>;
  saasLoading: boolean;
  setSaasLoading: (loading: boolean) => void;
  keyword: string;
  location: string;
}

export function useAlerts({
  agency,
  pushToast,
  setSaasStatus,
  loadWorkspace,
  setSaasLoading,
  keyword,
  location,
}: UseAlertsParams) {
  const [alertForm, setAlertForm] = useState({ keyword: "", location: "", frequency: "daily", max_results: 25 });
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [agentSuggest, setAgentSuggest] = useState<string | null>(null);
  const [showAllAgentSuggestions, setShowAllAgentSuggestions] = useState(true);
  const [agentLocationSuggestions, setAgentLocationSuggestions] = useState<any[]>([]);
  const [loadingAgentLocationSuggestions, setLoadingAgentLocationSuggestions] = useState(false);

  const agentLocationFetchVersion = useRef(0);

  const refreshSubscriptions = useCallback(async (apiKey = agency?.api_key) => {
    if (!apiKey) return;
    try {
      const data = await requestJson("/api/alerts/subscriptions", { headers: { "X-Agency-Key": apiKey } });
      setSubscriptions(data);
    } catch {
      setSubscriptions([]);
    }
  }, [agency?.api_key]);

  useEffect(() => {
    if (!agency?.api_key) return;
    void refreshSubscriptions(agency.api_key);
  }, [agency?.api_key, refreshSubscriptions]);

  useEffect(() => {
    if (agentSuggest !== "location") return undefined;

    const requestId = agentLocationFetchVersion.current + 1;
    agentLocationFetchVersion.current = requestId;
    setLoadingAgentLocationSuggestions(true);

    const timer = window.setTimeout(() => {
      requestLocationSuggestions(showAllAgentSuggestions ? "" : alertForm.location, showAllAgentSuggestions ? 120 : 40)
        .then((items) => {
          if (agentLocationFetchVersion.current !== requestId) return;
          setAgentLocationSuggestions(items);
        })
        .catch(() => {
          if (agentLocationFetchVersion.current !== requestId) return;
          setAgentLocationSuggestions(getClientLocationSuggestions(showAllAgentSuggestions ? "" : alertForm.location, showAllAgentSuggestions ? 120 : 40));
        })
        .finally(() => {
          if (agentLocationFetchVersion.current === requestId) setLoadingAgentLocationSuggestions(false);
        });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [alertForm.location, agentSuggest, showAllAgentSuggestions]);

  const visibleAgentKeywordSuggestions = useMemo(
    () => getVisibleSuggestions(alertForm.keyword, keywordSuggestions, agentSuggest === "keyword" && showAllAgentSuggestions),
    [alertForm.keyword, agentSuggest, showAllAgentSuggestions],
  );

  const visibleAgentLocationSuggestions = agentLocationSuggestions;

  async function handleCreateAlert(event: React.FormEvent) {
    event.preventDefault();
    if (!agency?.api_key) {
      setSaasStatus("Richten Sie zuerst einen Agentur-Zugang ein, bevor Sie einen Job-Alarm anlegen.");
      pushToast("error", "Richten Sie zuerst einen Agentur-Zugang ein (Schritt 1).");
      trackEvent("alert_creation_failed", { reason: "missing_agency_access", keyword: alertForm.keyword, location: alertForm.location });
      return;
    }
    if (!agency?.email_verified) {
      setSaasStatus("Bitte bestätigen Sie zuerst die E-Mail-Adresse Ihrer Agentur. Erst danach können Job-Alarme aktiviert werden.");
      pushToast("error", "Bitte bestätigen Sie zuerst die E-Mail-Adresse Ihrer Agentur.");
      trackEvent("alert_creation_failed", { reason: "agency_email_not_verified", keyword: alertForm.keyword, location: alertForm.location });
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
      await loadWorkspace(agency.api_key);
      setSaasStatus("Der Job-Alarm wurde eingerichtet und kann ab sofort genutzt werden.");
      trackEvent("agency_alert_created", { keyword: alertForm.keyword, location: alertForm.location });
    } catch (err: any) {
      setSaasStatus(err.message || "Einrichtung des Job-Alarms fehlgeschlagen");
      trackEvent("alert_creation_failed", { reason: err.message || "Einrichtung des Job-Alarms fehlgeschlagen", keyword: alertForm.keyword, location: alertForm.location });
    } finally {
      setSaasLoading(false);
    }
  }

  async function handleSendNow(subscriptionId: number) {
    if (!agency?.email_verified) {
      setSaasStatus("Der manuelle Versand ist erst nach bestätigter E-Mail-Adresse verfügbar.");
      return;
    }
    setSaasLoading(true);
    setSaasStatus("");
    try {
      const result = await requestJson(`/api/alerts/subscriptions/${subscriptionId}/send-now`, {
        method: "POST",
        headers: { "X-Agency-Key": agency.api_key },
      });
      await refreshSubscriptions(agency.api_key);
      await loadWorkspace(agency.api_key);
      setSaasStatus(
        result.dry_run
          ? `Die Zusammenfassung für ${result.recipient} wurde vorbereitet. Hinterlegen Sie einen Mail-Dienst, um reale Zustellungen zu aktivieren.`
          : `Die Zusammenfassung mit ${result.job_count} Treffern wurde an ${result.recipient} gesendet.`,
      );
      trackEvent("agency_alert_send_now", { subscriptionId, jobCount: result.job_count || 0, dryRun: Boolean(result.dry_run) });
    } catch (err: any) {
      setSaasStatus(err.message || "Versand des Job-Alarms fehlgeschlagen");
    } finally {
      setSaasLoading(false);
    }
  }

  async function handleDeleteAlert(subscriptionId: number) {
    if (!agency?.api_key) return;
    setSaasLoading(true);
    setSaasStatus("");
    try {
      await requestJson(`/api/alerts/subscriptions/${subscriptionId}`, {
        method: "DELETE",
        headers: { "X-Agency-Key": agency.api_key },
      });
      await refreshSubscriptions(agency.api_key);
      await loadWorkspace(agency.api_key);
      setSaasStatus("Der Job-Alarm wurde entfernt.");
      trackEvent("agency_alert_deleted", { subscriptionId });
    } catch (err: any) {
      setSaasStatus(err.message || "Löschen des Job-Alarms fehlgeschlagen");
    } finally {
      setSaasLoading(false);
    }
  }

  return {
    alertForm,
    setAlertForm,
    subscriptions,
    setSubscriptions,
    agentSuggest,
    setAgentSuggest,
    showAllAgentSuggestions,
    setShowAllAgentSuggestions,
    agentLocationSuggestions,
    loadingAgentLocationSuggestions,
    visibleAgentKeywordSuggestions,
    visibleAgentLocationSuggestions,
    handleCreateAlert,
    handleDeleteAlert,
    handleSendNow,
    refreshSubscriptions,
  };
}
