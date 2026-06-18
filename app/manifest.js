export default function manifest() {
  return {
    name: "KhalfaJobs Deutsches Stellenregister",
    short_name: "KhalfaJobs",
    description: "Professionelle Live-Suche fuer Stellenangebote der Bundesagentur fuer Arbeit mit CSV-Export und Job-Alarmen.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2efe8",
    theme_color: "#151515",
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
