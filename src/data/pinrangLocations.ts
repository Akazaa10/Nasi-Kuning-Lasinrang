export interface PinrangStreetCorridor {
  id: string;
  streetName: string;
  corridorArea: string;
  kelurahan: string;
  kecamatan: string;
  postalCode: string;
  lat: number;
  lng: number;
  commonAlleys: string[];
  defaultLandmark: string;
  keywords: string[];
}

export interface PinrangLandmark {
  id: string;
  name: string;
  category: 'monumen' | 'masjid' | 'pasar' | 'rs' | 'kantor' | 'taman' | 'sekolah' | 'spbu' | 'perumahan';
  streetName: string;
  kelurahan: string;
  kecamatan: string;
  lat: number;
  lng: number;
  relationHint: string;
}

export const PINRANG_CITY_CENTER = {
  lat: -3.7964,
  lng: 119.6525,
};

export const PINRANG_LANDMARKS: PinrangLandmark[] = [
  {
    id: 'lm-patung-lasinrang',
    name: 'Patung Lasinrang (Monumen Lasinrang)',
    category: 'monumen',
    streetName: 'Jl. Jenderal Sudirman',
    kelurahan: 'Kel. Jaya',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7964,
    lng: 119.6525,
    relationHint: 'Dekat Bundaran Patung Lasinrang',
  },
  {
    id: 'lm-taman-lasinrang',
    name: 'Taman Lasinrang Park',
    category: 'taman',
    streetName: 'Jl. Lasinrang',
    kelurahan: 'Kel. Jaya',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7958,
    lng: 119.6521,
    relationHint: 'Sekitar Taman Lasinrang Park',
  },
  {
    id: 'lm-masjid-agung',
    name: 'Masjid Agung Al-Munawwir Pinrang',
    category: 'masjid',
    streetName: 'Jl. Jenderal Sudirman',
    kelurahan: 'Kel. Macorawalie',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7905,
    lng: 119.6531,
    relationHint: 'Sekitar Masjid Agung Al-Munawwir',
  },
  {
    id: 'lm-pasar-sentral',
    name: 'Pasar Sentral Pinrang',
    category: 'pasar',
    streetName: 'Jl. Sultan Hasanuddin',
    kelurahan: 'Kel. Sawitto',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7928,
    lng: 119.6552,
    relationHint: 'Area Pasar Sentral Pinrang',
  },
  {
    id: 'lm-rsud-lasinrang',
    name: 'RSUD Lasinrang Pinrang',
    category: 'rs',
    streetName: 'Jl. Macan / Jl. Kesehatan',
    kelurahan: 'Kel. Macorawalie',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7972,
    lng: 119.6502,
    relationHint: 'Sekitar RSUD Lasinrang Pinrang',
  },
  {
    id: 'lm-mall-sejahtera',
    name: 'Mall Sejahtera Pinrang',
    category: 'pasar',
    streetName: 'Jl. Jenderal Sudirman',
    kelurahan: 'Kel. Jaya',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7945,
    lng: 119.6528,
    relationHint: 'Sekitar Mall Sejahtera Pinrang',
  },
  {
    id: 'lm-kantor-bupati',
    name: 'Kantor Bupati Pinrang',
    category: 'kantor',
    streetName: 'Jl. Bintang',
    kelurahan: 'Kel. Macorawalie',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7885,
    lng: 119.6518,
    relationHint: 'Dekat Kompleks Kantor Bupati Pinrang',
  },
  {
    id: 'lm-lapangan-bosowa',
    name: 'Lapangan Bosowa Pinrang',
    category: 'taman',
    streetName: 'Jl. Jenderal Sudirman',
    kelurahan: 'Kel. Bentengnge',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7986,
    lng: 119.6538,
    relationHint: 'Sekitar Lapangan Bosowa Pinrang',
  },
  {
    id: 'lm-rs-siti-khadijah',
    name: 'RS Aisyiyah Siti Khadijah Pinrang',
    category: 'rs',
    streetName: 'Jl. Andiisa / Jl. Kartini',
    kelurahan: 'Kel. Jaya',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7939,
    lng: 119.6495,
    relationHint: 'Dekat RS Siti Khadijah Pinrang',
  },
  {
    id: 'lm-terminal-paleteang',
    name: 'Kawasan Paleteang / Poros Rappang',
    category: 'pasar',
    streetName: 'Jl. Poros Pinrang - Rappang',
    kelurahan: 'Kel. Laleng Bata',
    kecamatan: 'Kec. Paleteang',
    lat: -3.7848,
    lng: 119.6582,
    relationHint: 'Sekitar Pertigaan Paleteang',
  },
  {
    id: 'lm-spbu-paleteang',
    name: 'SPBU Paleteang Pinrang',
    category: 'spbu',
    streetName: 'Jl. Poros Pinrang - Rappang',
    kelurahan: 'Kel. Pacongang',
    kecamatan: 'Kec. Paleteang',
    lat: -3.7832,
    lng: 119.6605,
    relationHint: 'Dekat SPBU Paleteang',
  },
  {
    id: 'lm-spbu-corawali',
    name: 'SPBU Corawali (Poros Parepare)',
    category: 'spbu',
    streetName: 'Jl. Poros Pinrang - Parepare',
    kelurahan: 'Kel. Bentengnge',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.8055,
    lng: 119.6512,
    relationHint: 'Sekitar SPBU Corawali Poros Parepare',
  },
  {
    id: 'lm-stadion-bau-massepe',
    name: 'Stadion Bau Massepe Pinrang',
    category: 'taman',
    streetName: 'Jl. Andi Pawelloi',
    kelurahan: 'Kel. Penrang',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7862,
    lng: 119.648,
    relationHint: 'Sekitar Stadion Bau Massepe',
  },
  {
    id: 'lm-sman-1-pinrang',
    name: 'SMAN 1 Pinrang',
    category: 'sekolah',
    streetName: 'Jl. Jenderal Sudirman',
    kelurahan: 'Kel. Jaya',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.7918,
    lng: 119.6526,
    relationHint: 'Dekat SMAN 1 Pinrang',
  },
  {
    id: 'lm-btn-corawali',
    name: 'Perumahan BTN Corawali Pinrang',
    category: 'perumahan',
    streetName: 'Jl. Corawali',
    kelurahan: 'Kel. Bentengnge',
    kecamatan: 'Kec. Watang Sawitto',
    lat: -3.8032,
    lng: 119.6522,
    relationHint: 'Kompleks BTN Corawali',
  },
  {
    id: 'lm-btn-pepabri',
    name: 'Perumahan BTN Pepabri / Laleng Bata',
    category: 'perumahan',
    streetName: 'Jl. Amassangan',
    kelurahan: 'Kel. Laleng Bata',
    kecamatan: 'Kec. Paleteang',
    lat: -3.7875,
    lng: 119.657,
    relationHint: 'Kompleks BTN Pepabri Laleng Bata',
  },
];

export const PINRANG_STREET_CORRIDORS: PinrangStreetCorridor[] = [
  {
    id: 'st-sudirman-lasinrang',
    streetName: 'Jl. Jenderal Sudirman',
    corridorArea: 'Poros Utama Patung Lasinrang - Mall Sejahtera',
    kelurahan: 'Kel. Jaya',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91212',
    lat: -3.7962,
    lng: 119.6525,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Lorong 3'],
    defaultLandmark: 'Dekat Patung Lasinrang / Mall Sejahtera',
    keywords: ['sudirman', 'patung lasinrang', 'mall sejahtera', 'jaya', 'bank bri', 'poros kota'],
  },
  {
    id: 'st-sudirman-masjid-agung',
    streetName: 'Jl. Jenderal Sudirman',
    corridorArea: 'Poros Masjid Agung Al-Munawwir - SMAN 1 Pinrang',
    kelurahan: 'Kel. Macorawalie',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91212',
    lat: -3.791,
    lng: 119.6529,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong Masjid Agung', 'Lorong 1', 'Lorong 2'],
    defaultLandmark: 'Dekat Masjid Agung Al-Munawwir Pinrang',
    keywords: ['sudirman', 'masjid agung', 'al munawwir', 'sman 1', 'macorawalie'],
  },
  {
    id: 'st-lasinrang',
    streetName: 'Jl. Lasinrang',
    corridorArea: 'Kawasan Taman Lasinrang Park & Kuliner Malam',
    kelurahan: 'Kel. Jaya',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91212',
    lat: -3.7955,
    lng: 119.6518,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Lorong 3', 'Lorong 4'],
    defaultLandmark: 'Dekat Taman Lasinrang Park',
    keywords: ['jalan lasinrang', 'taman lasinrang', 'kuliner lasinrang', 'jaya'],
  },
  {
    id: 'st-sultan-hasanuddin',
    streetName: 'Jl. Sultan Hasanuddin',
    corridorArea: 'Poros Pasar Sentral Pinrang - Sawitto',
    kelurahan: 'Kel. Sawitto',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91211',
    lat: -3.7932,
    lng: 119.6548,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Lorong 3', 'Lorong Pasar'],
    defaultLandmark: 'Dekat Pasar Sentral Pinrang',
    keywords: ['sultan hasanuddin', 'hasanuddin', 'pasar sentral', 'sawitto'],
  },
  {
    id: 'st-bintang',
    streetName: 'Jl. Bintang',
    corridorArea: 'Kawasan Kantor Bupati & Perkantoran Macorawalie',
    kelurahan: 'Kel. Macorawalie',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91212',
    lat: -3.7888,
    lng: 119.6516,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Lorong 3'],
    defaultLandmark: 'Sekitar Kantor Bupati Pinrang',
    keywords: ['jalan bintang', 'kantor bupati', 'macorawalie'],
  },
  {
    id: 'st-andi-makkasau',
    streetName: 'Jl. Andi Makkasau',
    corridorArea: 'Poros Tengah Kota - Macorawalie & Jaya',
    kelurahan: 'Kel. Macorawalie',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91212',
    lat: -3.7924,
    lng: 119.6512,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Lorong 3', 'Lorong 4'],
    defaultLandmark: 'Poros Jl. Andi Makkasau Pinrang',
    keywords: ['andi makkasau', 'makkasau', 'macorawalie', 'jaya'],
  },
  {
    id: 'st-kesehatan-macan',
    streetName: 'Jl. Macan / Jl. Kesehatan',
    corridorArea: 'Kawasan RSUD Lasinrang Pinrang',
    kelurahan: 'Kel. Macorawalie',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91212',
    lat: -3.797,
    lng: 119.6501,
    commonAlleys: ['Depan RSUD Lasinrang', 'Lorong 1', 'Lorong 2', 'Lorong Samping RSUD'],
    defaultLandmark: 'Dekat RSUD Lasinrang Pinrang',
    keywords: ['jalan macan', 'jalan kesehatan', 'rsud lasinrang', 'rumah sakit umum'],
  },
  {
    id: 'st-kartini',
    streetName: 'Jl. R.A. Kartini',
    corridorArea: 'Kawasan Kelurahan Jaya & RS Siti Khadijah',
    kelurahan: 'Kel. Jaya',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91212',
    lat: -3.7942,
    lng: 119.6498,
    commonAlleys: ['Pinggir Jalan', 'Lorong 1', 'Lorong 2', 'Lorong 3'],
    defaultLandmark: 'Dekat RS Siti Khadijah / Kel. Jaya',
    keywords: ['kartini', 'siti khadijah', 'jaya'],
  },
  {
    id: 'st-diponegoro',
    streetName: 'Jl. Pangeran Diponegoro',
    corridorArea: 'Kawasan Sawitto & Pusat Pertokoan',
    kelurahan: 'Kel. Sawitto',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91211',
    lat: -3.7948,
    lng: 119.6542,
    commonAlleys: ['Pinggir Jalan', 'Lorong 1', 'Lorong 2', 'Lorong 3'],
    defaultLandmark: 'Poros Jl. Diponegoro Sawitto',
    keywords: ['diponegoro', 'sawitto', 'pertokoan'],
  },
  {
    id: 'st-ahmad-yani',
    streetName: 'Jl. Jenderal Ahmad Yani',
    corridorArea: 'Kawasan Bentengnge & Lapangan Bosowa',
    kelurahan: 'Kel. Bentengnge',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91213',
    lat: -3.7992,
    lng: 119.6534,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Lorong 3'],
    defaultLandmark: 'Sekitar Lapangan Bosowa / Bentengnge',
    keywords: ['ahmad yani', 'bentengnge', 'lapangan bosowa'],
  },
  {
    id: 'st-corawali',
    streetName: 'Jl. Corawali (Poros Pinrang - Parepare)',
    corridorArea: 'Kawasan Bentengnge, Corawali & BTN Corawali',
    kelurahan: 'Kel. Bentengnge',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91213',
    lat: -3.8035,
    lng: 119.6518,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Blok A BTN', 'Blok B BTN', 'Blok C BTN'],
    defaultLandmark: 'Sekitar BTN Corawali / SPBU Corawali',
    keywords: ['corawali', 'btn corawali', 'poros parepare', 'bentengnge'],
  },
  {
    id: 'st-amassangan-lalengbata',
    streetName: 'Jl. Amassangan',
    corridorArea: 'Kawasan Laleng Bata & BTN Pepabri',
    kelurahan: 'Kel. Laleng Bata',
    kecamatan: 'Kec. Paleteang',
    postalCode: '91215',
    lat: -3.7878,
    lng: 119.6565,
    commonAlleys: ['Pinggir Jalan', 'Lorong 1', 'Lorong 2', 'Lorong 3', 'Blok BTN'],
    defaultLandmark: 'Kawasan Laleng Bata / Paleteang',
    keywords: ['amassangan', 'laleng bata', 'paleteang', 'pepabri'],
  },
  {
    id: 'st-poros-rappang-paleteang',
    streetName: 'Jl. Poros Pinrang - Rappang',
    corridorArea: 'Kawasan Paleteang, Pacongang & Benteng Sawitto',
    kelurahan: 'Kel. Pacongang',
    kecamatan: 'Kec. Paleteang',
    postalCode: '91215',
    lat: -3.7842,
    lng: 119.659,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Lorong 3', 'Lorong 4'],
    defaultLandmark: 'Sekitar Pertigaan / SPBU Paleteang',
    keywords: ['poros rappang', 'paleteang', 'pacongang', 'benteng sawitto', 'tirtonadi'],
  },
  {
    id: 'st-poros-langnga',
    streetName: 'Jl. Poros Pinrang - Langnga',
    corridorArea: 'Kawasan Penrang, Stadion Bau Massepe & Pallameang',
    kelurahan: 'Kel. Penrang',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91214',
    lat: -3.7868,
    lng: 119.6478,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Lorong Stadion'],
    defaultLandmark: 'Sekitar Stadion Bau Massepe / Penrang',
    keywords: ['langnga', 'penrang', 'stadion bau massepe', 'andi pawelloi'],
  },
  {
    id: 'st-poros-jampue',
    streetName: 'Jl. Poros Pinrang - Jampue',
    corridorArea: 'Kawasan Salo & Siparappe',
    kelurahan: 'Kel. Salo',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91214',
    lat: -3.7978,
    lng: 119.6455,
    commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Lorong 3'],
    defaultLandmark: 'Kawasan Salo / Poros Jampue',
    keywords: ['jampue', 'salo', 'siparappe'],
  },
  {
    id: 'st-serigala-gajah',
    streetName: 'Jl. Serigala / Jl. Gajah',
    corridorArea: 'Kawasan Pemukiman Macorawalie & Jaya',
    kelurahan: 'Kel. Macorawalie',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91212',
    lat: -3.7962,
    lng: 119.6488,
    commonAlleys: ['Lorong 1', 'Lorong 2', 'Lorong 3', 'Pinggir Jalan'],
    defaultLandmark: 'Dekat RSUD Lasinrang / Jl. Serigala',
    keywords: ['serigala', 'gajah', 'macan', 'kandea', 'macorawalie'],
  },
  {
    id: 'st-anggrek-melati',
    streetName: 'Jl. Anggrek / Jl. Melati',
    corridorArea: 'Kawasan Pacongang & Mamminasae Paleteang',
    kelurahan: 'Kel. Mamminasae',
    kecamatan: 'Kec. Paleteang',
    postalCode: '91215',
    lat: -3.7895,
    lng: 119.6558,
    commonAlleys: ['Lorong 1', 'Lorong 2', 'Lorong 3', 'Pinggir Jalan'],
    defaultLandmark: 'Kawasan Mamminasae Paleteang',
    keywords: ['anggrek', 'melati', 'mawar', 'dahlia', 'mamminasae', 'paleteang'],
  },
  {
    id: 'st-veteran-pahlawan',
    streetName: 'Jl. Pahlawan / Jl. Veteran',
    corridorArea: 'Kawasan Sawitto & Sipatokkong',
    kelurahan: 'Kel. Sipatokkong',
    kecamatan: 'Kec. Watang Sawitto',
    postalCode: '91211',
    lat: -3.7915,
    lng: 119.6562,
    commonAlleys: ['Pinggir Jalan', 'Lorong 1', 'Lorong 2', 'Lorong 3'],
    defaultLandmark: 'Kawasan Sipatokkong / Sawitto',
    keywords: ['pahlawan', 'veteran', 'teuku umar', 'sipatokkong', 'sawitto'],
  },
];

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function isWithinPinrangArea(lat: number, lng: number): boolean {
  return lat >= -3.92 && lat <= -3.65 && lng >= 119.52 && lng <= 119.78;
}

export function findNearestPinrangCorridor(
  lat: number,
  lng: number
): { corridor: PinrangStreetCorridor; distanceMeters: number } {
  let best = PINRANG_STREET_CORRIDORS[0];
  let bestDist = haversineDistanceMeters(lat, lng, best.lat, best.lng);

  for (let i = 1; i < PINRANG_STREET_CORRIDORS.length; i++) {
    const c = PINRANG_STREET_CORRIDORS[i];
    const d = haversineDistanceMeters(lat, lng, c.lat, c.lng);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }

  return { corridor: best, distanceMeters: bestDist };
}

export function findNearestPinrangLandmarks(
  lat: number,
  lng: number,
  maxCount = 3
): Array<{ name: string; relation: string; distanceMeters: number }> {
  return PINRANG_LANDMARKS.map((lm) => {
    const dist = haversineDistanceMeters(lat, lng, lm.lat, lm.lng);
    return {
      name: lm.name,
      relation:
        dist <= 120
          ? `Dekat ${lm.name} (±${dist}m)`
          : `${lm.relationHint} (±${dist}m)`,
      distanceMeters: dist,
    };
  })
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, maxCount);
}

export interface PinrangSearchSuggestion {
  id: string;
  title: string;
  subtitle: string;
  streetName: string;
  kelurahan: string;
  kecamatan: string;
  lat: number;
  lng: number;
  landmarkHint: string;
  commonAlleys: string[];
}

export function searchPinrangLocations(queryText: string): PinrangSearchSuggestion[] {
  const q = queryText.trim().toLowerCase();
  const results: PinrangSearchSuggestion[] = [];

  for (const corridor of PINRANG_STREET_CORRIDORS) {
    const haystack = [
      corridor.streetName,
      corridor.corridorArea,
      corridor.kelurahan,
      corridor.kecamatan,
      corridor.defaultLandmark,
      ...corridor.keywords,
    ]
      .join(' ')
      .toLowerCase();

    if (!q || haystack.includes(q)) {
      results.push({
        id: corridor.id,
        title: `${corridor.streetName} — ${corridor.corridorArea}`,
        subtitle: `${corridor.kelurahan}, ${corridor.kecamatan}, Kab. Pinrang`,
        streetName: corridor.streetName,
        kelurahan: corridor.kelurahan,
        kecamatan: corridor.kecamatan,
        lat: corridor.lat,
        lng: corridor.lng,
        landmarkHint: corridor.defaultLandmark,
        commonAlleys: corridor.commonAlleys,
      });
    }
  }

  for (const lm of PINRANG_LANDMARKS) {
    const haystack = [
      lm.name,
      lm.streetName,
      lm.kelurahan,
      lm.kecamatan,
      lm.relationHint,
    ]
      .join(' ')
      .toLowerCase();

    if (q && haystack.includes(q)) {
      results.push({
        id: lm.id,
        title: `${lm.name} (${lm.streetName})`,
        subtitle: `${lm.kelurahan}, ${lm.kecamatan}, Kab. Pinrang`,
        streetName: lm.streetName,
        kelurahan: lm.kelurahan,
        kecamatan: lm.kecamatan,
        lat: lm.lat,
        lng: lm.lng,
        landmarkHint: lm.relationHint,
        commonAlleys: ['Pinggir Jalan Poros', 'Lorong 1', 'Lorong 2', 'Lorong 3'],
      });
    }
  }

  return results.slice(0, 12);
}
