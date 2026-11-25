import { useCallback, useRef } from 'react';

export interface NearbyLandmarkItem {
  name: string;
  relation?: string;
  distanceMeters?: number;
}

export interface ReverseGeocodeResult {
  streetName: string;
  streetNumber: string;
  neighborhood: string;
  kelurahan: string;
  kecamatan: string;
  city: string;
  postalCode: string;
  plusCode: string;
  detectedAlley?: string;
  fullFormattedAddress: string;
  nearbyLandmarks: NearbyLandmarkItem[];
  source: 'osm-free';
}

export function useReverseGeocode() {
  const cacheRef = useRef<Map<string, ReverseGeocodeResult>>(new Map());

  const resolveCoordsToAddress = useCallback(
    async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) return cached;

      try {
        const res = await fetch(
          `/api/reverse-geocode?lat=${encodeURIComponent(
            lat.toFixed(6)
          )}&lng=${encodeURIComponent(lng.toFixed(6))}`
        );

        if (res.ok) {
          const data = (await res.json()) as {
            result?: ReverseGeocodeResult;
          };
          if (
            data.result &&
            (data.result.fullFormattedAddress || data.result.streetName)
          ) {
            cacheRef.current.set(cacheKey, data.result);
            return data.result;
          }
        }
      } catch {
        // return null gracefully
      }

      return null;
    },
    []
  );

  return { resolveCoordsToAddress };
}
