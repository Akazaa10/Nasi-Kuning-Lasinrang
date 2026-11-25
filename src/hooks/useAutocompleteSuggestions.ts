import { useCallback, useEffect, useState } from 'react';
import {
  PinrangSearchSuggestion,
  searchPinrangLocations,
} from '../data/pinrangLocations';

export interface PlaceSearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  streetName: string;
  kelurahan: string;
  kecamatan: string;
  lat: number;
  lng: number;
  landmarkHint: string;
  commonAlleys?: string[];
}

export interface UseAutocompleteSuggestionsReturn {
  suggestions: PlaceSearchResultItem[];
  isLoading: boolean;
  searchError: string | null;
  resetSession: () => void;
}

export function useAutocompleteSuggestions(
  inputString: string
): UseAutocompleteSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<PlaceSearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = inputString.trim();
    const localHits: PinrangSearchSuggestion[] = searchPinrangLocations(trimmed);
    setSuggestions(localHits);
    setSearchError(null);

    if (trimmed.length < 2) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await fetch(
          `/api/search-place?q=${encodeURIComponent(trimmed)}`
        );
        if (!res.ok) {
          if (!cancelled) setIsLoading(false);
          return;
        }
        const data = (await res.json()) as {
          results?: PlaceSearchResultItem[];
        };
        if (!cancelled) {
          if (Array.isArray(data.results) && data.results.length > 0) {
            setSuggestions(data.results);
          }
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inputString]);

  const resetSession = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading,
    searchError,
    resetSession,
  };
}
