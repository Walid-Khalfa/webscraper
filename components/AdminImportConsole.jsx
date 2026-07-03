"use client";

import { useState } from "react";

export default function AdminImportConsole() {
  const [secret, setSecret] = useState("");
  const [mode, setMode] = useState("test");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function runImport() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ mode }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || "Import konnte nicht gestartet werden");
      setResult(payload.report);
    } catch (err) {
      setError(err.message || "Import konnte nicht gestartet werden");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="search-panel" aria-label="Import-Konsole">
      <label>
        <span>Admin-Schlüssel</span>
        <input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="CRON_SECRET eingeben" />
      </label>
      <label>
        <span>Import-Modus</span>
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="test">Testimport</option>
          <option value="full">Vollimport</option>
        </select>
      </label>
      <button className="primary-action" type="button" onClick={runImport} disabled={loading || !secret.trim()}>
        {loading ? "Import läuft..." : "Import starten"}
      </button>

      {error ? <p className="workspace-muted" style={{ color: "#8b2618", margin: 0 }}>{error}</p> : null}
      {result ? (
        <div className="workspace-card" style={{ padding: "16px" }}>
          <p className="eyebrow">Letzter Lauf</p>
          <p style={{ margin: "0 0 8px" }}><strong>Neue Jobs:</strong> {result.newCount}</p>
          <p style={{ margin: "0 0 8px" }}><strong>Aktualisiert:</strong> {result.updatedCount}</p>
          <p style={{ margin: "0 0 8px" }}><strong>Duplikate:</strong> {result.duplicateCount}</p>
          <p style={{ margin: 0 }}><strong>Fehler:</strong> {result.errorCount}</p>
        </div>
      ) : null}
    </section>
  );
}
