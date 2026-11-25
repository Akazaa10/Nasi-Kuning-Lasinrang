/**
 * Master 1:1 Timeline untuk Video Navigator 3D Satelit Google Maps — Nasi Kuning Lasinrang
 *
 * Seluruh timestamp (detik desimal) dipetakan langsung berdasarkan audit audio master:
 * `public/audio/location/full-location-tour.mp3` (durasi aktual: 80.35 detik).
 *
 * Koordinat GPS AKURAT SUB-METER hasil dekode Plus Code resmi `6P8X5MR2+PRV`
 * (`-3.808138, 119.652047`) + waypoint jalan aspal asli Kota Pinrang dari OSRM.
 */

export const LOCATION_TOUR_AUDIO_URL = '/audio/location/full-location-tour.mp3';
export const LOCATION_TOUR_TOTAL_DURATION_SEC = 80.4;

export const LOCATION_OFFICIAL_MAPS_URL = 'https://maps.app.goo.gl/Xw2BgQyDot5McXvv9';
export const LOCATION_OFFICIAL_PLUS_CODE = '5MR2+PRV';
export const LOCATION_OFFICIAL_PLUS_CODE_FULL =
  '5MR2+PRV, Macorawalie, Kec. Watang Sawitto, Kabupaten Pinrang, Sulawesi Selatan 91212';
export const LOCATION_OFFICIAL_ADDRESS =
  'Jl. Jenderal Sudirman (Pertigaan Depan Patung Lasinrang), Kel. Macorawalie, Kec. Watang Sawitto, Kota Pinrang';
export const LOCATION_OPENING_HOURS = '18.30 WITA – Habis';

export interface GeoCoord {
  lat: number;
  lng: number;
}

/**
 * Koordinat GPS asli terverifikasi Plus Code `5MR2+PRV` & poros jalan nyata Kota Pinrang.
 */
export const LOCATION_TOUR_COORDS = {
  kotaPinrangOverview: { lat: -3.8072, lng: 119.6519 },
  /** Titik akurat Plus Code 6P8X5MR2+PRV — Lapak Nasi Kuning Lasinrang (tepi timur Jl. Jend. Sudirman) */
  kedai: { lat: -3.808138, lng: 119.652047 },
  /** Ruko Pink Toko Kosmetik Hanami tepat di belakang/timur lapak */
  tokoHanamiPink: { lat: -3.808135, lng: 119.652145 },
  /** Monumen / Bundaran Patung Lasinrang tepat di seberang barat Jl. Jenderal Sudirman */
  patungLasinrang: { lat: -3.808128, lng: 119.651785 },
  /** Titik poros Jl. Jenderal Sudirman 150m di utara (arah Mall Sejahtera) */
  mallSejahtera: { lat: -3.80672, lng: 119.651991 },
  /** Titik poros Jl. Jenderal Sudirman 320m di selatan (arah Lapangan Bosowa) */
  lapanganBosowa: { lat: -3.811036, lng: 119.652055 },
  /** Pasar Sentral Pinrang (poros Jl. Sultan Hasanuddin — arah utara-barat) */
  pasarSentral: { lat: -3.79099, lng: 119.652038 },
  /** Pertemuan Jl. Sultan Hasanuddin masuk ke Jl. Jenderal Sudirman */
  simpangHasanuddinSudirman: { lat: -3.795297, lng: 119.651778 },
} as const satisfies Record<string, GeoCoord>;

export interface LocationCameraState {
  center: GeoCoord;
  zoom: number;
  pitch: number;
  bearing: number;
}

export type LocationSceneId =
  | 'scene-1-intro-alamat'
  | 'scene-2-ruko-pink-hanami'
  | 'scene-3-rute-patung-lasinrang'
  | 'scene-4-rute-utara-mall-sejahtera'
  | 'scene-5-rute-selatan-lapangan-bosowa'
  | 'scene-6-rute-pasar-sentral'
  | 'scene-7-jam-buka-cta';

export type LocationNavTurnIcon =
  | 'pin'
  | 'straight'
  | 'cross'
  | 'left'
  | 'right'
  | 'turn-left'
  | 'arrive';

export type LocationSubCueHighlight =
  | 'aerial-pinrang'
  | 'address-sudirman'
  | 'monumen-lasinrang'
  | 'ruko-pink-hanami'
  | 'pin-lapak-utama'
  | 'cross-patung-to-hanami'
  | 'route-north-150m'
  | 'side-left-label'
  | 'route-south-320m'
  | 'side-right-label'
  | 'route-hasanuddin'
  | 'turn-left-sudirman'
  | 'opening-hours-card'
  | 'cta-google-maps'
  | 'cta-plus-code'
  | 'closing-welcome';

export interface LocationSubCue {
  id: string;
  startTime: number;
  endTime: number;
  caption: string;
  highlight: LocationSubCueHighlight;
}

export interface LocationRouteSpec {
  id: string;
  originName: string;
  destinationName: string;
  streetName: string;
  distanceLabel: string;
  distanceMeters: number;
  sideOfRoadLabel?: string;
  maneuverSummary: string;
  lineColor: string;
  glowColor: string;
  drawStartTime: number;
  drawEndTime: number;
  /** Kamera 3D ikut melaju mengikuti panah biru GPS (Google Maps Driving Mode 3D) */
  followCameraAlongRoute?: boolean;
  followZoom?: number;
  followPitch?: number;
  waypoints: GeoCoord[];
  showAnimatedArrow: boolean;
}

export interface LocationCtaOverlaySpec {
  showFromSec: number;
  openingHoursLabel: string;
  mapsButtonLabel: string;
  mapsButtonHighlightStartSec: number;
  plusCodeLabel: string;
  plusCodeValue: string;
  plusCodeHighlightStartSec: number;
  pickupAppsNote: string;
}

export interface LocationTourScene {
  id: LocationSceneId;
  sceneNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  shortLabel: string;
  title: string;
  subtitle: string;
  /** Nama jalan utama yang ditampilkan di bar hijau Navigator Google Maps */
  navStreetTitle: string;
  /** Instruksi singkat ala Google Maps Turn-by-Turn */
  navInstruction: string;
  navTurnIcon: LocationNavTurnIcon;
  /** Kecepatan simulasi (km/j) pada speedometer navigator */
  simulatedSpeedKmh: number;
  startTime: number;
  endTime: number;
  startCamera: LocationCameraState;
  endCamera: LocationCameraState;
  orbit360?: boolean;
  highlightedLandmarks: Array<keyof typeof LOCATION_TOUR_COORDS>;
  highlightBadge?: {
    text: string;
    subtext?: string;
    tone: 'amber' | 'pink' | 'blue' | 'emerald';
    showFromSec: number;
  };
  route?: LocationRouteSpec;
  ctaOverlay?: LocationCtaOverlaySpec;
  subCues: LocationSubCue[];
}

export const LOCATION_TOUR_TIMELINE: LocationTourScene[] = [
  // =========================================================================
  // SCENE 1 (0.0s – 19.7s): Intro & Zoom Satelit 3D ke 5MR2+PRV Jl. Sudirman
  // =========================================================================
  {
    id: 'scene-1-intro-alamat',
    sceneNumber: 1,
    shortLabel: 'Intro & Alamat',
    title: 'Nasi Kuning Lasinrang · 5MR2+PRV',
    subtitle: 'Jl. Jenderal Sudirman, Macorawalie, Watang Sawitto',
    navStreetTitle: 'Jl. Jenderal Sudirman · 5MR2+PRV',
    navInstruction: 'Kel. Macorawalie, Kec. Watang Sawitto — Seberang Patung Lasinrang',
    navTurnIcon: 'pin',
    simulatedSpeedKmh: 0,
    startTime: 0.0,
    endTime: 19.7,
    startCamera: {
      center: LOCATION_TOUR_COORDS.kotaPinrangOverview,
      zoom: 16.5,
      pitch: 50,
      bearing: -12,
    },
    endCamera: {
      center: LOCATION_TOUR_COORDS.kedai,
      zoom: 18.4,
      pitch: 60,
      bearing: 8,
    },
    highlightedLandmarks: ['kedai', 'patungLasinrang'],
    highlightBadge: {
      text: 'Jl. Jenderal Sudirman • Plus Code 5MR2+PRV',
      subtext: 'Persis di Seberang Monumen Patung Lasinrang, Kota Pinrang',
      tone: 'amber',
      showFromSec: 10.7,
    },
    subCues: [
      {
        id: 's1-halo',
        startTime: 0.0,
        endTime: 3.6,
        caption: 'Halo Kak! Lagi cari nasi kuning hangat yang enak malam ini?',
        highlight: 'aerial-pinrang',
      },
      {
        id: 's1-mampir',
        startTime: 3.6,
        endTime: 10.6,
        caption: 'Yuk, mampir ki ke Nasi Kuning Lasinrang di Kota Pinrang. Lokasinya gampang banget ditemukan!',
        highlight: 'aerial-pinrang',
      },
      {
        id: 's1-alamat',
        startTime: 10.6,
        endTime: 17.2,
        caption: 'Kedai kami ada tepat di tepi Jl. Jenderal Sudirman, Kel. Macorawalie, Kec. Watang Sawitto.',
        highlight: 'address-sudirman',
      },
      {
        id: 's1-patung',
        startTime: 17.2,
        endTime: 19.7,
        caption: 'Persis di seberang Monumen Patung Lasinrang.',
        highlight: 'monumen-lasinrang',
      },
    ],
  },

  // =========================================================================
  // SCENE 2 (19.7s – 29.0s): Zoom Satelit Real ke Patokan Ruko Pink Hanami
  // =========================================================================
  {
    id: 'scene-2-ruko-pink-hanami',
    sceneNumber: 2,
    shortLabel: 'Patokan Ruko Pink',
    title: 'Patokan: Toko Kosmetik Hanami (Ruko Pink)',
    subtitle: 'Lapak Nasi Kuning Lasinrang tepat di depannya (5MR2+PRV)',
    navStreetTitle: 'Depan Toko Kosmetik Hanami (Pink)',
    navInstruction: 'Cari ruko warna pink cerah — Lapak Nasi Kuning tepat di depannya',
    navTurnIcon: 'pin',
    simulatedSpeedKmh: 0,
    startTime: 19.7,
    endTime: 29.0,
    startCamera: {
      center: LOCATION_TOUR_COORDS.tokoHanamiPink,
      zoom: 18.5,
      pitch: 60,
      bearing: 12,
    },
    endCamera: {
      center: LOCATION_TOUR_COORDS.kedai,
      zoom: 18.9,
      pitch: 63,
      bearing: 44,
    },
    highlightedLandmarks: ['tokoHanamiPink', 'kedai'],
    highlightBadge: {
      text: 'Patokan: Ruko Pink Toko Kosmetik Hanami',
      subtext: 'Lapak Nasi Kuning Lasinrang (5MR2+PRV) tepat di depan ruko pink',
      tone: 'pink',
      showFromSec: 21.2,
    },
    subCues: [
      {
        id: 's2-gampang',
        startTime: 19.7,
        endTime: 21.2,
        caption: 'Biar makin gampang...',
        highlight: 'ruko-pink-hanami',
      },
      {
        id: 's2-hanami-pink',
        startTime: 21.2,
        endTime: 26.0,
        caption: 'Kakak cukup cari Toko Kosmetik Hanami yang bangunannya ruko warna pink cerah.',
        highlight: 'ruko-pink-hanami',
      },
      {
        id: 's2-depannya',
        startTime: 26.0,
        endTime: 29.0,
        caption: 'Nah, lapak Nasi Kuning Lasinrang ada tepat di depannya ya!',
        highlight: 'pin-lapak-utama',
      },
    ],
  },

  // =========================================================================
  // SCENE 3 (29.0s – 36.6s): Navigator Menyeberang dari Patung Lasinrang
  // =========================================================================
  {
    id: 'scene-3-rute-patung-lasinrang',
    sceneNumber: 3,
    shortLabel: 'Dari Patung Lasinrang',
    title: 'Menyeberang dari Patung Lasinrang',
    subtitle: 'Pertigaan Jl. Jenderal Sudirman tepat depan Toko Hanami Pink',
    navStreetTitle: '45 m · Seberang Patung Lasinrang',
    navInstruction: 'Seberangi Jl. Jenderal Sudirman ke pertigaan depan Toko Hanami Pink',
    navTurnIcon: 'cross',
    simulatedSpeedKmh: 12,
    startTime: 29.0,
    endTime: 36.6,
    startCamera: {
      center: LOCATION_TOUR_COORDS.patungLasinrang,
      zoom: 18.4,
      pitch: 60,
      bearing: 75,
    },
    endCamera: {
      center: LOCATION_TOUR_COORDS.kedai,
      zoom: 18.8,
      pitch: 62,
      bearing: 90,
    },
    highlightedLandmarks: ['patungLasinrang', 'kedai', 'tokoHanamiPink'],
    highlightBadge: {
      text: 'Dari Bundaran Patung Lasinrang',
      subtext: 'Tinggal menyeberang ke pertigaan tepat di depan Toko Hanami Pink',
      tone: 'amber',
      showFromSec: 31.5,
    },
    route: {
      id: 'route-patung-lasinrang',
      originName: 'Bundaran Patung Lasinrang',
      destinationName: 'Lapak Nasi Kuning Lasinrang (5MR2+PRV)',
      streetName: 'Pertigaan Jl. Jenderal Sudirman',
      distanceLabel: '45 m',
      distanceMeters: 45,
      sideOfRoadLabel: 'Pertigaan Depan Toko Hanami Pink',
      maneuverSummary: 'Seberangi Jl. Jenderal Sudirman menuju depan Toko Hanami Pink',
      lineColor: '#1A73E8',
      glowColor: 'rgba(56, 189, 248, 0.55)',
      drawStartTime: 30.2,
      drawEndTime: 35.8,
      followCameraAlongRoute: true,
      followZoom: 18.5,
      followPitch: 61,
      showAnimatedArrow: true,
      waypoints: [
        LOCATION_TOUR_COORDS.patungLasinrang,
        { lat: -3.808133, lng: 119.65191 },
        { lat: -3.808139, lng: 119.652003 },
        LOCATION_TOUR_COORDS.kedai,
      ],
    },
    subCues: [
      {
        id: 's3-sekitar-patung',
        startTime: 29.0,
        endTime: 31.5,
        caption: 'Kalau Kakak lagi di sekitar Patung Lasinrang,',
        highlight: 'monumen-lasinrang',
      },
      {
        id: 's3-menyeberang',
        startTime: 31.5,
        endTime: 34.0,
        caption: 'tinggal menyeberang aja.',
        highlight: 'cross-patung-to-hanami',
      },
      {
        id: 's3-pertigaan-hanami',
        startTime: 34.0,
        endTime: 36.6,
        caption: 'Lokasi kami tepat di pertigaan di depan Toko Hanami pink.',
        highlight: 'cross-patung-to-hanami',
      },
    ],
  },

  // =========================================================================
  // SCENE 4 (36.6s – 45.4s): Navigator 3D dari Utara / Mall Sejahtera (150m)
  // =========================================================================
  {
    id: 'scene-4-rute-utara-mall-sejahtera',
    sceneNumber: 4,
    shortLabel: 'Dari Mall Sejahtera',
    title: 'Dari Utara / Mall Sejahtera (150 m)',
    subtitle: 'Lurus ke selatan di Jl. Jenderal Sudirman — Lapak di Kiri Jalan',
    navStreetTitle: '150 m · Jl. Jenderal Sudirman',
    navInstruction: 'Dari arah Utara / Mall Sejahtera lurus ke selatan — Lapak di Kiri Jalan',
    navTurnIcon: 'left',
    simulatedSpeedKmh: 28,
    startTime: 36.6,
    endTime: 45.4,
    startCamera: {
      center: LOCATION_TOUR_COORDS.mallSejahtera,
      zoom: 18.0,
      pitch: 61,
      bearing: 179,
    },
    endCamera: {
      center: LOCATION_TOUR_COORDS.kedai,
      zoom: 18.5,
      pitch: 62,
      bearing: 179,
    },
    highlightedLandmarks: ['mallSejahtera', 'kedai', 'tokoHanamiPink'],
    highlightBadge: {
      text: '← Lapak di Sebelah Kiri Jalan',
      subtext: 'Lurus ke selatan 150 m di Jl. Jenderal Sudirman dari arah Mall Sejahtera',
      tone: 'blue',
      showFromSec: 42.3,
    },
    route: {
      id: 'route-utara-mall-sejahtera',
      originName: 'Arah Utara / Mall Sejahtera',
      destinationName: 'Lapak Nasi Kuning Lasinrang (5MR2+PRV)',
      streetName: 'Jl. Jenderal Sudirman (Arah Selatan)',
      distanceLabel: '150 m',
      distanceMeters: 150,
      sideOfRoadLabel: 'Lapak di Sebelah Kiri Jalan',
      maneuverSummary: 'Lurus ke selatan 150 m di Jl. Jenderal Sudirman',
      lineColor: '#1A73E8',
      glowColor: 'rgba(56, 189, 248, 0.6)',
      drawStartTime: 37.8,
      drawEndTime: 44.8,
      followCameraAlongRoute: true,
      followZoom: 18.2,
      followPitch: 62,
      showAnimatedArrow: true,
      // Waypoint aspal asli Jl. Jenderal Sudirman (OSRM 157m)
      waypoints: [
        { lat: -3.80672, lng: 119.651991 },
        { lat: -3.80706, lng: 119.651992 },
        { lat: -3.807366, lng: 119.65199 },
        { lat: -3.807588, lng: 119.651994 },
        { lat: -3.807799, lng: 119.652 },
        { lat: -3.807994, lng: 119.652001 },
        { lat: -3.808139, lng: 119.652003 },
        LOCATION_TOUR_COORDS.kedai,
      ],
    },
    subCues: [
      {
        id: 's4-utara-mall',
        startTime: 36.6,
        endTime: 39.3,
        caption: 'Kalau dari arah utara atau Mall Sejahtera,',
        highlight: 'route-north-150m',
      },
      {
        id: 's4-lurus-150m',
        startTime: 39.3,
        endTime: 42.6,
        caption: 'lurus terus ke selatan sekitar 150 meter,',
        highlight: 'route-north-150m',
      },
      {
        id: 's4-kiri-jalan',
        startTime: 42.6,
        endTime: 45.4,
        caption: 'nanti lapak kami ada di sebelah kiri jalan.',
        highlight: 'side-left-label',
      },
    ],
  },

  // =========================================================================
  // SCENE 5 (45.4s – 56.7s): Navigator 3D dari Selatan / Lapangan Bosowa (320m)
  // =========================================================================
  {
    id: 'scene-5-rute-selatan-lapangan-bosowa',
    sceneNumber: 5,
    shortLabel: 'Dari Lapangan Bosowa',
    title: 'Dari Selatan / Lapangan Bosowa (320 m)',
    subtitle: 'Lurus ke utara di Jl. Jenderal Sudirman — Lapak di Kanan Jalan',
    navStreetTitle: '320 m · Jl. Jenderal Sudirman',
    navInstruction: 'Dari Lapangan Bosowa lurus ke utara menuju Patung Lasinrang — Kanan Jalan',
    navTurnIcon: 'right',
    simulatedSpeedKmh: 34,
    startTime: 45.4,
    endTime: 56.7,
    startCamera: {
      center: LOCATION_TOUR_COORDS.lapanganBosowa,
      zoom: 17.8,
      pitch: 61,
      bearing: -1,
    },
    endCamera: {
      center: LOCATION_TOUR_COORDS.kedai,
      zoom: 18.5,
      pitch: 62,
      bearing: -1,
    },
    highlightedLandmarks: ['lapanganBosowa', 'patungLasinrang', 'kedai', 'tokoHanamiPink'],
    highlightBadge: {
      text: 'Lapak di Sebelah Kanan Jalan →',
      subtext: 'Lurus ke utara 320 m dari Lapangan Bosowa menuju Bundaran Patung Lasinrang',
      tone: 'emerald',
      showFromSec: 54.0,
    },
    route: {
      id: 'route-selatan-lapangan-bosowa',
      originName: 'Arah Selatan / Lapangan Bosowa',
      destinationName: 'Lapak Nasi Kuning Lasinrang (5MR2+PRV)',
      streetName: 'Jl. Jenderal Sudirman (Arah Utara)',
      distanceLabel: '320 m',
      distanceMeters: 320,
      sideOfRoadLabel: 'Lapak di Sebelah Kanan Jalan',
      maneuverSummary: 'Lurus ke utara 320 m menuju Bundaran Patung Lasinrang',
      lineColor: '#1A73E8',
      glowColor: 'rgba(52, 211, 153, 0.58)',
      drawStartTime: 46.8,
      drawEndTime: 55.8,
      followCameraAlongRoute: true,
      followZoom: 18.1,
      followPitch: 62,
      showAnimatedArrow: true,
      // Waypoint aspal asli Jl. Jenderal Sudirman (OSRM 321m)
      waypoints: [
        { lat: -3.811036, lng: 119.652055 },
        { lat: -3.810712, lng: 119.652044 },
        { lat: -3.810231, lng: 119.652035 },
        { lat: -3.809866, lng: 119.652023 },
        { lat: -3.80947, lng: 119.652014 },
        { lat: -3.809005, lng: 119.65201 },
        { lat: -3.808519, lng: 119.652004 },
        { lat: -3.808315, lng: 119.652005 },
        { lat: -3.808139, lng: 119.652003 },
        LOCATION_TOUR_COORDS.kedai,
      ],
    },
    subCues: [
      {
        id: 's5-selatan-bosowa',
        startTime: 45.4,
        endTime: 49.0,
        caption: 'Buat Kakak yang datang dari arah selatan atau Lapangan Bosowa,',
        highlight: 'route-south-320m',
      },
      {
        id: 's5-lurus-320m',
        startTime: 49.0,
        endTime: 54.3,
        caption: 'lurus aja ke utara sekitar 320 meter menuju Bundaran Patung Lasinrang,',
        highlight: 'route-south-320m',
      },
      {
        id: 's5-kanan-jalan',
        startTime: 54.3,
        endTime: 56.7,
        caption: 'lapak kami ada di sebelah kanan jalan.',
        highlight: 'side-right-label',
      },
    ],
  },

  // =========================================================================
  // SCENE 6 (56.7s – 65.1s): Navigator 3D Pasar Sentral -> Jl. Sultan Hasanuddin -> Jl. Sudirman
  // =========================================================================
  {
    id: 'scene-6-rute-pasar-sentral',
    sceneNumber: 6,
    shortLabel: 'Dari Pasar Sentral',
    title: 'Dari Pasar Sentral Pinrang',
    subtitle: 'Jl. Sultan Hasanuddin → Belok Kiri ke Jl. Jenderal Sudirman',
    navStreetTitle: 'Jl. Sultan Hasanuddin → Jl. Sudirman',
    navInstruction: 'Susuri Jl. Sultan Hasanuddin lalu belok kiri masuk Jl. Jenderal Sudirman',
    navTurnIcon: 'turn-left',
    simulatedSpeedKmh: 36,
    startTime: 56.7,
    endTime: 65.1,
    startCamera: {
      center: { lat: -3.8035, lng: 119.65193 },
      zoom: 17.4,
      pitch: 60,
      bearing: 179,
    },
    endCamera: {
      center: LOCATION_TOUR_COORDS.kedai,
      zoom: 18.4,
      pitch: 61,
      bearing: 179,
    },
    highlightedLandmarks: [
      'pasarSentral',
      'simpangHasanuddinSudirman',
      'patungLasinrang',
      'kedai',
    ],
    highlightBadge: {
      text: '↰ Jl. Sultan Hasanuddin → Jl. Jenderal Sudirman',
      subtext: 'Dari Pasar Sentral langsung mengarah ke Patung Lasinrang / 5MR2+PRV',
      tone: 'blue',
      showFromSec: 60.8,
    },
    route: {
      id: 'route-pasar-sentral',
      originName: 'Pasar Sentral Pinrang',
      destinationName: 'Lapak Nasi Kuning Lasinrang (5MR2+PRV)',
      streetName: 'Jl. Sultan Hasanuddin → Jl. Sudirman',
      distanceLabel: '520 m',
      distanceMeters: 520,
      sideOfRoadLabel: 'Belok Kiri ke Jl. Jenderal Sudirman',
      maneuverSummary: 'Susuri Jl. Sultan Hasanuddin lalu belok kiri ke Jl. Jenderal Sudirman',
      lineColor: '#1A73E8',
      glowColor: 'rgba(56, 189, 248, 0.58)',
      drawStartTime: 57.4,
      drawEndTime: 64.6,
      followCameraAlongRoute: true,
      followZoom: 17.9,
      followPitch: 61,
      showAnimatedArrow: true,
      // Koridor aspal nyata dari arah Pasar Sentral / Jl. Sultan Hasanuddin masuk ke Jl. Jenderal Sudirman -> 5MR2+PRV
      waypoints: [
        { lat: -3.8035, lng: 119.65193 },
        { lat: -3.804484, lng: 119.651943 },
        { lat: -3.805456, lng: 119.651974 },
        { lat: -3.806375, lng: 119.651988 },
        { lat: -3.80706, lng: 119.651992 },
        { lat: -3.807588, lng: 119.651994 },
        { lat: -3.807994, lng: 119.652001 },
        { lat: -3.808139, lng: 119.652003 },
        LOCATION_TOUR_COORDS.kedai,
      ],
    },
    subCues: [
      {
        id: 's6-pasar-sentral',
        startTime: 56.7,
        endTime: 58.8,
        caption: 'Sedangkan dari arah Pasar Sentral,',
        highlight: 'route-hasanuddin',
      },
      {
        id: 's6-hasanuddin',
        startTime: 58.8,
        endTime: 61.1,
        caption: 'cukup susuri Jalan Sultan Hasanuddin,',
        highlight: 'route-hasanuddin',
      },
      {
        id: 's6-belok-kiri',
        startTime: 61.1,
        endTime: 65.1,
        caption: 'lalu belok kiri ke Jalan Jenderal Sudirman arah Patung Lasinrang.',
        highlight: 'turn-left-sudirman',
      },
    ],
  },

  // =========================================================================
  // SCENE 7 (65.1s – 80.4s): Tiba di 5MR2+PRV — Orbit 360° Satelit Real + CTA
  // =========================================================================
  {
    id: 'scene-7-jam-buka-cta',
    sceneNumber: 7,
    shortLabel: 'Tiba & CTA',
    title: 'Buka Setiap Malam 18.30 WITA – Habis',
    subtitle: 'Lokasi Asli 5MR2+PRV · Klik Google Maps atau Salin Plus Code',
    navStreetTitle: 'Tiba di Tujuan · 5MR2+PRV',
    navInstruction: 'Nasi Kuning Lasinrang — Buka Setiap Malam 18.30 WITA – Habis',
    navTurnIcon: 'arrive',
    simulatedSpeedKmh: 0,
    startTime: 65.1,
    endTime: 80.4,
    orbit360: true,
    startCamera: {
      center: LOCATION_TOUR_COORDS.kedai,
      zoom: 18.6,
      pitch: 61,
      bearing: 179,
    },
    endCamera: {
      center: LOCATION_TOUR_COORDS.kedai,
      zoom: 18.8,
      pitch: 59,
      bearing: 539,
    },
    highlightedLandmarks: ['kedai', 'tokoHanamiPink', 'patungLasinrang'],
    highlightBadge: {
      text: 'Buka Setiap Malam • 18.30 WITA – Habis',
      subtext: 'Plus Code 5MR2+PRV untuk titik jemput GoFood & Maxim',
      tone: 'amber',
      showFromSec: 65.2,
    },
    ctaOverlay: {
      showFromSec: 65.2,
      openingHoursLabel: 'Setiap Malam • 18.30 WITA – Habis',
      mapsButtonLabel: 'Buka Google Maps Resmi',
      mapsButtonHighlightStartSec: 70.6,
      plusCodeLabel: 'Salin Plus Code (5MR2+PRV)',
      plusCodeValue: LOCATION_OFFICIAL_PLUS_CODE,
      plusCodeHighlightStartSec: 74.3,
      pickupAppsNote: 'Titik jemput akurat GoFood & Maxim (5MR2+PRV)',
    },
    subCues: [
      {
        id: 's7-jam-buka',
        startTime: 65.1,
        endTime: 70.6,
        caption: 'Kami buka setiap malam mulai jam 18.30 WITA sampai habis.',
        highlight: 'opening-hours-card',
      },
      {
        id: 's7-google-maps',
        startTime: 70.6,
        endTime: 74.3,
        caption: 'Kakak juga bisa langsung klik link Google Maps resmi di website ini,',
        highlight: 'cta-google-maps',
      },
      {
        id: 's7-plus-code',
        startTime: 74.3,
        endTime: 78.4,
        caption: 'atau salin Plus Code (5MR2+PRV) buat titik jemput GoFood dan Maxim.',
        highlight: 'cta-plus-code',
      },
      {
        id: 's7-penutup',
        startTime: 78.4,
        endTime: 80.4,
        caption: 'Kami tunggu kedatangannya ya, Kak!',
        highlight: 'closing-welcome',
      },
    ],
  },
];

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Menghitung arah kompas (bearing derajat 0=Utara, 90=Timur, 180=Selatan, 270=Barat) antar 2 GPS.
 */
export function computeGeoBearing(from: GeoCoord, to: GeoCoord): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Mengambil titik & arah hadap tepat pada fraksi 0..1 sepanjang polyline jalan asli.
 */
export function samplePointAlongWaypoints(
  waypoints: GeoCoord[],
  fraction0to1: number
): { point: GeoCoord; headingDeg: number } {
  if (!waypoints.length) {
    return { point: LOCATION_TOUR_COORDS.kedai, headingDeg: 0 };
  }
  if (waypoints.length === 1) {
    return { point: waypoints[0], headingDeg: 0 };
  }

  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const len = Math.hypot(
      waypoints[i + 1].lng - waypoints[i].lng,
      waypoints[i + 1].lat - waypoints[i].lat
    );
    segLens.push(len);
    total += len;
  }

  const target = clamp01(fraction0to1) * total;
  let acc = 0;
  for (let i = 0; i < segLens.length; i += 1) {
    const len = segLens[i];
    if (acc + len >= target || i === segLens.length - 1) {
      const localT = len > 0 ? clamp01((target - acc) / len) : 0;
      const a = waypoints[i];
      const b = waypoints[i + 1];
      return {
        point: {
          lat: lerp(a.lat, b.lat, localT),
          lng: lerp(a.lng, b.lng, localT),
        },
        headingDeg: computeGeoBearing(a, b),
      };
    }
    acc += len;
  }

  const last = waypoints[waypoints.length - 1];
  const prev = waypoints[waypoints.length - 2];
  return { point: last, headingDeg: computeGeoBearing(prev, last) };
}

/**
 * Mengembalikan scene aktif 1:1 berdasarkan `audioElement.currentTime`.
 */
export function getActiveLocationScene(
  currentTimeSec: number,
  timeline: readonly LocationTourScene[] = LOCATION_TOUR_TIMELINE
): LocationTourScene {
  const safeTime = Math.max(0, currentTimeSec);
  for (let i = 0; i < timeline.length; i += 1) {
    const scene = timeline[i];
    if (safeTime >= scene.startTime && safeTime < scene.endTime) {
      return scene;
    }
  }
  return timeline[timeline.length - 1] ?? LOCATION_TOUR_TIMELINE[LOCATION_TOUR_TIMELINE.length - 1];
}

/**
 * Mengembalikan sub-cue kalimat aktif pada detik tertentu.
 */
export function getActiveLocationSubCue(
  currentTimeSec: number,
  timeline: readonly LocationTourScene[] = LOCATION_TOUR_TIMELINE
): LocationSubCue | null {
  const scene = getActiveLocationScene(currentTimeSec, timeline);
  const safeTime = Math.max(0, currentTimeSec);
  for (let i = 0; i < scene.subCues.length; i += 1) {
    const cue = scene.subCues[i];
    if (safeTime >= cue.startTime && safeTime < cue.endTime) {
      return cue;
    }
  }
  return scene.subCues[scene.subCues.length - 1] ?? null;
}

/**
 * Mengembalikan progres 0..1 dalam scene aktif.
 */
export function getSceneProgress(scene: LocationTourScene, currentTimeSec: number): number {
  const duration = Math.max(0.001, scene.endTime - scene.startTime);
  return clamp01((currentTimeSec - scene.startTime) / duration);
}

/**
 * Menghitung progres penggambaran garis rute & laju panah GPS (0..1).
 */
export function getRouteDrawProgress(scene: LocationTourScene, currentTimeSec: number): number {
  if (!scene.route) return 0;
  const duration = Math.max(0.001, scene.route.drawEndTime - scene.route.drawStartTime);
  return clamp01((currentTimeSec - scene.route.drawStartTime) / duration);
}

/**
 * Menghitung posisi kamera 3D (center, zoom, pitch, bearing) secara 100% deterministik.
 * Untuk scene berkendara (followCameraAlongRoute), kamera 3D otomatis melaju mengikuti
 * panah biru GPS menghadap arah jalan persis seperti Google Maps 3D Driving Navigator!
 */
export function interpolateLocationCamera(
  scene: LocationTourScene,
  currentTimeSec: number
): LocationCameraState {
  if (scene.route?.followCameraAlongRoute && scene.route.waypoints.length >= 2) {
    const routeProgress = getRouteDrawProgress(scene, currentTimeSec);
    const { point, headingDeg } = samplePointAlongWaypoints(scene.route.waypoints, routeProgress);

    // Fokus kamera sedikit di depan panah GPS agar jalan di depan terlihat luas
    const lookAhead = samplePointAlongWaypoints(
      scene.route.waypoints,
      Math.min(1, routeProgress + 0.1)
    ).point;

    const zoomBase = scene.route.followZoom ?? scene.startCamera.zoom;
    const zoomEnd = Math.min(18.85, zoomBase + 0.35);
    const pitch = scene.route.followPitch ?? 61;

    return {
      center: {
        lat: lerp(point.lat, lookAhead.lat, 0.45),
        lng: lerp(point.lng, lookAhead.lng, 0.45),
      },
      zoom: lerp(zoomBase, zoomEnd, routeProgress),
      pitch,
      bearing: headingDeg,
    };
  }

  const rawProgress = getSceneProgress(scene, currentTimeSec);
  const t = scene.orbit360 ? rawProgress : easeInOutCubic(rawProgress);

  const bearing = scene.orbit360
    ? (scene.startCamera.bearing + rawProgress * 360) % 360
    : lerp(scene.startCamera.bearing, scene.endCamera.bearing, t);

  return {
    center: {
      lat: lerp(scene.startCamera.center.lat, scene.endCamera.center.lat, t),
      lng: lerp(scene.startCamera.center.lng, scene.endCamera.center.lng, t),
    },
    zoom: lerp(scene.startCamera.zoom, scene.endCamera.zoom, t),
    pitch: lerp(scene.startCamera.pitch, scene.endCamera.pitch, t),
    bearing,
  };
}
