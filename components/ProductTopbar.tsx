import Link from "next/link";

type ProductTopbarProps = {
  onToggleWorkspace?: () => void;
};

export default function ProductTopbar({
  onToggleWorkspace,
}: ProductTopbarProps) {
  return (
    <div className="product-topbar">
      <Link href="/" className="product-brand">
        KhalfaJobs für Personalvermittlungen
      </Link>
      <nav className="product-nav" aria-label="Primäre Navigation">
        <Link href="/" className="topbar-link">Suche</Link>
        <a href="/#ergebnisse" className="topbar-link">Ergebnisse</a>
        <a
          href="/#job-alarm"
          className="topbar-link"
          onClick={onToggleWorkspace}
        >
          Job-Alarm
        </a>
        <Link href="/pricing" className="topbar-link">Preise</Link>
        <Link href="/datenquelle" className="topbar-link">Datenquelle</Link>
        <Link href="/impressum" className="topbar-link">Impressum</Link>
        <Link href="/datenschutz" className="topbar-link">Datenschutz</Link>
      </nav>
    </div>
  );
}
