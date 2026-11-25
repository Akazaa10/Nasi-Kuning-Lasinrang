import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Cloud,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { SavedCustomerLocation, StoreConfig } from '../types';
import { isValidCoordinatePair, LatLngPoint } from '../utils/mapsConfig';
import {
  buildValidGoogleMapsCoordUrl,
  computeDistanceKm,
  formatDistanceId,
  formatIndonesianPhoneDisplay,
  isValidIndonesianMobilePhone,
} from '../utils/checkoutOrder';
import { useStoreResolvedLocation } from '../hooks/useStoreResolvedLocation';
import {
  PlaceSearchResultItem,
  useAutocompleteSuggestions,
} from '../hooks/useAutocompleteSuggestions';
import { ReverseGeocodeResult, useReverseGeocode } from '../hooks/useReverseGeocode';
import {
  PINRANG_CITY_CENTER,
  PINRANG_STREET_CORRIDORS,
} from '../data/pinrangLocations';
import { LeafletMapCanvas } from './LeafletMapCanvas';

interface CustomerLocationMapPickerProps {
  storeConfig: StoreConfig;
  customerLat?: number;
  customerLng?: number;
  customerPhone?: string;
  deliveryAddress: string;
  alleyDetail?: string;
  landmark: string;
  savedLocations: SavedCustomerLocation[];
  currentUser: FirebaseUser | null;
  onSignInGoogle: () => Promise<void>;
  onSelectCoordinates: (coords: {
    lat: number;
    lng: number;
    googleMapsLink: string;
    suggestedAddress?: string;
    suggestedAlleyDetail?: string;
    suggestedLandmark?: string;
    noticeText?: string;
  }) => void;
  onApplySavedLocation: (loc: SavedCustomerLocation) => void;
  onSaveCurrentLocation: (label: string) => Promise<boolean>;
  onDeleteSavedLocation: (locId: string) => Promise<void>;
  onSuggestLandmark?: (landmarkText: string) => void;
  onFocusPhone?: () => void;
}

export const CustomerLocationMapPicker: React.FC<CustomerLocationMapPickerProps> = ({
  storeConfig,
  customerLat,
  customerLng,
  customerPhone = '',
  deliveryAddress,
  alleyDetail = '',
  landmark,
  savedLocations,
  currentUser,
  onSignInGoogle,
  onSelectCoordinates,
  onApplySavedLocation,
  onSaveCurrentLocation,
  onDeleteSavedLocation,
  onSuggestLandmark,
  onFocusPhone,
}) => {
  const { resolvedStore } = useStoreResolvedLocation(storeConfig);
  const { resolveCoordsToAddress } = useReverseGeocode();

  const [cameraCenter, setCameraCenter] = useState<LatLngPoint | null>(null);
  const [zoom, setZoom] = useState<number>(15);
  const [searchInput, setSearchInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [resolvedPinAddress, setResolvedPinAddress] =
    useState<ReverseGeocodeResult | null>(null);

  const [gpsStatusMsg, setGpsStatusMsg] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
    isIframeBlocked?: boolean;
  } | null>(null);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [coarseGpsCandidate, setCoarseGpsCandidate] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);

  const [saveLabel, setSaveLabel] = useState('Rumah');
  const [isSavingLoc, setIsSavingLoc] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const lastAutoFilledAddressRef = useRef<string>('');
  const deliveryAddressRef = useRef<string>(deliveryAddress);
  deliveryAddressRef.current = deliveryAddress;
  const alleyDetailRef = useRef<string>(alleyDetail);
  alleyDetailRef.current = alleyDetail;
  const geocodeReqSeqRef = useRef<number>(0);
  const lastGeocodedCoordsKeyRef = useRef<string>('');
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const gpsWatchIdRef = useRef<number | null>(null);
  const gpsMaxTimerRef = useRef<number | null>(null);
  const gpsRefineTimerRef = useRef<number | null>(null);

  const hasCustomerPin = isValidCoordinatePair(customerLat, customerLng);
  const customerPos: LatLngPoint | null = useMemo(
    () =>
      hasCustomerPin
        ? { lat: customerLat as number, lng: customerLng as number }
        : null,
    [hasCustomerPin, customerLat, customerLng]
  );

  const storePos: LatLngPoint = resolvedStore?.coords || PINRANG_CITY_CENTER;

  useEffect(() => {
    if (customerPos && !cameraCenter) {
      setCameraCenter(customerPos);
      setZoom(17);
    } else if (!cameraCenter && storePos) {
      setCameraCenter(storePos);
      setZoom(15);
    }
  }, [customerPos, storePos, cameraCenter]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showDropdown]);

  const { suggestions, isLoading: isSearching, resetSession } =
    useAutocompleteSuggestions(searchInput);

  const stopActiveGpsWatch = () => {
    if (
      gpsWatchIdRef.current !== null &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    if (gpsMaxTimerRef.current !== null) {
      window.clearTimeout(gpsMaxTimerRef.current);
      gpsMaxTimerRef.current = null;
    }
    if (gpsRefineTimerRef.current !== null) {
      window.clearTimeout(gpsRefineTimerRef.current);
      gpsRefineTimerRef.current = null;
    }
  };

  useEffect(() => () => stopActiveGpsWatch(), []);

  const runReverseGeocodeForPin = async (
    lat: number,
    lng: number,
    forceApplyAddress = false
  ) => {
    lastGeocodedCoordsKeyRef.current = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const seq = ++geocodeReqSeqRef.current;
    setIsResolvingAddress(true);

    const geo = await resolveCoordsToAddress(lat, lng);
    if (seq !== geocodeReqSeqRef.current) return;
    setIsResolvingAddress(false);

    const link = buildValidGoogleMapsCoordUrl(lat, lng);
    if (!link) return;

    const currentTrimmed = deliveryAddressRef.current.trim();
    const canAutoReplace =
      forceApplyAddress ||
      !currentTrimmed ||
      currentTrimmed === lastAutoFilledAddressRef.current;

    if (!geo) {
      if (canAutoReplace) {
        const coordFallback = `Titik GPS Pinrang (${lat.toFixed(5)}, ${lng.toFixed(5)}) — lengkapi nama jalan / lorong di bawah`;
        lastAutoFilledAddressRef.current = coordFallback;
        onSelectCoordinates({
          lat,
          lng,
          googleMapsLink: link,
          suggestedAddress: coordFallback,
        });
      }
      return;
    }

    setResolvedPinAddress(geo);

    const shouldAutoFillAlley =
      Boolean(geo.detectedAlley) && !alleyDetailRef.current.trim();

    if ((geo.fullFormattedAddress && canAutoReplace) || shouldAutoFillAlley) {
      if (geo.fullFormattedAddress && canAutoReplace) {
        lastAutoFilledAddressRef.current = geo.fullFormattedAddress;
      }
      onSelectCoordinates({
        lat,
        lng,
        googleMapsLink: link,
        ...(geo.fullFormattedAddress && canAutoReplace
          ? { suggestedAddress: geo.fullFormattedAddress }
          : {}),
        ...(shouldAutoFillAlley ? { suggestedAlleyDetail: geo.detectedAlley } : {}),
      });
    }
  };

  useEffect(() => {
    if (!customerPos) return;
    const coordKey = `${customerPos.lat.toFixed(6)},${customerPos.lng.toFixed(6)}`;
    if (lastGeocodedCoordsKeyRef.current !== coordKey) {
      setCameraCenter(customerPos);
      setZoom((prev) => (prev >= 18 ? prev : 18));
      void runReverseGeocodeForPin(customerPos.lat, customerPos.lng, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPos?.lat, customerPos?.lng]);

  const commitPinPosition = (
    lat: number,
    lng: number,
    options?: {
      suggestedAddress?: string;
      suggestedLandmark?: string;
      noticeText?: string;
      zoomTo?: number;
      forceAutoAddress?: boolean;
    }
  ) => {
    const link = buildValidGoogleMapsCoordUrl(lat, lng);
    if (!link) return;
    setCameraCenter({ lat, lng });
    if (options?.zoomTo) {
      setZoom(options.zoomTo);
    }
    if (options?.suggestedAddress) {
      lastAutoFilledAddressRef.current = options.suggestedAddress;
    }
    onSelectCoordinates({
      lat,
      lng,
      googleMapsLink: link,
      suggestedAddress: options?.suggestedAddress,
      suggestedLandmark: options?.suggestedLandmark,
      noticeText: options?.noticeText,
    });

    void runReverseGeocodeForPin(lat, lng, Boolean(options?.forceAutoAddress));
  };

  const handleInteractivePinPlaced = (coords: LatLngPoint) => {
    stopActiveGpsWatch();
    setIsLocatingGps(false);
    setGpsAccuracyMeters(null);
    setCoarseGpsCandidate(null);
    commitPinPosition(coords.lat, coords.lng, {
      forceAutoAddress: true,
      noticeText:
        'Titik antar & nama jalan diperbarui dari peta! Anda bisa melengkapi detail lorong/no. rumah di bawah.',
    });
    setGpsStatusMsg({
      type: 'success',
      text: `Pin dipasang tepat di ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}. Nama jalan otomatis terisi.`,
    });
  };

  const handleSelectSuggestion = (item: PlaceSearchResultItem) => {
    stopActiveGpsWatch();
    setIsLocatingGps(false);
    setGpsAccuracyMeters(null);
    setCoarseGpsCandidate(null);

    const fullAddress = [
      item.streetName || item.title,
      item.kelurahan,
      item.kecamatan,
      'Kabupaten Pinrang',
    ]
      .filter(Boolean)
      .join(', ');

    commitPinPosition(item.lat, item.lng, {
      suggestedAddress: fullAddress,
      suggestedLandmark:
        !landmark.trim() && item.landmarkHint ? item.landmarkHint : undefined,
      zoomTo: 18,
      forceAutoAddress: true,
      noticeText: `Jalan dipilih: ${fullAddress}. Silakan pilih atau ketik detail Lorong / No. Rumah di bawah.`,
    });
    setSearchInput('');
    setShowDropdown(false);
    resetSession();
    setGpsStatusMsg({
      type: 'success',
      text: `Nama jalan otomatis terisi: ${fullAddress}. Pilih Lorong berapa / No. Rumah di kolom bawah agar kurir langsung sampai.`,
    });
  };

  const handleApplyCoarseCandidate = () => {
    if (!coarseGpsCandidate) return;
    const { lat, lng, accuracy } = coarseGpsCandidate;
    setCoarseGpsCandidate(null);
    setGpsAccuracyMeters(accuracy);
    commitPinPosition(lat, lng, {
      zoomTo: 17,
      forceAutoAddress: true,
      noticeText:
        'Pin diarahkan ke perkiraan lokasi. Wajib geser pin hijau di peta agar tepat di depan rumah Anda.',
    });
    setGpsStatusMsg({
      type: 'info',
      text: `Perkiraan lokasi dipasang (radius ±${accuracy}m). Silakan geser pin hijau di peta tepat ke rumah Anda.`,
    });
  };

  const handleDetectGpsAndCenter = () => {
    setGpsStatusMsg(null);
    setCoarseGpsCandidate(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatusMsg({
        type: 'warning',
        text: 'Browser ini tidak mendukung GPS otomatis. Silakan ketuk peta langsung atau pilih nama jalan di bawah.',
      });
      return;
    }

    stopActiveGpsWatch();
    setIsLocatingGps(true);
    setGpsStatusMsg({
      type: 'info',
      text: 'Mengunci sinyal satelit GPS presisi tinggi (1:1)... mohon tunggu beberapa detik.',
    });

    let bestPos: GeolocationPosition | null = null;
    let settled = false;
    let lockCommitted = false;

    const commitPrecisePosition = (pos: GeolocationPosition, isRefinement: boolean) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = Math.max(1, Math.round(pos.coords.accuracy));
      setGpsAccuracyMeters(acc);
      commitPinPosition(lat, lng, {
        zoomTo: acc <= 30 ? 19 : 18,
        forceAutoAddress: true,
        noticeText:
          acc <= 30
            ? `Lokasi GPS presisi 1:1 berhasil dikunci (akurasi ±${acc}m)!`
            : `Lokasi ditemukan dengan akurasi ±${acc}m. Periksa & geser pin hijau sedikit bila perlu.`,
      });
      setGpsStatusMsg({
        type: acc <= 35 ? 'success' : 'info',
        text:
          acc <= 35
            ? isRefinement
              ? `Lokasi GPS diperhalus & terkunci 1:1 (akurasi ±${acc}m)! Titik pin hijau & nama jalan otomatis terisi.`
              : `Lokasi GPS presisi 1:1 berhasil diambil (akurasi ±${acc}m). Titik pin hijau & nama jalan otomatis terisi!`
            : `Lokasi ditemukan dengan akurasi ±${acc}m. Pastikan pin hijau di peta sudah tepat di depan rumah Anda (bisa digeser manual).`,
      });
    };

    const finalizeSession = (errCode?: number, errMessage?: string) => {
      if (settled) return;
      settled = true;
      stopActiveGpsWatch();
      setIsLocatingGps(false);

      if (bestPos) {
        const bestAcc = Math.max(1, Math.round(bestPos.coords.accuracy));
        if (bestAcc <= 120) {
          if (!lockCommitted) {
            commitPrecisePosition(bestPos, false);
          }
          return;
        }

        // Coarse network / cell-tower / IP estimate (> 120m): do NOT silently drop a wrong pin
        setCameraCenter({
          lat: bestPos.coords.latitude,
          lng: bestPos.coords.longitude,
        });
        setZoom(16);
        setCoarseGpsCandidate({
          lat: bestPos.coords.latitude,
          lng: bestPos.coords.longitude,
          accuracy: bestAcc,
        });
        setGpsStatusMsg({
          type: 'warning',
          text: `Sinyal satelit GPS masih terlalu lebar (akurasi ±${bestAcc}m — biasanya memakai lokasi jaringan/IP saat di dalam ruangan). Aktifkan Lokasi Presisi Tinggi di HP lalu coba di teras/luar ruangan, atau ketuk langsung titik rumah Anda di peta bawah.`,
        });
        return;
      }

      const msgStr = String(errMessage || '');
      const isPolicyBlocked =
        /permissions policy|feature policy|has been disabled/i.test(msgStr);
      const isPermissionDenied = errCode === 1;

      if (isPermissionDenied || isPolicyBlocked) {
        const insideIframe = (() => {
          try {
            return window.self !== window.top;
          } catch {
            return true;
          }
        })();

        if (isPolicyBlocked || insideIframe) {
          setGpsStatusMsg({
            type: 'warning',
            isIframeBlocked: true,
            text: 'GPS dibatasi oleh mode preview browser. Buka di tab browser penuh agar GPS aktif otomatis, atau ketuk langsung rumah Anda di peta / pilih poros jalan di bawah.',
          });
        } else {
          setGpsStatusMsg({
            type: 'info',
            text: 'Izin Lokasi GPS belum diizinkan. Ketuk ikon kunci/setelan di sebelah URL browser untuk mengizinkan Lokasi, lalu klik Ambil Lokasi Saya lagi — atau ketuk peta di bawah.',
          });
        }
        return;
      }

      setGpsStatusMsg({
        type: 'warning',
        text: 'Sinyal GPS HP belum merespons (pastikan Lokasi / GPS Presisi Tinggi di HP aktif). Anda juga bisa langsung mengetuk rumah Anda di peta atau pilih poros jalan di bawah.',
      });
    };

    // Total convergence window: 12 seconds max for GNSS cold-start
    gpsMaxTimerRef.current = window.setTimeout(() => {
      finalizeSession();
    }, 12000);

    try {
      gpsWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (settled) return;

          const acc = pos.coords.accuracy;
          if (
            !bestPos ||
            acc < bestPos.coords.accuracy ||
            (acc === bestPos.coords.accuracy && pos.timestamp >= bestPos.timestamp)
          ) {
            bestPos = pos;
          }

          // True 1:1 GNSS precision achieved (<= 25m)
          if (acc <= 25) {
            const isRefinement = lockCommitted;
            lockCommitted = true;
            commitPrecisePosition(pos, isRefinement);

            if (acc <= 10) {
              finalizeSession();
            } else if (gpsRefineTimerRef.current === null) {
              // Wait up to 1.8s for an even tighter <=10m satellite lock, then finish cleanly
              gpsRefineTimerRef.current = window.setTimeout(() => {
                finalizeSession();
              }, 1800);
            }
            return;
          }

          // Intermediate update while still locking tighter satellites
          setGpsStatusMsg({
            type: 'info',
            text: `Menunggu satelit GPS lebih akurat (saat ini ±${Math.round(
              acc
            )}m)... harap tunggu sebentar.`,
          });
        },
        (err) => {
          if (err.code === 1) {
            finalizeSession(err.code, err.message);
          } else if (
            /permissions policy|feature policy|has been disabled/i.test(
              String(err.message || '')
            )
          ) {
            finalizeSession(err.code, err.message);
          } else if (err.code === 3 && bestPos) {
            finalizeSession();
          }
          // Ignore transient POSITION_UNAVAILABLE while watchPosition retries inside the 12s window
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        }
      );
    } catch (err) {
      const errObj = err as { code?: number; message?: string } | null;
      finalizeSession(errObj?.code, errObj?.message);
    }
  };

  const handleSavePermanent = async () => {
    if (!hasCustomerPin) {
      setGpsStatusMsg({
        type: 'warning',
        text: 'Ketuk peta, gunakan GPS, atau pilih jalan terlebih dahulu sebelum menyimpan permanen.',
      });
      return;
    }
    setIsSavingLoc(true);
    const ok = await onSaveCurrentLocation(saveLabel.trim() || 'Rumah');
    setIsSavingLoc(false);
    if (ok) {
      setSaveFeedback(
        currentUser
          ? `Lokasi "${saveLabel.trim() || 'Rumah'}" tersimpan permanen di perangkat & akun Google Anda!`
          : `Lokasi "${saveLabel.trim() || 'Rumah'}" tersimpan permanen di browser ini! Hubungkan Google agar ikut tersimpan di semua perangkat.`
      );
      window.setTimeout(() => setSaveFeedback(null), 4000);
    }
  };

  const handleSignInClick = async () => {
    try {
      setIsSigningIn(true);
      await onSignInGoogle();
    } catch {
      setGpsStatusMsg({
        type: 'info',
        text: 'Login Google dibatalkan. Lokasi tetap tersimpan aman di perangkat ini.',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const distanceText =
    customerPos && storePos
      ? formatDistanceId(
          computeDistanceKm(storePos.lat, storePos.lng, customerPos.lat, customerPos.lng)
        )
      : null;

  const mapCenter = cameraCenter || customerPos || storePos;

  const formattedCustomerPhone = customerPhone.trim()
    ? formatIndonesianPhoneDisplay(customerPhone)
    : '';

  return (
    <div className="space-y-3.5">
      {/* 1. Saved Permanent Locations Strip + Cloud Sync Status */}
      <div className="p-3.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/10 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-[#193D2B] flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-[#A83A2D]" />
            <span>Lokasi Tersimpan Permanen ({savedLocations.length})</span>
          </div>

          {currentUser ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#193D2B] bg-[#E9F0EC] px-2.5 py-0.5 rounded-lg border border-[#193D2B]/18">
              <Cloud className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[180px]">
                Sync Permanen: {currentUser.email}
              </span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSignInClick}
              disabled={isSigningIn}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-[#EFE9DC] border border-[#193D2B]/25 text-[#193D2B] text-[11px] font-semibold cursor-pointer transition-colors"
            >
              <Cloud className="w-3 h-3 shrink-0" />
              <span>
                {isSigningIn ? 'Menghubungkan...' : 'Hubungkan Google (Save Permanen Cloud)'}
              </span>
            </button>
          )}
        </div>

        {savedLocations.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {savedLocations.map((loc) => {
              const isActive =
                customerPos &&
                Math.abs(customerPos.lat - loc.lat) < 0.00005 &&
                Math.abs(customerPos.lng - loc.lng) < 0.00005;
              return (
                <div
                  key={loc.id}
                  className={`inline-flex items-center rounded-xl border text-xs overflow-hidden ${
                    isActive
                      ? 'bg-[#E9F0EC] border-[#193D2B] text-[#193D2B] font-bold'
                      : 'bg-white border-[#30251F]/12 text-[#30251F]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onApplySavedLocation(loc);
                      setCameraCenter({ lat: loc.lat, lng: loc.lng });
                      setZoom(18);
                      void runReverseGeocodeForPin(loc.lat, loc.lng, false);
                    }}
                    className="px-2.5 py-1.5 inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#EFE9DC]/60 text-left"
                  >
                    <MapPin className="w-3 h-3 text-[#A83A2D] shrink-0" />
                    <span>{loc.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSavedLocation(loc.id)}
                    aria-label={`Hapus lokasi ${loc.label}`}
                    className="px-2 py-1.5 text-[#6E5D53] hover:text-[#A83A2D] hover:bg-red-50 border-l border-[#30251F]/10 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-[#6E5D53]">
            Belum ada lokasi tersimpan. Tekan <strong>AMBIL LOKASI SAYA</strong> atau ketuk peta di bawah lalu klik Simpan Lokasi Permanen agar pesanan berikutnya cukup 1 kali ketuk.
          </p>
        )}
      </div>

      {/* 2. Free Search Bar (OpenStreetMap + Pinrang DB) + GPS Button */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div ref={searchBoxRef} className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#6E5D53] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && showDropdown) {
                  e.stopPropagation();
                  setShowDropdown(false);
                }
              }}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setShowDropdown(true);
              }}
              placeholder="Cari jalan, masjid, RSUD, pasar, atau area di Pinrang..."
              className="w-full bg-[#F7F3E9] border border-[#30251F]/16 rounded-xl pl-8 pr-3 py-2.5 text-xs text-[#30251F] placeholder:text-[#6E5D53]/65 focus:outline-none focus:border-[#193D2B]"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#6E5D53]">
                Mencari...
              </span>
            )}
            {showDropdown && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-[500] bg-white border border-[#30251F]/18 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-[#30251F]/8">
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full text-left px-3 py-2 text-xs text-[#30251F] hover:bg-[#F7F3E9] flex items-start gap-2 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#A83A2D] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-[#193D2B]">{item.title}</div>
                        <div className="text-[10.5px] text-[#6E5D53]">
                          {item.subtitle}
                          {item.landmarkHint ? ` · ${item.landmarkHint}` : ''}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={handleDetectGpsAndCenter}
            disabled={isLocatingGps}
            className="min-h-[42px] px-4 py-2.5 rounded-xl bg-[#193D2B] hover:bg-[#122E20] disabled:opacity-60 text-[#F7F3E9] font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 shadow-xs"
          >
            {isLocatingGps ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#E8C56E]" />
            ) : (
              <LocateFixed className="w-4 h-4 text-[#E8C56E]" />
            )}
            <span>
              {isLocatingGps ? 'Mengunci GPS Akurat...' : 'AMBIL LOKASI SAYA (GPS)'}
            </span>
          </button>
        </div>

        {/* Immediate GPS Feedback Banner Directly Under GPS Button */}
        {gpsStatusMsg && (
          <div
            role="status"
            className={`p-3 rounded-xl text-xs leading-relaxed border space-y-2 ${
              gpsStatusMsg.type === 'success'
                ? 'bg-[#E9F0EC] border-[#193D2B]/30 text-[#193D2B] font-medium'
                : gpsStatusMsg.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-950 font-medium'
                : 'bg-[#FAF5E8] border-[#D9A52E]/45 text-[#30251F] font-medium'
            }`}
          >
            <p>{gpsStatusMsg.text}</p>
            {coarseGpsCandidate && (
              <button
                type="button"
                onClick={handleApplyCoarseCandidate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] text-[11px] font-bold cursor-pointer transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-[#E8C56E]" />
                <span>
                  Pakai Perkiraan Ini (±{coarseGpsCandidate.accuracy}m) &amp; Geser Manual
                </span>
              </button>
            )}
            {gpsStatusMsg.isIframeBlocked && typeof window !== 'undefined' && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#193D2B] hover:bg-[#122E20] text-[#FFD24C] text-[11px] font-bold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Tab Penuh untuk Aktifkan GPS</span>
              </a>
            )}
          </div>
        )}

        {/* Quick-Pick Popular Pinrang City Streets & Corridors */}
        <div className="p-3 rounded-xl bg-[#F7F3E9] border border-[#30251F]/10 space-y-2">
          <div className="text-[10.5px] font-semibold text-[#6E5D53] flex items-center justify-between gap-2">
            <span>Pilih Cepat Poros Jalan Utama Kota Pinrang (Gratis Tanpa API Berbayar):</span>
            {distanceText && (
              <span className="text-[#193D2B] font-bold shrink-0">
                Jarak dari Kedai: ~{distanceText}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PINRANG_STREET_CORRIDORS.slice(0, 10).map((corridor) => {
              const isSelectedStreet =
                deliveryAddress
                  .toLowerCase()
                  .includes(corridor.streetName.toLowerCase()) &&
                deliveryAddress
                  .toLowerCase()
                  .includes(corridor.kelurahan.replace(/^kel\.\s*/i, '').toLowerCase());
              return (
                <button
                  key={corridor.id}
                  type="button"
                  onClick={() =>
                    handleSelectSuggestion({
                      id: corridor.id,
                      title: `${corridor.streetName} — ${corridor.corridorArea}`,
                      subtitle: `${corridor.kelurahan}, ${corridor.kecamatan}`,
                      streetName: corridor.streetName,
                      kelurahan: corridor.kelurahan,
                      kecamatan: corridor.kecamatan,
                      lat: corridor.lat,
                      lng: corridor.lng,
                      landmarkHint: corridor.defaultLandmark,
                      commonAlleys: corridor.commonAlleys,
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                    isSelectedStreet
                      ? 'bg-[#193D2B] text-[#F7F3E9] border-[#193D2B]'
                      : 'bg-white text-[#30251F] border-[#30251F]/12 hover:border-[#193D2B]/50'
                  }`}
                >
                  {corridor.streetName} ({corridor.kelurahan.replace(/^Kel\.\s*/i, '')})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Full Interactive OpenStreetMap Canvas (100% Free: Tap to Place & Drag Pin) */}
      <div className="relative">
        <LeafletMapCanvas
          center={mapCenter}
          zoom={zoom}
          heightClassName="h-[260px] sm:h-[300px]"
          storeMarker={{
            lat: storePos.lat,
            lng: storePos.lng,
            title: storeConfig.brandName,
            subtitle: 'Titik Kedai Nasi Kuning Lasinrang',
          }}
          customerMarker={
            customerPos
              ? {
                  lat: customerPos.lat,
                  lng: customerPos.lng,
                  title: 'Titik Antar Pesanan',
                  subtitle:
                    resolvedPinAddress?.fullFormattedAddress ||
                    deliveryAddress ||
                    'Geser pin hijau tepat ke depan rumah Anda',
                }
              : null
          }
          customerAccuracyMeters={gpsAccuracyMeters}
          interactiveMode="customer"
          onSelectCoords={handleInteractivePinPlaced}
        />

        <div className="pointer-events-none absolute top-2.5 left-12 right-2.5 z-[400] flex flex-wrap items-center justify-between gap-1.5">
          <span className="px-2.5 py-1 rounded-lg bg-[#12241A]/88 text-[#F7F3E9] text-[10px] font-medium shadow-sm">
            {customerPos
              ? 'Geser pin hijau atau ketuk peta tepat di depan rumah/lorong Anda'
              : 'Ketuk peta langsung atau tekan AMBIL LOKASI SAYA'}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {gpsAccuracyMeters !== null && (
              <span className="px-2.5 py-1 rounded-lg bg-[#193D2B]/95 text-white text-[10px] font-bold shadow-sm">
                Akurasi GPS ±{gpsAccuracyMeters}m
              </span>
            )}
            {distanceText && (
              <span className="px-2.5 py-1 rounded-lg bg-[#193D2B]/95 text-[#E8C56E] text-[10px] font-bold shadow-sm">
                Jarak dari Kedai: ~{distanceText}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Resolved Street Name + Coordinates Readout + Save Permanently Bar */}
      {customerPos && (
        <div className="p-3.5 rounded-xl bg-[#E9F0EC] border border-[#193D2B]/18 space-y-2.5">
          <div className="p-3 rounded-xl bg-white border border-[#193D2B]/14 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                {isResolvingAddress ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#193D2B]" />
                    <span>Mendeteksi Nama Jalan &amp; Area Sekitar...</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5 text-[#A83A2D]" />
                    <span>Alamat Jalan &amp; Area Terdeteksi Otomatis</span>
                  </>
                )}
              </span>

              {resolvedPinAddress?.fullFormattedAddress &&
                deliveryAddress.trim() !==
                  resolvedPinAddress.fullFormattedAddress && (
                  <button
                    type="button"
                    onClick={() => {
                      const link = buildValidGoogleMapsCoordUrl(
                        customerPos.lat,
                        customerPos.lng
                      );
                      if (!link) return;
                      lastAutoFilledAddressRef.current =
                        resolvedPinAddress.fullFormattedAddress;
                      onSelectCoordinates({
                        lat: customerPos.lat,
                        lng: customerPos.lng,
                        googleMapsLink: link,
                        suggestedAddress:
                          resolvedPinAddress.fullFormattedAddress,
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#193D2B] text-[#F7F3E9] text-[10px] font-semibold cursor-pointer hover:bg-[#122E20]"
                  >
                    Pakai Alamat Pin Ini
                  </button>
                )}
            </div>

            {resolvedPinAddress ? (
              <div className="space-y-2 text-xs text-[#30251F]">
                <div className="font-bold leading-snug text-[#193D2B]">
                  {resolvedPinAddress.fullFormattedAddress}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-[#6E5D53]">
                  {resolvedPinAddress.streetName && (
                    <div>
                      <span className="font-semibold text-[#4A3C34]">Nama Jalan: </span>
                      <span className="font-bold text-[#30251F]">
                        {resolvedPinAddress.streetName}
                        {resolvedPinAddress.streetNumber
                          ? ` No. ${resolvedPinAddress.streetNumber}`
                          : ''}
                      </span>
                    </div>
                  )}
                  {(resolvedPinAddress.kelurahan ||
                    resolvedPinAddress.kecamatan ||
                    resolvedPinAddress.city) && (
                    <div>
                      <span className="font-semibold text-[#4A3C34]">Kelurahan/Kec: </span>
                      <span>
                        {[
                          resolvedPinAddress.kelurahan,
                          resolvedPinAddress.kecamatan,
                          resolvedPinAddress.city,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-[#4A3C34]">Lorong / No. Rumah: </span>
                    {alleyDetail.trim() ? (
                      <span className="font-bold text-[#193D2B]">
                        {alleyDetail.trim()}
                      </span>
                    ) : (
                      <span className="text-[#9A7013] font-semibold">
                        Pilih / ketik Lorong di kolom bawah
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-[#4A3C34]">WA Aktif Kurir: </span>
                    {isValidIndonesianMobilePhone(customerPhone) ? (
                      <span className="font-mono font-bold text-[#193D2B]">
                        {formattedCustomerPhone} (Siap Dihubungi)
                      </span>
                    ) : onFocusPhone ? (
                      <button
                        type="button"
                        onClick={onFocusPhone}
                        className="font-bold text-[#A83A2D] underline cursor-pointer"
                      >
                        Isi Nomor WA Aktif Sekarang
                      </button>
                    ) : (
                      <span className="text-[#A83A2D] font-semibold">
                        Belum diisi
                      </span>
                    )}
                  </div>
                </div>

                {resolvedPinAddress.nearbyLandmarks.length > 0 && (
                  <div className="pt-1.5 border-t border-[#193D2B]/10 space-y-1">
                    <div className="text-[10.5px] font-bold text-[#193D2B] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#9A7013]" />
                      <span>
                        Patokan Terdekat Sekitar Titik (Ketuk untuk isi Patokan Kurir):
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {resolvedPinAddress.nearbyLandmarks.map((lm, i) => {
                        const labelText = lm.relation
                          ? lm.relation
                          : `Dekat ${lm.name}${
                              lm.distanceMeters !== undefined
                                ? ` (±${lm.distanceMeters}m)`
                                : ''
                            }`;
                        const isPicked = landmark
                          .toLowerCase()
                          .includes(lm.name.toLowerCase());
                        return (
                          <button
                            key={`${lm.name}-${i}`}
                            type="button"
                            onClick={() => {
                              if (onSuggestLandmark) {
                                onSuggestLandmark(`Dekat ${lm.name}`);
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-[10.5px] font-medium border transition-colors cursor-pointer text-left ${
                              isPicked
                                ? 'bg-[#193D2B] text-[#F7F3E9] border-[#193D2B]'
                                : 'bg-[#F7F3E9] text-[#30251F] border-[#30251F]/12 hover:border-[#193D2B]'
                            }`}
                          >
                            {labelText}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : !isResolvingAddress ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E5D53]">
                <span>
                  Ketuk deteksi ulang untuk mengambil nama jalan &amp; kelurahan dari koordinat pin ini.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void runReverseGeocodeForPin(customerPos.lat, customerPos.lng, true)
                  }
                  className="px-2.5 py-1 rounded-lg bg-[#193D2B] text-[#F7F3E9] text-[10.5px] font-semibold cursor-pointer hover:bg-[#122E20]"
                >
                  Deteksi Nama Jalan
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-mono-tabular text-[#193D2B] font-bold">
              Koordinat: {customerPos.lat.toFixed(6)}, {customerPos.lng.toFixed(6)}
              {distanceText ? ` · ~${distanceText} dari Kedai` : ''}
            </span>
            <a
              href={buildValidGoogleMapsCoordUrl(customerPos.lat, customerPos.lng) || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#193D2B] underline"
            >
              <span>Buka Rute di Google Maps (Gratis)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1.5 border-t border-[#193D2B]/12">
            <input
              type="text"
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              maxLength={40}
              placeholder="Label lokasi (misal: Rumah / Kantor)"
              className="flex-1 bg-white border border-[#193D2B]/22 rounded-lg px-2.5 py-1.5 text-xs text-[#30251F] focus:outline-none focus:border-[#193D2B]"
            />
            <button
              type="button"
              onClick={handleSavePermanent}
              disabled={isSavingLoc}
              className="px-3.5 py-1.5 rounded-lg bg-[#193D2B] hover:bg-[#122E20] disabled:opacity-60 text-[#F7F3E9] font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#E8C56E]" />
              <span>{isSavingLoc ? 'Menyimpan...' : 'Simpan Lokasi Permanen'}</span>
            </button>
          </div>
        </div>
      )}

      {saveFeedback && (
        <div className="p-2.5 rounded-lg text-[11px] font-semibold bg-[#E9F0EC] border border-[#193D2B]/25 text-[#193D2B] flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{saveFeedback}</span>
        </div>
      )}
    </div>
  );
};
