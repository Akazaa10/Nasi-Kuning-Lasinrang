import {
  TUTORIAL_STEP_CHAPTERS,
  TUTORIAL_TIMELINE,
  TUTORIAL_TOTAL_DURATION_SEC,
  type TutorialScreenId,
  type TutorialStepChapter,
  type TutorialStepId,
  type TutorialTimelineEvent,
} from '../data/tutorialTimeline';
import type {
  TutorialCheckoutState,
  TutorialCursorPoint,
  TutorialMapState,
  TutorialPortionState,
} from '../components/TutorialDomStage';

export interface TutorialStageSnapshot {
  activeEvent: TutorialTimelineEvent;
  activeEventIndex: number;
  activeChapter: TutorialStepChapter;
  activeChapterIndex: number;
  activeScreen: TutorialScreenId;
  scrollY: number;
  activeCategory: 'all' | 'baru' | 'spesial' | 'reguler';
  /** True setelah tombol Instal Aplikasi diklik */
  isAppInstalled: boolean;
  /** Tab aktif pada QuickOrderHub di halaman utama ('top' = Rekomendasi Menu, 'ulang' = Pesan Ulang) */
  quickHubTab: 'top' | 'ulang';
  /** ID menu spesifik yang sedang disebut narasi agar otomatis tersorot & terpusat di layar */
  highlightedMenuId: string | null;
  /** Label badge opsional di atas kartu menu yang sedang disebut */
  highlightedMenuBadge: string | null;
  zoomedMenuId: string | null;
  portionState: TutorialPortionState;
  checkoutState: TutorialCheckoutState;
  mapPinPos: TutorialCursorPoint;
  mapState: TutorialMapState;
  toastMessage: string | null;
  cursorPos: TutorialCursorPoint | null;
  isClicking: boolean;
  activeTargetSelector: string | null;
  caption: string;
}

const CLICK_RIPPLE_WINDOW_SEC = 0.42;
const PRIMARY_DEMO_MENU_ID = 'nasi-kuning-bebek-palekko';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp01(t);
}

function easeInOutCubic(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function sliceTypedText(fullText: string, progress: number): string {
  if (!fullText) return '';
  const p = clamp01(progress);
  const count = Math.max(1, Math.round(fullText.length * p));
  return fullText.slice(0, count);
}

/**
 * Menghitung daftar bab langkah dinamis dari timeline (ikut terupdate otomatis saat kalibrasi `?sync=1`).
 */
export function deriveStepChaptersFromTimeline(
  timeline: readonly TutorialTimelineEvent[] = TUTORIAL_TIMELINE
): TutorialStepChapter[] {
  const byStep = new Map<TutorialStepId, { start: number; end: number }>();

  for (const ev of timeline) {
    const existing = byStep.get(ev.stepId);
    if (!existing) {
      byStep.set(ev.stepId, { start: ev.startTime, end: ev.endTime });
    } else {
      existing.start = Math.min(existing.start, ev.startTime);
      existing.end = Math.max(existing.end, ev.endTime);
    }
  }

  return TUTORIAL_STEP_CHAPTERS.map((base) => {
    const bounds = byStep.get(base.stepId);
    if (!bounds) return base;
    return {
      ...base,
      startTime: bounds.start,
      endTime: Math.max(bounds.start + 0.1, bounds.end),
    };
  });
}

function findActiveEventIndex(
  currentTimeSec: number,
  timeline: readonly TutorialTimelineEvent[]
): number {
  if (timeline.length === 0) return 0;
  const safeTime = Number.isFinite(currentTimeSec) ? Math.max(0, currentTimeSec) : 0;

  for (let i = 0; i < timeline.length; i += 1) {
    const ev = timeline[i];
    if (safeTime >= ev.startTime && safeTime < ev.endTime) {
      return i;
    }
  }

  if (safeTime < timeline[0].startTime) {
    return 0;
  }
  return timeline.length - 1;
}

function getEventOrderMap(
  timeline: readonly TutorialTimelineEvent[]
): Map<string, number> {
  const map = new Map<string, number>();
  timeline.forEach((ev, idx) => {
    map.set(ev.id, idx);
  });
  return map;
}

/**
 * Evaluator deterministik murni:
 * Mengonversi satu angka `currentTimeSec` dari `audioElement.currentTime` menjadi seluruh
 * state tampilan `TutorialDomStage` 1:1.
 *
 * 100% bebas timer terpisah — play, pause, buffering, dan scrubbing maju/mundur selalu 1:1.
 */
export function evaluateTutorialStageAtTime(
  currentTimeSec: number,
  timeline: readonly TutorialTimelineEvent[] = TUTORIAL_TIMELINE
): TutorialStageSnapshot {
  const safeTimeline = timeline.length > 0 ? timeline : TUTORIAL_TIMELINE;
  const safeTime = Number.isFinite(currentTimeSec)
    ? Math.max(0, Math.min(TUTORIAL_TOTAL_DURATION_SEC + 5, currentTimeSec))
    : 0;

  const activeEventIndex = findActiveEventIndex(safeTime, safeTimeline);
  const activeEvent = safeTimeline[activeEventIndex];
  const orderMap = getEventOrderMap(safeTimeline);

  const hasReached = (eventId: string): boolean => {
    const idx = orderMap.get(eventId);
    return typeof idx === 'number' && activeEventIndex >= idx;
  };

  const hasPassed = (eventId: string): boolean => {
    const idx = orderMap.get(eventId);
    return typeof idx === 'number' && activeEventIndex > idx;
  };

  const eventDuration = Math.max(0.05, activeEvent.endTime - activeEvent.startTime);
  const localProgress = clamp01((safeTime - activeEvent.startTime) / eventDuration);
  const smoothProgress = easeInOutCubic(localProgress);

  const clickTriggerAt =
    typeof activeEvent.clickTime === 'number'
      ? activeEvent.clickTime
      : activeEvent.startTime;

  const isClicking = Boolean(
    activeEvent.clickSfx &&
      safeTime >= clickTriggerAt &&
      safeTime <= clickTriggerAt + CLICK_RIPPLE_WINDOW_SEC
  );

  // Active chapter
  const chapters = deriveStepChaptersFromTimeline(safeTimeline);
  let activeChapterIndex = chapters.findIndex(
    (ch) => ch.stepId === activeEvent.stepId
  );
  if (activeChapterIndex < 0) activeChapterIndex = 0;
  const activeChapter = chapters[activeChapterIndex];

  // =========================================================================
  // 1. HOME STATE, PWA INSTALL, QUICK HUB TAB, FILTER & PHOTO LIGHTBOX
  // =========================================================================
  const isAppInstalled =
    hasPassed('intro-click-install-app') ||
    (activeEvent.id === 'intro-click-install-app' && safeTime >= clickTriggerAt);

  const quickHubTab: 'top' | 'ulang' =
    hasPassed('home-click-pesan-ulang') ||
    (activeEvent.id === 'home-click-pesan-ulang' && safeTime >= clickTriggerAt)
      ? 'ulang'
      : 'top';

  let activeCategory: 'all' | 'baru' | 'spesial' | 'reguler' =
    activeEvent.meta?.category ?? 'all';

  if (activeEvent.id === 'catalog-filter-spesial' && safeTime < clickTriggerAt) {
    activeCategory = 'all';
  } else if (
    activeEvent.id === 'catalog-filter-reguler' &&
    safeTime < clickTriggerAt
  ) {
    activeCategory = 'spesial';
  }

  const highlightedMenuId = activeEvent.meta?.menuId ?? null;
  const highlightedMenuBadge = activeEvent.meta?.badgeLabel ?? null;

  let activeScreen: TutorialScreenId = activeEvent.screen;
  let zoomedMenuId: string | null = null;

  if (activeEvent.id === 'home-tap-zoom-photo') {
    if (safeTime >= clickTriggerAt && localProgress < 0.88) {
      activeScreen = 'photo-lightbox';
      zoomedMenuId = PRIMARY_DEMO_MENU_ID;
    } else {
      activeScreen = 'home';
      zoomedMenuId = null;
    }
  }

  // =========================================================================
  // 2. PORTION MODAL CUMULATIVE STATE (LANGKAH 1)
  // =========================================================================
  const portionPresetReached =
    hasPassed('step1-click-portion-preset') ||
    (activeEvent.id === 'step1-click-portion-preset' && safeTime >= clickTriggerAt);

  const portionCustomHighlighted =
    activeEvent.id === 'step1-highlight-nominal-lainnya' &&
    safeTime >= clickTriggerAt &&
    localProgress < 0.82;

  const portionQtyReached =
    hasPassed('step1-click-qty-plus') ||
    (activeEvent.id === 'step1-click-qty-plus' && safeTime >= clickTriggerAt);

  const portionSambalReached =
    hasPassed('step1-click-sambal') ||
    (activeEvent.id === 'step1-click-sambal' && safeTime >= clickTriggerAt);

  const portionBakwanReached =
    hasPassed('step1-add-bakwan-qty') ||
    (activeEvent.id === 'step1-add-bakwan-qty' && safeTime >= clickTriggerAt);

  const portionScopePartialReached =
    hasPassed('step1-click-topping-scope-sebagian') ||
    (activeEvent.id === 'step1-click-topping-scope-sebagian' &&
      safeTime >= clickTriggerAt);

  const portionExtraSideReached =
    hasPassed('step1-check-extra-side') ||
    (activeEvent.id === 'step1-check-extra-side' && safeTime >= clickTriggerAt);

  const fullDemoNote = 'Sambal pisah, bakwan hangat ya';
  let typedItemNote = '';
  let isTypingNote = false;
  if (hasPassed('step1-type-item-note')) {
    typedItemNote = fullDemoNote;
  } else if (activeEvent.id === 'step1-type-item-note') {
    isTypingNote = true;
    typedItemNote = sliceTypedText(fullDemoNote, localProgress);
  }

  const portionState: TutorialPortionState = {
    menuId: PRIMARY_DEMO_MENU_ID,
    riceType: 'nasi_kuning',
    portionMode: portionCustomHighlighted
      ? 'custom'
      : portionPresetReached
      ? 'preset1'
      : 'standard',
    customBudget: 18000,
    quantity: portionQtyReached ? 2 : 1,
    sambalPref: portionSambalReached ? 'pisah' : 'campur',
    bakwanQty: portionBakwanReached ? 1 : 0,
    toppingScope: portionScopePartialReached ? 'total_order' : 'per_portion',
    wantExtraSideDish: portionExtraSideReached,
    extraSideChips: portionExtraSideReached ? ['Telur Sambal'] : [],
    itemNote: typedItemNote,
    isTypingNote,
  };

  // =========================================================================
  // 3. CHECKOUT MODAL & PAYMENT CUMULATIVE STATE (LANGKAH 2 & 3)
  // =========================================================================
  const fullDemoName = 'Kak Andi Nurul';
  const fullDemoPhone = '0823-6395-3662';

  let typedName = '';
  let typedPhone = '';
  let activeTypingField: 'name' | 'phone' | null = null;

  if (hasPassed('step2-type-customer-identity')) {
    typedName = fullDemoName;
    typedPhone = fullDemoPhone;
  } else if (activeEvent.id === 'step2-type-customer-identity') {
    if (localProgress < 0.5) {
      activeTypingField = 'name';
      typedName = sliceTypedText(fullDemoName, localProgress / 0.5);
    } else {
      activeTypingField = 'phone';
      typedName = fullDemoName;
      typedPhone = sliceTypedText(fullDemoPhone, (localProgress - 0.5) / 0.5);
    }
  }

  let activeFulfillment: 'pickup' | 'own_courier' | 'help_courier' | '' = '';
  if (
    hasPassed('step2-click-kurir-pinrang') ||
    (activeEvent.id === 'step2-click-kurir-pinrang' && safeTime >= clickTriggerAt)
  ) {
    activeFulfillment = 'help_courier';
  } else if (
    hasPassed('step2-highlight-ojol-copy-coord') ||
    (activeEvent.id === 'step2-highlight-ojol-copy-coord' &&
      safeTime >= clickTriggerAt)
  ) {
    activeFulfillment = 'own_courier';
  } else if (
    hasPassed('step2-highlight-pickup') ||
    (activeEvent.id === 'step2-highlight-pickup' && safeTime >= clickTriggerAt)
  ) {
    activeFulfillment = 'pickup';
  }

  const qrisDownloaded =
    hasPassed('step3-click-qris-zoom-download') ||
    (activeEvent.id === 'step3-click-qris-zoom-download' &&
      safeTime >= clickTriggerAt);

  const copiedNumber =
    hasPassed('step3-click-ewallet-pay-copy') ||
    (activeEvent.id === 'step3-click-ewallet-pay-copy' &&
      safeTime >= clickTriggerAt);

  const paymentProofUploaded =
    hasPassed('step3-click-upload-payment-proof') ||
    (activeEvent.id === 'step3-click-upload-payment-proof' &&
      safeTime >= clickTriggerAt);

  const showEwalletHighlight = activeEvent.id === 'step3-click-ewallet-pay-copy';

  // Lorong & Patokan typing during step2-type-lorong-patokan
  const fullAlley = 'Lorong 2, Rumah Pagar Hijau';
  const fullLandmark = 'Dekat Masjid Agung Al-Munawwir';
  let typedAlley = '';
  let typedLandmark = '';
  let isTypingAlley = false;

  if (hasPassed('step2-type-lorong-patokan')) {
    typedAlley = fullAlley;
    typedLandmark = fullLandmark;
  } else if (activeEvent.id === 'step2-type-lorong-patokan') {
    isTypingAlley = true;
    if (localProgress < 0.55) {
      typedAlley = sliceTypedText(fullAlley, localProgress / 0.55);
    } else {
      typedAlley = fullAlley;
      typedLandmark = sliceTypedText(fullLandmark, (localProgress - 0.55) / 0.45);
    }
  } else if (hasReached('step2-click-ambil-lokasi-saya')) {
    typedAlley = '';
    typedLandmark = '';
  } else {
    typedAlley = fullAlley;
    typedLandmark = fullLandmark;
  }

  const checkoutState: TutorialCheckoutState = {
    customerName: typedName,
    customerPhone: typedPhone,
    activeTypingField,
    fulfillment: activeFulfillment,
    deliveryAddress:
      'Jl. Jenderal Sudirman, Kel. Macorawalie, Kec. Watang Sawitto, Pinrang',
    alleyDetail: typedAlley || fullAlley,
    landmark: typedLandmark || fullLandmark,
    paymentMethod: showEwalletHighlight ? 'gopay' : 'qris',
    qrisDownloaded,
    copiedNumber,
    showEwalletHighlight,
    paymentProofUploaded,
  };

  // =========================================================================
  // 4. CUSTOMER LOCATION MAP PICKER STATE (LANGKAH 2 KURIR)
  // =========================================================================
  const isLocatingGps =
    activeEvent.id === 'step2-click-ambil-lokasi-saya' &&
    safeTime >= clickTriggerAt &&
    localProgress < 0.68;

  const isDraggingPin = activeEvent.id === 'step2-drag-green-pin';

  const isSavedPermanent =
    hasPassed('step2-click-save-permanent-location') ||
    (activeEvent.id === 'step2-click-save-permanent-location' &&
      safeTime >= clickTriggerAt);

  let mapPinPos: TutorialCursorPoint = { x: 42, y: 44 };
  if (
    activeEvent.id === 'step2-click-ambil-lokasi-saya' &&
    safeTime >= clickTriggerAt
  ) {
    const gpsT = easeInOutCubic(clamp01((localProgress - 0.25) / 0.55));
    mapPinPos = {
      x: lerp(42, 54, gpsT),
      y: lerp(44, 50, gpsT),
    };
  } else if (activeEvent.id === 'step2-drag-green-pin') {
    mapPinPos = {
      x: lerp(54, 70, smoothProgress),
      y: lerp(50, 62, smoothProgress),
    };
  } else if (hasPassed('step2-drag-green-pin')) {
    mapPinPos = { x: 70, y: 62 };
  }

  const mapState: TutorialMapState = {
    searchQuery: 'Jl. Jenderal Sudirman, Pinrang',
    isTypingSearch: false,
    isLocatingGps,
    isDraggingPin,
    isSavedPermanent,
    resolvedAddress:
      'Jl. Jenderal Sudirman, Kel. Macorawalie, Kec. Watang Sawitto, Pinrang',
    distanceText: hasReached('step2-drag-green-pin') ? '1,1 km' : '1,4 km',
    saveLabel: 'Rumah',
    alleyDetail: typedAlley,
    landmark: typedLandmark,
    isTypingAlley,
  };

  // =========================================================================
  // 5. TOAST NOTIFICATIONS (DETERMINISTIC FROM TIMELINE)
  // =========================================================================
  let toastMessage: string | null = null;
  if (
    (activeEvent.id === 'intro-click-install-app' && safeTime >= clickTriggerAt) ||
    activeEvent.id === 'intro-install-pwa-ready'
  ) {
    toastMessage = 'Aplikasi Nasi Kuning Lasinrang terpasang di layar HP!';
  } else if (
    activeEvent.id === 'step2-highlight-ojol-copy-coord' &&
    safeTime >= clickTriggerAt + 0.6
  ) {
    toastMessage = 'Titik jemput 5MR2+PRV berhasil disalin!';
  } else if (
    activeEvent.id === 'step2-click-save-permanent-location' &&
    safeTime >= clickTriggerAt
  ) {
    toastMessage = 'Lokasi "Rumah" berhasil disimpan permanen!';
  } else if (
    activeEvent.id === 'step3-click-qris-zoom-download' &&
    safeTime >= clickTriggerAt
  ) {
    toastMessage = 'Gambar QRIS resmi tersimpan di Galeri HP!';
  } else if (
    activeEvent.id === 'step3-click-ewallet-pay-copy' &&
    safeTime >= clickTriggerAt
  ) {
    toastMessage =
      activeEvent.meta?.toastText ||
      'Nomor GoPay/DANA 0821-5089-754 berhasil disalin!';
  } else if (
    activeEvent.id === 'step3-click-upload-payment-proof' &&
    safeTime >= clickTriggerAt
  ) {
    toastMessage = 'Foto bukti pembayaran berhasil dilampirkan!';
  }

  // =========================================================================
  // 6. PER-EVENT SCROLLY & FALLBACK CURSOR (AUTO-TARGETED TO REAL DOM IN STAGE)
  // =========================================================================
  let scrollY = 0;
  let cursorPos: TutorialCursorPoint | null = { x: 195, y: 420 };

  switch (activeEvent.id) {
    // 1. INTRO & INSTAL APLIKASI
    case 'intro-greeting':
      scrollY = lerp(0, 24, smoothProgress);
      cursorPos = { x: 195, y: 240 };
      break;
    case 'intro-tagline-location':
      scrollY = lerp(24, 65, smoothProgress);
      cursorPos = { x: 195, y: 310 };
      break;
    case 'intro-hours':
      scrollY = lerp(65, 110, smoothProgress);
      cursorPos = { x: 195, y: 420 };
      break;
    case 'intro-click-install-app':
    case 'intro-install-pwa-ready':
      scrollY = 0;
      cursorPos = { x: 258, y: 66 };
      break;

    // 2. FITUR HALAMAN UTAMA
    case 'home-tap-zoom-photo':
      scrollY = 210;
      cursorPos = { x: 295, y: 410 };
      break;
    case 'home-check-rekomendasi':
      scrollY = 520;
      cursorPos = { x: 195, y: 380 };
      break;
    case 'home-click-pesan-ulang':
      scrollY = 520;
      cursorPos = { x: 280, y: 255 };
      break;
    case 'home-click-acara-berkah':
      scrollY = 820;
      cursorPos = { x: 195, y: 495 };
      break;

    // 3. DAFTAR MENU LENGKAP
    case 'catalog-open-intro':
    case 'catalog-sides-complete':
    case 'catalog-filter-spesial':
    case 'catalog-filter-reguler':
      scrollY = 0;
      cursorPos = { x: 195, y: 260 };
      break;

    case 'catalog-spesial-1-palekko':
    case 'catalog-spesial-2-cumi':
    case 'catalog-spesial-3-udang':
    case 'catalog-reguler-1-ayam-bakar':
    case 'catalog-reguler-2-ayam-kentucky':
    case 'catalog-reguler-3-ayam-cincang':
    case 'catalog-reguler-4-ayam-kecap':
    case 'catalog-reguler-5-ayam-sambal-hijau':
    case 'catalog-reguler-6-ayam-balado':
    case 'catalog-reguler-7-telur-balado':
    case 'catalog-reguler-8-telur-rebus':
    case 'catalog-reguler-9-ikan-goreng':
    case 'catalog-topping-bakwan':
    case 'step1-intro-easy':
    case 'step1-click-pesan-sekarang':
      scrollY = 260;
      cursorPos = { x: 274, y: 560 };
      break;

    // 4. LANGKAH 1 — MODAL PORSI
    case 'step1-select-rice-type':
      scrollY = 72;
      cursorPos = { x: 108, y: 318 };
      break;
    case 'step1-click-portion-preset':
      scrollY = 210;
      cursorPos = { x: 280, y: 350 };
      break;
    case 'step1-highlight-nominal-lainnya':
      scrollY = 240;
      cursorPos = { x: 280, y: 430 };
      break;
    case 'step1-click-qty-plus':
      scrollY = 390;
      cursorPos = { x: 336, y: 375 };
      break;
    case 'step1-click-sambal':
      scrollY = 490;
      cursorPos = { x: 195, y: 420 };
      break;
    case 'step1-add-bakwan-qty':
      scrollY = 660;
      cursorPos = { x: 320, y: 448 };
      break;
    case 'step1-click-topping-scope-sebagian':
      scrollY = 740;
      cursorPos = { x: 195, y: 460 };
      break;
    case 'step1-check-extra-side':
      scrollY = 850;
      cursorPos = { x: 140, y: 480 };
      break;
    case 'step1-type-item-note':
      scrollY = 930;
      cursorPos = { x: 195, y: 520 };
      break;
    case 'step1-click-masukkan-pesanan':
      scrollY = 930;
      cursorPos = { x: 246, y: 782 };
      break;

    // 5. LANGKAH 2 — CHECKOUT & MAPS
    case 'step2-checkout-review-cart':
      scrollY = 0;
      cursorPos = { x: 195, y: 218 };
      break;
    case 'step2-type-customer-identity':
      scrollY = 175;
      cursorPos =
        localProgress < 0.5 ? { x: 195, y: 266 } : { x: 195, y: 342 };
      break;
    case 'step2-click-fulfillment-section':
    case 'step2-highlight-pickup':
      scrollY = 340;
      cursorPos = { x: 195, y: 340 };
      break;
    case 'step2-highlight-ojol-copy-coord':
      scrollY = 395;
      cursorPos = { x: 195, y: 420 };
      break;
    case 'step2-click-kurir-pinrang':
      scrollY = 470;
      cursorPos = { x: 195, y: 486 };
      break;
    case 'step2-click-ambil-lokasi-saya':
      scrollY = 0;
      cursorPos = { x: 195, y: 274 };
      break;
    case 'step2-drag-green-pin': {
      scrollY = 58;
      const px = 26 + (mapPinPos.x / 100) * 338;
      const py = 268 + (mapPinPos.y / 100) * 208;
      cursorPos = { x: px, y: py };
      break;
    }
    case 'step2-type-lorong-patokan':
      scrollY = 230;
      cursorPos = { x: 195, y: 495 };
      break;
    case 'step2-click-save-permanent-location':
      scrollY = 260;
      cursorPos = { x: 280, y: 584 };
      break;

    // 6. LANGKAH 3 — PEMBAYARAN NON-COD & UNGGAH BUKTI
    case 'step3-scroll-payment-non-cod':
      scrollY = lerp(520, 775, smoothProgress);
      cursorPos = { x: 195, y: 320 };
      break;
    case 'step3-click-qris-zoom-download':
      scrollY = 840;
      cursorPos = { x: 195, y: 576 };
      break;
    case 'step3-click-ewallet-pay-copy':
      scrollY = 1060;
      cursorPos = { x: 195, y: 522 };
      break;
    case 'step3-click-upload-payment-proof':
      scrollY = 1230;
      cursorPos = { x: 195, y: 540 };
      break;
    case 'step3-click-periksa-pratinjau':
      scrollY = 1230;
      cursorPos = { x: 195, y: 780 };
      break;
    case 'step3-review-order-preview':
      scrollY = lerp(0, 185, smoothProgress);
      cursorPos = { x: 230, y: lerp(480, 320, smoothProgress) };
      break;

    // 7. FINAL & PENUTUP
    case 'final-click-kirim-whatsapp':
      scrollY = 185;
      cursorPos = { x: 195, y: 780 };
      break;
    case 'final-whatsapp-sent-simulation':
      scrollY = 0;
      cursorPos = { x: 195, y: 636 };
      break;
    case 'final-highlight-3d-route-tour':
      scrollY = 1120;
      cursorPos = { x: 195, y: 450 };
      break;
    case 'outro-closing-card':
      scrollY = 0;
      cursorPos = null;
      break;

    default:
      scrollY = 0;
      cursorPos = { x: 195, y: 420 };
  }

  return {
    activeEvent,
    activeEventIndex,
    activeChapter,
    activeChapterIndex,
    activeScreen,
    scrollY,
    activeCategory,
    isAppInstalled,
    quickHubTab,
    highlightedMenuId,
    highlightedMenuBadge,
    zoomedMenuId,
    portionState,
    checkoutState,
    mapPinPos,
    mapState,
    toastMessage,
    cursorPos,
    isClicking,
    activeTargetSelector: activeEvent.targetSelector || null,
    caption: activeEvent.caption,
  };
}
