import { useState, useEffect, useMemo, useCallback } from "react";

const statusCycle = ["interested", "applied", "interview", "closed"];
const statusLabels: Record<string, string> = {
  interested: "Interessiert",
  applied: "Beworben",
  interview: "Interview",
  closed: "Abgelehnt / Angebot",
};

async function requestJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(data?.detail || data || `Anfrage fehlgeschlagen mit Status ${response.status}`);
  }
  return data;
}

interface UseFavoritesParams {
  agency: any;
  pushToast: (type: string, message: string) => string;
  setWorkspaceOverview: React.Dispatch<React.SetStateAction<any>>;
}

export function useFavorites({
  agency,
  pushToast,
  setWorkspaceOverview,
}: UseFavoritesParams) {
  const [favorites, setFavorites] = useState<Record<string, any>>({});
  const [activeFavoriteRef, setActiveFavoriteRef] = useState<string | null>(null);
  const [draggingRef, setDraggingRef] = useState<string | null>(null);

  useEffect(() => {
    const storedFavorites = localStorage.getItem("jobFavorites");
    if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
  }, []);

  const saveFavorites = useCallback((next: Record<string, any>) => {
    setFavorites(next);
    localStorage.setItem("jobFavorites", JSON.stringify(next));
  }, []);

  const kanbanJobs = useMemo(
    () =>
      statusCycle.map((status) => ({
        status,
        jobs: Object.values(favorites).filter((entry) => entry.status === status && entry.job),
      })),
    [favorites],
  );

  const activeFavorite = activeFavoriteRef ? favorites[activeFavoriteRef] : null;

  function buildDossierPayload(entry: any) {
    if (!entry?.job?.reference) return null;
    return {
      reference: entry.job.reference,
      title: entry.job.title || "Unbenannte Stelle",
      employer: entry.job.employer || "Arbeitgeber nicht genannt",
      location: entry.job.location || "Standort nicht genannt",
      status: entry.status || "interested",
      notes: entry.notes || "",
      tags: Array.isArray(entry.tags) ? entry.tags : [],
    };
  }

  const updateWorkspaceDossier = useCallback((snapshot: any) => {
    if (!snapshot) return;
    setWorkspaceOverview((current: any) => {
      if (!current?.workspace) return current;
      const currentDossiers = Array.isArray(current.workspace.candidate_dossiers) ? current.workspace.candidate_dossiers : [];
      const nextDossiers = [snapshot, ...currentDossiers.filter((entry: any) => entry.reference !== snapshot.reference)].slice(0, 12);
      return {
        ...current,
        workspace: {
          ...current.workspace,
          candidate_dossiers: nextDossiers,
          reporting: {
            ...current.workspace.reporting,
            shared_dossiers: nextDossiers.length,
          },
        },
      };
    });
  }, [setWorkspaceOverview]);

  const removeWorkspaceDossier = useCallback((reference: string) => {
    if (!reference) return;
    setWorkspaceOverview((current: any) => {
      if (!current?.workspace) return current;
      const nextDossiers = (current.workspace.candidate_dossiers || []).filter((entry: any) => entry.reference !== reference);
      return {
        ...current,
        workspace: {
          ...current.workspace,
          candidate_dossiers: nextDossiers,
          reporting: {
            ...current.workspace.reporting,
            shared_dossiers: nextDossiers.length,
          },
        },
      };
    });
  }, [setWorkspaceOverview]);

  const persistFavoriteEntry = useCallback(async (entry: any) => {
    const payload = buildDossierPayload(entry);
    if (!agency?.api_key || !payload) return;

    try {
      const saved = await requestJson("/api/agencies/dossiers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agency-Key": agency.api_key,
        },
        body: JSON.stringify(payload),
      });
      updateWorkspaceDossier(saved);
    } catch {}
  }, [agency?.api_key, updateWorkspaceDossier]);

  const deleteFavoriteFromWorkspace = useCallback(async (reference: string) => {
    if (!agency?.api_key || !reference) return;
    try {
      await requestJson(`/api/agencies/dossiers/${encodeURIComponent(reference)}`, {
        method: "DELETE",
        headers: {
          "X-Agency-Key": agency.api_key,
        },
      });
      removeWorkspaceDossier(reference);
    } catch {}
  }, [agency?.api_key, removeWorkspaceDossier]);

  const ensureFavorite = useCallback((job: any, overrides = {}) => {
    const current = favorites[job.reference];
    const next = {
      ...current,
      notes: current?.notes || "",
      tags: current?.tags || [],
      status: current?.status || "interested",
      job,
      ...overrides,
    };
    const all = { ...favorites, [job.reference]: next };
    saveFavorites(all);
    void persistFavoriteEntry(next);
    return next;
  }, [favorites, saveFavorites, persistFavoriteEntry]);

  const toggleFavorite = useCallback((job: any) => {
    if (!job?.reference) return;
    if (favorites[job.reference]) {
      const next = { ...favorites };
      delete next[job.reference];
      saveFavorites(next);
      void deleteFavoriteFromWorkspace(job.reference);
      if (activeFavoriteRef === job.reference) setActiveFavoriteRef(null);
      pushToast("success", "Favorit entfernt.");
      return;
    }
    ensureFavorite(job);
    setActiveFavoriteRef(job.reference);
    pushToast("success", "Favorit gespeichert.");
  }, [favorites, saveFavorites, deleteFavoriteFromWorkspace, activeFavoriteRef, ensureFavorite, pushToast]);

  const cycleFavoriteStatus = useCallback((reference: string) => {
    const current = favorites[reference];
    if (!current) return;
    const currentIndex = statusCycle.indexOf(current.status || "interested");
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    const next = { ...favorites, [reference]: { ...current, status: nextStatus } };
    saveFavorites(next);
    void persistFavoriteEntry(next[reference]);
    pushToast("success", `Status auf ${statusLabels[nextStatus]} gesetzt.`);
  }, [favorites, saveFavorites, persistFavoriteEntry, pushToast]);

  const updateFavoriteField = useCallback((reference: string, updates: any) => {
    const current = favorites[reference];
    if (!current) return;
    const next = { ...favorites, [reference]: { ...current, ...updates } };
    saveFavorites(next);
    void persistFavoriteEntry(next[reference]);
  }, [favorites, saveFavorites, persistFavoriteEntry]);

  const moveFavoriteToStatus = useCallback((reference: string, status: string) => {
    const current = favorites[reference];
    if (!current) return;
    const next = { ...favorites, [reference]: { ...current, status } };
    saveFavorites(next);
    void persistFavoriteEntry(next[reference]);
  }, [favorites, saveFavorites, persistFavoriteEntry]);

  const mergeFavoritesFromDossiers = useCallback((dossiers: any[]) => {
    if (!Array.isArray(dossiers) || !dossiers.length) return;
    setFavorites((curr) => {
      const next = { ...curr };
      dossiers.forEach((dossier) => {
        const current = next[dossier.reference];
        next[dossier.reference] = {
          ...current,
          status: dossier.status || current?.status || "interested",
          notes: dossier.notes || current?.notes || "",
          tags: Array.isArray(dossier.tags) ? dossier.tags : current?.tags || [],
          job:
            current?.job ||
            {
              reference: dossier.reference,
              title: dossier.title,
              employer: dossier.employer,
              location: dossier.location,
              occupation: "",
              salary: "",
              url: dossier.reference ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${dossier.reference}` : "",
            },
        };
      });
      localStorage.setItem("jobFavorites", JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    favorites,
    setFavorites,
    activeFavoriteRef,
    setActiveFavoriteRef,
    draggingRef,
    setDraggingRef,
    kanbanJobs,
    activeFavorite,
    ensureFavorite,
    toggleFavorite,
    cycleFavoriteStatus,
    updateFavoriteField,
    moveFavoriteToStatus,
    mergeFavoritesFromDossiers,
  };
}
export { statusCycle, statusLabels };
