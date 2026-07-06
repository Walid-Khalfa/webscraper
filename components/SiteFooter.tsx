import Link from "next/link";
import { legalContact } from "../lib/site-config";

export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Footer">
      <div>
        <p className="site-footer-title">KhalfaJobs</p>
        <p className="site-footer-copy">Recherche, Monitoring und Export von BA-Stellenanzeigen für Recruiting-Agenturen.</p>
      </div>
      <div className="site-footer-links">
        <Link href="/impressum">Impressum</Link>
        <Link href="/datenschutz">Datenschutz</Link>
        <Link href="/pricing">Tarife</Link>
        <Link href="/datenquelle">Datenbasis</Link>
        <a href={`mailto:${legalContact.email}`}>Kontakt</a>
        <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a>
      </div>
    </footer>
  );
}
