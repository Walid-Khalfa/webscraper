import { useState, useCallback } from "react";

async function requestJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(data?.detail || data || `Anfrage fehlgeschlagen mit Status ${response.status}`);
  }
  return data;
}

interface UseWorkspaceParams {
  agency: any;
  pushToast: (type: string, message: string) => string;
  mergeFavoritesFromDossiers: (dossiers: any[]) => void;
}

export function useWorkspace({
  agency,
  pushToast,
  mergeFavoritesFromDossiers,
}: UseWorkspaceParams) {
  const [workspaceOverview, setWorkspaceOverview] = useState<any>(null);
  const [connectingCrm, setConnectingCrm] = useState<any>(null);
  const [crmApiKey, setCrmApiKey] = useState("");
  const [crmActionLoading, setCrmActionLoading] = useState(false);
  const [syncingCrmCandidate, setSyncingCrmCandidate] = useState<Record<string, boolean>>({});
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("RECRUITER");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const loadWorkspace = useCallback(async (apiKey = agency?.api_key) => {
    if (!apiKey) return;
    setWorkspaceLoading(true);
    try {
      const data = await requestJson("/api/agencies/workspace?limit=6", {
        headers: { "X-Agency-Key": apiKey },
      });
      setWorkspaceOverview(data);
      mergeFavoritesFromDossiers(data?.workspace?.candidate_dossiers || []);
    } catch {
      setWorkspaceOverview(null);
    } finally {
      setWorkspaceLoading(false);
    }
  }, [agency?.api_key, mergeFavoritesFromDossiers]);

  async function handleConnectCrm(e: React.FormEvent) {
    e.preventDefault();
    if (!connectingCrm || !agency?.api_key) return;
    setCrmActionLoading(true);
    try {
      await requestJson("/api/agencies/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agency-Key": agency.api_key,
        },
        body: JSON.stringify({
          provider: connectingCrm.provider,
          apiKey: crmApiKey,
        }),
      });
      pushToast("success", `${connectingCrm.display_name} erfolgreich verbunden.`);
      setConnectingCrm(null);
      setCrmApiKey("");
      await loadWorkspace();
    } catch (err: any) {
      pushToast("error", `Verbindung failed: ${err.message}`);
    } finally {
      setCrmActionLoading(false);
    }
  }

  async function handleDisconnectCrm(provider: string, displayName: string) {
    if (!agency?.api_key) return;
    if (!confirm(`Möchten Sie die Integration mit ${displayName} wirklich trennen?`)) return;
    try {
      await requestJson(`/api/agencies/integrations?provider=${provider}`, {
        method: "DELETE",
        headers: {
          "X-Agency-Key": agency.api_key,
        },
      });
      pushToast("success", `Verbindung mit ${displayName} getrennt.`);
      await loadWorkspace();
    } catch (err: any) {
      pushToast("error", `Trennung fehlgeschlagen: ${err.message}`);
    }
  }

  async function handlePushToCrm(provider: string, reference: string, displayName: string) {
    if (!agency?.api_key) return;
    const key = `${reference}:${provider}`;
    setSyncingCrmCandidate((current) => ({
      ...current,
      [key]: true,
    }));
    try {
      const res = await requestJson("/api/agencies/integrations/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agency-Key": agency.api_key,
        },
        body: JSON.stringify({ provider, reference }),
      });
      pushToast("success", res.message || `Kandidat erfolgreich zu ${displayName} exportiert.`);
      await loadWorkspace();
    } catch (err: any) {
      pushToast("error", `Export failed: ${err.message}`);
    } finally {
      setSyncingCrmCandidate((current) => ({
        ...current,
        [key]: false,
      }));
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!agency?.api_key) return;
    setInviteLoading(true);
    try {
      await requestJson("/api/agencies/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agency-Key": agency.api_key,
        },
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteName,
          role: inviteRole,
        }),
      });
      pushToast("success", `Einladung an ${inviteName} erfolgreich gesendet.`);
      setShowInviteForm(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("RECRUITER");
      await loadWorkspace();
    } catch (err: any) {
      pushToast("error", `Einladung fehlgeschlagen: ${err.message}`);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRemoveMember(memberId: number, name: string) {
    if (!agency?.api_key) return;
    if (!confirm(`Möchten Sie das Mitglied ${name} wirklich aus der Agentur entfernen?`)) return;
    try {
      await requestJson(`/api/agencies/members?id=${memberId}`, {
        method: "DELETE",
        headers: {
          "X-Agency-Key": agency.api_key,
        },
      });
      pushToast("success", `Mitglied ${name} wurde entfernt.`);
      await loadWorkspace();
    } catch (err: any) {
      pushToast("error", `Entfernen fehlgeschlagen: ${err.message}`);
    }
  }

  return {
    workspaceOverview,
    setWorkspaceOverview,
    connectingCrm,
    setConnectingCrm,
    crmApiKey,
    setCrmApiKey,
    crmActionLoading,
    syncingCrmCandidate,
    showInviteForm,
    setShowInviteForm,
    inviteEmail,
    setInviteEmail,
    inviteName,
    setInviteName,
    inviteRole,
    setInviteRole,
    inviteLoading,
    workspaceLoading,
    loadWorkspace,
    handleConnectCrm,
    handleDisconnectCrm,
    handlePushToCrm,
    handleInviteMember,
    handleRemoveMember,
  };
}
