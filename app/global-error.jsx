"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="de">
      <body>
        <main className="app-shell">
          <aside className="registry-rail" aria-label="Anwendungsidentitaet">
            <span>BA</span>
            <span>GLOBAL</span>
            <span>FEHLER</span>
          </aside>
          <section className="workspace">
            <div className="error-surface" role="alert">
              <p className="eyebrow">Kritischer Anwendungsfehler</p>
              <h1>Die Anwendung konnte nicht korrekt gestartet werden.</h1>
              <p>
                {error?.message ||
                  "Bitte laden Sie die Seite erneut. Falls das Problem bestehen bleibt, prüfen Sie die produktiven Umgebungsvariablen und das Deployment-Log."}
              </p>
              <div className="error-surface-actions">
                <button className="primary-action" type="button" onClick={() => reset()}>
                  Neu laden
                </button>
                <a className="secondary-action error-link-button" href="/">
                  Zur Startseite
                </a>
              </div>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
