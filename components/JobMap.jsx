"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Top German cities coordinates to avoid hitting Geocoding API too much
const STATIC_COORDS = {
  "berlin": [52.5200, 13.4050],
  "hamburg": [53.5511, 9.9937],
  "münchen": [48.1351, 11.5820],
  "köln": [50.9375, 6.9603],
  "frankfurt am main": [50.1109, 8.6821],
  "stuttgart": [48.7758, 9.1829],
  "düsseldorf": [51.2277, 6.7735],
  "leipzig": [51.3397, 12.3731],
  "dortmund": [51.5136, 7.4653],
  "essen": [51.4556, 7.0116],
  "bremen": [53.0793, 8.8017],
  "dresden": [51.0504, 13.7373],
  "hannover": [52.3759, 9.7320],
  "nürnberg": [49.4521, 11.0767],
  "duisburg": [51.4325, 6.7652],
  "bochum": [51.4818, 7.2162],
  "wuppertal": [51.2562, 7.1508],
  "bielefeld": [52.0302, 8.5325],
  "bonn": [50.7374, 7.0982],
  "münster": [51.9607, 7.6261],
  "karlsruhe": [49.0069, 8.4037],
  "mannheim": [49.4875, 8.4660],
  "augsburg": [48.3715, 10.8985],
  "wiesbaden": [50.0782, 8.2398],
  "gelsenkirchen": [51.5112, 7.1028],
  "mönchengladbach": [51.1927, 6.4327],
  "braunschweig": [52.2689, 10.5268],
  "kiel": [54.3233, 10.1228],
  "chemnitz": [50.8333, 12.9167],
  "aachen": [50.7753, 6.0839],
  "halle": [51.4828, 11.9697],
  "magdeburg": [52.1205, 11.6276],
  "freiburg": [47.9990, 7.8421],
  "krefeld": [51.3333, 6.5667],
  "lübeck": [53.8655, 10.6866],
  "mainz": [49.9929, 8.2473],
  "erfurt": [50.9787, 11.0328],
  "oberhausen": [51.4700, 6.8646],
  "rostock": [54.0924, 12.0991],
  "kassel": [51.3127, 9.4797],
  "hagen": [51.3671, 7.4633],
  "saarbrücken": [49.2401, 6.9969],
  "hamm": [51.6811, 7.8180],
  "potsdam": [52.3906, 13.0645],
  "ludwigshafen": [49.4815, 8.4419],
  "mülheim": [51.4275, 6.8825],
  "oldenburg": [53.1435, 8.2146],
  "osnabrück": [52.2799, 8.0472],
  "leverkusen": [51.0303, 6.9843],
  "heidelberg": [49.3988, 8.6724],
  "darmstadt": [49.8728, 8.6512],
};

const geocodeCache = new Map();

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

export default function JobMap({ jobs = [] }) {
  const [markers, setMarkers] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const geocodeJobs = async () => {
      // Group jobs by raw city name
      const jobsByCity = {};
      for (const job of jobs) {
        if (!job.location) continue;
        const rawOrt = job.location.split(',')[0].split('(')[0].trim();
        const rawOrtKey = rawOrt.toLowerCase();
        if (!jobsByCity[rawOrtKey]) {
          jobsByCity[rawOrtKey] = {
            cityName: rawOrt,
            jobs: [],
          };
        }
        jobsByCity[rawOrtKey].jobs.push(job);
      }

      const newMarkers = [];
      
      for (const key in jobsByCity) {
        const { cityName, jobs: cityJobs } = jobsByCity[key];
        let coords = null;
        
        if (STATIC_COORDS[key]) {
          coords = STATIC_COORDS[key];
        } else if (geocodeCache.has(key)) {
          coords = geocodeCache.get(key);
        } else {
          try {
            await new Promise(r => setTimeout(r, 250)); // rate limit nominatim
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName + ', Germany')}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.length > 0) {
                coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                geocodeCache.set(key, coords);
              } else {
                geocodeCache.set(key, null);
              }
            }
          } catch (e) {
            console.warn("Geocoding failed for", cityName);
            geocodeCache.set(key, null);
          }
        }

        if (coords) {
          newMarkers.push({
            cityName,
            position: coords,
            jobs: cityJobs
          });
        }
      }

      if (isMounted) {
        setMarkers(newMarkers);
      }
    };

    if (jobs.length > 0) {
      geocodeJobs();
    } else {
      setMarkers([]);
    }

    return () => {
      isMounted = false;
    };
  }, [jobs]);

  if (!mounted) return <div style={{ height: "100%", width: "100%", background: "#f0f0f0", borderRadius: "12px", border: "1px solid var(--line)" }} />;

  const center = markers.length > 0 ? markers[0].position : [51.1657, 10.4515]; // Center of Germany
  const positions = markers.map(m => m.position);

  // Helper to create custom HTML markers similar to tunes.dtb360talent.com
  const getCustomIcon = (cityName, count) => {
    const initials = cityName.slice(0, 2).toUpperCase();
    return L.divIcon({
      className: "custom-map-marker",
      html: `
        <div class="marker-wrapper">
          <div class="marker-circle">${initials}</div>
          ${count > 1 ? `<div class="marker-badge">${count}</div>` : ''}
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -18]
    });
  };

  return (
    <div style={{ height: "100%", width: "100%", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--line)" }}>
      <MapContainer 
        center={center} 
        zoom={6} 
        style={{ height: "100%", width: "100%", zIndex: 1 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {markers.map((group, idx) => (
          <Marker 
            key={`${group.cityName}-${idx}`} 
            position={group.position}
            icon={getCustomIcon(group.cityName, group.jobs.length)}
          >
            <Popup className="job-popup">
              <div style={{ padding: "4px", width: "240px", maxHeight: "300px", overflowY: "auto" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "700", borderBottom: "1px solid var(--line)", paddingBottom: "6px" }}>
                  {group.cityName} ({group.jobs.length} {group.jobs.length === 1 ? 'Stelle' : 'Stellen'})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {group.jobs.map((job, jIdx) => (
                    <div 
                      key={`${job.reference}-${jIdx}`}
                      style={{ 
                        paddingBottom: jIdx < group.jobs.length - 1 ? "8px" : "0", 
                        borderBottom: jIdx < group.jobs.length - 1 ? "1px dashed var(--line)" : "none" 
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
                          textAlign: "center"
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
