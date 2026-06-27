import Link from "next/link";
import { dataSourceHighlights, legalContact } from "../lib/site-config";

export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Footer">
      <div>
        <p className="site-footer-title">KhalfaJobs für Recruiting-Agenturen</p>
        <p className="site-footer-copy">{dataSourceHighlights[0]}</p>
      </div>
      <div className="site-footer-links">
        <Link href="/impressum">Impressum</Link>
        <Link href="/datenschutz">Datenschutz</Link>
        <Link href="/pricing">Preise</Link>
        <Link href="/datenquelle">Datenquelle</Link>
        <Link href="/kontakt">Kontakt</Link>
        <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a>
      </div>
    </footer>
  );
}
