import { useState, useEffect, useCallback } from "react";

const defaultEmailTemplate = {
  subject: "",
  agencyName: "",
  greeting: "Guten Morgen",
  intro: "hier sind Ihre neuesten relevanten Stellenangebote für heute.",
  showSalary: true,
  showLocation: true,
  showApplyLink: true,
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useUIFeedback() {
  const [toasts, setToasts] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState("grid");
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [emailTemplateOpts, setEmailTemplateOpts] = useState(defaultEmailTemplate);
  const [simulatingEmail, setSimulatingEmail] = useState(false);

  useEffect(() => {
    const storedView = localStorage.getItem("jobViewMode");
    const storedEmailTemplate = localStorage.getItem("emailTemplateOpts");
    if (storedView) setViewMode(storedView);
    if (storedEmailTemplate) {
      setEmailTemplateOpts({ ...defaultEmailTemplate, ...JSON.parse(storedEmailTemplate) });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("jobViewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("emailTemplateOpts", JSON.stringify(emailTemplateOpts));
  }, [emailTemplateOpts]);

  const pushToast = useCallback((type: string, message: string, persist = false) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.filter((toast) => toast.type !== "loading"), { id, type, message }].slice(-4));
    if (!persist) {
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4200);
    }
    return id;
  }, []);

  const appendConsole = useCallback((message: string) => {
    setConsoleLogs((current) => [
      ...current,
      `${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}  ${message}`,
    ].slice(-10));
  }, []);

  async function handleSimulateEmailSend() {
    setSimulatingEmail(true);
    pushToast("loading", "Versand wird simuliert...", true);
    await sleep(900);
    setSimulatingEmail(false);
    pushToast("success", "Digest erfolgreich simuliert. Die Vorschau entspricht dem aktuellen Layout.");
  }

  return {
    toasts,
    setToasts,
    viewMode,
    setViewMode,
    isConsoleOpen,
    setIsConsoleOpen,
    consoleLogs,
    setConsoleLogs,
    emailTemplateOpts,
    setEmailTemplateOpts,
    simulatingEmail,
    setSimulatingEmail,
    pushToast,
    appendConsole,
    handleSimulateEmailSend,
    defaultEmailTemplate,
  };
}
export { defaultEmailTemplate };
