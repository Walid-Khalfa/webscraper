import Link from "next/link";
import ProductTopbar from "../../components/ProductTopbar";
import SiteFooter from "../../components/SiteFooter";
import { pricingPlans } from "../../lib/site-config";

export const metadata = {
  title: "Tarife",
  description: "Tarife für Recruiting-Agenturen, Personalberater und Teams, die BA-Stellenanzeigen strukturiert recherchieren und überwachen möchten.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Tarife | KhalfaJobs",
    description: "Tarife für Recruiting-Agenturen mit Recherche, Alerts, Export und Team-Workflow.",
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
          <p className="eyebrow">Tarife</p>
          <h1>Tarife für Recruiting-Agenturen mit klarem Workflow-Fokus</h1>
          <p>Wählen Sie den passenden Tarif für Ihr Recherchevolumen, Ihre Teamgröße und Ihren Bedarf an Alerts, Exporten und Zusammenarbeit.</p>
        </header>

        <section className="plan-grid" aria-label="Tarifübersicht">
          {pricingPlans.map((plan) => (
            <article key={plan.name} className={`plan-card${plan.highlighted ? " is-highlighted" : ""}`}>
              <div>
                {plan.highlighted ? <span className="plan-badge">Für die meisten Agenturen</span> : null}
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
