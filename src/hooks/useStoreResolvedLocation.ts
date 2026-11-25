import { useMemo } from 'react';
import { StoreConfig } from '../types';
import { isValidCoordinatePair, LatLngPoint } from '../utils/mapsConfig';
import { PINRANG_CITY_CENTER } from '../data/pinrangLocations';

export interface ResolvedStorePlace {
  coords: LatLngPoint;
  placeId?: string;
  displayName?: string;
  formattedAddress?: string;
}

export function useStoreResolvedLocation(
  storeConfig: StoreConfig
): {
  resolvedStore: ResolvedStorePlace;
  isResolving: boolean;
} {
  const resolvedStore = useMemo<ResolvedStorePlace>(() => {
    if (isValidCoordinatePair(storeConfig.storeLat, storeConfig.storeLng)) {
      return {
        coords: {
          lat: storeConfig.storeLat as number,
          lng: storeConfig.storeLng as number,
        },
        placeId: storeConfig.storePlaceId,
        displayName: storeConfig.storePlaceName || storeConfig.brandName,
        formattedAddress: storeConfig.locationAddress,
      };
    }

    return {
      coords: {
        lat: PINRANG_CITY_CENTER.lat,
        lng: PINRANG_CITY_CENTER.lng,
      },
      displayName: storeConfig.storePlaceName || storeConfig.brandName,
      formattedAddress: storeConfig.locationAddress,
    };
  }, [
    storeConfig.storeLat,
    storeConfig.storeLng,
    storeConfig.storePlaceId,
    storeConfig.storePlaceName,
    storeConfig.brandName,
    storeConfig.locationAddress,
  ]);

  return { resolvedStore, isResolving: false };
}
