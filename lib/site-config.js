export const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://emploi-agences-next.vercel.app";

export const siteName = "KhalfaJobs";
export const defaultTitle = "KhalfaJobs – BA-Stellenanzeigen für Recruiting-Agenturen effizient durchsuchen";
export const defaultDescription =
  "KhalfaJobs hilft Recruiting-Agenturen, Stellenanzeigen der Bundesagentur für Arbeit schneller zu recherchieren, zu filtern, zu überwachen und als Shortlist zu exportieren.";

export const legalContact = {
  businessName: "KhalfaJobs",
  ownerName: "Walid Khalfa",
  street: null,
  postalCode: null,
  city: null,
  country: "Deutschland",
  email: "alerts@khalfajobs.me",
  phone: null,
  website: appUrl,
  contentResponsible: "Walid Khalfa",
  commercialRegisterCourt: null,
  commercialRegisterNumber: null,
  vatId: null,
};

export const legalFieldsMissing = [
  !legalContact.street || !legalContact.postalCode || !legalContact.city ? "Postanschrift" : null,
  !legalContact.phone ? "Telefon" : null,
  !legalContact.commercialRegisterCourt || !legalContact.commercialRegisterNumber ? "Registergericht / Registernummer" : null,
  !legalContact.vatId ? "USt-IdNr." : null,
].filter(Boolean);

export const pricingPlans = [
  {
    name: "Starter",
    price: "29 € / Monat",
    description: "Für einzelne Recruiter, die BA-Stellen systematischer recherchieren und sauber dokumentieren wollen.",
    cta: "Starter wählen",
    href: "/#suche",
    features: [
      "Bis zu 150 Suchanfragen pro Monat",
      "1 aktiver Job-Alarm",
      "Favoriten und persönliche Shortlists",
      "CSV-Export mit bis zu 50 Treffern",
    ],
  },
  {
    name: "Professional",
    price: "79 € / Monat",
    description: "Für wachsende Recruiting-Agenturen mit wiederkehrenden Recherchen, Kundenprojekten und Monitoring-Bedarf.",
    cta: "Professional wählen",
    href: "/#job-alarm",
    highlighted: true,
    features: [
      "Bis zu 1.000 Suchanfragen pro Monat",
      "Unbegrenzte Job-Alarme",
      "Shortlists, Favoriten und Verlaufsdaten",
      "CSV-Export mit bis zu 250 Treffern",
    ],
  },
  {
    name: "Agentur",
    price: "Preis auf Anfrage",
    description: "Für größere Teams mit Rollen, gemeinsamen Dossiers, Integrationen und individuellen Prozessanforderungen.",
    cta: "Demo anfragen",
    href: `mailto:${legalContact.email}?subject=Demo-Anfrage%20KhalfaJobs`,
    features: [
      "Individuelle Such- und Exportlimits",
      "Agenturweite Alerts und Vorlagen",
      "Teamzugänge mit Rollen und Freigaben",
      "CSV-Export sowie CRM- und ATS-Anbindung",
    ],
  },
];

export const recruitingUseCases = [
  {
    title: "Marktrecherche für Suchmandate",
    description: "Durchsuchen Sie BA-Stellenanzeigen nach Rolle, Region und Arbeitgeber und bauen Sie belastbare Marktüberblicke in Minuten statt Stunden auf.",
  },
  {
    title: "Monitoring relevanter Zielregionen",
    description: "Beobachten Sie neue Ausschreibungen in definierten Regionen automatisch und erkennen Sie Veränderungen im Stellenmarkt frühzeitig.",
  },
  {
    title: "Shortlists für Beratung und Vertrieb",
    description: "Speichern Sie relevante Treffer, priorisieren Sie Chancen und exportieren Sie strukturierte Listen für Kundenprojekte, Business Development oder interne Übergaben.",
  },
];

export const recruitingBenefits = [
  {
    label: "Speziell für Agenturen",
    value: "B2B-Workflow statt Jobbörse",
    description: "Suche, Export, Alerts und Shortlists sind auf die Arbeitsweise von Personalberatungen und Recruiting-Teams abgestimmt.",
  },
  {
    label: "Verlässliche Datenquelle",
    value: "Öffentliche BA-Stellenanzeigen",
    description: "Ihre Recherche basiert auf den öffentlich verfügbaren Stellenangeboten der Bundesagentur für Arbeit.",
  },
  {
    label: "Sofort weiterverwendbar",
    value: "CSV, Favoriten, Alerts",
    description: "Ergebnisse lassen sich direkt speichern, exportieren und für weitere Rechercheschritte oder Teamarbeit nutzen.",
  },
];

export const dataSourceHighlights = [
  "Datenbasis sind die öffentlich zugänglichen Stellenanzeigen der Bundesagentur für Arbeit.",
  "Suchbegriffe und Standorte werden live gegen die BA-Schnittstelle verarbeitet.",
  "Job-Alerts, Freigaben und E-Mail-Versand laufen über die eigene Plattformlogik.",
  "Hosting erfolgt in der Cloud über Vercel, E-Mail-Versand über Resend.",
  "Die Primärquelle bleibt immer die Originalanzeige der Bundesagentur für Arbeit.",
];
