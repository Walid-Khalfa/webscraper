"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";

// Since react-leaflet relies on window, we must dynamically import the map components
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import { MapPin } from "lucide-react";
import L from "leaflet";

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

const MapBounds = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      return function MapBoundsComponent({ positions }) {
        const map = mod.useMap();
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
      };
    }),
  { ssr: false }
);

export default function JobMap({ jobs = [] }) {
  const [markers, setMarkers] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const geocodeJobs = async () => {
      const newMarkers = [];
      
      for (const job of jobs) {
        if (!job.Ort) continue;
        
        const rawOrt = job.Ort.split(',')[0].split('(')[0].trim().toLowerCase();
        let coords = null;
        
        if (STATIC_COORDS[rawOrt]) {
          coords = STATIC_COORDS[rawOrt];
        } else if (geocodeCache.has(rawOrt)) {
          coords = geocodeCache.get(rawOrt);
        } else {
          try {
            await new Promise(r => setTimeout(r, 250)); // rate limit nominatim
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawOrt + ', Germany')}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.length > 0) {
                coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                geocodeCache.set(rawOrt, coords);
              } else {
                geocodeCache.set(rawOrt, null);
              }
            }
          } catch (e) {
            console.warn("Geocoding failed for", rawOrt);
            geocodeCache.set(rawOrt, null);
          }
        }

        if (coords) {
          // Add a tiny random offset so markers at the exact same city don't overlap completely
          const offsetLat = coords[0] + (Math.random() - 0.5) * 0.02;
          const offsetLng = coords[1] + (Math.random() - 0.5) * 0.02;
          
          newMarkers.push({
            ...job,
            position: [offsetLat, offsetLng]
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
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {markers.map((job, idx) => (
          <Marker key={`${job.Referenz}-${idx}`} position={job.position}>
            <Popup className="job-popup">
              <div style={{ padding: "4px" }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600" }}>{job.Titel}</h4>
                <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "var(--muted)" }}>{job.Arbeitgeber}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", marginBottom: "8px" }}>
                  <MapPin size={12} /> {job.Ort}
                </div>
                <a 
                  href={job.URL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: "6px 12px",
                    background: "var(--accent-base)",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "6px",
                    textAlign: "center",
                    fontWeight: "500",
                    fontSize: "12px"
                  }}
                >
                  Zur Stelle
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
        {positions.length > 0 && <MapBounds positions={positions} />}
      </MapContainer>
    </div>
  );
}
