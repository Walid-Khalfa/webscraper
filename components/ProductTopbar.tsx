import ThemeSwitcher from "./ThemeSwitcher";

type ThemeEntry = {
  id: string;
  label: string;
};

type ProductTopbarProps = {
  themes: ThemeEntry[];
  activeTheme: string;
  onThemeChange: (themeId: string) => void;
  hasAgency: boolean;
  onToggleWorkspace: () => void;
};

export default function ProductTopbar({
  themes,
  activeTheme,
  onThemeChange,
  hasAgency,
  onToggleWorkspace,
}: ProductTopbarProps) {
  return (
    <div className="product-topbar">
      <a href="#top" className="product-brand">
        KhalfaJobs für Personalvermittlungen
      </a>
      <nav className="product-nav" aria-label="Primaere Navigation">
        <a href="#suche" className="topbar-link">Suche</a>
        <a href="#ergebnisse" className="topbar-link">Ergebnisse</a>
        <a href="#job-alarm" className="topbar-link" onClick={onToggleWorkspace}>
          {hasAgency ? "Workspace" : "Job-Alarm"}
        </a>
        <a href="#datenquelle" className="topbar-link">Datenquelle</a>
        <a href="/impressum" className="topbar-link">Impressum</a>
        <a href="/datenschutz" className="topbar-link">Datenschutz</a>
      </nav>
      {process.env.NODE_ENV !== "production" && (
        <ThemeSwitcher themes={themes} activeTheme={activeTheme} onChange={onThemeChange} />
      )}
    </div>
  );
}
