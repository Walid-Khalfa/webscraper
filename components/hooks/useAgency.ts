import { useState, useEffect } from "react";
import { trackEvent } from "../analytics";

async function requestJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(data?.detail || data || `Anfrage fehlgeschlagen mit Status ${response.status}`);
  }
  return data;
}

interface UseAgencyParams {
  loadWorkspace: (apiKey: string) => Promise<void>;
  refreshSubscriptions: (apiKey: string) => Promise<void>;
  setEmailTemplateOpts: React.Dispatch<React.SetStateAction<any>>;
  defaultEmailTemplate: any;
  pushToast: (type: string, message: string) => string;
  setAgentOpen: (open: boolean) => void;
  setSubscriptions: (subs: any[]) => void;
  setWorkspaceOverview: (overview: any) => void;
  saasStatus: string;
  setSaasStatus: (status: string) => void;
  saasLoading: boolean;
  setSaasLoading: (loading: boolean) => void;
}

export function useAgency({
  loadWorkspace,
  refreshSubscriptions,
  setEmailTemplateOpts,
  defaultEmailTemplate,
  pushToast,
  setAgentOpen,
  setSubscriptions,
  setWorkspaceOverview,
  saasStatus,
  setSaasStatus,
  saasLoading,
  setSaasLoading,
}: UseAgencyParams) {
  const [agency, setAgency] = useState<any>(null);
  const [agencyForm, setAgencyForm] = useState({ name: "", email: "", plan: "starter" });
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [loginKey, setLoginKey] = useState("");
  const [verificationSending, setVerificationSending] = useState(false);

  useEffect(() => {
    const storedAgency = localStorage.getItem("agencyProfile");
    if (storedAgency) {
      const parsed = JSON.parse(storedAgency);
      setAgency(parsed);
      setAgentOpen(true);
    }
  }, [setAgentOpen]);

  useEffect(() => {
    if (!agency?.api_key) return;
    requestJson("/api/agencies/me", { headers: { "X-Agency-Key": agency.api_key } })
      .then((freshAgency) => {
        setAgency(freshAgency);
        localStorage.setItem("agencyProfile", JSON.stringify(freshAgency));
      })
      .catch(() => {});
  }, [agency?.api_key]);

  useEffect(() => {
    if (!agency?.api_key) return;
    void loadWorkspace(agency.api_key);
  }, [agency?.api_key, loadWorkspace]);

  async function handleCreateAgency(event: React.FormEvent) {
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
      await loadWorkspace(created.api_key);
      setEmailTemplateOpts((current: any) => ({ ...current, agencyName: current.agencyName || created.name }));
      setSaasStatus("Der Agentur-Zugang wurde eingerichtet. Bitte bestätigen Sie jetzt zuerst die E-Mail-Adresse, bevor Job-Alarme aktiviert werden.");
      trackEvent("agency_created", { plan: created.plan });
    } catch (err: any) {
      setSaasStatus(err.message || "Agentur-Erstellung fehlgeschlagen");
    } finally {
      setSaasLoading(false);
    }
  }

  async function handleLoginAgency(event: React.FormEvent) {
    event.preventDefault();
    if (!loginKey.trim()) return;
    setSaasLoading(true);
    setSaasStatus("");
    try {
      const freshAgency = await requestJson("/api/agencies/me", {
        headers: { "X-Agency-Key": loginKey.trim() },
      });
      setAgency(freshAgency);
      localStorage.setItem("agencyProfile", JSON.stringify(freshAgency));
      await loadWorkspace(freshAgency.api_key);
      setEmailTemplateOpts((current: any) => ({ ...current, agencyName: current.agencyName || freshAgency.name }));
      setSaasStatus("Erfolgreich mit Agentur-Schlüssel eingeloggt!");
      trackEvent("agency_logged_in", { plan: freshAgency.plan });
    } catch (err: any) {
      setSaasStatus(err.message || "Login fehlgeschlagen");
    } finally {
      setSaasLoading(false);
    }
  }

  function handleForgetAgency() {
    localStorage.removeItem("agencyProfile");
    setAgency(null);
    setSubscriptions([]);
    setWorkspaceOverview(null);
    setSaasStatus("Der lokale Agentur-Zugang wurde aus diesem Browser entfernt.");
  }

  async function handleResendVerification() {
    if (!agency?.api_key || agency?.email_verified) return;
    setVerificationSending(true);
    try {
      const result = await requestJson("/api/agencies/resend-verification", {
        method: "POST",
        headers: { "X-Agency-Key": agency.api_key },
      });
      setSaasStatus(result.message || "Die Verifizierungs-E-Mail wurde erneut versendet.");
      pushToast("success", result.message || "Die Verifizierungs-E-Mail wurde erneut versendet.");
    } catch (err: any) {
      setSaasStatus(err.message || "Versand der Verifizierungs-E-Mail fehlgeschlagen");
    } finally {
      setVerificationSending(false);
    }
  }

  return {
    agency,
    setAgency,
    agencyForm,
    setAgencyForm,
    authMode,
    setAuthMode,
    loginKey,
    setLoginKey,
    saasStatus,
    setSaasStatus,
    saasLoading,
    setSaasLoading,
    verificationSending,
    handleCreateAgency,
    handleLoginAgency,
    handleForgetAgency,
    handleResendVerification,
  };
}
