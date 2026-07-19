"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Compass,
  MapPin,
  Sparkles,
  Target,
  Wand2,
  X,
} from "lucide-react";

/**
 * MapCoachOverlay
 *
 * Panneau glassmorphism superposé à la carte. Il guide l'utilisateur
 * à travers les villes recommandées (peak markets) de son profil de
 * recherche. Fonctionne comme un mini "tour guidé" :
 *   - étape 0: prise en main de la carte
 *   - étape 1: highlight des top villes (cliquables)
 *   - étape 2: CTA "voir opportunité"
 *
 * L'utilisateur peut à tout moment fermer le coach via la croix.
 *
 * Props (toutes optionnelles):
 *   - active: boolean (true si le tour est en cours)
 *   - onDismiss: () => void (ferme le tour)
 *   - recommendedCities: [{ cityName, count, signal, note }]
 *   - topOpportunity: { title, employer, location, salary }
 *   - onSelectCity: (cityName) => void (déclenche un fly-to côté carte)
 *   - keyword, location, totalHits: current search context
 */
export default function MapCoachOverlay({
  active = true,
  onDismiss,
  recommendedCities = [],
  topOpportunity = null,
  onSelectCity,
  keyword = "",
  location = "",
  totalHits = 0,
}) {
  const [step, setStep] = useState(0);
  const [animatedIn, setAnimatedIn] = useState(false);
  const rootRef = useRef(null);

  // Trigger the entrance micro-animation only after mount so the
  // glassmorphism fade reads cleanly.
  useEffect(() => {
    if (!active) return undefined;
    const t = window.setTimeout(() => setAnimatedIn(true), 30);
    return () => window.clearTimeout(t);
  }, [active]);

  // Reset the coach step when the user selects a city manually so the
  // recommendation chips stay synchronized with the agenda.
  useEffect(() => {
    setStep(0);
  }, [location, keyword]);

  if (!active) return null;

  const topCity = recommendedCities[0];
  const safeHits = Number(totalHits) || 0;
  const nextLabel = step >= 2 ? "Fertig" : "Weiter";

  function handleNext() {
    if (step >= 2) {
      onDismiss && onDismiss();
      return;
    }
    setStep((current) => current + 1);
  }

  return (
    <aside
      ref={rootRef}
      className={`map-coach${animatedIn ? " is-mounted" : ""}`}
      role="region"
      aria-label="Coach der Kartenrecherche"
    >
      <button
        type="button"
        className="map-coach-close"
        aria-label="Coach schliessen"
        onClick={onDismiss}
      >
        <X size={14} />
      </button>

      <div className="map-coach-head">
        <span className="map-coach-eyebrow">
          <Wand2 size={12} aria-hidden="true" />
          Coach KhalfaJobs
        </span>
        <h3 className="map-coach-title">
          {step === 0 && "Karte lesen lernen"}
          {step === 1 && "Wo lohnt sich der Blick zuerst?"}
          {step === 2 && "Schneller Sprung zur besten Chance"}
        </h3>
        <p className="map-coach-copy">
          {step === 0 && (
            <>
              Treffer sind als Türme über der Karte angeordnet. Je höher der
              Stift, desto mehr Stellen in der jeweiligen Stadt. Zoomen Sie
              per Mausrad oder ziehen Sie die Karte in den gewünschten
              Markt.
            </>
          )}
          {step === 1 && (
            <>
              Diese Städte führen Ihr Profil gerade an – klicken Sie auf
              einen Marker oder einen Chip unten, um die Karte dorthin zu
              schwenken.
            </>
          )}
          {step === 2 && (
            <>
              Die nächste Empfehlung führt direkt zur besten bezahlten
              Position Ihrer Recherche – gefolgt vom Export für Ihr Team.
            </>
          )}
        </p>
      </div>

      {/* Step indicators – they also serve as a tiny map legend. */}
      <div className="map-coach-legend" aria-hidden="true">
        <span className="map-coach-legend-dot is-peak" />
        <span>&ge; 8 Treffer (Peak)</span>
        <span className="map-coach-legend-dot is-mid" />
        <span>3-7 Treffer</span>
        <span className="map-coach-legend-dot is-low" />
        <span>1-2 Treffer</span>
      </div>

      {step >= 1 && recommendedCities.length > 0 ? (
        <div className="map-coach-recommendations" aria-label="Top-Märkte">
          {recommendedCities.map((entry, index) => (
            <button
              key={entry.cityKey || entry.cityName}
              type="button"
              className={`map-coach-chip${index === 0 ? " is-top" : ""}`}
              onClick={() => onSelectCity && onSelectCity(entry.cityName)}
            >
              <span className="map-coach-chip-rank">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="map-coach-chip-name">{entry.cityName}</span>
              <span className="map-coach-chip-meta">
                <span>
                  <MapPin size={12} aria-hidden="true" />
                  {entry.count} {entry.count === 1 ? "Stelle" : "Stellen"}
                </span>
                <em>{entry.signal}</em>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {step >= 2 && topOpportunity ? (
        <article className="map-coach-opportunity" aria-label="Top-Gelegenheit">
          <span className="map-coach-opportunity-eyebrow">
            <Sparkles size={12} aria-hidden="true" /> Top-Gelegenheit
          </span>
          <strong>{topOpportunity.title || "Stelle im Spitzenfeld"}</strong>
          <span className="map-coach-opportunity-meta">
            {topOpportunity.employer} · {topOpportunity.location}
          </span>
          {topOpportunity.salary ? (
            <span className="map-coach-opportunity-salary">
              <Compass size={12} aria-hidden="true" /> {topOpportunity.salary}
            </span>
          ) : null}
        </article>
      ) : null}

      <footer className="map-coach-foot">
        <div className="map-coach-progress" aria-hidden="true">
          {[0, 1, 2].map((idx) => (
            <span
              key={idx}
              className={`map-coach-progress-dot${
                idx <= step ? " is-on" : ""
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          className="map-coach-cta"
          onClick={handleNext}
        >
          {step >= 2 ? (
            <Target size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
          {nextLabel}
        </button>
      </footer>

      <p className="map-coach-context" aria-live="polite">
        {keyword || "Aktuelle Recherche"}
        {location ? ` · ${location}` : ""} · {safeHits} Treffer im Blick
      </p>
    </aside>
  );
}
