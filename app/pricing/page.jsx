import Link from "next/link";
import ProductTopbar from "../../components/ProductTopbar";
import SiteFooter from "../../components/SiteFooter";
import { pricingPlans } from "../../lib/site-config";

export const metadata = {
  title: "Preise",
  description: "Preisübersicht für KhalfaJobs mit Starter-, Pro- und Agentur-Angebot.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Preise | KhalfaJobs",
    description: "Preisübersicht für KhalfaJobs mit Starter-, Pro- und Agentur-Angebot.",
    url: "/pricing",
  },
};

export default function PricingPage() {
  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Anwendungsidentität">
        <span>BA</span>
        <span>B2B</span>
        <span>PLANS</span>
      </aside>
      <article className="workspace legal-page">
        <ProductTopbar />
        <header className="job-detail-hero legal-hero">
          <p className="eyebrow">Preisübersicht</p>
          <h1>Preise für Recruiting-Agenturen</h1>
          <p>Klare Pakete für Recherche, Job-Alarme und exportierbare Shortlists. Die Agentur-Variante bleibt bewusst individuell, wenn Teamgrößen oder Integrationen variieren.</p>
        </header>

        <section className="plan-grid" aria-label="Preispläne">
          {pricingPlans.map((plan) => (
            <article key={plan.name} className={`plan-card${plan.highlighted ? " is-highlighted" : ""}`}>
              <div>
                {plan.highlighted ? <span className="plan-badge">Empfohlen</span> : null}
                <h2>{plan.name}</h2>
                <p className="plan-price">{plan.price}</p>
                <p>{plan.description}</p>
                <ul className="plan-list">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
              <Link href={plan.href} className="plan-cta">
                {plan.cta}
              </Link>
            </article>
          ))}
        </section>

        <SiteFooter />
      </article>
    </main>
  );
}
