"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { normalizeCityKey } from "../lib/german-city-map";
import { useGeocodedMarkers } from "./hooks/useGeocodedMarkers";

// 3D glassmorphism map. Tier classification + geocoding live in the
// shared `useGeocodedMarkers` hook — this component focuses on rendering
// the layered pillar+cap+initials+badge markup inside the
// .city-map-shell / .city-map-shell.spotlight-on wrapper.

function MapBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      if (positions.length === 1) {
        map.setView(positions[0], 12);
      } else {
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }
  }, [map, positions]);
  return null;
}

export default function JobMap3D({ jobs = [], selectedCity = "", onSelectCity }) {
  const { markers, mounted } = useGeocodedMarkers(jobs);

  if (!mounted) {
    return (
      <div
        className="city-map-shell"
        style={{
          height: "100%",
          width: "100%",
          background: "#f0f0f0",
          borderRadius: "12px",
          border: "1px solid var(--line)",
        }}
      />
    );
  }

  const center = markers.length > 0 ? markers[0].position : [51.1657, 10.4515]; // Center of Germany
  const positions = markers.map((m) => m.position);
  const selectedCityKey = normalizeCityKey(selectedCity);

  const getMarker3DIcon = (cityName, count, isActive, tier) => {
    const initials = cityName.slice(0, 2).toUpperCase();
    return L.divIcon({
      className: `custom-map-marker city-marker city-marker-${tier}${isActive ? " is-active" : ""}`,
      // The pillar consumes var(--depth) via CSS cascade. The tier class on
      // the icon container is the only place we declare the depth, which
      // removes the dual source-of-truth that lived in this file before.
      html: `
        <div class="city-marker-pillar">
          <div class="city-marker-cap">
            <span class="city-marker-initials">${initials}</span>
            ${count > 1 ? `<span class="city-marker-badge">${count}</span>` : ""}
          </div>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 42], // anchor at base of the pillar so the cap sits above the city
      popupAnchor: [0, -42],
    });
  };

  const spotlight = Boolean(selectedCity) && selectedCity !== "__all_map_cities__";

  return (
    <div
      className={`city-map-shell${spotlight ? " spotlight-on" : ""}`}
      data-spotlight={spotlight ? "active" : "idle"}
    >
      <div className="city-map-canvas">
        <MapContainer
          center={center}
          zoom={6}
          style={{ height: "100%", width: "100%", zIndex: 1 }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemap.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {markers.map((group, idx) => (
            <Marker
              key={`${group.cityName}-${idx}`}
              position={group.position}
              icon={getMarker3DIcon(
                group.cityName,
                group.jobs.length,
                normalizeCityKey(group.cityName) === selectedCityKey,
                group.tier,
              )}
              eventHandlers={
                onSelectCity
                  ? {
                      click: () => onSelectCity(group.cityName),
                    }
                  : undefined
              }
            >
              <Popup className="city-popup-3d">
                <div style={{ padding: "4px", width: "240px", maxHeight: "300px", overflowY: "auto" }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "700", borderBottom: "1px solid var(--line)", paddingBottom: "6px" }}>
                    {group.cityName} ({group.jobs.length} {group.jobs.length === 1 ? "Stelle" : "Stellen"})
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {group.jobs.map((job, jIdx) => (
                      <div
                        key={`${job.reference}-${jIdx}`}
                        style={{
                          paddingBottom: jIdx < group.jobs.length - 1 ? "8px" : "0",
                          borderBottom: jIdx < group.jobs.length - 1 ? "1px dashed var(--line)" : "none",
                        }}
                      >
                        <h5 style={{ margin: "0 0 2px 0", fontSize: "12px", fontWeight: "600", color: "var(--ink)" }}>{job.title}</h5>
                        <p style={{ margin: "0 0 6px 0", fontSize: "11px", color: "var(--steel)" }}>{job.employer}</p>
                        <a
                          href={job.url || `/jobs/${encodeURIComponent(job.reference)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            background: "var(--accent)",
                            color: "white",
                            textDecoration: "none",
                            borderRadius: "6px",
                            fontWeight: "500",
                            fontSize: "11px",
                            textAlign: "center",
                          }}
                        >
                          Ansehen
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          {positions.length > 0 && <MapBounds positions={positions} />}
        </MapContainer>
      </div>
    </div>
  );
}
