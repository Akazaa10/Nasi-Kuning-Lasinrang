/**
 * Audit & Timeline Narasi Video Tutorial Resmi Nasi Kuning Lasinrang (Versi Baru 1:1)
 * Sumber Audio: public/audio/tutorial/full-tutorial.mp3 (durasi eksak 201.874 detik / 03:21.9)
 * Efek Klik   : public/audio/tutorial/click-sfx.wav (Web Audio API 0ms attack)
 *
 * Seluruh timestamp (startTime, endTime, clickTime) dipetakan 1:1 berdasarkan audit
 * energi sinyal & jeda kata-per-kata mengikuti urutan narasi resmi terbaru.
 */

export const TUTORIAL_FULL_AUDIO_URL = '/audio/tutorial/full-tutorial.mp3?v=3';
export const TUTORIAL_CLICK_SFX_URL = '/audio/tutorial/click-sfx.wav?v=3';

/** Durasi total audio narasi penuh dalam detik (presisi 0.1 dtk) */
export const TUTORIAL_TOTAL_DURATION_SEC = 201.9;

export type TutorialStepId =
  | 'intro-install'
  | 'home-features'
  | 'menu-catalog'
  | 'step-1-portion'
  | 'step-2-checkout'
  | 'step-3-payment'
  | 'final-outro';

export type TutorialScreenId =
  | 'home'
  | 'menu-catalog'
  | 'photo-lightbox'
  | 'portion-modal'
  | 'checkout-modal'
  | 'map-picker'
  | 'payment-section'
  | 'order-preview'
  | 'whatsapp-preview'
  | 'outro-card';

export type TutorialActionType =
  | 'intro-showcase'
  | 'scroll'
  | 'highlight'
  | 'click'
  | 'open-zoom'
  | 'close-zoom'
  | 'type'
  | 'drag-pin'
  | 'toast'
  | 'outro';

export interface TutorialTimelineEvent {
  /** ID unik setiap event cue (digunakan juga sebagai kunci anti-dobel playClickSfx) */
  id: string;
  /** Kelompok langkah tutorial */
  stepId: TutorialStepId;
  /** Detik mulai cue pada full-tutorial.mp3 */
  startTime: number;
  /** Detik selesai cue pada full-tutorial.mp3 */
  endTime: number;
  /** Layar / modal 1:1 yang aktif */
  screen: TutorialScreenId;
  /** Jenis animasi / interaksi visual */
  action: TutorialActionType;
  /** Selector target elemen UI yang disorot, diklik, diketik, atau digulir */
  targetSelector: string;
  /** True jika efek suara klik (click-sfx.wav) harus diputar saat event ini aktif */
  clickSfx: boolean;
  /** Detik presisi pemutaran click-sfx.wav (default = startTime jika clickSfx: true) */
  clickTime?: number;
  /** Subtitle / teks penjelasan layar yang sinkron dengan narasi */
  caption: string;
  /** Data tambahan opsional untuk sorot menu spesifik, ketikan, toast, atau label UI */
  meta?: {
    menuId?: string;
    category?: 'all' | 'baru' | 'spesial' | 'reguler';
    typedValue?: string;
    secondaryTypedValue?: string;
    toastText?: string;
    scrollProgress?: number;
    badgeLabel?: string;
  };
}

export interface TutorialStepChapter {
  stepId: TutorialStepId;
  stepNumber: string;
  shortTitle: string;
  title: string;
  startTime: number;
  endTime: number;
}

export const TUTORIAL_STEP_CHAPTERS: TutorialStepChapter[] = [
  {
    stepId: 'intro-install',
    stepNumber: '00',
    shortTitle: 'Intro & Instal App',
    title: 'Intro: Selamat Datang & Instal Aplikasi di HP',
    startTime: 0.0,
    endTime: 31.1,
  },
  {
    stepId: 'home-features',
    stepNumber: '01',
    shortTitle: 'Fitur Beranda',
    title: 'Beranda: Perbesar Foto, Rekomendasi Menu, Pesan Ulang & Acara',
    startTime: 31.1,
    endTime: 44.3,
  },
  {
    stepId: 'menu-catalog',
    stepNumber: '02',
    shortTitle: '12 Menu & Bakwan',
    title: 'Daftar Menu Lengkap: 3 Spesial, 9 Reguler & Toping Bakwan',
    startTime: 44.3,
    endTime: 85.3,
  },
  {
    stepId: 'step-1-portion',
    stepNumber: '03',
    shortTitle: 'Atur Porsi & Toping',
    title: 'Langkah 1: Nasi, Porsi/Budget, Sambal & Opsi Toping Sebagian Porsi',
    startTime: 85.3,
    endTime: 125.2,
  },
  {
    stepId: 'step-2-checkout',
    stepNumber: '04',
    shortTitle: 'Checkout & Kurir',
    title: 'Langkah 2: Data Penerima, Kurir Kota Pinrang & Pin Google Maps',
    startTime: 125.2,
    endTime: 154.5,
  },
  {
    stepId: 'step-3-payment',
    stepNumber: '05',
    shortTitle: 'Bayar & Bukti',
    title: 'Langkah 3: Pembayaran Non-COD (QRIS/GoPay/DANA) & Unggah Bukti',
    startTime: 154.5,
    endTime: 176.1,
  },
  {
    stepId: 'final-outro',
    stepNumber: '✓',
    shortTitle: 'Kirim WA & Rute 3D',
    title: 'Final: Kirim Pesanan ke WhatsApp, Tur Rute 3D & Penutup',
    startTime: 176.1,
    endTime: 201.9,
  },
];

/**
 * Timeline presisi 1:1 untuk seluruh alur narasi baru dari 0.0 detik hingga 201.9 detik.
 */
export const TUTORIAL_TIMELINE: TutorialTimelineEvent[] = [
  // =========================================================================
  // 1. INTRO & INSTAL APLIKASI (0.0 – 31.1 dtk)
  // =========================================================================
  {
    id: 'intro-greeting',
    stepId: 'intro-install',
    startTime: 0.0,
    endTime: 8.9,
    screen: 'home',
    action: 'intro-showcase',
    targetSelector: '[data-tutorial="hero-brand"]',
    clickSfx: false,
    caption:
      'Assalamu’alaikum warahmatullahi wabarakatuh, salam sipakalebbi! Tabe’ Kak, selamat datang di website resmi Nasi Kuning Lasinrang.',
  },
  {
    id: 'intro-tagline-location',
    stepId: 'intro-install',
    startTime: 8.9,
    endTime: 16.6,
    screen: 'home',
    action: 'highlight',
    targetSelector: '[data-tutorial="hero-brand"]',
    clickSfx: false,
    caption:
      'Malunra, Marasa na Masempo — cita rasa khas adat Bugis asli di Jl. Jenderal Sudirman, depan Patung Lasinrang.',
  },
  {
    id: 'intro-hours',
    stepId: 'intro-install',
    startTime: 16.6,
    endTime: 20.7,
    screen: 'home',
    action: 'highlight',
    targetSelector: '[data-tutorial="hero-hours"]',
    clickSfx: false,
    caption: 'Kami buka setiap malam mulai jam 18.30 WITA sampai habis.',
  },
  {
    id: 'intro-click-install-app',
    stepId: 'intro-install',
    startTime: 20.7,
    endTime: 26.5,
    screen: 'home',
    action: 'click',
    targetSelector: '[data-tutorial="btn-install-app"]',
    clickSfx: true,
    clickTime: 23.5,
    caption:
      'Biar makin praktis kalau mau pesan lagi, langsung saja klik tombol "Instal Aplikasi" di bagian atas!',
  },
  {
    id: 'intro-install-pwa-ready',
    stepId: 'intro-install',
    startTime: 26.5,
    endTime: 31.1,
    screen: 'home',
    action: 'toast',
    targetSelector: '[data-tutorial="btn-install-app"]',
    clickSfx: false,
    caption:
      'Website ini otomatis terpasang di layar HP Kakak tanpa perlu lewat Play Store.',
    meta: {
      toastText: 'Aplikasi Nasi Kuning Lasinrang terpasang di layar HP!',
    },
  },

  // =========================================================================
  // 2. FITUR HALAMAN UTAMA (31.1 – 44.3 dtk)
  // =========================================================================
  {
    id: 'home-tap-zoom-photo',
    stepId: 'home-features',
    startTime: 31.1,
    endTime: 35.5,
    screen: 'home',
    action: 'open-zoom',
    targetSelector: '[data-tutorial="hero-photo-zoom"]',
    clickSfx: true,
    clickTime: 33.0,
    caption:
      'Di halaman utama, Kakak bisa ketuk foto menu buat memperbesar gambar poster HD.',
    meta: { menuId: 'nasi-kuning-bebek-palekko' },
  },
  {
    id: 'home-check-rekomendasi',
    stepId: 'home-features',
    startTime: 35.5,
    endTime: 37.2,
    screen: 'home',
    action: 'scroll',
    targetSelector: '[data-tutorial="quick-hub-rekomendasi"]',
    clickSfx: false,
    caption:
      'Cek "Rekomendasi Menu dari Kami": Bebek Palekko Bugis, Ayam Sambal Hijau & Ayam Cincang.',
  },
  {
    id: 'home-click-pesan-ulang',
    stepId: 'home-features',
    startTime: 37.2,
    endTime: 39.1,
    screen: 'home',
    action: 'click',
    targetSelector: '[data-tutorial="quick-hub-tab-ulang"]',
    clickSfx: true,
    clickTime: 37.5,
    caption: 'Klik tab "Pesan Ulang" buat langganan agar langsung masuk keranjang.',
  },
  {
    id: 'home-click-acara-berkah',
    stepId: 'home-features',
    startTime: 39.1,
    endTime: 44.3,
    screen: 'home',
    action: 'click',
    targetSelector: '[data-tutorial="btn-acara-berkah-wa"]',
    clickSfx: true,
    clickTime: 39.8,
    caption:
      'Atau klik tombol konsultasi WhatsApp untuk layanan Pesan Acara dan Jum’at Berkah.',
  },

  // =========================================================================
  // 3. DAFTAR MENU LENGKAP — 3 SPESIAL, 9 REGULER & TOPING BAKWAN (44.3 – 85.3 dtk)
  // =========================================================================
  {
    id: 'catalog-open-intro',
    stepId: 'menu-catalog',
    startTime: 44.3,
    endTime: 47.0,
    screen: 'menu-catalog',
    action: 'scroll',
    targetSelector: '#katalog-menu',
    clickSfx: false,
    caption: 'Sekarang, yuk intip Daftar Menu Lengkap & Harga Resmi kami!',
    meta: { category: 'all' },
  },
  {
    id: 'catalog-sides-complete',
    stepId: 'menu-catalog',
    startTime: 47.0,
    endTime: 54.9,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-tutorial="catalog-sides-banner"]',
    clickSfx: false,
    caption:
      'Setiap porsi sudah komplit dengan Nasi Kuning Harum atau Nasi Putih, Tempe Manis Gurih, Mie Goreng Kecap, dan Kerupuk Renyah.',
    meta: { category: 'all' },
  },
  {
    id: 'catalog-filter-spesial',
    stepId: 'menu-catalog',
    startTime: 54.9,
    endTime: 58.9,
    screen: 'menu-catalog',
    action: 'click',
    targetSelector: '[data-tutorial="filter-spesial"]',
    clickSfx: true,
    clickTime: 55.6,
    caption: 'Untuk Menu Spesial Rp 15.000, ada 3 jagoan utama kami:',
    meta: { category: 'spesial', badgeLabel: 'Menu Spesial · Rp 15.000' },
  },
  {
    id: 'catalog-spesial-1-palekko',
    stepId: 'menu-catalog',
    startTime: 58.9,
    endTime: 61.1,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-bebek-palekko"]',
    clickSfx: false,
    caption: 'Spesial 1/3: Nasi Kuning Bebek Palekko khas Bugis Pinrang (Rp 15.000).',
    meta: {
      category: 'spesial',
      menuId: 'nasi-kuning-bebek-palekko',
      badgeLabel: 'Spesial 1/3 · Bebek Palekko',
    },
  },
  {
    id: 'catalog-spesial-2-cumi',
    stepId: 'menu-catalog',
    startTime: 61.1,
    endTime: 62.3,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-cumi-tinta-hitam"]',
    clickSfx: false,
    caption: 'Spesial 2/3: Nasi Kuning Cumi Tinta Hitam (Rp 15.000).',
    meta: {
      category: 'spesial',
      menuId: 'nasi-kuning-cumi-tinta-hitam',
      badgeLabel: 'Spesial 2/3 · Cumi Tinta Hitam',
    },
  },
  {
    id: 'catalog-spesial-3-udang',
    stepId: 'menu-catalog',
    startTime: 62.3,
    endTime: 64.5,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-udang-saos"]',
    clickSfx: false,
    caption: 'Spesial 3/3: Nasi Kuning Udang Saos Asam Manis (Rp 15.000).',
    meta: {
      category: 'spesial',
      menuId: 'nasi-kuning-udang-saos',
      badgeLabel: 'Spesial 3/3 · Udang Saos Asam Manis',
    },
  },
  {
    id: 'catalog-filter-reguler',
    stepId: 'menu-catalog',
    startTime: 64.5,
    endTime: 69.5,
    screen: 'menu-catalog',
    action: 'click',
    targetSelector: '[data-tutorial="filter-reguler"]',
    clickSfx: true,
    clickTime: 65.4,
    caption: 'Untuk Menu Reguler Rp 10.000, tersedia 9 pilihan lauk nikmat:',
    meta: { category: 'reguler', badgeLabel: 'Menu Reguler · Rp 10.000' },
  },
  {
    id: 'catalog-reguler-1-ayam-bakar',
    stepId: 'menu-catalog',
    startTime: 69.5,
    endTime: 70.6,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-ayam-bakar"]',
    clickSfx: false,
    caption: 'Reguler 1/9: Nasi Kuning Ayam Bakar (Rp 10.000).',
    meta: {
      category: 'reguler',
      menuId: 'nasi-kuning-ayam-bakar',
      badgeLabel: 'Reguler 1/9 · Ayam Bakar',
    },
  },
  {
    id: 'catalog-reguler-2-ayam-kentucky',
    stepId: 'menu-catalog',
    startTime: 70.6,
    endTime: 71.8,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-ayam-kentucky"]',
    clickSfx: false,
    caption: 'Reguler 2/9: Nasi Kuning Ayam Kentucky (Rp 10.000).',
    meta: {
      category: 'reguler',
      menuId: 'nasi-kuning-ayam-kentucky',
      badgeLabel: 'Reguler 2/9 · Ayam Kentucky',
    },
  },
  {
    id: 'catalog-reguler-3-ayam-cincang',
    stepId: 'menu-catalog',
    startTime: 71.8,
    endTime: 72.9,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-ayam-cincang"]',
    clickSfx: false,
    caption: 'Reguler 3/9: Nasi Kuning Ayam Cincang (Rp 10.000).',
    meta: {
      category: 'reguler',
      menuId: 'nasi-kuning-ayam-cincang',
      badgeLabel: 'Reguler 3/9 · Ayam Cincang',
    },
  },
  {
    id: 'catalog-reguler-4-ayam-kecap',
    stepId: 'menu-catalog',
    startTime: 72.9,
    endTime: 73.9,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-ayam-kecap"]',
    clickSfx: false,
    caption: 'Reguler 4/9: Nasi Kuning Ayam Kecap (Rp 10.000).',
    meta: {
      category: 'reguler',
      menuId: 'nasi-kuning-ayam-kecap',
      badgeLabel: 'Reguler 4/9 · Ayam Kecap',
    },
  },
  {
    id: 'catalog-reguler-5-ayam-sambal-hijau',
    stepId: 'menu-catalog',
    startTime: 73.9,
    endTime: 75.2,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-ayam-sambal-hijau"]',
    clickSfx: false,
    caption: 'Reguler 5/9: Nasi Kuning Ayam Sambal Hijau (Rp 10.000).',
    meta: {
      category: 'reguler',
      menuId: 'nasi-kuning-ayam-sambal-hijau',
      badgeLabel: 'Reguler 5/9 · Ayam Sambal Hijau',
    },
  },
  {
    id: 'catalog-reguler-6-ayam-balado',
    stepId: 'menu-catalog',
    startTime: 75.2,
    endTime: 76.3,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-ayam-sambal"]',
    clickSfx: false,
    caption: 'Reguler 6/9: Nasi Kuning Ayam Balado (Rp 10.000).',
    meta: {
      category: 'reguler',
      menuId: 'nasi-kuning-ayam-sambal',
      badgeLabel: 'Reguler 6/9 · Ayam Balado',
    },
  },
  {
    id: 'catalog-reguler-7-telur-balado',
    stepId: 'menu-catalog',
    startTime: 76.3,
    endTime: 77.7,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-telur-sambal"]',
    clickSfx: false,
    caption: 'Reguler 7/9: Nasi Kuning Telur Sambal / Balado (Rp 10.000).',
    meta: {
      category: 'reguler',
      menuId: 'nasi-kuning-telur-sambal',
      badgeLabel: 'Reguler 7/9 · Telur Sambal / Balado',
    },
  },
  {
    id: 'catalog-reguler-8-telur-rebus',
    stepId: 'menu-catalog',
    startTime: 77.7,
    endTime: 78.8,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-telur-rebus"]',
    clickSfx: false,
    caption: 'Reguler 8/9: Nasi Kuning Telur Rebus (Rp 10.000).',
    meta: {
      category: 'reguler',
      menuId: 'nasi-kuning-telur-rebus',
      badgeLabel: 'Reguler 8/9 · Telur Rebus',
    },
  },
  {
    id: 'catalog-reguler-9-ikan-goreng',
    stepId: 'menu-catalog',
    startTime: 78.8,
    endTime: 80.2,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-ikan-goreng"]',
    clickSfx: false,
    caption: 'Reguler 9/9: Nasi Kuning Ikan Goreng (Rp 10.000).',
    meta: {
      category: 'reguler',
      menuId: 'nasi-kuning-ikan-goreng',
      badgeLabel: 'Reguler 9/9 · Ikan Goreng',
    },
  },
  {
    id: 'catalog-topping-bakwan',
    stepId: 'menu-catalog',
    startTime: 80.2,
    endTime: 85.3,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="bakwan-goreng"]',
    clickSfx: false,
    caption:
      'Plus, tersedia juga toping hangat Bakwan Goreng Renyah cuma Rp 1.000 per biji!',
    meta: {
      category: 'all',
      menuId: 'bakwan-goreng',
      badgeLabel: 'Toping Favorit · Rp 1.000',
    },
  },

  // =========================================================================
  // 4. LANGKAH 1 — ATUR PESANAN DI MODAL PORSI (85.3 – 125.2 dtk)
  // =========================================================================
  {
    id: 'step1-intro-easy',
    stepId: 'step-1-portion',
    startTime: 85.3,
    endTime: 89.0,
    screen: 'menu-catalog',
    action: 'highlight',
    targetSelector: '[data-menu-id="nasi-kuning-bebek-palekko"]',
    clickSfx: false,
    caption: 'Cara pesannya gampang sekali Kak, ikuti langkah kliknya ya!',
    meta: {
      category: 'all',
      menuId: 'nasi-kuning-bebek-palekko',
    },
  },
  {
    id: 'step1-click-pesan-sekarang',
    stepId: 'step-1-portion',
    startTime: 89.0,
    endTime: 92.8,
    screen: 'menu-catalog',
    action: 'click',
    targetSelector: '[data-tutorial="btn-pesan-sekarang"]',
    clickSfx: true,
    clickTime: 90.1,
    caption: 'Pertama, klik tombol "Pesan Sekarang" di menu pilihan Kakak.',
    meta: {
      category: 'all',
      menuId: 'nasi-kuning-bebek-palekko',
    },
  },
  {
    id: 'step1-select-rice-type',
    stepId: 'step-1-portion',
    startTime: 92.8,
    endTime: 96.2,
    screen: 'portion-modal',
    action: 'click',
    targetSelector: '[data-tutorial="portion-rice-type"]',
    clickSfx: true,
    clickTime: 93.7,
    caption: '1. Pilih Jenis Nasi: mau Nasi Kuning Gurih atau Nasi Putih.',
  },
  {
    id: 'step1-click-portion-preset',
    stepId: 'step-1-portion',
    startTime: 96.2,
    endTime: 98.3,
    screen: 'portion-modal',
    action: 'click',
    targetSelector: '[data-tutorial="portion-preset-extra"]',
    clickSfx: true,
    clickTime: 96.8,
    caption: '2. Klik pilihan porsinya (Standar, Lebih Puas, atau Jumbo).',
  },
  {
    id: 'step1-highlight-nominal-lainnya',
    stepId: 'step-1-portion',
    startTime: 98.3,
    endTime: 101.8,
    screen: 'portion-modal',
    action: 'click',
    targetSelector: '[data-tutorial="portion-preset-custom"]',
    clickSfx: true,
    clickTime: 98.8,
    caption: 'Atau klik "Nominal Lainnya" kalau mau atur budget porsi sendiri.',
  },
  {
    id: 'step1-click-qty-plus',
    stepId: 'step-1-portion',
    startTime: 101.8,
    endTime: 105.6,
    screen: 'portion-modal',
    action: 'click',
    targetSelector: '[data-tutorial="portion-qty-plus"]',
    clickSfx: true,
    clickTime: 104.0,
    caption: '3. Atur jumlah porsi pakai tombol tambah (+) atau kurang (−).',
  },
  {
    id: 'step1-click-sambal',
    stepId: 'step-1-portion',
    startTime: 105.6,
    endTime: 107.6,
    screen: 'portion-modal',
    action: 'click',
    targetSelector: '[data-tutorial="portion-sambal"]',
    clickSfx: true,
    clickTime: 106.1,
    caption: '4. Klik pilihan Sambal Khas Lasinrang (Campur, Dipisah, atau Tanpa Sambal).',
  },
  {
    id: 'step1-add-bakwan-qty',
    stepId: 'step-1-portion',
    startTime: 107.6,
    endTime: 110.2,
    screen: 'portion-modal',
    action: 'click',
    targetSelector: '[data-tutorial="portion-topping-bakwan"]',
    clickSfx: true,
    clickTime: 109.2,
    caption: '5. Mau tambah Bakwan Goreng Renyah (+Rp 1.000)? Atur jumlahnya.',
  },
  {
    id: 'step1-click-topping-scope-sebagian',
    stepId: 'step-1-portion',
    startTime: 110.2,
    endTime: 117.5,
    screen: 'portion-modal',
    action: 'click',
    targetSelector: '[data-tutorial="portion-topping-scope-partial"]',
    clickSfx: true,
    clickTime: 113.3,
    caption:
      'Kalau pesan lebih dari 1 porsi, klik "Hanya Sebagian Porsi" supaya harga toping tidak ikut dikali semua!',
  },
  {
    id: 'step1-check-extra-side',
    stepId: 'step-1-portion',
    startTime: 117.5,
    endTime: 120.4,
    screen: 'portion-modal',
    action: 'click',
    targetSelector: '[data-tutorial="portion-extra-side"]',
    clickSfx: true,
    clickTime: 119.2,
    caption: '6. Mau tambah lauk ekstra? Tinggal centang saja.',
  },
  {
    id: 'step1-type-item-note',
    stepId: 'step-1-portion',
    startTime: 120.4,
    endTime: 122.4,
    screen: 'portion-modal',
    action: 'type',
    targetSelector: '[data-tutorial="portion-item-note"]',
    clickSfx: false,
    caption: '7. Tulis catatan khusus pesanan ini kalau ada.',
    meta: { typedValue: 'Sambal pisah, bakwan hangat ya' },
  },
  {
    id: 'step1-click-masukkan-pesanan',
    stepId: 'step-1-portion',
    startTime: 122.4,
    endTime: 125.2,
    screen: 'portion-modal',
    action: 'click',
    targetSelector: '[data-tutorial="btn-masukkan-pesanan"]',
    clickSfx: true,
    clickTime: 123.1,
    caption: 'Lalu klik tombol "Masukkan Pesanan".',
  },

  // =========================================================================
  // 5. LANGKAH 2 — CHECKOUT, KURIR & PIN GOOGLE MAPS (125.2 – 154.5 dtk)
  // =========================================================================
  {
    id: 'step2-checkout-review-cart',
    stepId: 'step-2-checkout',
    startTime: 125.2,
    endTime: 127.6,
    screen: 'checkout-modal',
    action: 'highlight',
    targetSelector: '[data-tutorial="checkout-cart-list"]',
    clickSfx: false,
    caption: 'Kedua, di halaman Checkout, cek ulang daftar pesanan Kakak.',
  },
  {
    id: 'step2-type-customer-identity',
    stepId: 'step-2-checkout',
    startTime: 127.6,
    endTime: 130.7,
    screen: 'checkout-modal',
    action: 'type',
    targetSelector: '[data-tutorial="checkout-customer-name"]',
    clickSfx: false,
    caption: 'Lalu isi Nama Lengkap dan Nomor WhatsApp Aktif.',
    meta: {
      typedValue: 'Kak Andi Nurul',
      secondaryTypedValue: '0823-6395-3662',
    },
  },
  {
    id: 'step2-click-fulfillment-section',
    stepId: 'step-2-checkout',
    startTime: 130.7,
    endTime: 133.7,
    screen: 'checkout-modal',
    action: 'click',
    targetSelector: '[data-tutorial="checkout-fulfillment-section"]',
    clickSfx: true,
    clickTime: 131.8,
    caption: 'Berikutnya, klik Metode Penerimaan Pesanan.',
  },
  {
    id: 'step2-highlight-pickup',
    stepId: 'step-2-checkout',
    startTime: 133.7,
    endTime: 137.2,
    screen: 'checkout-modal',
    action: 'click',
    targetSelector: '[data-tutorial="fulfillment-pickup"]',
    clickSfx: true,
    clickTime: 134.2,
    caption: '1. Ambil Sendiri di depan Patung Lasinrang (Bebas Ongkir).',
  },
  {
    id: 'step2-highlight-ojol-copy-coord',
    stepId: 'step-2-checkout',
    startTime: 137.2,
    endTime: 140.5,
    screen: 'checkout-modal',
    action: 'click',
    targetSelector: '[data-tutorial="fulfillment-own-courier"]',
    clickSfx: true,
    clickTime: 137.6,
    caption: '2. Pakai GoFood atau Maxim lalu salin titik jemput resmi kedai.',
  },
  {
    id: 'step2-click-kurir-pinrang',
    stepId: 'step-2-checkout',
    startTime: 140.5,
    endTime: 143.1,
    screen: 'checkout-modal',
    action: 'click',
    targetSelector: '[data-tutorial="fulfillment-help-courier"]',
    clickSfx: true,
    clickTime: 141.0,
    caption: 'Atau klik "3. Pakai Kurir Area Kota Pinrang".',
  },
  {
    id: 'step2-click-ambil-lokasi-saya',
    stepId: 'step-2-checkout',
    startTime: 143.1,
    endTime: 146.3,
    screen: 'map-picker',
    action: 'click',
    targetSelector: '[data-tutorial="btn-ambil-lokasi-saya"]',
    clickSfx: true,
    clickTime: 144.4,
    caption: 'Khusus kurir, klik tombol hijau "AMBIL LOKASI SAYA (GPS)".',
  },
  {
    id: 'step2-drag-green-pin',
    stepId: 'step-2-checkout',
    startTime: 146.3,
    endTime: 148.7,
    screen: 'map-picker',
    action: 'drag-pin',
    targetSelector: '[data-tutorial="map-green-pin"]',
    clickSfx: false,
    caption: 'Geser Pin Hijau tepat di depan rumah atau lorong Kakak.',
  },
  {
    id: 'step2-type-lorong-patokan',
    stepId: 'step-2-checkout',
    startTime: 148.7,
    endTime: 150.7,
    screen: 'map-picker',
    action: 'type',
    targetSelector: '[data-tutorial="map-lorong-patokan"]',
    clickSfx: false,
    caption: 'Isi detail Lorong / Nomor Rumah dan Patokan terdekat.',
    meta: {
      typedValue: 'Lorong 2, Rumah Pagar Hijau',
      secondaryTypedValue: 'Dekat Masjid Agung Al-Munawwir',
    },
  },
  {
    id: 'step2-click-save-permanent-location',
    stepId: 'step-2-checkout',
    startTime: 150.7,
    endTime: 154.5,
    screen: 'map-picker',
    action: 'click',
    targetSelector: '[data-tutorial="btn-simpan-lokasi-permanen"]',
    clickSfx: true,
    clickTime: 151.2,
    caption:
      'Lalu klik tombol "Simpan Lokasi Permanen" biar nanti tinggal pilih!',
  },

  // =========================================================================
  // 6. LANGKAH 3 — PEMBAYARAN NON-COD & UNGGAH BUKTI (154.5 – 176.1 dtk)
  // =========================================================================
  {
    id: 'step3-scroll-payment-non-cod',
    stepId: 'step-3-payment',
    startTime: 154.5,
    endTime: 157.7,
    screen: 'payment-section',
    action: 'scroll',
    targetSelector: '[data-tutorial="checkout-payment-section"]',
    clickSfx: false,
    caption: 'Langkah terakhir: Pembayaran Langsung (Non-COD).',
  },
  {
    id: 'step3-click-qris-zoom-download',
    stepId: 'step-3-payment',
    startTime: 157.7,
    endTime: 161.6,
    screen: 'payment-section',
    action: 'click',
    targetSelector: '[data-tutorial="btn-unduh-qris"]',
    clickSfx: true,
    clickTime: 158.6,
    caption: 'Klik "Perbesar" atau "Unduh QRIS" untuk langsung scan dari m-banking / e-wallet.',
  },
  {
    id: 'step3-click-ewallet-pay-copy',
    stepId: 'step-3-payment',
    startTime: 161.6,
    endTime: 166.4,
    screen: 'payment-section',
    action: 'toast',
    targetSelector: '[data-tutorial="btn-bayar-langsung"]',
    clickSfx: true,
    clickTime: 164.2,
    caption:
      'Atau transfer ke GoPay & DANA (0821-5089-754) dengan klik "Bayar Langsung" atau "Salin Nomor".',
    meta: { toastText: 'Nomor GoPay/DANA 0821-5089-754 berhasil disalin!' },
  },
  {
    id: 'step3-click-upload-payment-proof',
    stepId: 'step-3-payment',
    startTime: 166.4,
    endTime: 170.7,
    screen: 'payment-section',
    action: 'click',
    targetSelector: '[data-tutorial="btn-upload-bukti-bayar"]',
    clickSfx: true,
    clickTime: 168.2,
    caption: 'Setelah transfer berhasil, klik "Unggah Foto Bukti Pembayaran".',
  },
  {
    id: 'step3-click-periksa-pratinjau',
    stepId: 'step-3-payment',
    startTime: 170.7,
    endTime: 172.8,
    screen: 'payment-section',
    action: 'click',
    targetSelector: '[data-tutorial="btn-periksa-pratinjau"]',
    clickSfx: true,
    clickTime: 171.1,
    caption: 'Lalu klik tombol "Periksa & Pratinjau Pesanan".',
  },
  {
    id: 'step3-review-order-preview',
    stepId: 'step-3-payment',
    startTime: 172.8,
    endTime: 176.1,
    screen: 'order-preview',
    action: 'scroll',
    targetSelector: '[data-tutorial="order-preview-summary"]',
    clickSfx: false,
    caption: 'Kalau rinciannya sudah pas semua, cukup klik satu tombol:',
  },

  // =========================================================================
  // 7. FINAL & PENUTUP — KIRIM WA, TUR RUTE 3D & SALAM (176.1 – 201.9 dtk)
  // =========================================================================
  {
    id: 'final-click-kirim-whatsapp',
    stepId: 'final-outro',
    startTime: 176.1,
    endTime: 177.8,
    screen: 'order-preview',
    action: 'click',
    targetSelector: '[data-tutorial="btn-kirim-whatsapp"]',
    clickSfx: true,
    clickTime: 176.3,
    caption: 'Klik "Kirim Pesanan ke WhatsApp"!',
  },
  {
    id: 'final-whatsapp-sent-simulation',
    stepId: 'final-outro',
    startTime: 177.8,
    endTime: 184.1,
    screen: 'whatsapp-preview',
    action: 'highlight',
    targetSelector: '[data-tutorial="whatsapp-proof-reminder"]',
    clickSfx: false,
    caption:
      'Otomatis format pesanan lengkap beserta link Google Maps langsung masuk ke WhatsApp Admin kami!',
  },
  {
    id: 'final-highlight-3d-route-tour',
    stepId: 'final-outro',
    startTime: 184.1,
    endTime: 190.5,
    screen: 'home',
    action: 'highlight',
    targetSelector: '[data-tutorial="section-3d-route-tour"]',
    clickSfx: false,
    caption:
      'Di bagian bawah website juga tersedia Tur Video Rute 3D buat Kakak yang baru pertama kali mampir ke lapak.',
  },
  {
    id: 'outro-closing-card',
    stepId: 'final-outro',
    startTime: 190.5,
    endTime: 201.9,
    screen: 'outro-card',
    action: 'outro',
    targetSelector: '[data-tutorial="outro-closing-card"]',
    clickSfx: false,
    caption:
      'Cepat dan gampang sekali toh Kak? Terima kasih sudah memesan di Nasi Kuning Lasinrang — Wassalamu’alaikum warahmatullahi wabarakatuh!',
  },
];

/**
 * Mengembalikan event timeline yang sedang aktif pada detik tertentu.
 */
export function getActiveTimelineEvent(currentTimeSec: number): TutorialTimelineEvent {
  const safeTime = Number.isFinite(currentTimeSec) ? Math.max(0, currentTimeSec) : 0;
  for (let i = 0; i < TUTORIAL_TIMELINE.length; i += 1) {
    const ev = TUTORIAL_TIMELINE[i];
    if (safeTime >= ev.startTime && safeTime < ev.endTime) {
      return ev;
    }
  }
  return TUTORIAL_TIMELINE[TUTORIAL_TIMELINE.length - 1];
}

/**
 * Mengembalikan bab langkah yang aktif pada detik tertentu.
 */
export function getActiveStepChapter(currentTimeSec: number): TutorialStepChapter {
  const safeTime = Number.isFinite(currentTimeSec) ? Math.max(0, currentTimeSec) : 0;
  for (let i = 0; i < TUTORIAL_STEP_CHAPTERS.length; i += 1) {
    const ch = TUTORIAL_STEP_CHAPTERS[i];
    if (safeTime >= ch.startTime && safeTime < ch.endTime) {
      return ch;
    }
  }
  return TUTORIAL_STEP_CHAPTERS[TUTORIAL_STEP_CHAPTERS.length - 1];
}

/**
 * Mengembalikan daftar event yang memiliki `clickSfx: true` dan waktu kliknya
 * sudah tercapai pada `currentTimeSec` namun belum tercatat pada `playedIds`.
 */
export function getDueClickEvents(
  currentTimeSec: number,
  playedIds: ReadonlySet<string>,
  lookbackSec = 0.25
): TutorialTimelineEvent[] {
  const safeTime = Number.isFinite(currentTimeSec) ? Math.max(0, currentTimeSec) : 0;
  return TUTORIAL_TIMELINE.filter((ev) => {
    if (!ev.clickSfx || playedIds.has(ev.id)) return false;
    const triggerAt = typeof ev.clickTime === 'number' ? ev.clickTime : ev.startTime;
    return safeTime >= triggerAt && safeTime - triggerAt <= lookbackSec;
  });
}

/**
 * Mengembalikan daftar ID event klik yang terjadi pada atau setelah `targetTimeSec`
 * (berguna untuk reset selektif saat pengguna melakukan seek mundur).
 */
export function getClickEventIdsFromTime(targetTimeSec: number): string[] {
  const safeTime = Number.isFinite(targetTimeSec) ? Math.max(0, targetTimeSec) : 0;
  return TUTORIAL_TIMELINE.filter((ev) => {
    if (!ev.clickSfx) return false;
    const triggerAt = typeof ev.clickTime === 'number' ? ev.clickTime : ev.startTime;
    return triggerAt >= safeTime;
  }).map((ev) => ev.id);
}

/**
 * Pemetaan rentang detik presisi pada `public/audio/tutorial/full-tutorial.mp3`
 * untuk bab pemutar tutorial (0.0 dtk – 201.9 dtk tanpa celah).
 */
export const TUTORIAL_CHAPTER_AUDIO_RANGES: Record<
  string,
  { startTime: number; endTime: number }
> = {
  'intro-menu': { startTime: 0.0, endTime: 85.3 },
  'portion-sambal': { startTime: 85.3, endTime: 125.2 },
  'identity-delivery': { startTime: 125.2, endTime: 143.1 },
  'google-maps-pin': { startTime: 143.1, endTime: 154.5 },
  'payment-methods': { startTime: 154.5, endTime: 170.7 },
  'preview-whatsapp': { startTime: 170.7, endTime: 201.9 },
};

export function getChapterAudioRange(
  chapterId: string,
  totalDurationSec = TUTORIAL_TOTAL_DURATION_SEC
): { startTime: number; endTime: number; duration: number } {
  const range = TUTORIAL_CHAPTER_AUDIO_RANGES[chapterId] ?? {
    startTime: 0,
    endTime: totalDurationSec,
  };
  const startTime = Math.max(0, Math.min(totalDurationSec, range.startTime));
  const endTime = Math.max(
    startTime + 0.5,
    Math.min(totalDurationSec, range.endTime)
  );
  return {
    startTime,
    endTime,
    duration: Math.max(0.5, endTime - startTime),
  };
}
