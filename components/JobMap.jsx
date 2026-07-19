"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { normalizeCityKey } from "../lib/german-city-map";
import { useGeocodedMarkers } from "./hooks/useGeocodedMarkers";

// 2D fallback map used by the legacy pre-3D code path. The 3D glassmorphism
// experience (`JobMap3D.jsx`) shares the geocode + tier pipeline via the
// `useGeocodedMarkers` hook — this file only owns the simpler marker.

function MapBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      if (positions.length === 1) {
        map.setView(positions[0], 12);
      } else {
        // Lazy-load L only on the client and only when needed so the SSR
        // bundle stays slim. L is already pulled in by react-leaflet at
        // runtime via the parent module; calling it here for bounds is
        // safe post-hydration.
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }
  }, [map, positions]);
  return null;
}

export default function JobMap({ jobs = [], selectedCity = "", onSelectCity }) {
  const { markers, mounted } = useGeocodedMarkers(jobs);

  if (!mounted) {
    return (
      <div
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

  // 2D marker rendering keeps the simple Leaflet pin. Tier information is
  // available on `markers[i].tier` but we deliberately ignore it here so
  // the fallback path stays visually quiet.
  const getCustomIcon = (cityName, count, isActive) => {
    const initials = cityName.slice(0, 2).toUpperCase();
    // Leaflet loaded at runtime via parent module; require() here would
    // break SSR, so use the runtime L exposed by react-leaflet.
    return L.divIcon({
      className: "custom-map-marker",
      html: `
        <div class="marker-wrapper${isActive ? " is-active" : ""}">
          <div class="marker-circle">${initials}</div>
          ${count > 1 ? `<div class="marker-badge">${count}</div>` : ""}
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -18],
    });
  };

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid var(--line)",
      }}
    >
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
            icon={getCustomIcon(group.cityName, group.jobs.length, normalizeCityKey(group.cityName) === selectedCityKey)}
            eventHandlers={
              onSelectCity
                ? {
                    click: () => onSelectCity(group.cityName),
                  }
                : undefined
            }
          >
            <Popup className="job-popup">
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
  );
}
