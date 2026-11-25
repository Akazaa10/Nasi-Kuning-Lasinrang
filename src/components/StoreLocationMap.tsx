import React, { useState, useRef } from 'react';
import { ExternalLink, LocateFixed, MapPin, Search, Navigation } from 'lucide-react';
import { StoreConfig } from '../types';
import { LatLngPoint } from '../utils/mapsConfig';
import {
  PlaceSearchResultItem,
  useAutocompleteSuggestions,
} from '../hooks/useAutocompleteSuggestions';
import { LeafletMapCanvas } from './LeafletMapCanvas';

const OFFICIAL_MAPS_SHORT_URL = 'https://maps.app.goo.gl/Xw2BgQyDot5McXvv9';
const OFFICIAL_PLUS_CODE =
  '5MR2+PRV, Macorawalie, Kec. Watang Sawitto, Kabupaten Pinrang, Sulawesi Selatan 91212';
const OFFICIAL_STALL_ADDRESS =
  'Jl. Jendral Sudirman (Depan Patung Lasinrang), Macorawalie, Kec. Watang Sawitto, Kota Pinrang 91212';

interface StoreLocationMapProps {
  storeConfig: StoreConfig;
  editable?: boolean;
  heightClassName?: string;
  onSelectStoreCoords?: (coords: {
    lat: number;
    lng: number;
    placeId?: string;
    placeName?: string;
  }) => void;
}

export const StoreLocationMap: React.FC<StoreLocationMapProps> = ({
  storeConfig,
  editable = false,
  heightClassName = 'h-[280px] sm:h-[340px]',
  onSelectStoreCoords,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gpsFeedback, setGpsFeedback] = useState<string | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  // If editable in Owner Panel, show coordinate picker tools
  const { suggestions, isLoading: isSearching, resetSession } =
    useAutocompleteSuggestions(editable ? searchQuery : '');

  const handleSelectSuggestion = (item: PlaceSearchResultItem) => {
    if (!onSelectStoreCoords) return;
    onSelectStoreCoords({
      lat: item.lat,
      lng: item.lng,
      placeName: `${item.title} (${item.subtitle})`,
    });
    setSearchQuery('');
    setShowSuggestions(false);
    resetSession();
    setGpsFeedback(
      `Titik kedai diarahkan ke ${item.title} (${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}).`
    );
  };

  const handlePinMoved = (coords: LatLngPoint) => {
    if (!editable || !onSelectStoreCoords) return;
    onSelectStoreCoords({ lat: coords.lat, lng: coords.lng });
    setGpsFeedback(
      `Titik pin kedai diperbarui (${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}) dan disimpan permanen.`
    );
  };

  const storeWatchIdRef = useRef<number | null>(null);
  const storeTimerRef = useRef<number | null>(null);

  const stopStoreGpsWatch = () => {
    if (storeWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(storeWatchIdRef.current);
      storeWatchIdRef.current = null;
    }
    if (storeTimerRef.current !== null) {
      window.clearTimeout(storeTimerRef.current);
      storeTimerRef.current = null;
    }
  };

  React.useEffect(() => () => stopStoreGpsWatch(), []);

  const handleUseCurrentGpsForStore = () => {
    setGpsFeedback(null);
    if (!editable || !onSelectStoreCoords || !navigator.geolocation) {
      setGpsFeedback('GPS browser tidak tersedia. Ketuk peta langsung untuk memilih titik kedai.');
      return;
    }

    stopStoreGpsWatch();
    setGpsFeedback('Mengunci sinyal satelit GPS presisi untuk posisi kedai...');

    let bestPos: GeolocationPosition | null = null;
    let settled = false;

    const finalize = (pos: GeolocationPosition | null, errMsg?: string) => {
      if (settled) return;
      settled = true;
      stopStoreGpsWatch();
      if (!pos) {
        setGpsFeedback(
          errMsg || 'Sinyal GPS belum terkunci. Ketuk peta langsung atau geser pin merah ke posisi kedai.'
        );
        return;
      }
      const acc = Math.round(pos.coords.accuracy);
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      onSelectStoreCoords(next);
      setGpsFeedback(
        acc <= 30
          ? `Titik GPS kedai presisi terkunci (~${acc}m): ${next.lat.toFixed(6)}, ${next.lng.toFixed(6)}.`
          : `Titik GPS kedai diperbarui (akurasi ~${acc}m): ${next.lat.toFixed(6)}, ${next.lng.toFixed(6)} — geser pin merah jika masih melenceng.`
      );
    };

    storeTimerRef.current = window.setTimeout(() => {
      finalize(
        bestPos,
        'Sinyal satelit GPS terlalu lemah di dalam ruangan. Silakan ketuk/geser pin merah tepat di peta kedai.'
      );
    }, 10500);

    storeWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
          bestPos = pos;
        }
        if (pos.coords.accuracy <= 20) {
          finalize(pos);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          finalize(
            null,
            'Izin GPS diblokir/belum aktif. Buka di tab penuh atau ketuk/geser pin merah langsung di peta bawah.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10500, maximumAge: 0 }
    );
  };

  const DEFAULT_STORE_LAT = -3.79638;
  const DEFAULT_STORE_LNG = 119.65255;
  const hasCustomOwnerCoords =
    typeof storeConfig.storeLat === 'number' &&
    typeof storeConfig.storeLng === 'number' &&
    Number.isFinite(storeConfig.storeLat) &&
    Number.isFinite(storeConfig.storeLng) &&
    (Math.abs(storeConfig.storeLat - DEFAULT_STORE_LAT) > 0.0005 ||
      Math.abs(storeConfig.storeLng - DEFAULT_STORE_LNG) > 0.0005);

  const embedUrl = hasCustomOwnerCoords
    ? `https://maps.google.com/maps?q=${storeConfig.storeLat},${storeConfig.storeLng}&t=&z=17&ie=UTF8&iwloc=&output=embed`
    : 'https://maps.google.com/maps?q=5MR2%2BPRV+Pinrang&t=&z=17&ie=UTF8&iwloc=&output=embed';
  const directMapsUrl = hasCustomOwnerCoords
    ? `https://www.google.com/maps/search/?api=1&query=${storeConfig.storeLat},${storeConfig.storeLng}`
    : OFFICIAL_MAPS_SHORT_URL;
  const displayAddress = storeConfig.locationAddress?.trim() || OFFICIAL_STALL_ADDRESS;
  const displayLandmark =
    storeConfig.pickupCoordinatesText?.trim() ||
    'Tepat di Depan Patung Lasinrang & Toko Kosmetik HANAMI Pink';

  // Visitor View: 100% Free Google Maps Embed iframe (No API Key Required)
  if (!editable) {
    return (
      <div className="space-y-3.5">
        {/* Buyer Friendly Address & Plus Code Banner */}
        <div className="p-4 rounded-2xl bg-white border border-[#30251F]/10 shadow-xs text-[#30251F] space-y-1.5">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-[#A83A2D] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-[#193D2B] leading-snug">
                {displayAddress}
              </div>
              <div className="text-[11.5px] text-[#6E5D53] flex items-center gap-1.5 flex-wrap mt-1">
                <span className="font-medium">Patokan: {displayLandmark}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular font-bold text-[#193D2B]">
                  Plus Code: {OFFICIAL_PLUS_CODE.split(',')[0]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 100% Free Responsive Google Maps Embed iframe */}
        <div className="relative w-full overflow-hidden rounded-2xl border border-[#30251F]/12 shadow-sm bg-[#EFE9DC]">
          <iframe
            title={`Peta Lokasi Resmi ${storeConfig.brandName}`}
            src={embedUrl}
            className="w-full h-72 md:h-96 rounded-2xl border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <span className="text-xs text-[#6E5D53] text-center sm:text-left">
            {displayLandmark}
          </span>
          <a
            href={directMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto min-h-[44px] px-5 py-3 rounded-xl bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] fx-2d-forest text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Navigation className="w-4 h-4 shrink-0 text-[#E8C56E]" />
            <span>Buka di Google Maps / Petunjuk Arah</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>
      </div>
    );
  }

  // Owner Panel Editable Mode
  const activeLat = storeConfig.storeLat || -3.79638;
  const activeLng = storeConfig.storeLng || 119.65255;

  return (
    <div className="space-y-2.5">
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div ref={searchBoxRef} className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#6E5D53] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && showSuggestions) {
                  e.stopPropagation();
                  setShowSuggestions(false);
                }
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="Cari jalan / area Patung Lasinrang di Pinrang..."
              className="w-full bg-white border border-[#30251F]/16 rounded-xl pl-8 pr-3 py-2 text-xs text-[#30251F] focus:outline-none focus:border-[#193D2B]"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-[500] bg-white border border-[#30251F]/15 rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-[#30251F]/8">
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full text-left px-3 py-2 text-xs text-[#30251F] hover:bg-[#F7F3E9] cursor-pointer"
                    >
                      <div className="font-bold text-[#193D2B]">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[10.5px] text-[#6E5D53]">{item.subtitle}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#6E5D53]">
                Mencari...
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleUseCurrentGpsForStore}
            className="px-3.5 py-2 rounded-xl bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors"
          >
            <LocateFixed className="w-3.5 h-3.5 text-[#E8C56E]" />
            <span>Pakai GPS Saat Ini</span>
          </button>
        </div>
        <p className="text-[11px] text-[#6E5D53]">
          Geser atau ketuk titik pin untuk menyesuaikan posisi kedai Nasi Kuning Lasinrang.
        </p>
        {gpsFeedback && (
          <p className="text-[11px] text-[#193D2B] bg-[#E9F0EC] border border-[#193D2B]/18 rounded-lg px-2.5 py-1.5 font-medium">
            {gpsFeedback}
          </p>
        )}
      </div>

      <div className="relative">
        <LeafletMapCanvas
          center={{ lat: activeLat, lng: activeLng }}
          zoom={18}
          heightClassName={heightClassName}
          storeMarker={{
            lat: activeLat,
            lng: activeLng,
            title: storeConfig.brandName,
            subtitle: storeConfig.pickupCoordinatesText,
          }}
          interactiveMode="store"
          onSelectCoords={handlePinMoved}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E5D53] px-1">
        <span className="font-mono-tabular">
          Koordinat Kedai:{' '}
          <strong className="text-[#193D2B]">
            {activeLat.toFixed(6)}, {activeLng.toFixed(6)}
          </strong>
        </span>
        <a
          href={directMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[#193D2B] hover:underline"
        >
          <span>Lihat di Google Maps Resmi</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
