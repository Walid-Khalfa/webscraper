export const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://emploi-agences-next.vercel.app";

export const siteName = "KhalfaJobs";
export const defaultTitle = "KhalfaJobs – Jobsuche für Recruiting-Agenturen";
export const defaultDescription =
  "Durchsuchen Sie aktuelle Stellenangebote der Bundesagentur für Arbeit, speichern Sie Treffer und exportieren Sie Recruiting-Shortlists.";

export const legalContact = {
  businessName: "KhalfaJobs",
  ownerName: "Walid Khalfa",
  street: "Bitte ergänzen",
  postalCode: "Bitte ergänzen",
  city: "Bitte ergänzen",
  country: "Deutschland",
  email: "alerts@khalfajobs.me",
  phone: "Bitte ergänzen",
  website: appUrl,
  contentResponsible: "Walid Khalfa",
  commercialRegisterCourt: "Bitte ergänzen, falls vorhanden",
  commercialRegisterNumber: "Bitte ergänzen, falls vorhanden",
  vatId: "Bitte ergänzen, falls vorhanden",
};

export const legalFieldsMissing = [
  ["Unternehmen / Rechtsform", legalContact.businessName],
  ["Postanschrift", `${legalContact.street}, ${legalContact.postalCode} ${legalContact.city}`],
  ["Telefon", legalContact.phone],
  ["Registergericht / Registernummer", `${legalContact.commercialRegisterCourt} / ${legalContact.commercialRegisterNumber}`],
  ["USt-IdNr.", legalContact.vatId],
].filter(([, value]) => String(value).includes("Bitte ergänzen"));

export const pricingPlans = [
  {
    name: "Starter",
    price: "29 € / Monat",
    description: "Für Einzelrecruiter und erste Marktsondierungen.",
    cta: "Plan auswählen",
    href: "/#suche",
    features: [
      "Bis zu 150 Suchen pro Monat",
      "1 Job-Alarm",
      "Favoriten-Tracking",
      "CSV-Export bis 50 Treffer",
    ],
  },
  {
    name: "Pro",
    price: "79 € / Monat",
    description: "Für Recruiting-Teams mit wiederkehrenden Shortlists und Kundenprojekten.",
    cta: "Plan auswählen",
    href: "/#job-alarm",
    highlighted: true,
    features: [
      "Bis zu 1.000 Suchen pro Monat",
      "Unbegrenzte Job-Alarme",
      "Favoriten-Tracking und Shortlists",
      "CSV-Export bis 250 Treffer",
    ],
  },
  {
    name: "Agentur",
    price: "Preis auf Anfrage",
    description: "Für Personalberatungen mit mehreren Beratern, Teamzugängen und Integrationen.",
    cta: "Demo anfragen",
    href: "/kontakt",
    features: [
      "Individuelle Such- und Exportlimits",
      "Agenturweite Alerts und Vorlagen",
      "Teamzugänge und gemeinsame Dossiers",
      "CSV-Export, CRM- und ATS-Anbindung",
    ],
  },
];

export const recruitingUseCases = [
  {
    title: "Active Sourcing",
    description: "Offene Stellen nach Region, Rolle und Arbeitgeber clustern und direkt in exportierbare Shortlists überführen.",
  },
  {
    title: "Regionale Marktbeobachtung",
    description: "Neue Ausschreibungen in Zielregionen beobachten und Veränderungen im Stellenmarkt früh erkennen.",
  },
  {
    title: "Shortlists für Berater",
    description: "Relevante Treffer speichern, priorisieren und als CSV für Kundenprojekte oder interne Pitches exportieren.",
  },
];

export const recruitingBenefits = [
  {
    label: "Für Recruiting-Teams entwickelt",
    value: "Klarer B2B-Fokus",
    description: "Suche, Export und Job-Alarm sind auf Agentur- und Research-Workflows ausgelegt.",
  },
  {
    label: "Offizielle Datenbasis",
    value: "Bundesagentur für Arbeit",
    description: "Die Recherche basiert auf den öffentlichen Stellenangeboten der BA.",
  },
  {
    label: "Exportierbare Ergebnisse",
    value: "CSV und Favoriten",
    description: "Treffer können für interne Shortlists, Outreach und Reporting vorbereitet werden.",
  },
];

export const dataSourceHighlights = [
  "Datenquelle: öffentliche Stellenangebote der Bundesagentur für Arbeit.",
  "Suchbegriffe und Standorte werden live gegen die BA-Schnittstelle verarbeitet.",
  "Job-Alarme und E-Mail-Zustellung laufen über die eigene Plattformlogik.",
  "Hosting erfolgt über Vercel, E-Mail-Versand über Resend.",
  "Produktanalyse ist technisch vorbereitet; externe Analytics sollten nur nach tatsächlicher Aktivierung in der Datenschutzerklärung benannt werden.",
];
