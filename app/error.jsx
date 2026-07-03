"use client";

export default function GlobalError({ error, reset }) {
  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Anwendungsidentitaet">
        <span>BA</span>
        <span>FEHLER</span>
        <span>APP</span>
      </aside>
      <section className="workspace">
        <div className="error-surface" role="alert">
          <p className="eyebrow">Anwendungsfehler</p>
          <h1>Diese Seite ist momentan nicht verfügbar.</h1>
          <p>
            {error?.message ||
              "Beim Laden ist ein unerwartetes Problem aufgetreten. Bitte versuchen Sie es erneut oder kehren Sie zur Startseite zurück."}
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
  );
}
