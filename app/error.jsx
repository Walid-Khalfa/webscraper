"use client";

export default function GlobalError({ error, reset }) {
  return (
    <main className="app-shell">
      <aside className="registry-rail" aria-label="Anwendungsidentitaet">
        <span>BA</span>
        <span>ERROR</span>
        <span>APP</span>
      </aside>
      <section className="workspace">
        <div className="error-surface" role="alert">
          <p className="eyebrow">Anwendungsfehler</p>
          <h1>Die Seite konnte nicht korrekt geladen werden.</h1>
          <p>
            {error?.message ||
              "Ein unerwarteter Fehler ist aufgetreten. Bitte laden Sie die Seite neu oder versuchen Sie es in wenigen Minuten erneut."}
          </p>
          <div className="error-surface-actions">
            <button className="primary-action" type="button" onClick={() => reset()}>
              Erneut versuchen
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
