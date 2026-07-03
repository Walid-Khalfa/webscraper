export default function manifest() {
  return {
    name: "KhalfaJobs – BA-Stellenanzeigen für Recruiting-Agenturen",
    short_name: "KhalfaJobs",
    description: "Recherche, Alerts und CSV-Export für Recruiting-Agenturen auf Basis öffentlicher Stellenanzeigen der Bundesagentur für Arbeit.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ed",
    theme_color: "#153243",
    lang: "de-DE",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
