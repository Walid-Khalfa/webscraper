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
        KhalfaJobs für Recruiting-Agenturen
      </Link>
      <nav className="product-nav" aria-label="Primäre Navigation">
        <Link href="/" className="topbar-link">Recherche</Link>
        <a href="/#ergebnisse" className="topbar-link">Ergebnisse</a>
        <a href="/#job-alarm" className="topbar-link" onClick={onToggleWorkspace}>
          Alerts
        </a>
        <Link href="/pricing" className="topbar-link">Tarife</Link>
        <Link href="/datenquelle" className="topbar-link">Datenbasis</Link>
        <Link href="/impressum" className="topbar-link">Impressum</Link>
        <Link href="/datenschutz" className="topbar-link">Datenschutz</Link>
      </nav>
    </div>
  );
}
