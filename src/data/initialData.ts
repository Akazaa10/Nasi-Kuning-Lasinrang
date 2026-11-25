import {
  MenuItem,
  PortionPresetConfig,
  SambalOptionConfig,
  StoreConfig,
  ToppingOption,
} from '../types';

import qrisCleanImg from '../assets/images/qris_nasi_kuning_lasinrang_clean.jpg';

const bebekPalekkoImg = '/images/menu-official/nasi-kuning-bebek-palekko.jpg';
const cumiTintaHitamImg = '/images/menu-official/nasi-kuning-cumi-tinta-hitam.jpg';
const udangSaosImg = '/images/menu-official/nasi-kuning-udang-saos.jpg';
const ayamBakarImg = '/images/menu-official/nasi-kuning-ayam-bakar.jpg';
const ayamKentuckyImg = '/images/menu-official/nasi-kuning-ayam-kentucky.jpg';
const ayamCincangImg = '/images/menu-official/nasi-kuning-ayam-cincang.jpg';
const ayamKecapImg = '/images/menu-official/nasi-kuning-ayam-kecap.jpg';
const ayamSambalHijauImg = '/images/menu-official/nasi-kuning-ayam-sambal-hijau.jpg';
const ayamSambalImg = '/images/menu-official/nasi-kuning-ayam-sambal.jpg';
const telurSambalImg = '/images/menu-official/nasi-kuning-telur-sambal.jpg';
const telurRebusImg = '/images/menu-official/nasi-kuning-telur-rebus.jpg';
const ikanGorengImg = '/images/menu-official/nasi-kuning-ikan-goreng.jpg';
const bakwanGorengImg = '/assets/aistudio/Duck-ai-image-2026-11-24-02-52_c7755447.jpeg';

export const HERO_IMAGE_URL = bebekPalekkoImg;
export const DEFAULT_REAL_QRIS_URL = qrisCleanImg;

export const NEW_OFFICIAL_MENU_IDS = [
  'nasi-kuning-cumi-tinta-hitam',
  'nasi-kuning-udang-saos',
  'nasi-kuning-ayam-bakar',
] as const;

export const DEFAULT_TOPPING_OPTIONS: ToppingOption[] = [
  {
    id: 'bakwan-goreng',
    name: 'Bakwan Goreng Renyah',
    price: 1000,
    unitLabel: 'per 1 pcs',
    description:
      'Bakwan goreng hangat renyah gurih racikan dapur Lasinrang cuma seribuan aja, pas jadi pelengkap nasi kuning hangat.',
    imageUrl: bakwanGorengImg,
    badgeText: 'Toping Favorit · Rp 1.000',
  },
];

export const DEFAULT_PORTION_PRESETS: PortionPresetConfig = {
  extraPuasLabel: 'Porsi Lebih Puas',
  extraPuasRegulerDelta: 2000,
  extraPuasSpesialDelta: 3000,
  jumboLabel: 'Porsi Jumbo',
  jumboRegulerDelta: 3000,
  jumboSpesialDelta: 5000,
};

export const DEFAULT_EXTRA_SIDE_OPTIONS: string[] = [
  'Telur Rebus',
  'Telur Sambal',
  'Ayam Goreng',
  'Tempe Ekstra',
  'Kerupuk Ekstra',
];

export const DEFAULT_SAMBAL_OPTIONS: SambalOptionConfig[] = [
  {
    id: 'campur',
    label: '🌶️ Pakai Sambal (Campur di Nasi)',
    desc: 'Sambal langsung disiram nikmat di atas nasi kuning hangat',
    enabled: true,
  },
  {
    id: 'pisah',
    label: '🥣 Sambal Dipisah',
    desc: 'Sambal dibungkus terpisah agar bisa diatur sendiri level pedasnya',
    enabled: true,
  },
  {
    id: 'tanpa',
    label: '🚫 Tidak Pakai Sambal',
    desc: 'Cocok untuk anak-anak atau yang tidak menyukai pedas',
    enabled: true,
  },
];

export const INITIAL_STORE_CONFIG: StoreConfig = {
  brandName: 'NASI KUNING LASINRANG',
  tagline: 'Malunra Tongeng • Warisan Rempah Adat Bugis Asli di Jantung Kota Pinrang',
  locationAddress:
    'Jl. Jendral Sudirman (Depan Patung Lasinrang), Macorawalie, Kec. Watang Sawitto, Kota Pinrang 91212',
  pickupCoordinatesText:
    '5MR2+PRV, Macorawalie, Kec. Watang Sawitto, Kabupaten Pinrang, Sulawesi Selatan 91212',
  operatingHours: 'Buka Setiap Malam • Mulai Pukul 18.30 WITA – Sampai Habis',
  isOpenLive: true,
  liveStatusText: 'LIVE • SEDANG BUKA DI DEPAN PATUNG LASINRANG',
  whatsappNumber: '6282363953662',
  whatsappDisplay: '+62 823-6395-3662',
  ewalletNumber: '08215089754',
  ewalletDisplay: '+62 821-5089-754',
  qrisMerchantName: 'NASI KUNING LASINRANG, WTNG SWT',
  qrisNmid: 'ID1026523395907',
  qrisTerminalId: 'A01',
  qrisPrintedBy: '93600914',
  qrisVersion: 'v0.0.2026.05.22',
  qrisImageUrl: DEFAULT_REAL_QRIS_URL,
  gofoodUrl: 'https://gofood.co.id',
  maximUrl: 'https://taximaxim.com/id/id/',
  googleMapsQuery: 'Patung Lasinrang, Jl. Jenderal Sudirman, Kabupaten Pinrang, Sulawesi Selatan',
  portionPresets: DEFAULT_PORTION_PRESETS,
  extraSideOptions: DEFAULT_EXTRA_SIDE_OPTIONS,
  sambalOptions: DEFAULT_SAMBAL_OPTIONS,
};

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'nasi-kuning-bebek-palekko',
    name: 'Nasi Kuning Bebek Palekko',
    category: 'spesial',
    basePrice: 15000,
    description:
      'Mahakarya kuliner adat Bugis Pinrang. Nasi kuning harum santan kunyit asli berpadu dengan Bebek Palekko cincang kaya rempah lengkuas, serai, asam, dan cabai pilihan.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Bebek Palekko Bugis',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: bebekPalekkoImg,
    signatureTag: 'Spesial Adat Bugis · Komplit',
    isAvailable: true,
    spiceLevel: 'Pedas Rempah Palekko',
  },
  {
    id: 'nasi-kuning-cumi-tinta-hitam',
    name: 'Nasi Kuning Cumi Tinta Hitam',
    category: 'spesial',
    basePrice: 15000,
    description:
      'Cumi segar pilihan dimasak dengan bumbu tinta hitam rempah Bugis yang gurih pekat, harum daun jeruk dan cabai iris, berpadu sempurna dengan nasi kuning pulen hangat.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Cumi Tinta Hitam',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: cumiTintaHitamImg,
    signatureTag: 'Menu Baru · Cumi Tinta Hitam',
    isAvailable: true,
    spiceLevel: 'Gurih Rempah Hitam',
  },
  {
    id: 'nasi-kuning-udang-saos',
    name: 'Nasi Kuning Udang Saos Asam Manis',
    category: 'spesial',
    basePrice: 15000,
    description:
      'Udang segar berdaging manis dimasak dalam balutan saos asam manis gurih kental kaya bumbu rempah, disajikan komplit bersama nasi kuning harum, tempe manis gurih, mie goreng kecap, dan kerupuk renyah.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Udang Saos Asam Manis',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: udangSaosImg,
    signatureTag: 'Menu Baru · Saos Asam Manis',
    isAvailable: true,
    spiceLevel: 'Asam Manis Gurih',
  },
  {
    id: 'nasi-kuning-ayam-bakar',
    name: 'Nasi Kuning Ayam Bakar',
    category: 'reguler',
    basePrice: 10000,
    description:
      'Ayam bakar bumbu kecap rempah pilihan dengan aroma panggangan smoky yang karamel manis gurih dan daging empuk, lengkap dengan nasi kuning harum serta lauk pendamping.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Ayam Bakar Bumbu',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: ayamBakarImg,
    signatureTag: 'Menu Baru · Ayam Bakar Komplit',
    isAvailable: true,
    spiceLevel: 'Manis Gurih Berempah',
  },
  {
    id: 'nasi-kuning-ayam-kentucky',
    name: 'Nasi Kuning Ayam Kentucky',
    category: 'reguler',
    basePrice: 10000,
    description:
      'Nasi kuning hangat beraroma kunyit berpadu ayam goreng tepung renyah keemasan yang gurih di luar dan lembut di dalam, lengkap dengan lauk pendamping.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Ayam Kentucky Renyah',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: ayamKentuckyImg,
    signatureTag: 'Kriuk Renyah · Komplit',
    isAvailable: true,
    spiceLevel: 'Gurih Renyah',
  },
  {
    id: 'nasi-kuning-ayam-cincang',
    name: 'Nasi Kuning Ayam Cincang',
    category: 'reguler',
    basePrice: 10000,
    description:
      'Potongan ayam cincang berbumbu rempah kuning gurih yang meresap sempurna, mudah disantap bersama nasi kuning pulen, tempe manis, mie goreng, dan kerupuk.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Ayam Cincang Bumbu',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: ayamCincangImg,
    signatureTag: 'Bumbu Meresap · Komplit',
    isAvailable: true,
    spiceLevel: 'Gurih Rempah',
  },
  {
    id: 'nasi-kuning-ayam-kecap',
    name: 'Nasi Kuning Ayam Kecap',
    category: 'reguler',
    basePrice: 10000,
    description:
      'Olahan ayam empuk yang dimasak dengan bumbu kecap manis gurih dan rempah hangat rumahan khas Pinrang. Cocok untuk semua kalangan.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Ayam Kecap Manis Gurih',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: ayamKecapImg,
    signatureTag: 'Manis Gurih · Komplit',
    isAvailable: true,
    spiceLevel: 'Manis Gurih Hangat',
  },
  {
    id: 'nasi-kuning-ayam-sambal-hijau',
    name: 'Nasi Kuning Ayam Sambal Hijau',
    category: 'reguler',
    basePrice: 10000,
    description:
      'Ayam goreng berbumbu yang disajikan dengan sambal cabai hijau segar beraroma daun jeruk, lengkap dengan lauk pendamping.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Ayam Sambal Hijau',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: ayamSambalHijauImg,
    signatureTag: 'Cabai Hijau · Komplit',
    isAvailable: true,
    spiceLevel: 'Pedas Segar Aromatik',
  },
  {
    id: 'nasi-kuning-ayam-sambal',
    name: 'Nasi Kuning Ayam Balado',
    category: 'reguler',
    basePrice: 10000,
    description:
      'Perpaduan nasi kuning hangat dengan ayam berbumbu balado merah rempah pilihan yang kaya rasa gurih dan pedas seimbang, lengkap dengan tempe manis gurih, mie goreng kecap, dan kerupuk renyah.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Ayam Balado Merah',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: ayamSambalImg,
    signatureTag: 'Balado Merah · Komplit',
    isAvailable: true,
    spiceLevel: 'Pedas Gurih Nikmat',
  },
  {
    id: 'nasi-kuning-telur-sambal',
    name: 'Nasi Kuning Telur Sambal Saos',
    category: 'reguler',
    basePrice: 10000,
    description:
      'Telur pilihan yang dimasak dalam balutan sambal saos merah gurih, disajikan bersama nasi kuning harum, tempe manis gurih, mie goreng kecap, dan kerupuk renyah.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Telur Sambal Saos',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: telurSambalImg,
    signatureTag: 'Telur Sambal Saos · Komplit',
    isAvailable: true,
    spiceLevel: 'Pedas Manis Gurih',
  },
  {
    id: 'nasi-kuning-telur-rebus',
    name: 'Nasi Kuning Telur Rebus',
    category: 'reguler',
    basePrice: 10000,
    description:
      'Pilihan klasik yang ringan dan mengenyangkan. Nasi kuning santan kunyit asli dengan telur rebus matang sempurna, tempe manis, mie goreng, dan kerupuk.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Telur Rebus',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: telurRebusImg,
    signatureTag: 'Klasik Ringan · Komplit',
    isAvailable: true,
    spiceLevel: 'Gurih Ringan',
  },
  {
    id: 'nasi-kuning-ikan-goreng',
    name: 'Nasi Kuning Ikan Goreng',
    category: 'reguler',
    basePrice: 10000,
    description:
      'Ikan segar marinasi bumbu kunyit yang digoreng garing keemasan, sangat serasi disantap dengan nasi kuning pulen, sambal, tempe, mie goreng, dan kerupuk.',
    sidesIncluded: [
      'Nasi Kuning Harum',
      'Ikan Goreng Kunyit',
      'Tempe Manis Gurih',
      'Mie Goreng Kecap',
      'Kerupuk Renyah',
    ],
    imageUrl: ikanGorengImg,
    signatureTag: 'Ikan Goreng · Komplit',
    isAvailable: true,
    spiceLevel: 'Gurih Garing',
  },
];

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
