// Shared hook that turns a flat jobs[] array into marker data per German city.
// Surfaces the tier classification (peak / mid / low) used by both the 2D
// fallback map (JobMap.jsx) and the 3D glassmorphism map (JobMap3D.jsx).
//
// Geocoding strategy:
//   1. Use GERMAN_CITY_COORDS lookup first (no network, instant).
//   2. Fall back to in-memory geocodeCache for cities we have already
//      resolved in this session.
//   3. Otherwise hit Nominatim (OpenStreetMap) with a 250ms throttle so we
//      don't trip the rate-limit during bulk import.
//
// The hook also exposes a `mounted` flag so consumer components can keep
// their SSR / placeholder behavior in sync with the geocode pipeline.

import { useEffect, useState } from "react";
import {
  GERMAN_CITY_COORDS,
  extractPrimaryCity,
  normalizeCityKey,
} from "../../lib/german-city-map";
import { logWarn, clientPrefix } from "../logger";

const TIER_PEAK_MIN = 8;
const TIER_MID_MIN = 3;

// Single source-of-truth for the tier thresholds. Mirrors the German-market
// signal logic in useSearch.ts (getCityMarketSignal). If you change these,
// update the matching text strings / CSS --depth variables in lock-step.
export type MarkerTier = "peak" | "mid" | "low";

export type GeocodedMarker = {
  cityName: string;
  position: [number, number];
  jobs: any[];
  tier: MarkerTier;
};

// Module-level cache survives across re-renders of the same component and
// is shared between JobMap.jsx and JobMap3D.jsx callsites.
const geocodeCache = new Map<string, [number, number] | null>();

function classifyTier(count: number): MarkerTier {
  if (count >= TIER_PEAK_MIN) return "peak";
  if (count >= TIER_MID_MIN) return "mid";
  return "low";
}

export function useGeocodedMarkers(jobs: any[] = []) {
  const [markers, setMarkers] = useState<GeocodedMarker[]>([]);
  const [mounted, setMounted] = useState(false);

  // Flip the client-side mount flag once so the consumer can swap out the
  // SSR placeholder for the Leaflet canvas. Identical to the inline
  // pattern that lived in JobMap.jsx / JobMap3D.jsx — kept here so both
  // components share one implementation.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const geocodeJobs = async () => {
      // Group jobs by their primary city so the marker count reflects the
      // true cluster size (used for tier classification downstream).
      const jobsByCity: Record<string, { cityName: string; jobs: any[] }> = {};
      for (const job of jobs) {
        if (!job?.location) continue;
        const cityName = extractPrimaryCity(job.location);
        const cityKey = normalizeCityKey(cityName);
        if (!cityKey) continue;
        if (!jobsByCity[cityKey]) {
          jobsByCity[cityKey] = { cityName, jobs: [] };
        }
        jobsByCity[cityKey].jobs.push(job);
      }

      const newMarkers: GeocodedMarker[] = [];

      for (const key of Object.keys(jobsByCity)) {
        const { cityName, jobs: cityJobs } = jobsByCity[key];
        let coords: [number, number] | null = null;

        // GERMAN_CITY_COORDS is exported from a .js module, so TS infers
        // it as a sealed object literal without an index signature.
        // Cast to Record<string, [number, number]> once per lookup so the
        // strict-mode tsc --noEmit check stays green without touching the
        // source library file.
        const knownCoords = GERMAN_CITY_COORDS as unknown as Record<string, [number, number]>;

        if (knownCoords[key]) {
          coords = knownCoords[key];
        } else if (geocodeCache.has(key)) {
          coords = geocodeCache.get(key) ?? null;
        } else {
          try {
            await new Promise((r) => window.setTimeout(r, 250)); // honor Nominatim rate limit
            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName + ", Germany")}`,
            );
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
              }
            }
            geocodeCache.set(key, coords);
          } catch (e: any) {
            // Non-fatal: a geocoding failure just means no marker for that
            // city. We log via the unified logfmt pipeline so a Vercel-side
            // drain surfaces the failure alongside the server-side run.
            logWarn(clientPrefix("useGeocodedMarkers"), "Geocoding failed", {
              city: cityName,
              error_message: e?.message,
            });
            geocodeCache.set(key, null);
          }
        }

        if (coords) {
          newMarkers.push({
            cityName,
            position: coords,
            jobs: cityJobs,
            tier: classifyTier(cityJobs.length),
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

  return { markers, mounted };
}
