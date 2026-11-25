import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock,
  Copy,
  Download,
  Flame,
  HeartHandshake,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Loader2,
  LocateFixed,
  MapPin,
  Maximize2,
  Menu as MenuIcon,
  MessageSquareText,
  Minus,
  Navigation,
  Paperclip,
  Phone,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  User,
  Utensils,
  Wallet,
  X,
} from 'lucide-react';
import {
  DEFAULT_EXTRA_SIDE_OPTIONS,
  DEFAULT_PORTION_PRESETS,
  DEFAULT_REAL_QRIS_URL,
  DEFAULT_SAMBAL_OPTIONS,
  DEFAULT_TOPPING_OPTIONS,
  HERO_IMAGE_URL,
  INITIAL_MENU_ITEMS,
  INITIAL_STORE_CONFIG,
  NEW_OFFICIAL_MENU_IDS,
  formatRupiah,
} from '../data/initialData';
import type { TutorialScreenId } from '../data/tutorialTimeline';
import type {
  FulfillmentType,
  MenuItem,
  PaymentMethodType,
  RiceType,
  SambalPreference,
  StoreConfig,
} from '../types';
import {
  DanaLogoIcon,
  DanaLogoInline,
  GopayLogoIcon,
  GopayLogoInline,
  QrisLogo,
} from './BrandLogos';
import {
  BananaLeafOrnament,
  NusantaraSectionDivider,
  SpiceBotanicalOrnament,
} from './CulinaryOrnaments';
import { FoodImage, preloadAndDecodeImage } from './FoodImage';

export const TUTORIAL_VIRTUAL_WIDTH = 390;
export const TUTORIAL_VIRTUAL_HEIGHT = 844;

const OFFICIAL_LOGO_URL =
  '/assets/aistudio/file_000000004bd48211a316832fba565d37_46611b00.png';

const RECOMMENDED_MENU_IDS = [
  'nasi-kuning-bebek-palekko',
  'nasi-kuning-ayam-sambal-hijau',
  'nasi-kuning-ayam-cincang',
] as const;

export type ToppingScope = 'per_portion' | 'total_order';

export interface TutorialPortionState {
  menuId?: string;
  riceType?: RiceType;
  portionMode?: 'standard' | 'preset1' | 'preset2' | 'custom';
  customBudget?: number;
  quantity?: number;
  sambalPref?: SambalPreference;
  bakwanQty?: number;
  toppingScope?: ToppingScope;
  wantExtraSideDish?: boolean;
  extraSideChips?: string[];
  itemNote?: string;
  isTypingNote?: boolean;
}

export interface TutorialCheckoutState {
  customerName?: string;
  customerPhone?: string;
  activeTypingField?: 'name' | 'phone' | null;
  fulfillment?: FulfillmentType | '';
  deliveryAddress?: string;
  alleyDetail?: string;
  landmark?: string;
  paymentMethod?: PaymentMethodType;
  qrisDownloaded?: boolean;
  copiedNumber?: boolean;
  showEwalletHighlight?: boolean;
  paymentProofUploaded?: boolean;
}

export interface TutorialMapState {
  searchQuery?: string;
  isTypingSearch?: boolean;
  isLocatingGps?: boolean;
  isDraggingPin?: boolean;
  isSavedPermanent?: boolean;
  resolvedAddress?: string;
  distanceText?: string;
  saveLabel?: string;
  alleyDetail?: string;
  landmark?: string;
  isTypingAlley?: boolean;
}

export interface TutorialCursorPoint {
  x: number;
  y: number;
}

export interface TutorialDomStageProps {
  /** Layar aktif yang sedang disimulasikan */
  activeScreen: TutorialScreenId;
  /** Posisi scroll vertikal dalam piksel virtual (0..max) untuk layar aktif */
  scrollY?: number;
  /** Status simulasi aplikasi PWA terinstal */
  isAppInstalled?: boolean;
  /** Tab aktif pada QuickOrderHub di Beranda ('top' = Rekomendasi Menu, 'ulang' = Pesan Ulang) */
  quickHubTab?: 'top' | 'ulang';
  /** Tab kategori aktif di Katalog Menu */
  activeCategory?: 'all' | 'baru' | 'spesial' | 'reguler';
  /** ID menu spesifik yang sedang disebut narasi (otomatis disorot & dipusatkan di layar) */
  highlightedMenuId?: string | null;
  /** Label penanda menu aktif (misal 'Reguler 2/9 · Ayam Kentucky') */
  highlightedMenuBadge?: string | null;
  /** ID menu yang sedang dibuka di lightbox zoom foto */
  zoomedMenuId?: string | null;
  /** State simulasi PortionModal */
  portionState?: TutorialPortionState;
  /** State simulasi CheckoutModal & Pembayaran */
  checkoutState?: TutorialCheckoutState;
  /** Posisi Pin Hijau pada peta Pinrang (persentase 0..100 pada sumbu X & Y) */
  mapPinPos?: TutorialCursorPoint;
  /** State tambahan simulasi CustomerLocationMapPicker */
  mapState?: TutorialMapState;
  /** Pesan toast melayang (misal: nomor disalin / QRIS diunduh / lokasi tersimpan) */
  toastMessage?: string | null;
  /** Posisi kursor/jari virtual dalam koordinat virtual 390x844 (null untuk menyembunyikan) */
  cursorPos?: TutorialCursorPoint | null;
  /** True saat kursor sedang menekan/mengklik tombol (memicu ripple + scale-95) */
  isClicking?: boolean;
  /** Selector elemen target aktif (misal '[data-tutorial="btn-pesan-sekarang"]') untuk efek sorot & tekan scale-95 */
  activeTargetSelector?: string | null;
  /** Nonaktifkan transisi lerp saat pengguna sedang scrub/seek cepat */
  instantMotion?: boolean;
  /** Subtitle opsional di bagian bawah layar ponsel */
  caption?: string | null;
  /** Tampilkan subtitle di dalam layar ponsel */
  showCaption?: boolean;
  /** Jarak bawah subtitle (px virtual 844px) agar tidak bertabrakan dengan scrubber inline */
  captionBottomOffsetPx?: number;
  /** Konfigurasi kedai live (fallback ke INITIAL_STORE_CONFIG) */
  storeConfig?: StoreConfig;
  /** Daftar menu live (fallback ke INITIAL_MENU_ITEMS) */
  menuItems?: MenuItem[];
  /** Tambahan className pada wrapper luar */
  className?: string;
}

function normalizeTargetKey(selector?: string | null): string {
  if (!selector) return '';
  const trimmed = selector.trim();
  const dataMatch = trimmed.match(/data-tutorial=["']([^"']+)["']/);
  if (dataMatch) return dataMatch[1];
  const menuMatch = trimmed.match(/data-menu-id=["']([^"']+)["']/);
  if (menuMatch) return menuMatch[1];
  if (trimmed.startsWith('#')) return trimmed.slice(1);
  return trimmed;
}

function isTargetMatched(
  activeTargetSelector: string | null | undefined,
  candidateKey: string
): boolean {
  if (!activeTargetSelector) return false;
  return normalizeTargetKey(activeTargetSelector) === candidateKey;
}

function getInteractiveStateClass(
  activeTargetSelector: string | null | undefined,
  candidateKey: string,
  isClicking: boolean
): string {
  if (!isTargetMatched(activeTargetSelector, candidateKey)) {
    return 'transition-transform duration-150';
  }
  if (isClicking) {
    return 'scale-95 brightness-95 ring-2 ring-[#FFD24C] shadow-[0_0_0_4px_rgba(255,210,76,0.45)] transition-transform duration-150';
  }
  return 'ring-2 ring-[#FFD24C]/95 shadow-[0_0_18px_rgba(255,210,76,0.52)] transition-all duration-200';
}

function isNewMenuEntry(item: MenuItem): boolean {
  return (
    (NEW_OFFICIAL_MENU_IDS as readonly string[]).includes(item.id) ||
    item.id.startsWith('menu-') ||
    /menu baru/i.test(item.signatureTag || '')
  );
}

/* =========================================================================
   KURSOR / JARI VIRTUAL REALISTIS (SMOOTH LERP + RIPPLE WAVE)
   ========================================================================= */

interface VirtualTouchCursorProps {
  targetPos: TutorialCursorPoint | null | undefined;
  isClicking: boolean;
  isDragging?: boolean;
  instant?: boolean;
}

const VirtualTouchCursor: React.FC<VirtualTouchCursorProps> = ({
  targetPos,
  isClicking,
  isDragging = false,
  instant = false,
}) => {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const currentPosRef = useRef<TutorialCursorPoint>({
    x: targetPos?.x ?? 195,
    y: targetPos?.y ?? 420,
  });
  const targetPosRef = useRef<TutorialCursorPoint>({
    x: targetPos?.x ?? 195,
    y: targetPos?.y ?? 420,
  });
  const [rippleCounter, setRippleCounter] = useState<number>(0);
  const prevClickingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!targetPos) return;
    targetPosRef.current = {
      x: Math.max(8, Math.min(TUTORIAL_VIRTUAL_WIDTH - 8, targetPos.x)),
      y: Math.max(8, Math.min(TUTORIAL_VIRTUAL_HEIGHT - 8, targetPos.y)),
    };
    if (instant || isClicking) {
      currentPosRef.current = { ...targetPosRef.current };
      if (layerRef.current) {
        layerRef.current.style.transform = `translate3d(${currentPosRef.current.x}px, ${currentPosRef.current.y}px, 0)`;
      }
    }
  }, [targetPos, instant, isClicking]);

  useEffect(() => {
    if (isClicking && !prevClickingRef.current) {
      setRippleCounter((c) => c + 1);
    }
    prevClickingRef.current = isClicking;
  }, [isClicking]);

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(48, Math.max(1, now - lastTs));
      lastTs = now;

      const cur = currentPosRef.current;
      const tgt = targetPosRef.current;
      const dx = tgt.x - cur.x;
      const dy = tgt.y - cur.y;

      if (Math.abs(dx) < 0.35 && Math.abs(dy) < 0.35) {
        cur.x = tgt.x;
        cur.y = tgt.y;
      } else {
        const lerpAlpha = 1 - Math.pow(1 - 0.55, dt / 16.67);
        cur.x += dx * lerpAlpha;
        cur.y += dy * lerpAlpha;
      }

      if (layerRef.current) {
        layerRef.current.style.transform = `translate3d(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px, 0)`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  if (!targetPos) return null;

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-[70] will-change-transform"
      style={{
        transform: `translate3d(${currentPosRef.current.x}px, ${currentPosRef.current.y}px, 0)`,
      }}
    >
      {/* Concentric Touch Ripple Waves on Click */}
      {rippleCounter > 0 && (
        <React.Fragment key={`ripple-${rippleCounter}`}>
          <span className="tutorial-touch-ripple-outer absolute left-0 top-0 w-10 h-10 rounded-full border-[2.5px] border-[#FFD24C] bg-[#FFC72C]/22 shadow-[0_0_16px_rgba(255,210,76,0.65)]" />
          <span className="tutorial-touch-ripple-inner absolute left-0 top-0 w-7 h-7 rounded-full border-2 border-white bg-[#FDFBF7]/35" />
        </React.Fragment>
      )}

      {/* Fingertip Contact Glow Halo */}
      <span
        className={`absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-150 ${
          isClicking
            ? 'w-6 h-6 bg-[#FFD24C]/70 ring-2 ring-white shadow-[0_0_14px_rgba(255,210,76,0.9)]'
            : isDragging
            ? 'w-7 h-7 bg-[#193D2B]/40 ring-2 ring-[#193D2B]'
            : 'w-4 h-4 bg-white/45 ring-1 ring-[#FFD24C]/85'
        }`}
      />

      {/* Realistic Touch Hand / Finger Pointer SVG anchored accurately at fingertip (0,0) */}
      <div
        className={`relative -left-[10px] -top-[4px] transition-transform duration-150 origin-[10px_4px] ${
          isClicking
            ? 'scale-[0.86] translate-y-[2px] -rotate-[6deg]'
            : isDragging
            ? 'scale-[0.94] -rotate-[4deg]'
            : 'scale-100'
        }`}
      >
        <svg
          width="42"
          height="46"
          viewBox="0 0 42 46"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_6px_10px_rgba(5,31,20,0.58)]"
        >
          <path
            d="M11.5 3.2C9.6 3.2 8.2 4.7 8.2 6.6V21.5L5.7 19.3C4.4 18.1 2.4 18.3 1.4 19.7C0.5 20.9 0.7 22.6 1.8 23.7L9.8 32.2C12.2 34.8 15.6 36.2 19.1 36.2H24.2C30.4 36.2 35.2 31.3 35.2 25.1V17.4C35.2 15.5 33.7 14 31.8 14C30.7 14 29.8 14.5 29.1 15.2C28.8 13.5 27.3 12.2 25.5 12.2C24.4 12.2 23.4 12.7 22.7 13.5C22.3 11.9 20.9 10.7 19.1 10.7C17.8 10.7 16.7 11.4 16 12.4V6.6C16 4.7 14.5 3.2 12.6 3.2H11.5Z"
            fill="url(#nklFingerGrad)"
            stroke="#051F14"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <rect
            x="10.1"
            y="5.2"
            width="3.9"
            height="4.6"
            rx="1.9"
            fill="#FFFDF9"
            fillOpacity="0.88"
          />
          <path
            d="M16.2 17.5V22.5M22.6 16.5V22.2M29.1 17.8V22.4"
            stroke="#B67B5A"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeOpacity="0.65"
          />
          <rect
            x="13.5"
            y="36.2"
            width="16"
            height="5.5"
            rx="2.75"
            fill="#084C32"
            stroke="#FFD24C"
            strokeWidth="1.4"
          />
          <defs>
            <linearGradient
              id="nklFingerGrad"
              x1="8"
              y1="3"
              x2="33"
              y2="36"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FFF5EA" />
              <stop offset="0.55" stopColor="#F5D3B8" />
              <stop offset="1" stopColor="#E4B38E" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

/* =========================================================================
   PETA KOTA PINRANG INTERAKTIF 1:1 (UNTUK CUSTOMER LOCATION MAP PICKER)
   ========================================================================= */

interface PinrangInteractiveMapMockProps {
  pinPos: TutorialCursorPoint;
  isDraggingPin: boolean;
  isLocatingGps: boolean;
  distanceText: string;
  activeTargetSelector?: string | null;
  isClicking: boolean;
}

const PinrangInteractiveMapMock: React.FC<PinrangInteractiveMapMockProps> = ({
  pinPos,
  isDraggingPin,
  isLocatingGps,
  distanceText,
  activeTargetSelector,
  isClicking,
}) => {
  const clampedX = Math.max(12, Math.min(88, pinPos.x));
  const clampedY = Math.max(18, Math.min(84, pinPos.y));
  const storeX = 32;
  const storeY = 58;

  return (
    <div
      data-tutorial="map-picker-canvas"
      className={`relative h-[220px] w-full rounded-xl overflow-hidden border border-[#30251F]/15 bg-[#EFE9DC] shadow-inner ${getInteractiveStateClass(
        activeTargetSelector,
        'map-picker-canvas',
        false
      )}`}
    >
      {/* Realistic OpenStreetMap / Google Maps Cartography SVG of Kota Pinrang */}
      <svg
        viewBox="0 0 360 220"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <rect width="360" height="220" fill="#F2EFE9" />

        {/* Green Parks / Alun-Alun Lasinrang */}
        <rect x="18" y="18" width="84" height="58" rx="8" fill="#CDE6C1" />
        <rect x="236" y="145" width="96" height="62" rx="10" fill="#D5EACA" />
        <circle cx="115" cy="128" r="19" fill="#C6E3B8" stroke="#99C789" strokeWidth="1.5" />

        {/* City Building Footprints */}
        <g fill="#E2DDD2" stroke="#D5CFC2" strokeWidth="0.8">
          <rect x="132" y="22" width="38" height="24" rx="2" />
          <rect x="178" y="22" width="44" height="24" rx="2" />
          <rect x="234" y="22" width="48" height="30" rx="2" />
          <rect x="292" y="24" width="46" height="28" rx="2" />
          <rect x="148" y="64" width="34" height="26" rx="2" />
          <rect x="192" y="62" width="42" height="30" rx="2" />
          <rect x="248" y="66" width="40" height="25" rx="2" />
          <rect x="298" y="70" width="44" height="30" rx="2" />
          <rect x="20" y="92" width="46" height="28" rx="2" />
          <rect x="150" y="142" width="36" height="25" rx="2" />
          <rect x="194" y="146" width="32" height="26" rx="2" />
          <rect x="24" y="156" width="54" height="32" rx="2" />
        </g>

        {/* Secondary Streets & Lorongs */}
        <g stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round">
          <line x1="0" y1="54" x2="360" y2="54" />
          <line x1="0" y1="184" x2="360" y2="184" />
          <line x1="78" y1="0" x2="78" y2="220" />
          <line x1="186" y1="0" x2="186" y2="220" />
          <line x1="242" y1="0" x2="242" y2="220" />
          <line x1="294" y1="54" x2="294" y2="184" />
        </g>

        {/* Major Arterial Roads (Jl. Jend. Sudirman & Jl. Lasinrang) */}
        <g stroke="#F8D678" strokeWidth="9" strokeLinecap="round" fill="none">
          <path d="M0 128 H96 M134 128 H360" />
          <path d="M115 0 V109 M115 147 V220" />
        </g>
        <g stroke="#FFF8DC" strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M0 128 H96 M134 128 H360" />
          <path d="M115 0 V109 M115 147 V220" />
        </g>
        {/* Patung Lasinrang Roundabout Road */}
        <circle
          cx="115"
          cy="128"
          r="19"
          fill="none"
          stroke="#F8D678"
          strokeWidth="7"
        />
        <circle
          cx="115"
          cy="128"
          r="19"
          fill="none"
          stroke="#FFF8DC"
          strokeWidth="4.5"
        />

        {/* Road Name Labels */}
        <text
          x="160"
          y="131"
          fill="#6B5A3E"
          fontSize="8.5"
          fontWeight="700"
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          Jl. Jenderal Sudirman
        </text>
        <text
          x="196"
          y="49"
          fill="#7A7368"
          fontSize="7.5"
          fontWeight="600"
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          Jl. Sultan Hasanuddin
        </text>
        <text
          x="26"
          y="48"
          fill="#193D2B"
          fontSize="8"
          fontWeight="700"
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          Lasinrang Park
        </text>
        <text
          x="252"
          y="172"
          fill="#193D2B"
          fontSize="7.5"
          fontWeight="700"
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          Macorawalie
        </text>

        {/* Dashed Delivery Route from Patung Lasinrang Kedai to Customer Pin */}
        <line
          x1={(storeX / 100) * 360}
          y1={(storeY / 100) * 220}
          x2={(clampedX / 100) * 360}
          y2={(clampedY / 100) * 220}
          stroke="#193D2B"
          strokeWidth="2.8"
          strokeDasharray="6 5"
          strokeLinecap="round"
        />
      </svg>

      {/* Top Overlay Map Guidance & Distance Badges (1:1 CustomerLocationMapPicker) */}
      <div className="pointer-events-none absolute top-2 left-2 right-2 z-20 flex items-center justify-between gap-1.5">
        <span className="px-2 py-1 rounded-lg bg-[#30251F]/85 text-[#F7F3E9] text-[9.5px] font-medium shadow-sm truncate">
          Ketuk peta atau geser pin hijau tepat di depan rumah/lorong Anda
        </span>
        <span className="px-2 py-1 rounded-lg bg-[#193D2B]/90 text-[#F7F3E9] text-[9.5px] font-bold shadow-sm shrink-0">
          ~{distanceText} dari Kedai
        </span>
      </div>

      {/* Fixed Red Store Marker (Patung Lasinrang) */}
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-full"
        style={{ left: `${storeX}%`, top: `${storeY}%` }}
      >
        <div className="flex flex-col items-center">
          <span className="mb-0.5 px-1.5 py-0.5 rounded bg-[#A83A2D] text-[#F7F3E9] text-[8.5px] font-extrabold whitespace-nowrap shadow">
            Lapak Lasinrang
          </span>
          <div className="w-6 h-6 rounded-full bg-[#A83A2D] border-2 border-white shadow-md flex items-center justify-center">
            <Store className="w-3 h-3 text-[#FFD24C]" />
          </div>
        </div>
      </div>

      {/* Draggable Green Customer Delivery Pin (Controlled by mapPinPos) */}
      <div
        data-tutorial="map-green-pin"
        className={`absolute z-30 -translate-x-1/2 -translate-y-full transition-[left,top] duration-300 ease-out ${
          isDraggingPin ? 'scale-110' : 'scale-100'
        }`}
        style={{ left: `${clampedX}%`, top: `${clampedY}%` }}
      >
        <span
          className={`absolute left-1/2 bottom-[-3px] -translate-x-1/2 rounded-full bg-black/35 transition-all duration-200 ${
            isDraggingPin ? 'w-5 h-2 blur-[1.5px]' : 'w-3 h-1.5 blur-[0.5px]'
          }`}
        />

        <div
          className={`flex flex-col items-center transition-transform duration-200 ${
            isDraggingPin ? '-translate-y-2.5' : 'translate-y-0'
          }`}
        >
          <span className="mb-1 px-2 py-0.5 rounded-md bg-[#193D2B] text-[#F7F3E9] border border-white/70 text-[9px] font-extrabold whitespace-nowrap shadow-md">
            {isLocatingGps
              ? 'Mendeteksi GPS...'
              : isDraggingPin
              ? 'Geser ke Depan Rumah'
              : 'Titik Antar (Pin Hijau)'}
          </span>
          <div
            className={`relative w-9 h-9 rounded-full bg-[#193D2B] border-[2.5px] border-white shadow-[0_6px_14px_rgba(25,61,43,0.65)] flex items-center justify-center ${
              isTargetMatched(activeTargetSelector, 'map-green-pin') && isClicking
                ? 'scale-95 ring-4 ring-[#FFD24C]/70'
                : isTargetMatched(activeTargetSelector, 'map-green-pin')
                ? 'ring-4 ring-[#193D2B]/45'
                : ''
            }`}
          >
            <MapPin className="w-4.5 h-4.5 text-[#FFD24C] fill-[#FFD24C]/30" />
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#193D2B]" />
          </div>
        </div>
      </div>

      {/* Bottom-right Attribution Style Pill */}
      <div className="pointer-events-none absolute bottom-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded bg-white/85 text-[8.5px] text-[#30251F] font-semibold">
        Kota Pinrang · Google Maps Pin
      </div>
    </div>
  );
};

/* =========================================================================
   KOMPONEN UTAMA: TUTORIAL DOM STAGE (390x844 RESPONSIVE 1:1 MIRROR)
   ========================================================================= */

export const TutorialDomStage: React.FC<TutorialDomStageProps> = React.memo(({
  activeScreen,
  scrollY = 0,
  isAppInstalled = false,
  quickHubTab = 'top',
  activeCategory = 'all',
  highlightedMenuId = null,
  highlightedMenuBadge = null,
  zoomedMenuId = null,
  portionState,
  checkoutState,
  mapPinPos = { x: 64, y: 38 },
  mapState,
  toastMessage = null,
  cursorPos = null,
  isClicking = false,
  activeTargetSelector = null,
  instantMotion = false,
  caption = null,
  showCaption = false,
  captionBottomOffsetPx = 24,
  storeConfig = INITIAL_STORE_CONFIG,
  menuItems = INITIAL_MENU_ITEMS,
  className = '',
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const stageViewportRef = useRef<HTMLDivElement | null>(null);
  const catalogScrollInnerRef = useRef<HTMLDivElement | null>(null);
  const portionScrollInnerRef = useRef<HTMLDivElement | null>(null);
  const checkoutScrollInnerRef = useRef<HTMLDivElement | null>(null);
  const mapScrollInnerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(0.72);
  const [autoCatalogScrollY, setAutoCatalogScrollY] = useState<number | null>(
    null
  );
  const [autoBodyScrollY, setAutoBodyScrollY] = useState<number | null>(null);
  const [measuredCursorPos, setMeasuredCursorPos] =
    useState<TutorialCursorPoint | null>(null);

  const supportsCssZoom = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('zoom', '1'),
    []
  );

  // Preload & pre-decode all official 4K menu photos, logo & QRIS for 0ms instant switching & zero black flashes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const urls = new Set<string>([
      OFFICIAL_LOGO_URL,
      HERO_IMAGE_URL,
      storeConfig.qrisImageUrl || DEFAULT_REAL_QRIS_URL,
    ]);
    const allMenus = menuItems.length > 0 ? menuItems : INITIAL_MENU_ITEMS;
    for (const m of allMenus) {
      if (m.imageUrl) urls.add(m.imageUrl);
    }
    for (const m of INITIAL_MENU_ITEMS) {
      if (m.imageUrl) urls.add(m.imageUrl);
    }
    for (const t of DEFAULT_TOPPING_OPTIONS) {
      if (t.imageUrl) urls.add(t.imageUrl);
    }

    const queue = Array.from(urls);
    const runBatch = async () => {
      for (let i = 0; i < queue.length; i += 4) {
        if (cancelled) return;
        await Promise.all(
          queue.slice(i, i + 4).map((src) => preloadAndDecodeImage(src))
        );
      }
    };
    void runBatch();
    return () => {
      cancelled = true;
    };
  }, [menuItems, storeConfig.qrisImageUrl]);

  // Responsive transform: scale(...) via ResizeObserver so 390x844 never clips on mobile or desktop
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const sx = rect.width / TUTORIAL_VIRTUAL_WIDTH;
      const sy = rect.height / TUTORIAL_VIRTUAL_HEIGHT;
      const next = Math.round(Math.min(sx, sy) * 10000) / 10000;
      if (Number.isFinite(next) && next > 0.1) {
        setScale((prev) => (Math.abs(prev - next) >= 0.001 ? next : prev));
      }
    };

    updateScale();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }

    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Always include all 12 official narrated menus so none are ever missing in tutorial playback
  const resolvedMenuItems = useMemo(() => {
    const base = menuItems.length > 0 ? [...menuItems] : [...INITIAL_MENU_ITEMS];
    const existingIds = new Set(base.map((m) => m.id));
    for (const initItem of INITIAL_MENU_ITEMS) {
      if (!existingIds.has(initItem.id)) {
        base.push(initItem);
      }
    }
    return base;
  }, [menuItems]);

  const displayMenuCount = Math.max(12, resolvedMenuItems.length);
  const palekkoItem = useMemo(
    () =>
      resolvedMenuItems.find((m) => m.id === 'nasi-kuning-bebek-palekko') ||
      resolvedMenuItems[0],
    [resolvedMenuItems]
  );

  // 3 New Menus for Hero 2x2 Mini Poster Grid (1:1 App.tsx)
  const newMenus = useMemo(
    () => resolvedMenuItems.filter(isNewMenuEntry).slice(0, 3),
    [resolvedMenuItems]
  );

  // 3 Recommended Menu items (Bebek Palekko Bugis, Ayam Sambal Hijau, Ayam Cincang)
  const recommendedMenus = useMemo(() => {
    const list: MenuItem[] = [];
    for (const id of RECOMMENDED_MENU_IDS) {
      const found = resolvedMenuItems.find((m) => m.id === id);
      if (found) list.push(found);
    }
    return list.length > 0 ? list : resolvedMenuItems.slice(0, 3);
  }, [resolvedMenuItems]);

  const selectedPortionMenu = useMemo(() => {
    if (portionState?.menuId) {
      const found = resolvedMenuItems.find((m) => m.id === portionState.menuId);
      if (found) return found;
    }
    return palekkoItem;
  }, [portionState?.menuId, resolvedMenuItems, palekkoItem]);

  const zoomedMenu = useMemo(() => {
    if (zoomedMenuId) {
      return resolvedMenuItems.find((m) => m.id === zoomedMenuId) || palekkoItem;
    }
    return palekkoItem;
  }, [zoomedMenuId, resolvedMenuItems, palekkoItem]);

  const filteredMenus = useMemo(() => {
    if (activeCategory === 'all') return resolvedMenuItems;
    if (activeCategory === 'baru') return resolvedMenuItems.filter(isNewMenuEntry);
    return resolvedMenuItems.filter((m) => m.category === activeCategory);
  }, [resolvedMenuItems, activeCategory]);

  // Portion calculations (identical 1:1 to PortionModal.tsx including toppingScope)
  const portionPresets = storeConfig.portionPresets || DEFAULT_PORTION_PRESETS;
  const riceType: RiceType = portionState?.riceType || 'nasi_kuning';
  const portionMode = portionState?.portionMode || 'standard';
  const quantity = Math.max(1, portionState?.quantity ?? 1);
  const sambalPref: SambalPreference = portionState?.sambalPref || 'campur';
  const bakwanQty = Math.max(0, portionState?.bakwanQty ?? 0);
  const toppingScope: ToppingScope = portionState?.toppingScope || 'per_portion';
  const wantExtraSideDish = Boolean(portionState?.wantExtraSideDish);
  const extraSideChips = portionState?.extraSideChips || [];
  const itemNote = portionState?.itemNote ?? '';
  const isTypingNote = Boolean(portionState?.isTypingNote);

  const isSpesial = selectedPortionMenu.category === 'spesial';
  const basePrice = selectedPortionMenu.basePrice;
  const preset1Price =
    basePrice +
    (isSpesial
      ? portionPresets.extraPuasSpesialDelta
      : portionPresets.extraPuasRegulerDelta);
  const preset2Price =
    basePrice +
    (isSpesial
      ? portionPresets.jumboSpesialDelta
      : portionPresets.jumboRegulerDelta);
  const customPrice = Math.max(
    basePrice,
    portionState?.customBudget ?? basePrice + 3000
  );

  let activeUnitPrice = basePrice;
  let portionLabel = `Porsi Standar (${formatRupiah(basePrice)})`;
  if (portionMode === 'preset1') {
    activeUnitPrice = preset1Price;
    portionLabel = `${portionPresets.extraPuasLabel} (${formatRupiah(preset1Price)})`;
  } else if (portionMode === 'preset2') {
    activeUnitPrice = preset2Price;
    portionLabel = `${portionPresets.jumboLabel} (${formatRupiah(preset2Price)})`;
  } else if (portionMode === 'custom') {
    activeUnitPrice = customPrice;
    portionLabel = `Request Porsi Khusus (${formatRupiah(customPrice)})`;
  }

  const bakwanTopping = DEFAULT_TOPPING_OPTIONS[0];
  const toppingTotal = bakwanQty * (bakwanTopping?.price ?? 1000);
  const isPartialTopping = quantity > 1 && toppingScope === 'total_order';
  const finalUnitPrice = isPartialTopping
    ? activeUnitPrice
    : activeUnitPrice + toppingTotal;
  const lineSubtotal = isPartialTopping
    ? activeUnitPrice * quantity + toppingTotal
    : finalUnitPrice * quantity;

  // Checkout state values
  const customerName = checkoutState?.customerName ?? '';
  const customerPhone = checkoutState?.customerPhone ?? '';
  const activeTypingField = checkoutState?.activeTypingField ?? null;
  const fulfillment: FulfillmentType | '' = checkoutState?.fulfillment ?? '';
  const paymentMethod: PaymentMethodType = checkoutState?.paymentMethod ?? 'qris';
  const qrisDownloaded = Boolean(checkoutState?.qrisDownloaded);
  const copiedNumber = Boolean(checkoutState?.copiedNumber);
  const paymentProofUploaded = Boolean(checkoutState?.paymentProofUploaded);
  const deliveryAddress =
    checkoutState?.deliveryAddress ||
    mapState?.resolvedAddress ||
    'Jl. Jenderal Sudirman, Kel. Macorawalie, Kec. Watang Sawitto, Pinrang';
  const alleyDetail =
    mapState?.alleyDetail ??
    checkoutState?.alleyDetail ??
    'Lorong 2, Rumah Pagar Hijau';
  const landmark =
    mapState?.landmark ??
    checkoutState?.landmark ??
    'Dekat Masjid Agung Al-Munawwir';

  // Zero rubber-band lag: continuous rAF scroll is 0ms instant; discrete menu-card snaps are razor-crisp 150ms
  const scrollTransitionClass = 'transition-none';
  const catalogScrollTransitionClass =
    !instantMotion && (highlightedMenuId || autoCatalogScrollY !== null)
      ? 'transition-transform duration-150 ease-out'
      : 'transition-none';

  const safeScrollY = Math.max(0, Number.isFinite(scrollY) ? scrollY : 0);

  const heroBrandHeading =
    storeConfig.brandName.trim().toUpperCase() === 'NASI KUNING LASINRANG'
      ? 'Nasi Kuning Lasinrang'
      : storeConfig.brandName;

  const sambalTextMap: Record<SambalPreference, string> = {
    campur: 'Pakai Sambal (Campur di Nasi)',
    pisah: 'Sambal Dipisah',
    tanpa: 'Tidak Pakai Sambal',
  };

  const riceTextLabel =
    riceType === 'nasi_putih' ? 'Nasi Putih Hangat' : 'Nasi Kuning Gurih';

  const paymentLabel =
    paymentMethod === 'gopay'
      ? `GoPay (${storeConfig.ewalletNumber})`
      : paymentMethod === 'dana'
      ? `DANA (${storeConfig.ewalletNumber})`
      : 'QRIS GPN Resmi';

  const showHomeOrCatalog =
    activeScreen === 'home' ||
    activeScreen === 'menu-catalog' ||
    activeScreen === 'photo-lightbox';

  const showLightbox =
    activeScreen === 'photo-lightbox' || Boolean(zoomedMenuId);

  const showCheckoutOrPayment =
    activeScreen === 'checkout-modal' || activeScreen === 'payment-section';

  const isTopBarDark =
    showHomeOrCatalog ||
    activeScreen === 'whatsapp-preview' ||
    activeScreen === 'outro-card';

  // Auto-center ANY of the 12 spoken menu cards + Bakwan Goreng or Home Sections inside the viewport
  useLayoutEffect(() => {
    if (!showHomeOrCatalog) {
      setAutoCatalogScrollY(null);
      return;
    }
    const innerEl = catalogScrollInnerRef.current;
    if (!innerEl || scale <= 0.05) return;

    // 1. Spoken menu card auto-center in catalog
    if (activeScreen !== 'home' && highlightedMenuId) {
      const cardEl = innerEl.querySelector<HTMLElement>(
        `[data-menu-id="${highlightedMenuId}"]`
      );
      if (!cardEl) {
        setAutoCatalogScrollY(null);
        return;
      }
      const innerRect = innerEl.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      const cardOffsetTop = (cardRect.top - innerRect.top) / scale;
      const centeredScroll = Math.max(0, cardOffsetTop - 28);
      setAutoCatalogScrollY(centeredScroll);
      return;
    }

    // 2. Home section target auto-center (QuickOrderHub, Pesan Ulang, Acara & Berkah, 3D Route Tour)
    if (activeScreen === 'home' && activeTargetSelector) {
      const key = normalizeTargetKey(activeTargetSelector);
      const autoScrollHomeKeys = new Set([
        'quick-hub-rekomendasi',
        'quick-hub-tab-ulang',
        'btn-acara-berkah-wa',
        'section-3d-route-tour',
      ]);
      if (autoScrollHomeKeys.has(key)) {
        const targetEl = innerEl.querySelector<HTMLElement>(activeTargetSelector);
        if (targetEl) {
          const innerRect = innerEl.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();
          const offsetTop = (targetRect.top - innerRect.top) / scale;
          const targetHeight = targetRect.height / scale;
          const desiredTop = Math.max(44, Math.min(170, (540 - targetHeight) / 2));
          setAutoCatalogScrollY(Math.max(0, offsetTop - desiredTop));
          return;
        }
      }
    }

    setAutoCatalogScrollY(null);
  }, [
    showHomeOrCatalog,
    activeScreen,
    highlightedMenuId,
    activeTargetSelector,
    activeCategory,
    scale,
    filteredMenus.length,
  ]);

  const effectiveCatalogScrollY =
    autoCatalogScrollY !== null ? autoCatalogScrollY : safeScrollY;

  // Auto-center active interactive targets inside PortionModal, Checkout/Payment, & MapPicker
  useLayoutEffect(() => {
    if (scale <= 0.05 || !activeTargetSelector) {
      setAutoBodyScrollY(null);
      return;
    }

    const innerEl =
      activeScreen === 'portion-modal'
        ? portionScrollInnerRef.current
        : showCheckoutOrPayment
        ? checkoutScrollInnerRef.current
        : activeScreen === 'map-picker'
        ? mapScrollInnerRef.current
        : null;

    if (!innerEl) {
      setAutoBodyScrollY(null);
      return;
    }

    const key = normalizeTargetKey(activeTargetSelector);
    const manualScrollKeys = new Set([
      'btn-masukkan-pesanan',
      'btn-periksa-pratinjau',
      'checkout-fulfillment-section',
      'checkout-payment-section',
      'map-picker-canvas',
      'map-green-pin',
    ]);
    if (manualScrollKeys.has(key)) {
      setAutoBodyScrollY(null);
      return;
    }

    const targetEl = innerEl.querySelector<HTMLElement>(activeTargetSelector);
    if (!targetEl) {
      setAutoBodyScrollY(null);
      return;
    }

    const innerRect = innerEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const targetOffsetTop = (targetRect.top - innerRect.top) / scale;
    const targetHeight = targetRect.height / scale;

    const desiredTopInBody = Math.max(76, Math.min(210, (460 - targetHeight) / 2));
    const centered = Math.max(0, targetOffsetTop - desiredTopInBody);
    setAutoBodyScrollY(centered);
  }, [
    activeScreen,
    showCheckoutOrPayment,
    activeTargetSelector,
    scale,
    portionState?.portionMode,
    portionState?.quantity,
    portionState?.bakwanQty,
    portionState?.toppingScope,
    checkoutState?.fulfillment,
    checkoutState?.paymentMethod,
  ]);

  const effectiveBodyScrollY =
    autoBodyScrollY !== null ? autoBodyScrollY : safeScrollY;
  const bodySnapTransitionClass =
    !instantMotion && autoBodyScrollY !== null
      ? 'transition-transform duration-150 ease-out'
      : scrollTransitionClass;

  const hasCursor = cursorPos !== null;

  // Auto-target VirtualTouchCursor to the EXACT rendered pixel center of active interactive targets
  useLayoutEffect(() => {
    if (
      !hasCursor ||
      mapState?.isDraggingPin ||
      !activeTargetSelector ||
      !stageViewportRef.current ||
      scale <= 0.05
    ) {
      setMeasuredCursorPos((prev) => (prev === null ? prev : null));
      return;
    }

    const normalizedKey = normalizeTargetKey(activeTargetSelector);
    const nonPointTargets = new Set([
      'menu-grid-all',
      'katalog-menu',
      'order-preview-summary',
      'outro-closing-card',
      'map-picker-canvas',
      'checkout-fulfillment-section',
      'checkout-payment-section',
      'hero-brand',
      'quick-hub-rekomendasi',
      'catalog-sides-banner',
      'section-3d-route-tour',
    ]);
    if (nonPointTargets.has(normalizedKey)) {
      setMeasuredCursorPos(null);
      return;
    }

    const stageEl = stageViewportRef.current;
    const targetEl = stageEl.querySelector<HTMLElement>(activeTargetSelector);
    if (!targetEl) {
      setMeasuredCursorPos(null);
      return;
    }

    const stageRect = stageEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    if (targetRect.width <= 0 || targetRect.height <= 0) {
      setMeasuredCursorPos(null);
      return;
    }

    const cx = (targetRect.left + targetRect.width / 2 - stageRect.left) / scale;
    let cy = (targetRect.top + targetRect.height / 2 - stageRect.top) / scale;

    const activeScrollInner = showHomeOrCatalog
      ? catalogScrollInnerRef.current
      : activeScreen === 'portion-modal'
      ? portionScrollInnerRef.current
      : showCheckoutOrPayment
      ? checkoutScrollInnerRef.current
      : activeScreen === 'map-picker'
      ? mapScrollInnerRef.current
      : null;

    if (
      activeScrollInner &&
      activeScrollInner.contains(targetEl) &&
      activeScrollInner.parentElement
    ) {
      const parentRect = activeScrollInner.parentElement.getBoundingClientRect();
      const innerRect = activeScrollInner.getBoundingClientRect();
      const activeScrollPx = showHomeOrCatalog
        ? effectiveCatalogScrollY
        : effectiveBodyScrollY;
      const parentTopInStage = (parentRect.top - stageRect.top) / scale;
      const targetOffsetInInner = (targetRect.top - innerRect.top) / scale;
      const targetHeightInStage = targetRect.height / scale;
      cy =
        parentTopInStage +
        targetOffsetInInner -
        activeScrollPx +
        targetHeightInStage / 2;
    }

    if (cy >= 44 && cy <= TUTORIAL_VIRTUAL_HEIGHT - 24) {
      const nextX = Math.max(16, Math.min(TUTORIAL_VIRTUAL_WIDTH - 16, cx));
      const nextY = Math.max(48, Math.min(TUTORIAL_VIRTUAL_HEIGHT - 24, cy));
      setMeasuredCursorPos((prev) =>
        prev && Math.abs(prev.x - nextX) < 0.5 && Math.abs(prev.y - nextY) < 0.5
          ? prev
          : { x: nextX, y: nextY }
      );
    } else {
      setMeasuredCursorPos((prev) => (prev === null ? prev : null));
    }
  }, [
    activeScreen,
    activeTargetSelector,
    highlightedMenuId,
    effectiveCatalogScrollY,
    effectiveBodyScrollY,
    safeScrollY,
    isClicking,
    zoomedMenuId,
    scale,
    mapState?.isDraggingPin,
    hasCursor,
  ]);

  const resolvedCursorPos =
    cursorPos === null ? null : measuredCursorPos || cursorPos;

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full h-full overflow-hidden select-none flex items-center justify-center ${
        isTopBarDark ? 'bg-[#063825]' : 'bg-[#F7F3E9]'
      } ${className}`}
    >
      {/* Native 4K Vector/Retina DPI Virtual Mobile Viewport (CSS zoom prevents offscreen bitmap downscale blur) */}
      <div
        ref={stageViewportRef}
        className="tutorial-crisp-stage relative shrink-0 overflow-hidden shadow-none"
        style={
          supportsCssZoom
            ? {
                width: `${TUTORIAL_VIRTUAL_WIDTH}px`,
                height: `${TUTORIAL_VIRTUAL_HEIGHT}px`,
                zoom: scale,
              }
            : {
                width: `${TUTORIAL_VIRTUAL_WIDTH}px`,
                height: `${TUTORIAL_VIRTUAL_HEIGHT}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
              }
        }
      >
        {/* ===============================================================
            LAYAR 1: BERANDA & KATALOG MENU (1:1 ROYAL BUGIS EMERALD & GOLD + WARM IVORY App.tsx)
           =============================================================== */}
        {showHomeOrCatalog && (
          <div className="relative w-full h-full bg-[#FDFBF7] text-[#1F1814] flex flex-col">
            {/* Safe Top Bar Spacer for iPhone 18 Pro Dynamic Island */}
            <div className="h-[38px] shrink-0 bg-[#063825]" aria-hidden="true" />

            {/* Sticky Website Top Header (100% Identical Royal Bugis Emerald & Gold Header from App.tsx) */}
            <header className="shrink-0 z-30 bg-header-royal-bugis px-2">
              <div className="bg-bugis-woven-band -mx-2" aria-hidden="true" />
              <div className="flex items-center justify-between gap-1.5 px-2.5 py-2 my-1.5 rounded-2xl bg-header-royal-inner relative overflow-hidden">
                {/* Brand Left: Official Emblem + Lontara Bugis + Brand Name */}
                <div className="min-w-0 max-w-[162px] flex items-center gap-2 text-left">
                  <img
                    src={OFFICIAL_LOGO_URL}
                    alt="Logo Resmi Nasi Kuning Lasinrang"
                    className="w-8 h-8 rounded-full object-contain shrink-0 bg-white ring-2 ring-[#F3C969] shadow-md"
                    draggable={false}
                  />
                  <div className="min-w-0">
                    <span className="block text-[8px] font-bold tracking-[0.12em] uppercase text-[#FFD24C] leading-none mb-0.5 truncate">
                      ✦ ᨊᨔᨗ ᨀᨘᨊᨗ ᨒᨔᨗᨑ ✦
                    </span>
                    <span className="truncate block text-xs font-bold tracking-tight text-white font-serif-display leading-tight">
                      {heroBrandHeading}
                    </span>
                  </div>
                </div>

                {/* Right Action Buttons: Instal App + Pesan + Hamburger */}
                <div className="flex items-center gap-1 shrink-0">
                  {!isAppInstalled && (
                    <div
                      data-tutorial="btn-install-app"
                      className={`min-h-[34px] px-2.5 py-1 rounded-full bg-[#193D2B] text-[#F3C969] fx-2d-dark-chip text-[10.5px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 ${getInteractiveStateClass(
                        activeTargetSelector,
                        'btn-install-app',
                        isClicking
                      )}`}
                    >
                      <Download className="w-3 h-3 text-[#F3C969] shrink-0" />
                      <span>Instal App</span>
                    </div>
                  )}

                  <div className="min-h-[34px] px-2.5 py-1 rounded-full text-[10.5px] font-extrabold flex items-center gap-1 whitespace-nowrap shrink-0 shadow-md border bg-gradient-to-r from-[#FFC72C] to-[#FFD24C] text-[#051F14] border-white/60">
                    <ShoppingBag className="w-3 h-3 shrink-0 text-[#064E3B]" />
                    <span>Pesan</span>
                  </div>

                  <div className="w-[34px] h-[34px] rounded-full bg-[#042417]/90 border border-[#FFD24C]/65 text-[#FFD24C] flex items-center justify-center shrink-0">
                    <MenuIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </header>

            {/* Scrollable Body Driven Smoothly by exact Audio/DOM scrollY */}
            <div className="relative flex-1 overflow-hidden">
              <div
                ref={catalogScrollInnerRef}
                className={`w-full ${catalogScrollTransitionClass}`}
                style={{
                  transform: `translate3d(0, -${effectiveCatalogScrollY}px, 0)`,
                }}
              >
                {/* HERO SECTION (100% 1:1 Royal Bugis Emerald & Gold Sanctuary from App.tsx) */}
                {activeScreen === 'home' && (
                  <section className="relative bg-royal-bugis-hero pt-4 pb-7 border-b-2 border-[#D9A52E]/45 overflow-hidden">
                    <div
                      className="pointer-events-none absolute -top-6 -right-8 opacity-20"
                      aria-hidden="true"
                    >
                      <BananaLeafOrnament className="w-36 h-36 rotate-12" />
                    </div>
                    <div
                      className="pointer-events-none absolute bottom-4 -left-8 opacity-20"
                      aria-hidden="true"
                    >
                      <SpiceBotanicalOrnament className="w-32 h-32" />
                    </div>

                    <div className="px-3.5 space-y-4 relative z-10">
                      {/* Adat Bugis Lontara Royal Crest Badge + Brand Headline */}
                      <div
                        data-tutorial="hero-brand"
                        className={`space-y-3 rounded-2xl p-1 -m-1 ${getInteractiveStateClass(
                          activeTargetSelector,
                          'hero-brand',
                          isClicking
                        )}`}
                      >
                        <div className="inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#084C32] border border-[#FFD24C]/75 shadow-[0_4px_18px_rgba(255,210,76,0.25)]">
                          <span className="text-[11px] font-bold tracking-[0.14em] text-[#FFD24C]">
                            ✦ ᨊᨔᨗ ᨀᨘᨊᨗ ᨒᨔᨗᨑ ✦
                          </span>
                          <span className="w-1 h-1 rounded-full bg-[#FFD24C]" />
                          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
                            Warisan Kuliner Adat Bugis · Pinrang
                          </span>
                        </div>

                        <div
                          data-tutorial="hero-hours"
                          className={`text-xs font-bold text-[#FFD24C] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-xl p-1 -m-1 ${getInteractiveStateClass(
                            activeTargetSelector,
                            'hero-hours',
                            isClicking
                          )}`}
                        >
                          <span>Depan Patung Lasinrang, Pinrang</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-white">{storeConfig.operatingHours}</span>
                        </div>

                        <div className="space-y-1.5">
                          <h1 className="text-[30px] font-extrabold font-serif-display leading-[1.08] tracking-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.55)]">
                            NASI KUNING{' '}
                            <span className="text-gold-luminous block">
                              LASINRANG
                            </span>
                          </h1>
                          <NusantaraSectionDivider className="max-w-[240px] opacity-100 pt-0.5" />
                        </div>

                        <p className="text-xs font-serif-display italic font-semibold text-[#FFD24C]">
                          “Malunra Tongeng, Marasa na Masempo — Adat Sipakalebbi ri Bumi Lasinrang”
                        </p>

                        <p className="text-xs text-white leading-relaxed font-medium">
                          Nasi kuning santan kunyit asli yang ditanak dengan tradisi dapur Bugis Pinrang, disajikan hangat setiap malam bersama 12 pilihan lauk komplit mulai Bebek Palekko Bugis, Cumi Tinta Hitam, Udang Saos Asam Manis, Ayam Bakar, hingga Bakwan Goreng Renyah.
                        </p>
                      </div>

                      {/* 3-Pillar Falsafah Adat Bugis Strip (1:1 App.tsx) */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-[#073B27] fx-2d-dark-chip p-2 text-center">
                          <span className="block text-[10px] font-bold text-[#FFD24C] tracking-widest">
                            ᨄᨒᨛᨀᨚ
                          </span>
                          <span className="block text-[11px] font-extrabold text-white mt-0.5">
                            Rempah Bugis
                          </span>
                          <span className="block text-[9.5px] font-medium text-[#FFD24C]">
                            Bumbu Palekko
                          </span>
                        </div>
                        <div className="rounded-2xl bg-[#073B27] fx-2d-dark-chip p-2 text-center">
                          <span className="block text-[10px] font-bold text-[#FFD24C] tracking-widest">
                            ᨊᨔᨗ ᨀᨘᨊᨗ
                          </span>
                          <span className="block text-[11px] font-extrabold text-white mt-0.5">
                            Santan Kunyit
                          </span>
                          <span className="block text-[9.5px] font-medium text-[#FFD24C]">
                            Kukusan Hangat
                          </span>
                        </div>
                        <div className="rounded-2xl bg-[#073B27] fx-2d-dark-chip p-2 text-center">
                          <span className="block text-[10px] font-bold text-[#FFD24C] tracking-widest">
                            ᨔᨗᨄᨀᨒᨛᨅᨗ
                          </span>
                          <span className="block text-[11px] font-extrabold text-white mt-0.5">
                            Sipakalebbi
                          </span>
                          <span className="block text-[9.5px] font-medium text-[#FFD24C]">
                            Pelayanan Ramah
                          </span>
                        </div>
                      </div>

                      {/* Primary Hero CTAs (Lihat Menu, Pesan Sekarang, Instal Aplikasi di HP, Panduan) */}
                      <div
                        data-tutorial="hero-cta-menu"
                        className={`space-y-2 rounded-2xl p-1 -m-1 ${getInteractiveStateClass(
                          activeTargetSelector,
                          'hero-cta-menu',
                          isClicking
                        )}`}
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <div className="min-h-[42px] px-3 py-2.5 rounded-2xl bg-[#FFC72C] text-[#051F14] fx-2d-gold font-extrabold text-xs flex items-center justify-center gap-1.5">
                            <Utensils className="w-4 h-4 shrink-0" />
                            <span>Lihat Menu</span>
                          </div>
                          <div className="min-h-[42px] px-3 py-2.5 rounded-2xl bg-[#D91B24] text-white fx-2d-crimson font-extrabold text-xs flex items-center justify-center gap-1.5">
                            <ShoppingBag className="w-4 h-4 shrink-0 text-[#FFD24C]" />
                            <span>Pesan Sekarang</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isAppInstalled && (
                            <div className="flex-1 min-h-[40px] px-3 py-2 rounded-2xl bg-[#193D2B] text-[#F3C969] fx-2d-dark-chip font-bold text-xs flex items-center justify-center gap-1.5">
                              <Download className="w-3.5 h-3.5 text-[#F3C969] shrink-0" />
                              <span>Instal Aplikasi di HP</span>
                            </div>
                          )}
                          <div className="flex-1 min-h-[40px] px-3 py-2 rounded-2xl bg-[#073B27] text-white fx-2d-dark-chip font-bold text-xs flex items-center justify-center gap-1.5 shrink-0">
                            <Play className="w-3.5 h-3.5 text-[#FFD24C] fill-[#FFD24C]" />
                            <span>Panduan</span>
                          </div>
                        </div>
                      </div>

                      {/* Flagship Uncropped 3:4 Portrait Poster Showcase (1:1 App.tsx) */}
                      <div
                        data-tutorial="hero-photo-zoom"
                        className={`rounded-3xl menu-card-3d-dark ${getInteractiveStateClass(
                          activeTargetSelector,
                          'hero-photo-zoom',
                          isClicking
                        )}`}
                      >
                        <div className="relative aspect-[3/4] w-full menu-poster-3d-frame overflow-hidden border-b border-[#FFD24C]/45">
                          <FoodImage
                            src={palekkoItem.imageUrl}
                            alt={palekkoItem.name}
                            fit="poster"
                            eager
                          />
                          <div
                            className="absolute bottom-3 right-3 z-20 w-9 h-9 rounded-full bg-black/75 border border-[#FFD24C]/70 text-white flex items-center justify-center shadow-lg"
                            aria-hidden="true"
                          >
                            <Maximize2 className="w-4 h-4 text-[#FFD24C]" />
                          </div>
                        </div>
                        <div className="p-3.5 bg-[#052E1E]/95 border-t border-[#FFD24C]/45 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[#FFD24C] block">
                              Andalan Utama Adat Bugis
                            </span>
                            <div className="text-sm font-bold font-serif-display text-white truncate">
                              {palekkoItem.name}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-extrabold font-mono-tabular text-[#FFD24C]">
                              {formatRupiah(palekkoItem.basePrice)}
                            </span>
                            <span className="px-3 py-2 rounded-xl bg-[#FFC72C] text-[#051F14] fx-2d-gold text-[11px] font-extrabold">
                              Pesan Sekarang
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2x2 Mini Portrait Poster Gallery (3 Menu Baru + Bakwan Goreng Renyah) */}
                      <div className="grid grid-cols-2 gap-2.5">
                        {newMenus.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl menu-mini-3d-card flex flex-col"
                          >
                            <div className="relative aspect-[3/4] w-full menu-poster-3d-frame overflow-hidden border-b border-[#FFD24C]/35">
                              <FoodImage
                                src={item.imageUrl}
                                alt={item.name}
                                fit="poster"
                              />
                            </div>
                            <div className="p-2.5 bg-[#052E1E]/95 border-t border-[#FFD24C]/35 flex-1 flex flex-col justify-between gap-1">
                              <div>
                                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#FFD24C] block">
                                  Menu Baru
                                </span>
                                <div className="text-[11px] font-bold font-serif-display text-white leading-snug line-clamp-1">
                                  {item.name}
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] font-extrabold font-mono-tabular text-[#FFD24C]">
                                  {formatRupiah(item.basePrice)}
                                </span>
                                <span className="text-[10px] font-extrabold text-white underline">
                                  Pesan →
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {bakwanTopping && (
                          <div className="rounded-2xl menu-mini-3d-card flex flex-col">
                            <div className="relative aspect-[3/4] w-full menu-poster-3d-frame overflow-hidden border-b border-[#FFD24C]/35">
                              {bakwanTopping.imageUrl && (
                                <FoodImage
                                  src={bakwanTopping.imageUrl}
                                  alt={bakwanTopping.name}
                                  fit="poster"
                                />
                              )}
                            </div>
                            <div className="p-2.5 bg-[#052E1E] border-t border-[#FFD24C]/35 flex-1 flex flex-col justify-between gap-1">
                              <div>
                                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#FFD24C] block">
                                  Toping Favorit
                                </span>
                                <div className="text-[11px] font-bold font-serif-display text-white leading-snug line-clamp-1">
                                  {bakwanTopping.name}
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] font-extrabold font-mono-tabular text-[#FFD24C]">
                                  +{formatRupiah(bakwanTopping.price)}
                                </span>
                                <span className="text-[10px] font-extrabold text-white underline">
                                  Tambah →
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* CATALOG SECTION (100% 1:1 Warm Ivory Editorial #FDFBF7 + Uncropped 3:4 Portrait Posters from App.tsx) */}
                <section
                  id="katalog-menu"
                  className="bg-[#FDFBF7] px-3.5 py-6 space-y-5 border-b border-[#FFC72C]/35"
                >
                  {/* Editorial Section Header */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#B87300] block">
                        ✦ Katalog Resmi {storeConfig.brandName} · {displayMenuCount} Menu + Toping Bakwan ✦
                      </span>
                      <h2 className="text-2xl font-bold font-serif-display text-[#064E3B] leading-[1.12]">
                        Daftar Menu Lengkap &amp; Harga Resmi
                      </h2>
                      <p
                        data-tutorial="catalog-sides-banner"
                        className={`text-xs font-medium text-[#241C17] leading-relaxed rounded-xl p-1 -m-1 ${getInteractiveStateClass(
                          activeTargetSelector,
                          'catalog-sides-banner',
                          false
                        )}`}
                      >
                        Setiap porsi sudah termasuk Nasi Kuning Harum (atau Nasi Putih), Lauk Utama Pilihan, Tempe Manis Gurih, Mie Goreng Kecap, dan Kerupuk Renyah. Ketuk foto untuk memperbesar atau klik Pesan Sekarang.
                      </p>
                    </div>

                    {/* Segmented Filter Control (1:1 App.tsx #FAF5E8 + #084C32 active) */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 p-1.5 bg-[#FAF5E8] border border-[#FFC72C]/45 rounded-2xl gap-1.5">
                        <div
                          className={`px-3 py-2 rounded-xl text-xs font-extrabold text-center ${
                            activeCategory === 'all'
                              ? 'bg-[#084C32] text-[#FFD24C] fx-2d-forest'
                              : 'bg-white text-[#1F1814] fx-2d-ivory'
                          }`}
                        >
                          Semua ({displayMenuCount})
                        </div>
                        <div
                          data-tutorial="filter-spesial"
                          className={`px-3 py-2 rounded-xl text-xs font-extrabold text-center ${
                            activeCategory === 'spesial'
                              ? 'bg-[#084C32] text-[#FFD24C] fx-2d-forest'
                              : 'bg-white text-[#1F1814] fx-2d-ivory'
                          } ${getInteractiveStateClass(
                            activeTargetSelector,
                            'filter-spesial',
                            isClicking
                          )}`}
                        >
                          Spesial (3)
                        </div>
                        <div
                          data-tutorial="filter-reguler"
                          className={`px-3 py-2 rounded-xl text-xs font-extrabold text-center ${
                            activeCategory === 'reguler'
                              ? 'bg-[#084C32] text-[#FFD24C] fx-2d-forest'
                              : 'bg-white text-[#1F1814] fx-2d-ivory'
                          } ${getInteractiveStateClass(
                            activeTargetSelector,
                            'filter-reguler',
                            isClicking
                          )}`}
                        >
                          Reguler (9)
                        </div>
                        <div
                          className={`px-3 py-2 rounded-xl text-xs font-extrabold text-center ${
                            activeCategory === 'baru'
                              ? 'bg-[#084C32] text-[#FFD24C] fx-2d-forest'
                              : 'bg-white text-[#1F1814] fx-2d-ivory'
                          }`}
                        >
                          Menu Baru
                        </div>
                      </div>

                      <div className="w-full py-2 px-3 rounded-xl bg-white text-[#064E3B] fx-2d-ivory text-xs font-extrabold flex items-center justify-center gap-1.5">
                        <Copy className="w-3.5 h-3.5 text-[#B87300]" />
                        <span>Salin Daftar Menu</span>
                      </div>
                    </div>
                  </div>

                  {/* 1:1 Editorial Plate Menu Cards with Uncropped 3:4 Portrait Poster Stage */}
                  <div data-tutorial="menu-grid-all" className="space-y-4">
                    {filteredMenus.map((item, idx) => {
                      const isPrimaryCard = highlightedMenuId
                        ? item.id === highlightedMenuId
                        : idx === 0;
                      const isSpotlightedMenu =
                        Boolean(highlightedMenuId) && item.id === highlightedMenuId;
                      const isNew = isNewMenuEntry(item);
                      return (
                        <article
                          key={item.id}
                          data-menu-id={item.id}
                          data-tutorial={isPrimaryCard ? 'menu-card-primary' : undefined}
                          className={`editorial-plate flex flex-col justify-between transition-all duration-150 ${
                            isSpotlightedMenu
                              ? 'ring-[3px] ring-[#084C32] shadow-[0_0_28px_rgba(8,76,50,0.35)]'
                              : isPrimaryCard
                              ? getInteractiveStateClass(
                                  activeTargetSelector,
                                  'menu-card-primary',
                                  false
                                )
                              : ''
                          }`}
                        >
                          <div>
                            {/* Full 3:4 Portrait Poster Container — Zero Crop */}
                            <div className="relative aspect-[3/4] w-full overflow-hidden menu-poster-3d-frame border-b border-[#FFC72C]/45">
                              <FoodImage
                                src={item.imageUrl}
                                alt={item.name}
                                fit="poster"
                                eager
                              />

                              {isSpotlightedMenu && highlightedMenuBadge && (
                                <span className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-[#084C32]/95 text-[#FFD24C] border border-[#FFD24C] text-[10px] font-extrabold uppercase tracking-wider shadow-lg">
                                  {highlightedMenuBadge}
                                </span>
                              )}

                              <div
                                data-tutorial={isPrimaryCard ? 'btn-tap-zoom' : undefined}
                                className={`absolute bottom-3 right-3 z-20 w-8 h-8 rounded-full bg-black/75 text-white border border-[#FFD24C]/65 flex items-center justify-center shadow-md ${
                                  isPrimaryCard
                                    ? getInteractiveStateClass(
                                        activeTargetSelector,
                                        'btn-tap-zoom',
                                        isClicking
                                      )
                                    : ''
                                }`}
                              >
                                <Maximize2 className="w-3.5 h-3.5 text-[#FFD24C]" />
                              </div>
                            </div>

                            {/* Card Body (1:1 App.tsx) */}
                            <div className="p-4 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                    item.category === 'spesial'
                                      ? 'bg-[#084C32] text-[#FFD24C]'
                                      : isNew
                                      ? 'bg-[#D91B24] text-white'
                                      : 'bg-[#FAF5E8] text-[#064E3B] border border-[#FFC72C]/55'
                                  }`}
                                >
                                  {item.category === 'spesial'
                                    ? 'Menu Spesial'
                                    : isNew
                                    ? 'Menu Baru'
                                    : 'Menu Reguler'}
                                </span>
                                <span className="text-[11px] font-bold text-[#B87300]">
                                  {item.spiceLevel}
                                </span>
                              </div>

                              <h3 className="text-lg font-bold font-serif-display text-[#064E3B] leading-snug">
                                {item.name}
                              </h3>

                              <div className="text-[11px] text-[#3D3028] font-semibold leading-relaxed">
                                <strong className="text-[#064E3B]">Komplit: </strong>
                                {item.sidesIncluded.join(' · ')}
                              </div>
                            </div>
                          </div>

                          {/* Card Footer: Price & Pesan Sekarang CTA */}
                          <div className="px-4 py-3.5 bg-[#FDFBF7] border-t border-[#FFC72C]/35 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-[#3D3028] block">
                                Porsi Komplit
                              </span>
                              <span className="text-base font-extrabold font-mono-tabular text-[#064E3B]">
                                {formatRupiah(item.basePrice)}
                              </span>
                            </div>

                            <div
                              data-tutorial={
                                isPrimaryCard ? 'btn-pesan-sekarang' : undefined
                              }
                              className={`min-h-[38px] px-3.5 py-2 rounded-xl bg-[#084C32] text-white fx-2d-forest font-extrabold text-xs flex items-center gap-1.5 whitespace-nowrap ${
                                isPrimaryCard
                                  ? getInteractiveStateClass(
                                      activeTargetSelector,
                                      'btn-pesan-sekarang',
                                      isClicking
                                    )
                                  : ''
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5] text-[#FFD24C]" />
                              <span>Pesan Sekarang</span>
                            </div>
                          </div>
                        </article>
                      );
                    })}

                    {/* Dedicated Toping Tambahan Card: Bakwan Goreng Renyah Rp 1.000 (1:1 App.tsx) */}
                    {bakwanTopping && (
                      <article
                        data-menu-id="bakwan-goreng"
                        className={`editorial-plate flex flex-col justify-between transition-all duration-150 ${
                          highlightedMenuId === 'bakwan-goreng'
                            ? 'ring-[3px] ring-[#D91B24] shadow-[0_0_28px_rgba(217,27,36,0.35)]'
                            : ''
                        }`}
                      >
                        <div>
                          <div className="relative aspect-[3/4] w-full overflow-hidden menu-poster-3d-frame border-b border-[#FFC72C]/45">
                            {bakwanTopping.imageUrl && (
                              <FoodImage
                                src={bakwanTopping.imageUrl}
                                alt={bakwanTopping.name}
                                fit="poster"
                              />
                            )}
                            {highlightedMenuId === 'bakwan-goreng' &&
                              highlightedMenuBadge && (
                                <span className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-[#D91B24]/95 text-white border border-[#FFD24C] text-[10px] font-extrabold uppercase tracking-wider shadow-lg">
                                  {highlightedMenuBadge}
                                </span>
                              )}
                          </div>
                          <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-[#D91B24] text-white text-[10px] font-extrabold uppercase tracking-wider">
                                Toping Favorit
                              </span>
                              <span className="text-[11px] font-bold text-[#B87300]">
                                Hangat &amp; Renyah
                              </span>
                            </div>
                            <h3 className="text-lg font-bold font-serif-display text-[#064E3B] leading-snug">
                              {bakwanTopping.name}
                            </h3>
                            <p className="text-[11px] text-[#3D3028] font-semibold leading-relaxed">
                              Sayur kol &amp; wortel segar digoreng garing hangat. Bebas tambah untuk semua porsi atau sebagian porsi saja.
                            </p>
                          </div>
                        </div>
                        <div className="px-4 py-3.5 bg-[#FDFBF7] border-t border-[#FFC72C]/35 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-[#3D3028] block">
                              Harga Satuan
                            </span>
                            <span className="text-base font-extrabold font-mono-tabular text-[#D91B24]">
                              +{formatRupiah(bakwanTopping.price)}
                            </span>
                          </div>
                          <div className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#D91B24] text-white fx-2d-crimson font-extrabold text-xs flex items-center gap-1.5 whitespace-nowrap">
                            <Plus className="w-3.5 h-3.5 stroke-[2.5] text-[#FFD24C]" />
                            <span>Pesan + Bakwan</span>
                          </div>
                        </div>
                      </article>
                    )}
                  </div>
                </section>

                {/* QUICK ORDER HUB & PESAN ACARA & JUM'AT BERKAH (1:1 QuickOrderHub.tsx & App.tsx) */}
                {activeScreen === 'home' && (
                  <section className="bg-[#FAF5E8] px-3.5 py-6 space-y-5 border-b border-[#FFC72C]/35">
                    {/* 1:1 QuickOrderHub White Card */}
                    <div
                      data-tutorial="quick-hub-rekomendasi"
                      className={`bg-white rounded-3xl border border-[#FFC72C]/45 p-4 space-y-4 shadow-[0_20px_50px_-24px_rgba(6,78,59,0.18)] ${getInteractiveStateClass(
                        activeTargetSelector,
                        'quick-hub-rekomendasi',
                        false
                      )}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[#B87300] block">
                            Pesan Instan 1-Klik
                          </span>
                          <h2 className="text-lg font-bold font-serif-display text-[#064E3B] leading-tight">
                            Rekomendasi Menu dari Kami &amp; Pesan Ulang
                          </h2>
                        </div>
                        <span className="text-[10px] font-bold text-[#084C32] shrink-0">
                          Siap Saji · Hangat
                        </span>
                      </div>

                      {/* Segmented Tab Bar */}
                      <div className="grid grid-cols-2 p-1.5 bg-[#FAF5E8] border border-[#FFC72C]/35 rounded-2xl gap-1.5">
                        <div
                          className={`py-2 px-2.5 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 ${
                            quickHubTab === 'top'
                              ? 'bg-[#084C32] text-[#FFD24C] fx-2d-forest'
                              : 'bg-white text-[#1F1814] fx-2d-ivory'
                          }`}
                        >
                          <Flame className="w-3.5 h-3.5 text-[#D91B24] shrink-0" />
                          <span className="truncate">Rekomendasi Menu</span>
                        </div>

                        <div
                          data-tutorial="quick-hub-tab-ulang"
                          className={`py-2 px-2.5 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 ${
                            quickHubTab === 'ulang'
                              ? 'bg-[#084C32] text-[#FFD24C] fx-2d-forest'
                              : 'bg-white text-[#1F1814] fx-2d-ivory'
                          } ${getInteractiveStateClass(
                            activeTargetSelector,
                            'quick-hub-tab-ulang',
                            isClicking
                          )}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                          <span>Pesan Ulang</span>
                        </div>
                      </div>

                      {/* Tab Content */}
                      {quickHubTab === 'top' ? (
                        <div className="divide-y divide-[#064E3B]/10">
                          {recommendedMenus.map((item, rIdx) => {
                            const meta =
                              rIdx === 0
                                ? { badge: 'Rekomendasi Utama', like: '96% suka' }
                                : rIdx === 1
                                ? { badge: 'Pedas Segar', like: '91% suka' }
                                : { badge: 'Bumbu Meresap', like: '88% suka' };
                            return (
                              <div
                                key={item.id}
                                className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-2.5"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-14 h-20 rounded-xl bg-hd-poster-stage border border-[#FFC72C]/45 menu-poster-3d-frame overflow-hidden shrink-0">
                                    <FoodImage
                                      src={item.imageUrl}
                                      alt={item.name}
                                      fit="poster"
                                    />
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      <span className="font-extrabold text-[#B87300]">
                                        {meta.badge}
                                      </span>
                                      <span aria-hidden="true" className="text-[#3D3028]/40">
                                        ·
                                      </span>
                                      <span className="text-[#084C32] font-bold">
                                        {meta.like}
                                      </span>
                                    </div>
                                    <h3 className="text-xs font-bold font-serif-display text-[#064E3B] truncate">
                                      {item.name}
                                    </h3>
                                    <div className="text-xs font-extrabold font-mono-tabular text-[#D91B24]">
                                      {formatRupiah(item.basePrice)}
                                    </div>
                                  </div>
                                </div>
                                <div className="px-3 py-2 rounded-xl bg-[#084C32] text-white fx-2d-forest text-[10.5px] font-extrabold whitespace-nowrap shrink-0">
                                  + Pesan Sekarang
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-2xl bg-[#F7F3E9] border border-[#30251F]/10 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#9A7013]">
                              Pesanan Terakhir Anda
                            </span>
                            <span className="text-[11px] font-bold text-[#193D2B]">
                              2 Porsi Tersimpan
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-[#30251F]">
                            2× Nasi Kuning Bebek Palekko (Porsi Lebih Puas) + 1× Bakwan Goreng
                          </div>
                          <div className="pt-2 border-t border-[#30251F]/10 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] text-[#6E5D53] block">
                                Total Pesanan
                              </span>
                              <span className="text-sm font-bold font-mono-tabular text-[#193D2B]">
                                Rp 37.000
                              </span>
                            </div>
                            <span className="px-3.5 py-2 rounded-xl bg-[#A83A2D] text-white fx-2d-crimson text-[11px] font-bold inline-flex items-center gap-1.5">
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Pesan Ulang Sekarang</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 1:1 Prominent Pesan Acara & Jum'at Berkah Banner (editorial-plate-dark) */}
                    <div className="editorial-plate-dark p-5 border-2 border-[#FFD24C]/75 space-y-3.5">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD24C]/20 border border-[#FFD24C]/65 text-[#FFD24C] text-[10px] font-extrabold uppercase tracking-[0.12em]">
                        <HeartHandshake className="w-3.5 h-3.5 text-[#FFD24C]" />
                        <span>✦ Pesanan Acara, Berkah &amp; Partai Besar ✦</span>
                      </div>

                      <h3 className="text-2xl font-bold font-serif-display text-white leading-[1.12]">
                        Pesan Acara &amp; Jum&apos;at Berkah
                      </h3>

                      <p className="text-xs text-white font-medium leading-relaxed">
                        Kami melayani pesanan partai besar mulai{' '}
                        <strong className="text-[#051F14] font-mono-tabular font-extrabold bg-[#FFD24C] px-2 py-0.5 rounded-lg">
                          Rp 10.000 / porsi
                        </strong>{' '}
                        untuk Jum&apos;at Berkah, Syukuran, Aqiqah, Pengajian, Arisan, hingga Rapat Instansi di Kota Pinrang.
                      </p>

                      <div
                        data-tutorial="btn-acara-berkah-wa"
                        className={`w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#FFC72C] text-[#051F14] fx-2d-gold font-extrabold text-xs flex items-center justify-center gap-2 ${getInteractiveStateClass(
                          activeTargetSelector,
                          'btn-acara-berkah-wa',
                          isClicking
                        )}`}
                      >
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>Konsultasi Pesanan Acara &amp; Partai Besar via WA</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {[
                          'Jum’at Berkah',
                          'Syukuran & Aqiqah',
                          'Pengajian & Arisan',
                          'Rapat Instansi',
                          'Ulang Tahun',
                          'Acara Keluarga',
                        ].map((label) => (
                          <div
                            key={label}
                            className="px-2.5 py-2 rounded-xl bg-[#073B27] border border-[#FFD24C]/40 fx-2d-dark-chip text-white font-extrabold text-[10.5px] flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5 text-[#FFD24C] shrink-0" />
                            <span className="truncate">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* 1:1 TUR VIDEO RUTE 3D & LOKASI LAPAK SECTION (Rendered on home screen) */}
                {activeScreen === 'home' && (
                  <section
                    data-tutorial="section-3d-route-tour"
                    className={`bg-[#FDFBF7] px-3.5 py-6 pb-20 space-y-4 ${getInteractiveStateClass(
                      activeTargetSelector,
                      'section-3d-route-tour',
                      false
                    )}`}
                  >
                    <div className="space-y-1">
                      <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#B87300] block">
                        Lokasi Lapak &amp; Navigasi 3D
                      </span>
                      <h2 className="text-2xl font-bold font-serif-display text-[#064E3B] leading-tight">
                        Depan Patung Lasinrang, Pinrang
                      </h2>
                      <p className="text-xs font-medium text-[#241C17]">
                        {storeConfig.locationAddress} · {storeConfig.operatingHours}
                      </p>
                    </div>

                    <div className="editorial-plate p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#9A7013] block">
                            Navigator Satelit 3D Kota Pinrang · Buka 18.30 WITA
                          </span>
                          <h3 className="text-sm font-bold font-serif-display text-[#193D2B]">
                            Panduan Rute 3D Menuju Nasi Kuning Lasinrang
                          </h3>
                        </div>
                        <span className="px-2.5 py-1.5 rounded-xl bg-[#193D2B] text-[#F7F3E9] text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
                          <Play className="w-3 h-3 fill-current" />
                          <span>Tur Rute 3D</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="py-2.5 px-3 rounded-xl bg-[#084C32] text-white fx-2d-forest text-[11px] font-extrabold flex items-center justify-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#FFD24C]" />
                          <span>Hubungi WA Resmi</span>
                        </div>
                        <div className="py-2.5 px-3 rounded-xl bg-[#FAF5E8] text-[#064E3B] fx-2d-ivory text-[11px] font-extrabold flex items-center justify-center gap-1.5">
                          <Navigation className="w-3.5 h-3.5 text-[#084C32]" />
                          <span>Google Maps</span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* MOBILE BOTTOM APP BAR (1:1 Mirror MobileBottomAppBar in PWAInstallModal.tsx) */}
            <nav
              aria-label="Navigasi Cepat Bawah"
              className="shrink-0 z-30 bg-[#06291B] border-t border-[#D9A52E]/50 pb-3 pt-1 px-1 shadow-[0_-10px_28px_rgba(0,0,0,0.42)]"
            >
              <div className="grid grid-cols-5 items-center gap-1">
                <div className="py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[#F7F3E9]/85">
                  <Home className="w-4 h-4 text-[#F3C969]" />
                  <span className="text-[9.5px] font-bold leading-none">Beranda</span>
                </div>
                <div className="py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[#F7F3E9]/85">
                  <Utensils className="w-4 h-4 text-[#F3C969]" />
                  <span className="text-[9.5px] font-bold leading-none">
                    Menu ({displayMenuCount})
                  </span>
                </div>
                {isAppInstalled ? (
                  <div className="py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[#F7F3E9]/85">
                    <Sparkles className="w-4 h-4 text-[#F3C969]" />
                    <span className="text-[9.5px] font-bold leading-none">
                      Spesial
                    </span>
                  </div>
                ) : (
                  <div className="py-1.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-0.5 bg-gradient-to-r from-[#D9A52E] to-[#F3C969] text-[#0D2117] shadow-md">
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span className="text-[9.5px] font-extrabold leading-none">
                      Instal
                    </span>
                  </div>
                )}
                <div className="py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[#F7F3E9]/85">
                  <MapPin className="w-4 h-4 text-[#F3C969]" />
                  <span className="text-[9.5px] font-bold leading-none">Lokasi</span>
                </div>
                <div className="py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[#F7F3E9]/85">
                  <ShoppingBag className="w-4 h-4 text-[#F3C969]" />
                  <span className="text-[9.5px] font-bold leading-none">Keranjang</span>
                </div>
              </div>
            </nav>

            {/* FULLSCREEN PHOTO ZOOM LIGHTBOX OVERLAY (1:1 Mirror App.tsx Lightbox) */}
            {showLightbox && (
              <div className="absolute inset-0 z-50 bg-[#12241A]/94 flex items-center justify-center p-3.5 pt-[44px]">
                <div className="w-full bg-[#F7F3E9] border border-[#30251F]/15 rounded-2xl shadow-2xl overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-white border-b border-[#30251F]/10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-[#193D2B] font-serif-display truncate">
                        {zoomedMenu.name}
                      </h3>
                      <p className="text-[11px] text-[#6E5D53] font-mono-tabular truncate">
                        {zoomedMenu.signatureTag} · {formatRupiah(zoomedMenu.basePrice)}
                      </p>
                    </div>
                    <div
                      data-tutorial="btn-close-zoom"
                      className={`p-2 rounded-xl bg-[#EFE9DC] text-[#193D2B] shrink-0 ${getInteractiveStateClass(
                        activeTargetSelector,
                        'btn-close-zoom',
                        isClicking
                      )}`}
                    >
                      <X className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="p-3 bg-[#EFE9DC]">
                    <div className="relative aspect-[3/4] w-full max-h-[540px] rounded-xl overflow-hidden bg-hd-poster-stage border border-[#D9A52E]/45 menu-poster-3d-frame">
                      <FoodImage
                        src={zoomedMenu.imageUrl}
                        alt={zoomedMenu.name}
                        fit="poster"
                        eager
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===============================================================
            LAYAR 2: PORTION MODAL (1:1 MIRROR PortionModal.tsx — WARM IVORY & FOREST GREEN)
           =============================================================== */}
        {activeScreen === 'portion-modal' && (
          <div className="relative w-full h-full bg-[#F7F3E9] text-[#30251F] flex flex-col">
            {/* Safe Top Bar Spacer for Dynamic Island */}
            <div className="h-[38px] shrink-0 bg-[#F7F3E9]" aria-hidden="true" />

            {/* Sticky Top Header (1:1 PortionModal) */}
            <header className="shrink-0 z-30 bg-[#F7F3E9]/95 border-b border-[#30251F]/10">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-white text-[#193D2B] text-xs font-semibold flex items-center gap-1.5 border border-[#30251F]/12 shadow-2xs shrink-0">
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>Kembali ke Menu</span>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10.5px] font-bold text-[#9A7013] uppercase tracking-wider truncate">
                    Atur Pesanan
                  </div>
                  <div className="text-[11px] text-[#4A3C34] font-medium truncate">
                    {selectedPortionMenu.name}
                  </div>
                </div>
              </div>
            </header>

            {/* Scrollable Body */}
            <div className="relative flex-1 overflow-hidden">
              <div
                ref={portionScrollInnerRef}
                className={`px-3.5 py-4 space-y-4 pb-16 ${bodySnapTransitionClass}`}
                style={{
                  transform: `translate3d(0, -${effectiveBodyScrollY}px, 0)`,
                }}
              >
                {/* Menu Hero Photo Card — Uncropped 3:4 Portrait Poster Stage + Emerald Panel (1:1 PortionModal) */}
                <div className="rounded-3xl menu-card-3d-dark grid grid-cols-12 items-center">
                  <div className="col-span-5 relative aspect-[3/4] w-full menu-poster-3d-frame overflow-hidden border-r border-[#FFD24C]/40">
                    <FoodImage
                      src={selectedPortionMenu.imageUrl}
                      alt={selectedPortionMenu.name}
                      fit="poster"
                      eager
                    />
                  </div>
                  <div className="col-span-7 p-3.5 space-y-2 text-[#F7F3E9]">
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D9A52E]/15 border border-[#D9A52E]/35 text-[#E8C56E] text-[9.5px] font-bold uppercase tracking-wider">
                      {selectedPortionMenu.category === 'spesial'
                        ? 'Menu Spesial'
                        : 'Menu Reguler'}{' '}
                      · {selectedPortionMenu.spiceLevel}
                    </div>
                    <h1 className="text-sm font-bold text-white font-serif-display leading-snug">
                      {selectedPortionMenu.name}
                    </h1>
                    <div className="pt-1.5 border-t border-white/15 flex items-baseline justify-between gap-1">
                      <span className="text-[10px] text-[#F7F3E9]/75 font-medium">
                        Harga Porsi Komplit
                      </span>
                      <span className="text-base font-bold text-[#E8C56E] font-mono-tabular">
                        {formatRupiah(selectedPortionMenu.basePrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Complete Sides Notice (1:1 PortionModal #E9F0EC) */}
                <div className="p-3.5 rounded-xl bg-[#E9F0EC] border border-[#193D2B]/15">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#193D2B] mb-0.5">
                    <Utensils className="w-3.5 h-3.5 shrink-0" />
                    <span>Sudah Termasuk Komplit Dalam 1 Porsi:</span>
                  </div>
                  <p className="text-[11px] text-[#30251F] leading-relaxed">
                    {selectedPortionMenu.sidesIncluded
                      .map((s, idx) =>
                        idx === 0 && /nasi/i.test(s) ? riceTextLabel : s
                      )
                      .join(' · ')}
                  </p>
                </div>

                {/* 1. Rice Type Selector */}
                <div
                  data-tutorial="portion-rice-type"
                  className={`space-y-2 rounded-xl p-1 -m-1 ${getInteractiveStateClass(
                    activeTargetSelector,
                    'portion-rice-type',
                    isClicking
                  )}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#30251F] flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5 text-[#9A7013]" />
                      <span>1. Pilih Jenis Nasi</span>
                    </div>
                    <span className="text-[11px] text-[#193D2B] font-semibold">
                      Sesuai Selera
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        riceType === 'nasi_kuning'
                          ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 shadow-2xs'
                          : 'bg-white/75 border-[#30251F]/12'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-[#193D2B]">
                          Nasi Kuning Gurih
                        </span>
                        {riceType === 'nasi_kuning' && (
                          <Check className="w-3.5 h-3.5 text-[#193D2B]" />
                        )}
                      </div>
                      <div className="text-[10.5px] text-[#6E5D53]">
                        Santan kunyit asli harum
                      </div>
                    </div>
                    <div
                      className={`p-2.5 rounded-xl border ${
                        riceType === 'nasi_putih'
                          ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 shadow-2xs'
                          : 'bg-white/75 border-[#30251F]/12'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-[#193D2B]">
                          Nasi Putih
                        </span>
                        {riceType === 'nasi_putih' && (
                          <Check className="w-3.5 h-3.5 text-[#193D2B]" />
                        )}
                      </div>
                      <div className="text-[10.5px] text-[#6E5D53]">
                        Nasi putih pulen hangat
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Flexible Portion / Budget Selector */}
                <div
                  data-tutorial="portion-presets"
                  className={`space-y-2 rounded-xl p-1 -m-1 ${getInteractiveStateClass(
                    activeTargetSelector,
                    'portion-presets',
                    isClicking
                  )}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#30251F] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#9A7013]" />
                      <span>2. Pilih Porsi / Sesuaikan Budget</span>
                    </div>
                    <span className="text-[11px] text-[#193D2B] font-semibold">
                      Bebas Request
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        mode: 'standard' as const,
                        title: 'Porsi Standar',
                        price: formatRupiah(basePrice),
                        sub: 'Komplit Normal',
                        tutorialId: 'portion-preset-standard',
                      },
                      {
                        mode: 'preset1' as const,
                        title: portionPresets.extraPuasLabel,
                        price: formatRupiah(preset1Price),
                        sub: 'Ekstra Nasi & Lauk',
                        tutorialId: 'portion-preset-extra',
                      },
                      {
                        mode: 'preset2' as const,
                        title: portionPresets.jumboLabel,
                        price: formatRupiah(preset2Price),
                        sub: 'Nasi & Bumbu Lebih',
                        tutorialId: 'portion-preset-jumbo',
                      },
                      {
                        mode: 'custom' as const,
                        title: 'Nominal Lainnya',
                        price: 'Ketik Budget',
                        sub: `Mulai ${formatRupiah(basePrice)}+`,
                        tutorialId: 'portion-preset-custom',
                      },
                    ].map((opt) => {
                      const active = portionMode === opt.mode;
                      return (
                        <div
                          key={opt.mode}
                          data-tutorial={opt.tutorialId}
                          className={`p-2.5 rounded-xl border ${
                            active
                              ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 shadow-2xs'
                              : 'bg-white/75 border-[#30251F]/12'
                          } ${getInteractiveStateClass(
                            activeTargetSelector,
                            opt.tutorialId,
                            isClicking
                          )}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[11px] font-bold text-[#193D2B] truncate">
                              {opt.title}
                            </span>
                            {active && (
                              <Check className="w-3.5 h-3.5 text-[#193D2B] shrink-0" />
                            )}
                          </div>
                          <div className="text-sm font-bold font-mono-tabular text-[#30251F]">
                            {opt.price}
                          </div>
                          <div className="text-[10px] text-[#6E5D53]">{opt.sub}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Quantity Stepper */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#30251F] flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5 text-[#193D2B]" />
                      <span>3. Tentukan Jumlah Porsi</span>
                    </div>
                    <span className="text-[11px] text-[#193D2B] font-semibold">
                      {quantity} Porsi Dipilih
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-[#30251F]/12 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-[#6E5D53]">
                      <span className="font-bold text-[#30251F] block">
                        Banyaknya Porsi
                      </span>
                      <span>Ketuk − / + atur jumlah</span>
                    </div>
                    <div className="flex items-center gap-2 bg-[#EFE9DC] border border-[#30251F]/12 rounded-xl p-1 shrink-0">
                      <div className="w-7 h-7 rounded-lg bg-white text-[#30251F] flex items-center justify-center">
                        <Minus className="w-3.5 h-3.5" />
                      </div>
                      <span className="min-w-[54px] text-center font-bold font-mono-tabular text-xs text-[#30251F]">
                        {quantity} Porsi
                      </span>
                      <div
                        data-tutorial="portion-qty-plus"
                        className={`w-7 h-7 rounded-lg bg-[#193D2B] text-[#F7F3E9] flex items-center justify-center ${getInteractiveStateClass(
                          activeTargetSelector,
                          'portion-qty-plus',
                          isClicking
                        )}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Mandatory Sambal Preference */}
                <div
                  data-tutorial="portion-sambal"
                  className={`space-y-2 rounded-xl p-1 -m-1 ${getInteractiveStateClass(
                    activeTargetSelector,
                    'portion-sambal',
                    isClicking
                  )}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#30251F] flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-[#A83A2D]" />
                      <span>4. Pilihan Sambal Khas Lasinrang</span>
                    </div>
                    <span className="text-[11px] text-[#A83A2D] font-semibold">
                      Wajib Pilih
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {DEFAULT_SAMBAL_OPTIONS.map((option) => {
                      const active = sambalPref === option.id;
                      return (
                        <div
                          key={option.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                            active
                              ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 shadow-2xs'
                              : 'bg-white/75 border-[#30251F]/12'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#30251F]">
                              {option.label}
                            </div>
                            <div className="text-[10.5px] text-[#6E5D53] mt-0.5">
                              {option.desc}
                            </div>
                          </div>
                          <div
                            className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                              active
                                ? 'border-[#193D2B] bg-[#193D2B] text-white'
                                : 'border-[#30251F]/25'
                            }`}
                          >
                            {active && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Topping Option (Bakwan Goreng Renyah Rp 1.000 + Opsi Sebagian Porsi — 1:1 PortionModal) */}
                {bakwanTopping && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-[#30251F] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#9A7013]" />
                        <span>5. Opsi Toping Tambahan</span>
                      </div>
                      <span className="text-[11px] text-[#6E5D53] font-medium">
                        Cuma Seribuan
                      </span>
                    </div>

                    {quantity > 1 && (
                      <div className="p-3 rounded-xl bg-[#FAF5E8] border border-[#D9A52E]/50 space-y-2">
                        <div className="text-[11px] font-bold text-[#193D2B]">
                          Opsi Toping untuk {quantity} Porsi:
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div
                            data-tutorial="portion-topping-scope-partial"
                            className={`p-2 rounded-lg border text-left ${
                              toppingScope === 'total_order'
                                ? 'bg-[#193D2B] text-white border-[#193D2B] shadow-2xs'
                                : 'bg-white text-[#30251F] border-[#30251F]/15'
                            } ${getInteractiveStateClass(
                              activeTargetSelector,
                              'portion-topping-scope-partial',
                              isClicking
                            )}`}
                          >
                            <div className="text-[10.5px] font-bold leading-snug">
                              Hanya Sebagian Porsi (Total Satuan)
                            </div>
                            <div
                              className={`text-[9.5px] mt-0.5 leading-tight ${
                                toppingScope === 'total_order'
                                  ? 'text-[#E8C56E]'
                                  : 'text-[#6E5D53]'
                              }`}
                            >
                              Misal hanya 1 porsi yang pakai toping (tidak dikali {quantity})
                            </div>
                          </div>

                          <div
                            className={`p-2 rounded-lg border text-left ${
                              toppingScope === 'per_portion'
                                ? 'bg-[#193D2B] text-white border-[#193D2B] shadow-2xs'
                                : 'bg-white text-[#30251F] border-[#30251F]/15'
                            }`}
                          >
                            <div className="text-[10.5px] font-bold leading-snug">
                              Semua {quantity} Porsi Pakai Toping
                            </div>
                            <div
                              className={`text-[9.5px] mt-0.5 leading-tight ${
                                toppingScope === 'per_portion'
                                  ? 'text-[#E8C56E]'
                                  : 'text-[#6E5D53]'
                              }`}
                            >
                              Otomatis dikali {quantity} porsi
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      data-tutorial="portion-topping-bakwan"
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
                        bakwanQty > 0
                          ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 shadow-2xs'
                          : 'bg-white/75 border-[#30251F]/12'
                      } ${getInteractiveStateClass(
                        activeTargetSelector,
                        'portion-topping-bakwan',
                        isClicking
                      )}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 ${
                            bakwanQty > 0
                              ? 'bg-[#193D2B] border-[#193D2B] text-white'
                              : 'border-[#30251F]/30 bg-white'
                          }`}
                        >
                          {bakwanQty > 0 && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        {bakwanTopping.imageUrl && (
                          <div className="w-11 h-14 rounded-lg overflow-hidden shrink-0 border border-[#D9A52E]/45 menu-poster-3d-frame">
                            <FoodImage
                              src={bakwanTopping.imageUrl}
                              alt={bakwanTopping.name}
                              fit="poster"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#30251F] truncate">
                            {bakwanTopping.name}
                          </div>
                          <div className="text-[11px] font-bold font-mono-tabular text-[#9A7013]">
                            +{formatRupiah(bakwanTopping.price)} / 1 pcs
                          </div>
                          {bakwanQty > 0 && (
                            <div className="text-[10px] font-bold text-[#193D2B] font-mono-tabular">
                              {isPartialTopping
                                ? `Total: ${bakwanQty} pcs (+${formatRupiah(toppingTotal)})`
                                : `Per Porsi: ${bakwanQty} pcs (+${formatRupiah(toppingTotal)}/porsi)`}
                            </div>
                          )}
                        </div>
                      </div>

                      {bakwanQty > 0 ? (
                        <div className="flex items-center gap-1 bg-[#EFE9DC] border border-[#30251F]/12 rounded-lg p-0.5 shrink-0">
                          <span className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
                            <Minus className="w-3 h-3" />
                          </span>
                          <span className="w-5 text-center text-xs font-bold font-mono-tabular">
                            {bakwanQty}
                          </span>
                          <span className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
                            <Plus className="w-3 h-3" />
                          </span>
                        </div>
                      ) : (
                        <span className="px-2.5 py-1.5 rounded-lg bg-[#EFE9DC] text-[#30251F] border border-[#30251F]/12 text-[11px] font-semibold whitespace-nowrap shrink-0">
                          + Tambah
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. Extra Side Dish */}
                <div
                  data-tutorial="portion-extra-side"
                  className={`p-3 rounded-xl bg-white border border-[#30251F]/12 space-y-2 ${getInteractiveStateClass(
                    activeTargetSelector,
                    'portion-extra-side',
                    isClicking
                  )}`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#30251F]">
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        wantExtraSideDish
                          ? 'bg-[#193D2B] border-[#193D2B] text-white'
                          : 'border-[#30251F]/30 bg-white'
                      }`}
                    >
                      {wantExtraSideDish && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span>6. Mau Tambah Lauk Ekstra?</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_EXTRA_SIDE_OPTIONS.map((chip) => {
                      const chosen = extraSideChips.includes(chip);
                      return (
                        <span
                          key={chip}
                          className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold border ${
                            chosen
                              ? 'bg-[#193D2B] text-white border-[#193D2B]'
                              : 'bg-[#F7F3E9] text-[#30251F] border-[#30251F]/14'
                          }`}
                        >
                          {chosen ? `✓ ${chip}` : `+ ${chip}`}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* 7. Catatan Khusus Pesanan Ini (Opsional) */}
                <div
                  data-tutorial="portion-item-note"
                  className={`space-y-1.5 rounded-xl p-1 -m-1 ${getInteractiveStateClass(
                    activeTargetSelector,
                    'portion-item-note',
                    isClicking
                  )}`}
                >
                  <div className="text-xs font-bold text-[#30251F] flex items-center gap-1.5">
                    <MessageSquareText className="w-3.5 h-3.5 text-[#6E5D53]" />
                    <span>7. Catatan Khusus Pesanan Ini (Opsional)</span>
                  </div>
                  <div
                    className={`w-full rounded-xl bg-white border px-3 py-2 text-xs min-h-[38px] flex items-center ${
                      isTypingNote
                        ? 'border-[#193D2B] ring-2 ring-[#193D2B]/20'
                        : 'border-[#30251F]/14'
                    }`}
                  >
                    {itemNote ? (
                      <span className="font-semibold text-[#30251F]">
                        {itemNote}
                        {isTypingNote && (
                          <span className="tutorial-typing-caret inline-block w-[1.5px] h-3.5 bg-[#193D2B] ml-0.5 align-middle" />
                        )}
                      </span>
                    ) : (
                      <span className="text-[#6E5D53]/65">
                        Contoh: 1 porsi pakai bakwan, 1 porsi tanpa bakwan...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Bottom Action Bar (1:1 PortionModal) */}
            <div className="shrink-0 z-30 bg-white/95 border-t border-[#30251F]/12 shadow-[0_-6px_18px_-8px_rgba(48,37,31,0.12)] px-3.5 pt-3 pb-[22px]">
              <div className="flex items-center justify-between gap-3">
                <div className="shrink-0">
                  <div className="text-[10.5px] font-medium text-[#6E5D53]">
                    Subtotal ({quantity} Porsi)
                  </div>
                  <div className="text-base font-bold font-mono-tabular text-[#193D2B]">
                    {formatRupiah(lineSubtotal)}
                  </div>
                </div>
                <div
                  data-tutorial="btn-masukkan-pesanan"
                  className={`flex-1 py-2.5 px-4 rounded-xl bg-[#A83A2D] text-[#F7F3E9] font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 ${getInteractiveStateClass(
                    activeTargetSelector,
                    'btn-masukkan-pesanan',
                    isClicking
                  )}`}
                >
                  <span>Masukkan Pesanan</span>
                  <Check className="w-4 h-4 shrink-0" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===============================================================
            LAYAR 3 & 5: CHECKOUT MODAL & PEMBAYARAN NON-COD (1:1 MIRROR CheckoutModal.tsx)
           =============================================================== */}
        {showCheckoutOrPayment && (
          <div className="relative w-full h-full bg-[#F7F3E9] text-[#30251F] flex flex-col">
            <div className="h-[38px] shrink-0 bg-[#F7F3E9]" aria-hidden="true" />

            {/* Sticky Order Page Header (1:1 CheckoutModal) */}
            <header className="shrink-0 z-30 bg-[#F7F3E9]/95 border-b border-[#30251F]/10">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="px-2.5 py-1.5 rounded-xl bg-white text-[#193D2B] text-xs font-semibold flex items-center gap-1 border border-[#30251F]/15 shadow-2xs shrink-0">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali</span>
                  </div>
                  <img
                    src={OFFICIAL_LOGO_URL}
                    alt="Logo Nasi Kuning Lasinrang"
                    className="w-8 h-8 rounded-full object-contain shrink-0 ring-1 ring-[#D9A52E]/60 bg-white"
                    draggable={false}
                  />
                  <div className="min-w-0">
                    <span className="text-[9.5px] font-bold uppercase tracking-widest text-[#9A7013] block truncate">
                      Langkah 1 dari 2 · Detail Pesanan
                    </span>
                    <h1 className="text-xs font-bold text-[#193D2B] font-serif-display truncate">
                      Penyelesaian Pesanan Anda
                    </h1>
                  </div>
                </div>
                <div className="px-2.5 py-1.5 rounded-xl bg-white text-[#193D2B] border border-[#D9A52E]/50 text-[10.5px] font-semibold flex items-center gap-1 shrink-0">
                  <Play className="w-3 h-3 text-[#A83A2D] fill-[#A83A2D]" />
                  <span>Tutorial</span>
                </div>
              </div>
            </header>

            {/* Scrollable Checkout Body */}
            <div className="relative flex-1 overflow-hidden">
              <div
                ref={checkoutScrollInnerRef}
                className={`px-3.5 py-4 space-y-5 pb-20 ${bodySnapTransitionClass}`}
                style={{
                  transform: `translate3d(0, -${effectiveBodyScrollY}px, 0)`,
                }}
              >
                {/* 1. Cart Items List */}
                <div
                  data-tutorial="checkout-cart-list"
                  className={`space-y-2.5 rounded-xl p-1 -m-1 ${getInteractiveStateClass(
                    activeTargetSelector,
                    'checkout-cart-list',
                    isClicking
                  )}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#193D2B]">
                      1. Daftar Menu Dipilih ({quantity} Porsi)
                    </span>
                    <span className="text-[11px] text-[#A83A2D] font-semibold">
                      + Tambah Menu
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-[#30251F]/12 shadow-2xs flex items-start gap-2.5">
                    <div className="w-14 h-18 rounded-lg overflow-hidden shrink-0 border border-[#D9A52E]/45 menu-poster-3d-frame">
                      <FoodImage
                        src={selectedPortionMenu.imageUrl}
                        alt={selectedPortionMenu.name}
                        fit="poster"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-[#30251F] truncate">
                        {selectedPortionMenu.name}
                      </h4>
                      <p className="text-[11px] text-[#193D2B] font-semibold">
                        {riceTextLabel}
                      </p>
                      <p className="text-[11px] text-[#9A7013] font-semibold">
                        {portionLabel}
                      </p>
                      <p className="text-[10.5px] text-[#6E5D53]">
                        {sambalTextMap[sambalPref]}
                      </p>
                      {bakwanQty > 0 && (
                        <p className="text-[10.5px] text-[#9A7013] font-semibold mt-0.5">
                          {isPartialTopping
                            ? `Toping (Sebagian Porsi): Bakwan Goreng ${bakwanQty} pcs (+${formatRupiah(
                                toppingTotal
                              )} total)`
                            : `Toping: Bakwan Goreng ×${bakwanQty}/porsi (+${formatRupiah(
                                toppingTotal
                              )}/porsi)`}
                        </p>
                      )}
                      {itemNote && (
                        <p className="text-[10px] text-[#193D2B] italic mt-0.5 truncate">
                          Catatan: &ldquo;{itemNote}&rdquo;
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1.5">
                      <div className="text-xs font-bold font-mono-tabular text-[#30251F]">
                        {formatRupiah(lineSubtotal)}
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <span className="w-6 h-6 rounded-md bg-[#EFE9DC] flex items-center justify-center border border-[#30251F]/12">
                          <Minus className="w-3 h-3" />
                        </span>
                        <span className="w-5 text-center text-xs font-bold font-mono-tabular">
                          {quantity}
                        </span>
                        <span className="w-6 h-6 rounded-md bg-[#EFE9DC] flex items-center justify-center border border-[#30251F]/12">
                          <Plus className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Customer Identity */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>2. Data Penerima Pesanan</span>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <div className="text-[11px] font-semibold text-[#30251F] mb-1">
                        Nama lengkap <span className="text-[#A83A2D]">*</span>
                      </div>
                      <div
                        id="checkout-customer-name"
                        data-tutorial="checkout-customer-name"
                        className={`relative w-full bg-white border rounded-xl pl-8 pr-3 py-2 text-xs text-[#30251F] flex items-center min-h-[36px] ${
                          activeTypingField === 'name'
                            ? 'border-[#193D2B] ring-2 ring-[#193D2B]/20'
                            : 'border-[#30251F]/20'
                        } ${getInteractiveStateClass(
                          activeTargetSelector,
                          'checkout-customer-name',
                          isClicking
                        )}`}
                      >
                        <User className="w-3.5 h-3.5 text-[#6E5D53]/70 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        {customerName ? (
                          <span className="font-semibold text-[#30251F]">
                            {customerName}
                            {activeTypingField === 'name' && (
                              <span className="tutorial-typing-caret inline-block w-[1.5px] h-3.5 bg-[#193D2B] ml-0.5 align-middle" />
                            )}
                          </span>
                        ) : (
                          <span className="text-[#6E5D53]/60">
                            Masukkan nama penerima pesanan.
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-[#30251F] mb-1">
                        Nomor WhatsApp Aktif <span className="text-[#A83A2D]">*</span>
                      </div>
                      <div
                        className={`relative w-full bg-white border rounded-xl pl-8 pr-3 py-2 text-xs font-mono-tabular text-[#30251F] flex items-center min-h-[36px] ${
                          activeTypingField === 'phone'
                            ? 'border-[#193D2B] ring-2 ring-[#193D2B]/20'
                            : 'border-[#30251F]/20'
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5 text-[#6E5D53]/70 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        {customerPhone ? (
                          <span className="font-bold text-[#30251F]">
                            {customerPhone}
                            {activeTypingField === 'phone' && (
                              <span className="tutorial-typing-caret inline-block w-[1.5px] h-3.5 bg-[#193D2B] ml-0.5 align-middle" />
                            )}
                          </span>
                        ) : (
                          <span className="font-sans text-[#6E5D53]/60">
                            Contoh: 0823xxxxxxxx
                          </span>
                        )}
                      </div>
                      {customerPhone.length >= 10 && (
                        <p className="text-[10.5px] text-[#193D2B] font-semibold mt-1 flex items-center gap-1">
                          <Check className="w-3 h-3 shrink-0" />
                          <span>WA Aktif siap dihubungi kurir: {customerPhone}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Three Explicit Fulfillment Choices */}
                <div
                  id="checkout-fulfillment-section"
                  data-tutorial="checkout-fulfillment-section"
                  className={`space-y-2.5 rounded-xl p-1 -m-1 ${getInteractiveStateClass(
                    activeTargetSelector,
                    'checkout-fulfillment-section',
                    false
                  )}`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    <span>
                      3. Metode Penerimaan Pesanan{' '}
                      <span className="text-[#A83A2D]">*</span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        id: 'pickup' as const,
                        tutorialId: 'fulfillment-pickup',
                        title: '1. Ambil Sendiri di Tempat',
                        desc: 'Ambil langsung di depan Patung Lasinrang (Bebas Ongkir).',
                        icon: <Store className="w-4 h-4" />,
                      },
                      {
                        id: 'own_courier' as const,
                        tutorialId: 'fulfillment-own-courier',
                        title: '2. Pakai Jasa GoFood atau Maxim',
                        desc: 'Pesan driver GoFood, GoSend, atau Maxim dengan titik jemput lapak.',
                        icon: <Truck className="w-4 h-4" />,
                      },
                      {
                        id: 'help_courier' as const,
                        tutorialId: 'fulfillment-help-courier',
                        title: '3. Pakai Kurir Area Kota Pinrang',
                        desc: 'Layanan pengantaran kurir cepat area Kota Pinrang langsung ke alamat atau titik rumah Anda.',
                        icon: <HelpCircle className="w-4 h-4" />,
                      },
                    ].map((opt) => {
                      const isSelected = fulfillment === opt.id;
                      return (
                        <div
                          key={opt.id}
                          data-tutorial={opt.tutorialId}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                            isSelected
                              ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 shadow-2xs'
                              : 'bg-white/80 border-[#30251F]/12'
                          } ${getInteractiveStateClass(
                            activeTargetSelector,
                            opt.tutorialId,
                            isClicking
                          )}`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-[#193D2B] text-white'
                                : 'bg-[#EFE9DC] text-[#193D2B]'
                            }`}
                          >
                            {opt.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-[#30251F]">
                              {opt.title}
                            </div>
                            <p className="text-[10.5px] text-[#6E5D53] mt-0.5 leading-snug">
                              {opt.desc}
                            </p>
                          </div>
                          <div
                            className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                              isSelected
                                ? 'border-[#193D2B] bg-[#193D2B] text-white'
                                : 'border-[#30251F]/25'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {fulfillment === 'own_courier' && (
                    <div className="p-2.5 rounded-xl bg-[#E9F0EC] border border-[#193D2B]/20 text-[11px] text-[#30251F] space-y-1">
                      <strong className="text-[#193D2B] block">
                        Titik Jemput Driver GoFood / Maxim:
                      </strong>
                      <div>
                        Nasi Kuning Lasinrang — Depan Patung Lasinrang, Jl. Jend. Sudirman, Kota Pinrang.
                      </div>
                    </div>
                  )}

                  {fulfillment === 'help_courier' && (
                    <div className="p-2.5 rounded-xl bg-[#FAF5E8] border border-[#D9A52E]/45 text-[11px] text-[#30251F] leading-snug">
                      <strong className="text-[#9A7013] block mb-0.5">
                        Pengantaran Kurir Area Kota Pinrang:
                      </strong>
                      Pesanan siap diantar kurir area Kota Pinrang dan konfirmasi ongkir
                      disampaikan via WhatsApp.
                    </div>
                  )}
                </div>

                {/* 6. Payment Method Section (Pembayaran Langsung Non-COD) */}
                <div
                  data-tutorial="checkout-payment-section"
                  className={`space-y-3 rounded-xl p-1 -m-1 ${getInteractiveStateClass(
                    activeTargetSelector,
                    'checkout-payment-section',
                    false
                  )}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" />
                      <span>6. Pembayaran Langsung (Non-COD)</span>
                    </div>
                    <span className="text-[10.5px] font-bold text-[#A83A2D]">
                      Tidak melayani COD
                    </span>
                  </div>

                  {/* 3 Payment Method Selector Cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        paymentMethod === 'qris'
                          ? 'bg-white border-[#D9A52E] ring-1 ring-[#D9A52E]/35 shadow-2xs'
                          : 'bg-white/75 border-[#30251F]/12'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-md bg-[#EFE9DC] border border-[#30251F]/10 flex items-center justify-center mb-1">
                        <QrCode className="w-3.5 h-3.5 text-[#9A7013]" />
                      </div>
                      <div className="text-[11px] font-bold text-[#30251F]">
                        QRIS GPN
                      </div>
                      <div className="text-[9.5px] text-[#6E5D53] truncate">
                        Semua Bank
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        paymentMethod === 'gopay'
                          ? 'bg-white border-[#00AA13] ring-1 ring-[#00AA13]/25 shadow-2xs'
                          : 'bg-white/75 border-[#30251F]/12'
                      }`}
                    >
                      <GopayLogoIcon className="w-6 h-6 mb-1" />
                      <div className="text-[11px] font-bold text-[#30251F]">
                        GoPay
                      </div>
                      <div className="text-[9.5px] text-[#6E5D53] font-mono-tabular truncate">
                        {storeConfig.ewalletNumber}
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        paymentMethod === 'dana'
                          ? 'bg-white border-[#108EE9] ring-1 ring-[#108EE9]/25 shadow-2xs'
                          : 'bg-white/75 border-[#30251F]/12'
                      }`}
                    >
                      <DanaLogoIcon className="w-6 h-6 mb-1" />
                      <div className="text-[11px] font-bold text-[#30251F]">DANA</div>
                      <div className="text-[9.5px] text-[#6E5D53] font-mono-tabular truncate">
                        {storeConfig.ewalletNumber}
                      </div>
                    </div>
                  </div>

                  {/* Official QRIS Resmi Card */}
                  <div
                    data-tutorial="payment-qris-card"
                    className={`p-3.5 rounded-2xl bg-white border border-[#30251F]/12 flex items-center gap-3 ${getInteractiveStateClass(
                      activeTargetSelector,
                      'payment-qris-card',
                      false
                    )}`}
                  >
                    <div className="w-24 aspect-[586/825] rounded-xl overflow-hidden bg-white border border-[#30251F]/15 shrink-0 p-0.5 flex items-center justify-center qris-frame-3d">
                      <img
                        src={storeConfig.qrisImageUrl || DEFAULT_REAL_QRIS_URL}
                        alt="QRIS Resmi Nasi Kuning Lasinrang"
                        className="w-full h-full object-contain rounded-lg bg-white"
                        draggable={false}
                      />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <QrisLogo />
                      <div className="text-xs font-bold text-[#30251F] leading-snug">
                        {storeConfig.qrisMerchantName}
                      </div>
                      <div className="text-[10.5px] font-mono-tabular text-[#6E5D53]">
                        NMID: {storeConfig.qrisNmid} ({storeConfig.qrisTerminalId})
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EFE9DC] text-[#30251F] border border-[#30251F]/12 text-[10.5px] font-semibold">
                          <Maximize2 className="w-3 h-3" />
                          <span>Perbesar</span>
                        </span>
                        <span
                          data-tutorial="btn-unduh-qris"
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10.5px] font-bold ${
                            qrisDownloaded
                              ? 'bg-[#E9F0EC] border-[#193D2B]/30 text-[#193D2B]'
                              : 'bg-white border-[#30251F]/18 text-[#30251F]'
                          } ${getInteractiveStateClass(
                            activeTargetSelector,
                            'btn-unduh-qris',
                            isClicking
                          )}`}
                        >
                          {qrisDownloaded ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>QRIS Diunduh</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3 h-3" />
                              <span>Unduh QRIS</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* GoPay / DANA Official Transfer Card (0821-5089-754) */}
                  <div
                    data-tutorial="payment-ewallet-card"
                    className={`p-3.5 rounded-2xl bg-white border space-y-2.5 ${
                      paymentMethod === 'dana'
                        ? 'border-[#108EE9]/45'
                        : 'border-[#00AA13]/40'
                    } ${getInteractiveStateClass(
                      activeTargetSelector,
                      'payment-ewallet-card',
                      false
                    )}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center -space-x-1.5 shrink-0">
                        <GopayLogoIcon className="w-7 h-7 ring-2 ring-white rounded-lg" />
                        <DanaLogoIcon className="w-7 h-7 ring-2 ring-white rounded-lg" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10.5px] text-[#6E5D53] font-semibold">
                          Nomor Resmi GoPay / DANA (11 Digit):
                        </div>
                        <div className="text-base font-bold font-mono-tabular text-[#30251F]">
                          0821-5089-754
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <div
                        data-tutorial="btn-bayar-langsung"
                        className={`py-2.5 px-3.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs ${
                          paymentMethod === 'dana' ? 'bg-[#108EE9]' : 'bg-[#00AA13]'
                        } ${getInteractiveStateClass(
                          activeTargetSelector,
                          'btn-bayar-langsung',
                          isClicking
                        )}`}
                      >
                        {paymentMethod === 'dana' ? (
                          <DanaLogoInline className="w-4 h-4 shrink-0" />
                        ) : (
                          <GopayLogoInline className="w-4 h-4 shrink-0" />
                        )}
                        <span>Bayar Langsung via GoPay / DANA</span>
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                      </div>

                      <div
                        data-tutorial="btn-salin-nomor"
                        className={`py-2.5 px-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                          copiedNumber
                            ? 'bg-[#E9F0EC] border-[#193D2B]/35 text-[#193D2B]'
                            : 'bg-[#EFE9DC] border-[#30251F]/15 text-[#30251F]'
                        } ${getInteractiveStateClass(
                          activeTargetSelector,
                          'btn-salin-nomor',
                          isClicking
                        )}`}
                      >
                        {copiedNumber ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#193D2B]" />
                            <span>Nomor 0821-5089-754 Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-[#6E5D53]" />
                            <span>Salin Nomor (0821-5089-754)</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 1:1 Unggah Foto Bukti Pembayaran Card */}
                  <div
                    data-tutorial="btn-upload-bukti-bayar"
                    className={`p-3.5 rounded-2xl border space-y-2 ${
                      paymentProofUploaded
                        ? 'bg-[#E9F0EC] border-[#193D2B]/45'
                        : 'bg-white border-[#30251F]/15'
                    } ${getInteractiveStateClass(
                      activeTargetSelector,
                      'btn-upload-bukti-bayar',
                      isClicking
                    )}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#A83A2D]" />
                        <span>Unggah Foto Bukti Pembayaran (Opsional)</span>
                      </div>
                      {paymentProofUploaded && (
                        <span className="px-2 py-0.5 rounded-md bg-[#193D2B] text-[#F7F3E9] text-[9.5px] font-bold">
                          Terlampir ✓
                        </span>
                      )}
                    </div>

                    <div
                      className={`w-full py-2.5 px-3 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-2 ${
                        paymentProofUploaded
                          ? 'bg-white border-[#193D2B] text-[#193D2B]'
                          : 'bg-[#F7F3E9] border-[#9A7013]/45 text-[#30251F]'
                      }`}
                    >
                      {paymentProofUploaded ? (
                        <>
                          <Check className="w-4 h-4 text-[#193D2B] shrink-0" />
                          <span>bukti-transfer-qris-37000.jpg Siap Dilampirkan</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-[#A83A2D] shrink-0" />
                          <span>Pilih / Unggah Foto Bukti Pembayaran</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 7. Order Summary Box (Bright Warm Ivory & Gold-Trimmed Card) */}
                <div className="editorial-plate bg-gradient-to-br from-[#FFFDF9] via-[#FFFFFF] to-[#FAF3DF] border-2 border-[#D9A52E]/65 p-4 space-y-2 text-[#16110E]">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9A7013] block">
                    Ringkasan Penyelesaian Akhir
                  </span>
                  <div className="flex items-center justify-between text-xs text-[#4A3C34]">
                    <span>Subtotal Makanan ({quantity} Porsi)</span>
                    <span className="font-mono-tabular font-bold text-[#16110E]">
                      {formatRupiah(lineSubtotal)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#D9A52E]/35 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#16110E]">
                      Total Pembayaran
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF5E8] border border-[#D9A52E]/55 text-base font-extrabold text-[#084C32] font-mono-tabular">
                      {formatRupiah(lineSubtotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Bottom Bar (1:1 Dark Emerald Settlement Bar from CheckoutModal.tsx) */}
            <div className="shrink-0 z-30 bg-[#12291D] text-[#F7F3E9] border-t-2 border-[#D9A52E]/45 shadow-[0_-12px_30px_-8px_rgba(12,26,18,0.45)] px-3.5 pt-2.5 pb-[22px] flex items-center gap-2">
              <div className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-[#F7F3E9] text-[11px] font-semibold whitespace-nowrap">
                + Menu
              </div>
              <div
                data-tutorial="btn-periksa-pratinjau"
                className={`flex-1 py-2.5 px-3.5 rounded-xl bg-[#D9A52E] text-[#12291D] font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 ${getInteractiveStateClass(
                  activeTargetSelector,
                  'btn-periksa-pratinjau',
                  isClicking
                )}`}
              >
                <span>Periksa &amp; Pratinjau Pesanan</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              </div>
            </div>
          </div>
        )}

        {/* ===============================================================
            LAYAR 4: CUSTOMER LOCATION MAP PICKER (1:1 MIRROR CustomerLocationMapPicker.tsx)
           =============================================================== */}
        {activeScreen === 'map-picker' && (
          <div className="relative w-full h-full bg-[#F7F3E9] text-[#30251F] flex flex-col">
            <div className="h-[38px] shrink-0 bg-[#F7F3E9]" aria-hidden="true" />

            {/* Sticky Header */}
            <header className="shrink-0 z-30 bg-[#F7F3E9]/95 border-b border-[#30251F]/10">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="px-2.5 py-1.5 rounded-xl bg-white text-[#193D2B] text-xs font-semibold flex items-center gap-1 border border-[#30251F]/14 shrink-0">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali</span>
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xs font-bold text-[#193D2B] font-serif-display truncate">
                      Titik Google Maps Pengantaran
                    </h1>
                    <p className="text-[10px] text-[#9A7013] font-semibold truncate">
                      Kurir Area Kota Pinrang
                    </p>
                  </div>
                </div>
              </div>
            </header>

            {/* Scrollable Map Picker Body */}
            <div className="relative flex-1 overflow-hidden">
              <div
                ref={mapScrollInnerRef}
                className={`px-3.5 py-3.5 space-y-3 pb-16 ${bodySnapTransitionClass}`}
                style={{
                  transform: `translate3d(0, -${effectiveBodyScrollY}px, 0)`,
                }}
              >
                <div className="p-3 rounded-2xl bg-white border border-[#30251F]/12 space-y-3 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#A83A2D]" />
                    <span>4. Titik Google Maps &amp; Alamat Pengantaran</span>
                  </div>

                  {/* Saved Permanent Locations Strip */}
                  <div className="p-2.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/12 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-[#30251F] flex items-center gap-1.5">
                        <Bookmark className="w-3 h-3 text-[#A83A2D]" />
                        <span>
                          Lokasi Tersimpan ({mapState?.isSavedPermanent ? 1 : 0})
                        </span>
                      </div>
                      {mapState?.isSavedPermanent && (
                        <span className="px-2 py-0.5 rounded-md bg-[#E9F0EC] border border-[#193D2B]/25 text-[#193D2B] text-[10px] font-bold inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>{mapState.saveLabel || 'Rumah'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Search Input + Ambil Lokasi Saya GPS Button */}
                  <div className="space-y-2">
                    <div
                      data-tutorial="map-search-input"
                      className={`relative w-full bg-white border rounded-xl pl-8 pr-3 py-2 text-xs text-[#30251F] flex items-center min-h-[36px] ${
                        mapState?.isTypingSearch
                          ? 'border-[#193D2B] ring-2 ring-[#193D2B]/20'
                          : 'border-[#30251F]/20'
                      } ${getInteractiveStateClass(
                        activeTargetSelector,
                        'map-search-input',
                        isClicking
                      )}`}
                    >
                      <Search className="w-3.5 h-3.5 text-[#6E5D53] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      {mapState?.searchQuery ? (
                        <span className="font-semibold text-[#30251F] truncate">
                          {mapState.searchQuery}
                          {mapState.isTypingSearch && (
                            <span className="tutorial-typing-caret inline-block w-[1.5px] h-3.5 bg-[#193D2B] ml-0.5 align-middle" />
                          )}
                        </span>
                      ) : (
                        <span className="text-[#6E5D53]/65 truncate">
                          Cari jalan, masjid, RSUD, atau area Pinrang...
                        </span>
                      )}
                    </div>

                    <div
                      data-tutorial="btn-ambil-lokasi-saya"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-[#193D2B] text-[#F7F3E9] font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs ${getInteractiveStateClass(
                        activeTargetSelector,
                        'btn-ambil-lokasi-saya',
                        isClicking
                      )}`}
                    >
                      {mapState?.isLocatingGps ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LocateFixed className="w-4 h-4" />
                      )}
                      <span>
                        {mapState?.isLocatingGps
                          ? 'Mendeteksi Nama Jalan...'
                          : 'AMBIL LOKASI SAYA (GPS)'}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Pinrang City Street Map Canvas with Draggable Pin Hijau */}
                  <PinrangInteractiveMapMock
                    pinPos={mapPinPos}
                    isDraggingPin={Boolean(mapState?.isDraggingPin)}
                    isLocatingGps={Boolean(mapState?.isLocatingGps)}
                    distanceText={mapState?.distanceText || '1,2 km'}
                    activeTargetSelector={activeTargetSelector}
                    isClicking={isClicking}
                  />

                  {/* 1:1 Lorong & Patokan Rumah Input Fields */}
                  <div
                    data-tutorial="map-lorong-patokan"
                    className={`p-2.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/14 space-y-2 ${getInteractiveStateClass(
                      activeTargetSelector,
                      'map-lorong-patokan',
                      isClicking
                    )}`}
                  >
                    <div className="text-[10.5px] font-bold text-[#193D2B]">
                      Detail Lorong, Nomor Rumah &amp; Patokan Kurir:
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      <div className="px-2.5 py-1.5 rounded-lg bg-white border border-[#30251F]/16 text-[11px] min-h-[30px] flex items-center">
                        {alleyDetail ? (
                          <span className="font-semibold text-[#30251F]">
                            {alleyDetail}
                            {mapState?.isTypingAlley && (
                              <span className="tutorial-typing-caret inline-block w-[1.5px] h-3 bg-[#193D2B] ml-0.5 align-middle" />
                            )}
                          </span>
                        ) : (
                          <span className="text-[#6E5D53]/60">
                            Lorong / Nomor Rumah / Warna Pagar...
                          </span>
                        )}
                      </div>
                      <div className="px-2.5 py-1.5 rounded-lg bg-white border border-[#30251F]/16 text-[11px] min-h-[30px] flex items-center">
                        {landmark ? (
                          <span className="font-semibold text-[#193D2B]">
                            Patokan: {landmark}
                          </span>
                        ) : (
                          <span className="text-[#6E5D53]/60">
                            Patokan terdekat (Masjid, Sekolah, Toko)...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Resolved Address + Save Permanently Bar */}
                  <div className="p-3 rounded-xl bg-[#E9F0EC] border border-[#193D2B]/20 space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-white border border-[#193D2B]/15 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#A83A2D]" />
                        <span>Alamat Jalan &amp; Area Terdeteksi Otomatis</span>
                      </div>
                      <div className="text-[11.5px] font-bold text-[#30251F] leading-snug">
                        {deliveryAddress}
                      </div>
                      <div className="text-[10px] font-mono-tabular text-[#193D2B] font-bold">
                        -3.788420, 119.654180 · ~{mapState?.distanceText || '1,2 km'} dari
                        Lapak
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white border border-[#193D2B]/25 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#30251F]">
                        {mapState?.saveLabel || 'Rumah'}
                      </div>
                      <div
                        data-tutorial="btn-simpan-lokasi-permanen"
                        className={`px-3 py-1.5 rounded-lg bg-[#193D2B] text-[#F7F3E9] font-semibold text-[11px] inline-flex items-center gap-1.5 shrink-0 ${getInteractiveStateClass(
                          activeTargetSelector,
                          'btn-simpan-lokasi-permanen',
                          isClicking
                        )}`}
                      >
                        {mapState?.isSavedPermanent ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#FFD24C]" />
                            <span>Tersimpan!</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3.5 h-3.5" />
                            <span>Simpan Lokasi Permanen</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===============================================================
            LAYAR 6A: PRATINJAU PESANAN (1:1 MIRROR CheckoutModal Step 2)
           =============================================================== */}
        {activeScreen === 'order-preview' && (
          <div className="relative w-full h-full bg-[#F7F3E9] text-[#30251F] flex flex-col">
            <div className="h-[38px] shrink-0 bg-[#F7F3E9]" aria-hidden="true" />

            <header className="shrink-0 z-30 bg-[#F7F3E9]/95 border-b border-[#30251F]/10">
              <div className="px-3.5 py-2.5 flex items-center gap-2">
                <div className="px-2.5 py-1.5 rounded-xl bg-white text-[#193D2B] text-xs font-semibold flex items-center gap-1 border border-[#30251F]/15 shrink-0">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Ubah</span>
                </div>
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="Logo Nasi Kuning Lasinrang"
                  className="w-8 h-8 rounded-full object-contain shrink-0 ring-1 ring-[#D9A52E]/60 bg-white"
                  draggable={false}
                />
                <div className="min-w-0">
                  <span className="text-[9.5px] font-bold uppercase tracking-widest text-[#9A7013] block truncate">
                    Langkah 2 dari 2 · Verifikasi Akhir
                  </span>
                  <h1 className="text-xs font-bold text-[#193D2B] font-serif-display truncate">
                    Pratinjau &amp; Kirim Pesanan
                  </h1>
                </div>
              </div>
            </header>

            <div className="relative flex-1 overflow-hidden">
              <div
                data-tutorial="order-preview-summary"
                className={`px-3.5 py-4 space-y-3.5 pb-16 ${scrollTransitionClass}`}
                style={{
                  transform: `translate3d(0, -${safeScrollY}px, 0)`,
                }}
              >
                {/* Identitas Pelanggan */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#30251F]/12 space-y-2 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Identitas Pelanggan</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10.5px] text-[#6E5D53] block">
                        Nama Penerima
                      </span>
                      <span className="font-bold text-[#30251F]">
                        {customerName || 'Kak Andi Nurul'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10.5px] text-[#6E5D53] block">
                        WhatsApp Aktif
                      </span>
                      <span className="font-bold font-mono-tabular text-[#30251F]">
                        {customerPhone || '0823-6395-3662'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rincian Produk */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#30251F]/12 space-y-2 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Rincian Produk ({quantity} Porsi)</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <span className="font-bold text-[#30251F]">
                        1. {selectedPortionMenu.name}{' '}
                        <span className="text-[#A83A2D]">({quantity} porsi)</span>
                      </span>
                      <span className="font-bold font-mono-tabular text-[#30251F] shrink-0">
                        {formatRupiah(lineSubtotal)}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#6E5D53] space-y-0.5 pl-2.5">
                      <div>Jenis Nasi: {riceTextLabel}</div>
                      <div>Porsi: {portionLabel}</div>
                      <div>Sambal: {sambalTextMap[sambalPref]}</div>
                      {bakwanQty > 0 && (
                        <div className="text-[#9A7013] font-semibold">
                          {isPartialTopping
                            ? `Toping (Sebagian Porsi): Bakwan Goreng Renyah ${bakwanQty} pcs (+${formatRupiah(
                                toppingTotal
                              )} total)`
                            : `Toping: Bakwan Goreng Renyah ×${bakwanQty}/porsi (+${formatRupiah(
                                toppingTotal
                              )}/porsi)`}
                        </div>
                      )}
                      {itemNote && (
                        <div className="text-[#193D2B] italic">
                          Catatan: &ldquo;{itemNote}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Informasi Penerimaan & Lokasi */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#30251F]/12 space-y-1.5 text-[11.5px] shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#A83A2D]" />
                    <span>Informasi Penerimaan &amp; Lokasi</span>
                  </div>
                  <div>
                    <span className="text-[#6E5D53]">Metode: </span>
                    <strong>Pakai Kurir Area Kota Pinrang</strong>
                  </div>
                  <div>
                    <span className="text-[#6E5D53]">Alamat: </span>
                    <span className="font-semibold">{deliveryAddress}</span>
                  </div>
                  <div>
                    <span className="text-[#6E5D53]">Detail: </span>
                    <span>
                      {alleyDetail} · {landmark}
                    </span>
                  </div>
                  <div className="text-[#193D2B] font-semibold truncate">
                    maps.google.com/?q=-3.788420,119.654180
                  </div>
                </div>

                {/* Total Pembayaran (Bright Warm Ivory & Gold-Trimmed Card) */}
                <div className="editorial-plate bg-gradient-to-br from-[#FFFDF9] via-[#FFFFFF] to-[#FAF3DF] border-2 border-[#D9A52E]/65 p-4 space-y-1.5 text-xs text-[#16110E]">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9A7013] block">
                    Ringkasan Tagihan &amp; Pembayaran
                  </span>
                  <div className="flex justify-between text-[#4A3C34]">
                    <span>Metode Pembayaran</span>
                    <span className="font-bold text-[#084C32]">{paymentLabel}</span>
                  </div>
                  <div className="flex justify-between text-[#084C32] font-semibold text-[11px]">
                    <span>Konfirmasi Ongkos Kirim Kurir</span>
                    <span className="font-bold">Via Admin WA</span>
                  </div>
                  <div className="pt-2 border-t border-[#D9A52E]/35 flex justify-between items-center">
                    <span className="text-xs font-extrabold text-[#16110E]">
                      Total Pembayaran
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF5E8] border border-[#D9A52E]/55 text-base font-extrabold text-[#084C32] font-mono-tabular">
                      {formatRupiah(lineSubtotal)}
                    </span>
                  </div>
                </div>

                {/* Bukti Pembayaran Card */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#193D2B]/25 space-y-1.5 text-xs">
                  <div className="font-bold uppercase tracking-wider text-[#193D2B] text-[11px] flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Bukti Pembayaran Siap Dilampirkan</span>
                  </div>
                  <p className="text-[11px] text-[#6E5D53] leading-relaxed">
                    Setelah klik Kirim ke WhatsApp, jangan lupa lampirkan screenshot bukti
                    transfer QRIS / GoPay / DANA di chat Admin.
                  </p>
                </div>
              </div>
            </div>

            {/* Sticky Bottom Bar (1:1 Dark Emerald Settlement Bar from CheckoutModal.tsx) */}
            <div className="shrink-0 z-30 bg-[#12291D] text-[#F7F3E9] border-t-2 border-[#D9A52E]/45 shadow-[0_-12px_30px_-8px_rgba(12,26,18,0.45)] px-3.5 pt-2.5 pb-[22px] flex items-center gap-2">
              <div className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-[#F7F3E9] text-[11px] font-semibold flex items-center gap-1 shrink-0">
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Ubah</span>
              </div>
              <div
                data-tutorial="btn-kirim-whatsapp"
                className={`flex-1 py-2.5 px-4 rounded-xl bg-[#D9A52E] text-[#12291D] font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 ${getInteractiveStateClass(
                  activeTargetSelector,
                  'btn-kirim-whatsapp',
                  isClicking
                )}`}
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span>Kirim Pesanan &amp; Bukti ke WA</span>
              </div>
            </div>
          </div>
        )}

        {/* ===============================================================
            LAYAR 6B: PRATINJAU CHAT WHATSAPP + PENGINGAT BUKTI BAYAR
           =============================================================== */}
        {activeScreen === 'whatsapp-preview' && (
          <div className="relative w-full h-full bg-[#ECE5DD] text-[#111B21] flex flex-col">
            <div className="h-[38px] shrink-0 bg-[#075E54]" aria-hidden="true" />

            {/* WhatsApp Top Bar */}
            <header className="shrink-0 bg-[#075E54] text-white px-3 py-2.5 flex items-center gap-2.5 shadow-md">
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Admin Nasi Kuning Lasinrang"
                className="w-9 h-9 rounded-full object-contain bg-white ring-1 ring-[#FFD24C] shrink-0"
                draggable={false}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">
                  Admin Nasi Kuning Lasinrang
                </div>
                <div className="text-[10.5px] text-[#B9F6CA]">online · Fast Respon</div>
              </div>
              <Phone className="w-4 h-4 opacity-85 shrink-0" />
            </header>

            {/* Chat Canvas */}
            <div className="flex-1 px-3 py-3 space-y-3 overflow-hidden">
              <div className="flex justify-center">
                <span className="px-2.5 py-0.5 rounded-lg bg-white/85 text-[10px] font-semibold text-[#54656F] shadow-2xs">
                  HARI INI
                </span>
              </div>

              {/* Outgoing Formatted Order Message Bubble */}
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] border border-[#B5E29C] p-3 shadow-xs space-y-1.5 text-[11px] leading-relaxed text-[#111B21]">
                <div className="font-extrabold text-[#064E3B]">
                  *PESANAN NASI KUNING LASINRANG*
                </div>
                <div>
                  Nama: <strong>{customerName || 'Kak Andi Nurul'}</strong>
                  <br />
                  WA: {customerPhone || '0823-6395-3662'}
                </div>
                <div className="border-t border-[#064E3B]/15 pt-1">
                  1. <strong>{selectedPortionMenu.name}</strong> ({quantity} porsi)
                  <br />• {riceTextLabel} · {portionLabel}
                  <br />• {sambalTextMap[sambalPref]}
                  {bakwanQty > 0 && (
                    <>
                      <br />•{' '}
                      {isPartialTopping
                        ? `Toping (Sebagian Porsi): Bakwan Goreng ${bakwanQty} pcs (+${formatRupiah(
                            toppingTotal
                          )})`
                        : `Toping: Bakwan Goreng ×${bakwanQty}`}
                    </>
                  )}
                </div>
                <div className="border-t border-[#064E3B]/15 pt-1">
                  Pengantaran: <strong>Kurir Area Kota Pinrang</strong>
                  <br />
                  Maps: <span className="text-[#027EB5] underline">maps.google.com/?q=-3.788,119.654</span>
                  <br />
                  Bayar: <strong>{paymentLabel}</strong> ({formatRupiah(lineSubtotal)})
                </div>
                <div className="flex items-center justify-end gap-1 text-[9.5px] text-[#54656F]">
                  <span>19.05</span>
                  <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1]" />
                </div>
              </div>

              {/* Proof of Payment Reminder Card */}
              <div
                data-tutorial="whatsapp-proof-reminder"
                className={`rounded-2xl bg-white border-2 border-[#D9A52E] p-3 shadow-md space-y-1.5 ${getInteractiveStateClass(
                  activeTargetSelector,
                  'whatsapp-proof-reminder',
                  isClicking
                )}`}
              >
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#193D2B]">
                  <Camera className="w-4 h-4 shrink-0 text-[#A83A2D]" />
                  <span>Pengingat Lampirkan Bukti Bayar</span>
                </div>
                <p className="text-[11px] text-[#30251F] leading-relaxed">
                  Jangan lupa kirim <strong>screenshot bukti transfer QRIS / GoPay / DANA</strong>{' '}
                  di chat WhatsApp ini agar pesanan langsung diproses dapur!
                </p>
              </div>
            </div>

            {/* Bottom WhatsApp Composer Bar */}
            <div className="shrink-0 px-2.5 pt-2 pb-[22px] bg-[#F0F2F5] border-t border-black/10 flex items-center gap-2">
              <div className="flex-1 rounded-full bg-white border border-black/10 px-3.5 py-2 flex items-center justify-between text-[11px] text-[#667781]">
                <span>Lampirkan foto bukti bayar...</span>
                <div className="flex items-center gap-2 text-[#064E3B]">
                  <Paperclip className="w-4 h-4" />
                  <Camera className="w-4 h-4" />
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#00A884] text-white flex items-center justify-center shrink-0 shadow-sm">
                <Send className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}

        {/* ===============================================================
            LAYAR 7: KARTU PENUTUP RESMI (OUTRO CARD — ROYAL BUGIS EMERALD & GOLD)
           =============================================================== */}
        {activeScreen === 'outro-card' && (
          <div
            data-tutorial="outro-closing-card"
            className="relative w-full h-full bg-royal-bugis-hero text-white flex flex-col justify-between overflow-hidden"
          >
            <div className="pt-[38px]">
              <div className="bg-bugis-woven-band" aria-hidden="true" />
            </div>

            <div
              className="pointer-events-none absolute top-24 -right-8 opacity-20"
              aria-hidden="true"
            >
              <BananaLeafOrnament className="w-40 h-40 rotate-12" />
            </div>
            <div
              className="pointer-events-none absolute bottom-20 -left-8 opacity-20"
              aria-hidden="true"
            >
              <SpiceBotanicalOrnament className="w-36 h-36" />
            </div>

            <div className="relative z-10 px-6 my-auto flex flex-col items-center text-center space-y-5">
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Logo Resmi Nasi Kuning Lasinrang"
                className="w-28 h-28 rounded-full object-contain ring-4 ring-[#FFD24C] ring-offset-4 ring-offset-[#063825] bg-white shadow-2xl"
                draggable={false}
              />

              <div className="space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#FFD24C]">
                  ✦ ᨊᨔᨗ ᨀᨘᨊᨗ ᨒᨔᨗᨑ ✦
                </p>
                <h2 className="text-3xl font-bold font-serif-display text-gold-luminous leading-tight">
                  Selamat Menikmati
                </h2>
                <p className="text-base font-bold italic font-serif-display text-[#FFD24C] leading-snug">
                  Nasi Kuning Lasinrang:
                  <br />
                  Malunra, Marasa, na Masempo!
                </p>
              </div>

              <div className="w-full rounded-2xl bg-[#073B27] fx-2d-dark-chip p-4 space-y-2 text-xs">
                <div className="flex items-center justify-center gap-2 text-[#FFD24C] font-bold">
                  <Clock className="w-4 h-4 text-[#FFD24C] shrink-0" />
                  <span>Buka Setiap Malam · 18.30 WITA – Habis</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-white text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-[#FFD24C] shrink-0" />
                  <span>Depan Patung Lasinrang, Kota Pinrang</span>
                </div>
              </div>
            </div>

            <div className="pb-[18px]">
              <div className="bg-bugis-woven-band" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* ===============================================================
            FLOATING TOAST NOTIFICATION (e.g., Nomor Disalin / QRIS Diunduh)
           =============================================================== */}
        {toastMessage && (
          <div className="pointer-events-none absolute top-[54px] inset-x-4 z-[60] flex justify-center">
            <div className="px-3.5 py-2.5 rounded-2xl bg-[#084C32] border border-[#FFD24C]/80 text-white text-xs font-bold shadow-[0_12px_26px_rgba(0,0,0,0.45)] flex items-center gap-2 max-w-full">
              <span className="w-5 h-5 rounded-full bg-[#FFD24C] text-[#051F14] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
              <span className="leading-snug">{toastMessage}</span>
            </div>
          </div>
        )}

        {/* ===============================================================
            SUBTITLE OVERLAY OPSIONAL DI DALAM LAYAR PONSEL
           =============================================================== */}
        {showCaption && caption && (
          <div
            className="pointer-events-none absolute inset-x-3 z-[55] flex justify-center"
            style={{ bottom: `${captionBottomOffsetPx}px` }}
          >
            <div className="px-3.5 py-2 rounded-2xl bg-[#051F14]/92 border border-[#FFD24C]/55 text-white text-[11.5px] font-semibold leading-snug text-center shadow-lg">
              {caption}
            </div>
          </div>
        )}

        {/* ===============================================================
            KURSOR / JARI VIRTUAL REALISTIS (SMOOTH LERP + RIPPLE)
           =============================================================== */}
        <VirtualTouchCursor
          targetPos={resolvedCursorPos}
          isClicking={isClicking}
          isDragging={Boolean(mapState?.isDraggingPin)}
          instant={instantMotion}
        />
      </div>
    </div>
  );
});

TutorialDomStage.displayName = 'TutorialDomStage';
