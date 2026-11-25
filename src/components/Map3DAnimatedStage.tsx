import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Clock,
  Compass,
  Copy,
  CornerUpLeft,
  ExternalLink,
  Layers,
  MapPin,
  Navigation,
} from 'lucide-react';
import {
  GeoCoord,
  LOCATION_OFFICIAL_MAPS_URL,
  LOCATION_OFFICIAL_PLUS_CODE,
  LOCATION_TOUR_COORDS,
  LOCATION_TOUR_TIMELINE,
  LocationCameraState,
  LocationTourScene,
  getActiveLocationScene,
  getRouteDrawProgress,
  interpolateLocationCamera,
  samplePointAlongWaypoints,
} from '../data/locationTourTimeline';

export type Map3DTheme = 'satellite' | 'roadmap';

export interface Map3DAnimatedStageProps {
  /** Detik aktif dari master audio (`audioElement.currentTime`) */
  currentTimeSec: number;
  /** Pembaca waktu langsung dari `<audio>` untuk loop kamera WebGL 60fps tanpa re-render React */
  getMasterTime?: () => number;
  /** Status pemutaran aktif */
  isPlaying?: boolean;
  /** Mode citra Google Maps 3D: 'satellite' (Satelit Real HD + Nama Jalan, DEFAULT) atau 'roadmap' (Peta Jalan HD) */
  mapTheme?: Map3DTheme;
  /** Callback saat pengguna mengganti Satelit <-> Peta Jalan */
  onMapThemeChange?: (theme: Map3DTheme) => void;
  /** Izinkan pengguna menggeser/memutar peta 3D secara manual saat dijeda */
  interactiveWhenPaused?: boolean;
  /** Link Google Maps resmi */
  officialMapsUrl?: string;
  /** Plus Code resmi (`5MR2+PRV`) */
  officialPlusCode?: string;
  /** Callback saat Plus Code disalin */
  onCopyPlusCode?: (code: string) => void;
  /** Callback saat peta 3D selesai dimuat */
  onMapReady?: () => void;
  /** Override daftar scene (dipakai saat Mode Kalibrasi Live ?sync=1) */
  timelineScenes?: readonly LocationTourScene[];
  /** Tampilkan atau sembunyikan subtitle singkat bawah */
  showSubtitles?: boolean;
  /** True saat scrubbing/lompat agar kamera langsung jump 1:1 tanpa damping */
  instantJump?: boolean;
  /** Jarak aman atas (px) agar bar navigator tidak menabrak Dynamic Island iPhone */
  topHudOffsetPx?: number;
  /** Jarak aman bawah (px) agar subtitle & kartu CTA tidak tertutup tepi bawah */
  bottomControlsClearancePx?: number;
  /** Kelas CSS tambahan untuk kontainer luar */
  className?: string;
}

// Konfigurasi wajib MapLibre GL JS v6 di Vite agar worker tidak 404 saat pre-bundle/build
if (typeof window !== 'undefined') {
  try {
    maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
  } catch {
    // ignore
  }
}

const ROUTE_REMAINING_SOURCE_ID = 'nav3d-remaining-route-src';
const ROUTE_TRAVELED_SOURCE_ID = 'nav3d-traveled-route-src';
const ROUTE_DOTS_SOURCE_ID = 'nav3d-route-dots-src';
const TARGET_RING_SOURCE_ID = 'nav3d-target-ring-src';

const ROUTE_GLOW_LAYER_ID = 'nav3d-route-glow-layer';
const ROUTE_CASING_LAYER_ID = 'nav3d-route-casing-layer';
const ROUTE_CORE_LAYER_ID = 'nav3d-route-core-layer';
const ROUTE_TRAVELED_LAYER_ID = 'nav3d-route-traveled-layer';
const ROUTE_DOTS_LAYER_ID = 'nav3d-route-dots-layer';
const TARGET_RING_FILL_LAYER_ID = 'nav3d-target-ring-fill';
const TARGET_RING_LINE_LAYER_ID = 'nav3d-target-ring-line';

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function detectWebGLSupport(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

function formatRemainingDistance(distanceMeters: number, progress0to1: number): string {
  const remMeters = Math.max(0, Math.round(distanceMeters * (1 - progress0to1)));
  if (remMeters >= 1000) {
    return `${(remMeters / 1000).toFixed(1).replace('.', ',')} km`;
  }
  return `${remMeters} m`;
}

/**
 * Lingkaran halus transparan di permukaan tanah agar atap bangunan & jalan asli pada citra satelit tetap 100% tembus terlihat!
 */
function createSubtleGroundRing(center: GeoCoord, radiusMeters: number, steps = 36): number[][] {
  const latScale = 1 / 111320;
  const lngScale = 1 / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const coords: number[][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * Math.PI * 2;
    coords.push([
      center.lng + Math.cos(theta) * radiusMeters * lngScale,
      center.lat + Math.sin(theta) * radiusMeters * latScale,
    ]);
  }
  return coords;
}

function buildTargetRingsGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          kind: 'kedai',
          fillColor: 'rgba(245, 183, 0, 0.14)',
          lineColor: '#FFE066',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [createSubtleGroundRing(LOCATION_TOUR_COORDS.kedai, 9.5, 36)],
        },
      },
      {
        type: 'Feature',
        properties: {
          kind: 'hanami',
          fillColor: 'rgba(255, 46, 147, 0.15)',
          lineColor: '#FF4DA6',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [createSubtleGroundRing(LOCATION_TOUR_COORDS.tokoHanamiPink, 8.5, 32)],
        },
      },
    ],
  };
}

function computeNavigatorRouteGeometry(
  waypoints: GeoCoord[],
  progress0to1: number,
  pulsePhase: number
): {
  fullCoords: Array<[number, number]>;
  traveledCoords: Array<[number, number]>;
  movingDots: GeoJSON.Feature[];
  puckPoint: GeoCoord | null;
  puckHeadingDeg: number;
} {
  if (!waypoints || waypoints.length < 2) {
    return {
      fullCoords: [],
      traveledCoords: [],
      movingDots: [],
      puckPoint: null,
      puckHeadingDeg: 0,
    };
  }

  const fullCoords: Array<[number, number]> = waypoints.map((pt) => [pt.lng, pt.lat]);
  const p = Math.max(0, Math.min(1, progress0to1));
  const { point: puckPoint, headingDeg: puckHeadingDeg } = samplePointAlongWaypoints(waypoints, p);

  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const len = Math.hypot(
      waypoints[i + 1].lng - waypoints[i].lng,
      waypoints[i + 1].lat - waypoints[i].lat
    );
    segLengths.push(len);
    totalLen += len;
  }

  const targetLen = p * totalLen;
  const traveledCoords: Array<[number, number]> = [fullCoords[0]];
  let acc = 0;
  for (let i = 0; i < segLengths.length; i += 1) {
    const len = segLengths[i];
    if (acc + len < targetLen) {
      traveledCoords.push(fullCoords[i + 1]);
      acc += len;
    } else {
      traveledCoords.push([puckPoint.lng, puckPoint.lat]);
      break;
    }
  }

  const movingDots: GeoJSON.Feature[] = [];
  const dotCount = 5;
  for (let i = 0; i < dotCount; i += 1) {
    const rawPos = (i / dotCount + pulsePhase) % 1;
    const f = p + rawPos * (1 - p);
    if (f > p + 0.035 && f < 0.98) {
      const { point } = samplePointAlongWaypoints(waypoints, f);
      movingDots.push({
        type: 'Feature',
        properties: { index: i },
        geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      });
    }
  }

  return { fullCoords, traveledCoords, movingDots, puckPoint, puckHeadingDeg };
}

/**
 * Style MapLibre GL 3D Google Maps Real 2x Retina HD (`&scale=2` = 512x512 px tiles di `tileSize: 256` & `maxzoom: 19`):
 * - Memberikan 4x kerapatan piksel dibanding tile standar, sehingga atap rumah, ruko Toko Hanami, aspal jalan, dan label jalan tampil HD tajam!
 * - `raster-fade-duration: 0` mencegah efek kedip/hilang saat transisi zoom.
 */
function buildGoogleMaps3DStyle(theme: Map3DTheme): maplibregl.StyleSpecification {
  const isSatellite = theme === 'satellite';
  const layerParam = isSatellite ? 'y' : 'm';

  return {
    version: 8,
    sources: {
      'google-maps-real': {
        type: 'raster',
        tiles: [
          `https://mt0.google.com/vt/lyrs=${layerParam}&hl=id&scale=2&x={x}&y={y}&z={z}`,
          `https://mt1.google.com/vt/lyrs=${layerParam}&hl=id&scale=2&x={x}&y={y}&z={z}`,
          `https://mt2.google.com/vt/lyrs=${layerParam}&hl=id&scale=2&x={x}&y={y}&z={z}`,
          `https://mt3.google.com/vt/lyrs=${layerParam}&hl=id&scale=2&x={x}&y={y}&z={z}`,
        ],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'map-bg',
        type: 'background',
        paint: {
          'background-color': isSatellite ? '#18242E' : '#E5E3DF',
        },
      },
      {
        id: 'google-maps-real-layer',
        type: 'raster',
        source: 'google-maps-real',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'raster-opacity': 1,
          'raster-fade-duration': 0,
          'raster-resampling': 'linear',
          'raster-contrast': isSatellite ? 0.08 : 0.02,
          'raster-saturation': isSatellite ? 0.1 : 0,
        },
      },
    ],
  };
}

function buildRasterBackupMapStyle(theme: Map3DTheme): maplibregl.StyleSpecification {
  const tileUrl =
    theme === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  return {
    version: 8,
    sources: {
      'backup-tiles': {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'map-bg-backup',
        type: 'background',
        paint: {
          'background-color': theme === 'satellite' ? '#18242E' : '#E5E3DF',
        },
      },
      {
        id: 'backup-tiles-layer',
        type: 'raster',
        source: 'backup-tiles',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'raster-fade-duration': 0,
        },
      },
    ],
  };
}

function attachNavigator3DLayers(map: maplibregl.Map): void {
  const ringsData = buildTargetRingsGeoJSON();
  const existingRings = map.getSource(TARGET_RING_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  if (existingRings) {
    existingRings.setData(ringsData);
  } else {
    map.addSource(TARGET_RING_SOURCE_ID, { type: 'geojson', data: ringsData });
  }

  if (!map.getLayer(TARGET_RING_FILL_LAYER_ID)) {
    map.addLayer({
      id: TARGET_RING_FILL_LAYER_ID,
      type: 'fill',
      source: TARGET_RING_SOURCE_ID,
      paint: { 'fill-color': ['get', 'fillColor'] },
    });
  }

  if (!map.getLayer(TARGET_RING_LINE_LAYER_ID)) {
    map.addLayer({
      id: TARGET_RING_LINE_LAYER_ID,
      type: 'line',
      source: TARGET_RING_SOURCE_ID,
      paint: {
        'line-color': ['get', 'lineColor'],
        'line-width': 2.5,
        'line-opacity': 0.94,
      },
    });
  }

  if (!map.getSource(ROUTE_REMAINING_SOURCE_ID)) {
    map.addSource(ROUTE_REMAINING_SOURCE_ID, { type: 'geojson', data: EMPTY_GEOJSON });
  }
  if (!map.getSource(ROUTE_TRAVELED_SOURCE_ID)) {
    map.addSource(ROUTE_TRAVELED_SOURCE_ID, { type: 'geojson', data: EMPTY_GEOJSON });
  }
  if (!map.getSource(ROUTE_DOTS_SOURCE_ID)) {
    map.addSource(ROUTE_DOTS_SOURCE_ID, { type: 'geojson', data: EMPTY_GEOJSON });
  }

  if (!map.getLayer(ROUTE_GLOW_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_GLOW_LAYER_ID,
      type: 'line',
      source: ROUTE_REMAINING_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#38BDF8',
        'line-width': 18,
        'line-blur': 9,
        'line-opacity': 0.45,
      },
    });
  }

  if (!map.getLayer(ROUTE_CASING_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_CASING_LAYER_ID,
      type: 'line',
      source: ROUTE_REMAINING_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 11,
        'line-opacity': 0.96,
      },
    });
  }

  if (!map.getLayer(ROUTE_CORE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_CORE_LAYER_ID,
      type: 'line',
      source: ROUTE_REMAINING_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#1A73E8',
        'line-width': 7,
        'line-opacity': 1,
      },
    });
  }

  if (!map.getLayer(ROUTE_TRAVELED_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_TRAVELED_LAYER_ID,
      type: 'line',
      source: ROUTE_TRAVELED_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#60A5FA',
        'line-width': 5.5,
        'line-opacity': 0.78,
      },
    });
  }

  if (!map.getLayer(ROUTE_DOTS_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_DOTS_LAYER_ID,
      type: 'circle',
      source: ROUTE_DOTS_SOURCE_ID,
      paint: {
        'circle-radius': 4,
        'circle-color': '#FFFFFF',
        'circle-stroke-color': '#1A73E8',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.96,
      },
    });
  }
}

interface LandmarkPinConfig {
  key: keyof typeof LOCATION_TOUR_COORDS;
  coords: GeoCoord;
  title: string;
  subtitle: string;
  variant: 'kedai' | 'hanami' | 'patung' | 'mall' | 'bosowa' | 'pasar';
}

const LANDMARK_PIN_CONFIGS: LandmarkPinConfig[] = [
  {
    key: 'kedai',
    coords: LOCATION_TOUR_COORDS.kedai,
    title: 'Nasi Kuning Lasinrang',
    subtitle: '5MR2+PRV · 18.30 WITA',
    variant: 'kedai',
  },
  {
    key: 'tokoHanamiPink',
    coords: LOCATION_TOUR_COORDS.tokoHanamiPink,
    title: 'Toko Kosmetik Hanami',
    subtitle: 'Patokan Ruko Pink',
    variant: 'hanami',
  },
  {
    key: 'patungLasinrang',
    coords: LOCATION_TOUR_COORDS.patungLasinrang,
    title: 'Patung Lasinrang',
    subtitle: 'Seberang Lapak',
    variant: 'patung',
  },
  {
    key: 'mallSejahtera',
    coords: LOCATION_TOUR_COORDS.mallSejahtera,
    title: 'Arah Mall Sejahtera',
    subtitle: 'Utara · 150 m',
    variant: 'mall',
  },
  {
    key: 'lapanganBosowa',
    coords: LOCATION_TOUR_COORDS.lapanganBosowa,
    title: 'Arah Lapangan Bosowa',
    subtitle: 'Selatan · 320 m',
    variant: 'bosowa',
  },
  {
    key: 'pasarSentral',
    coords: LOCATION_TOUR_COORDS.pasarSentral,
    title: 'Pasar Sentral',
    subtitle: 'Jl. Sultan Hasanuddin',
    variant: 'pasar',
  },
];

/**
 * PENTING (ANTI-KEDIP 100%):
 * - Elemen `root` dimiliki penuh oleh MapLibre GL JS (yang menyetel `root.style.transform = translate(...)` setiap frame).
 * - JANGAN PERNAH menaruh `transition-all` atau menyentuh `root.style.transform`!
 * - Semua animasi `opacity` & `scale` diterapkan HANYA pada elemen anak `.map3d-marker-inner`.
 */
function createLandmarkPinElement(cfg: LandmarkPinConfig): {
  root: HTMLDivElement;
  inner: HTMLDivElement;
} {
  const root = document.createElement('div');
  root.className = 'pointer-events-none select-none';
  root.dataset.landmarkKey = cfg.key;

  const inner = document.createElement('div');
  inner.className = 'map3d-marker-inner';

  if (cfg.variant === 'kedai') {
    inner.innerHTML = `
      <div class="relative flex flex-col items-center">
        <div class="flex flex-col items-center">
          <div class="px-2.5 py-1.5 rounded-xl bg-gradient-to-b from-[#FFE46B] via-[#F5B700] to-[#D98A00] text-[#2E0906] border-2 border-white shadow-[0_8px_22px_rgba(0,0,0,0.68)] text-center whitespace-nowrap">
            <div class="text-[11px] font-extrabold leading-tight tracking-tight">★ ${cfg.title}</div>
            <div class="text-[9px] font-bold text-[#4A1914] leading-tight mt-0.5 font-mono">${cfg.subtitle}</div>
          </div>
          <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white -mt-[1px]"></div>
        </div>
        <div class="relative mt-0.5 w-4 h-4">
          <span class="map3d-pin-halo absolute left-1/2 top-1/2 w-10 h-10 rounded-full bg-[#FFE066]/70"></span>
          <span class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#F5B700] border-2 border-white shadow-md"></span>
        </div>
      </div>
    `;
  } else if (cfg.variant === 'hanami') {
    inner.innerHTML = `
      <div class="relative flex flex-col items-center">
        <div class="px-2.5 py-1 rounded-xl bg-[#DB2777] text-white border-2 border-[#FCE7F3] shadow-[0_8px_20px_rgba(219,39,119,0.72)] text-center whitespace-nowrap">
          <div class="text-[10.5px] font-extrabold leading-tight tracking-tight">${cfg.title}</div>
          <div class="text-[8.5px] font-semibold text-pink-100 leading-tight">${cfg.subtitle}</div>
        </div>
        <div class="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#FCE7F3] -mt-[1px]"></div>
        <div class="w-3 h-3 rounded-full bg-[#FF2E93] border-2 border-white shadow mt-0.5"></div>
      </div>
    `;
  } else {
    const accents: Record<
      Exclude<LandmarkPinConfig['variant'], 'kedai' | 'hanami'>,
      { border: string; dot: string; sub: string }
    > = {
      patung: { border: 'border-amber-400', dot: 'bg-amber-400', sub: 'text-amber-200' },
      mall: { border: 'border-sky-400', dot: 'bg-sky-400', sub: 'text-sky-200' },
      bosowa: { border: 'border-emerald-400', dot: 'bg-emerald-400', sub: 'text-emerald-200' },
      pasar: { border: 'border-orange-400', dot: 'bg-orange-400', sub: 'text-orange-200' },
    };
    const a = accents[cfg.variant];

    inner.innerHTML = `
      <div class="flex flex-col items-center">
        <div class="px-2 py-1 rounded-lg bg-[#0B1220]/94 text-white border ${a.border} shadow-[0_6px_16px_rgba(0,0,0,0.65)] text-center whitespace-nowrap">
          <div class="text-[10px] font-bold leading-tight">${cfg.title}</div>
          <div class="text-[8.5px] font-medium ${a.sub} leading-tight">${cfg.subtitle}</div>
        </div>
        <div class="w-2.5 h-2.5 rounded-full ${a.dot} border-2 border-white shadow mt-0.5"></div>
      </div>
    `;
  }

  root.appendChild(inner);
  return { root, inner };
}

/**
 * Panah Biru GPS Google Maps 3D Driving Navigator dengan kerucut sorot arah depan.
 */
function createGpsNavigatorPuckElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'pointer-events-none select-none';
  el.innerHTML = `
    <div class="relative w-14 h-14 flex items-center justify-center">
      <div class="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-10 bg-gradient-to-t from-[#38BDF8]/55 to-transparent" style="clip-path: polygon(50% 0%, 100% 100%, 0% 100%);"></div>
      <span class="map3d-pin-halo absolute left-1/2 top-1/2 w-12 h-12 rounded-full bg-[#1A73E8]/50"></span>
      <div class="relative w-9 h-9 rounded-full bg-white border-2 border-[#1A73E8] shadow-[0_6px_18px_rgba(0,0,0,0.65)] flex items-center justify-center">
        <svg viewBox="0 0 24 24" class="w-5 h-5 text-[#1A73E8] fill-[#1A73E8]" aria-hidden="true">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
        </svg>
      </div>
    </div>
  `;
  return el;
}

/**
 * Fallback 3D CSS Perspective Map — HANYA dirender jika perangkat tidak mendukung WebGL.
 */
const Map3DCssFallbackStage: React.FC<{
  scene: LocationTourScene;
  camera: LocationCameraState;
  routeProgress: number;
}> = ({ scene, camera, routeProgress }) => {
  const project = (pt: GeoCoord): [number, number] => {
    const x = 300 + (pt.lng - LOCATION_TOUR_COORDS.kedai.lng) * 75000;
    const y = 310 - (pt.lat - LOCATION_TOUR_COORDS.kedai.lat) * 75000;
    return [x, y];
  };

  const [focusX, focusY] = project(camera.center);
  const scaleFactor = Math.max(0.85, Math.min(1.5, 1 + (camera.zoom - 17.5) * 0.22));
  const translateX = (300 - focusX) * 0.55;
  const translateY = (300 - focusY) * 0.55;

  const routeSvgPath = useMemo(() => {
    if (!scene.route || scene.route.waypoints.length < 2) return '';
    return scene.route.waypoints
      .map((pt, idx) => {
        const [x, y] = project(pt);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [scene.route]);

  const puckPos = useMemo(() => {
    if (!scene.route) return null;
    const { point } = samplePointAlongWaypoints(scene.route.waypoints, routeProgress);
    return project(point);
  }, [scene.route, routeProgress]);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-[#1B2A38]"
      style={{ perspective: '900px' }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(58deg) scale(${scaleFactor}) translate3d(${translateX}px, ${translateY}px, 0px)`,
        }}
      >
        <svg viewBox="0 0 600 600" className="w-[620px] h-[620px] overflow-visible">
          <rect x="-120" y="-120" width="840" height="840" fill="#233240" />
          <path d="M 300 0 L 300 600" stroke="#475569" strokeWidth="26" />
          <path d="M 300 0 L 300 600" stroke="#F8FAFC" strokeWidth="18" />
          <path d="M 100 310 L 500 310" stroke="#CBD5E1" strokeWidth="12" />
          {routeSvgPath && (
            <>
              <path d={routeSvgPath} fill="none" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" />
              <path d={routeSvgPath} fill="none" stroke="#1A73E8" strokeWidth="6" strokeLinecap="round" />
            </>
          )}
          {puckPos && (
            <circle cx={puckPos[0]} cy={puckPos[1]} r="9" fill="#1A73E8" stroke="#FFFFFF" strokeWidth="3" />
          )}
          <circle cx="300" cy="310" r="10" fill="#F5B700" stroke="#FFFFFF" strokeWidth="2.5" />
          <circle cx="320" cy="310" r="8" fill="#FF2E93" stroke="#FFFFFF" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
};

interface MarkerEntry {
  marker: maplibregl.Marker;
  root: HTMLDivElement;
  inner: HTMLDivElement;
}

export const Map3DAnimatedStage: React.FC<Map3DAnimatedStageProps> = React.memo(
  ({
    currentTimeSec,
    getMasterTime,
    isPlaying = false,
    mapTheme: controlledTheme,
    onMapThemeChange,
    interactiveWhenPaused = true,
    officialMapsUrl = LOCATION_OFFICIAL_MAPS_URL,
    officialPlusCode = LOCATION_OFFICIAL_PLUS_CODE,
    onCopyPlusCode,
    onMapReady,
    timelineScenes = LOCATION_TOUR_TIMELINE,
    showSubtitles = false,
    instantJump = false,
    topHudOffsetPx = 44,
    bottomControlsClearancePx = 22,
    className = '',
  }) => {
    const [internalTheme, setInternalTheme] = useState<Map3DTheme>(controlledTheme ?? 'satellite');
    const activeTheme = controlledTheme ?? internalTheme;

    const [webglAvailable, setWebglAvailable] = useState<boolean>(() => detectWebGLSupport());
    const [isMapStyleLoaded, setIsMapStyleLoaded] = useState(false);
    const [copiedPlusCode, setCopiedPlusCode] = useState(false);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const navTitleRef = useRef<HTMLSpanElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const mapLoadedRef = useRef(false);
    const usedBackupStyleRef = useRef(false);
    const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
    const gpsPuckMarkerRef = useRef<maplibregl.Marker | null>(null);
    const gpsPuckElRef = useRef<HTMLDivElement | null>(null);

    const prevTimeRef = useRef<number>(currentTimeSec);
    const prevFrameMsRef = useRef<number>(0);
    const lastStaticRouteSceneIdRef = useRef<string | null>(null);
    const lastHighlightedSceneIdRef = useRef<string | null>(null);
    const lastDynamicGeoUpdateMsRef = useRef<number>(0);
    const smoothedCameraRef = useRef<LocationCameraState | null>(null);
    const userInteractingRef = useRef(false);

    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;
    const timelineScenesRef = useRef(timelineScenes);
    timelineScenesRef.current = timelineScenes;
    const getMasterTimeRef = useRef(getMasterTime);
    getMasterTimeRef.current = getMasterTime;

    const activeScene = useMemo(
      () => getActiveLocationScene(currentTimeSec, timelineScenes),
      [currentTimeSec, timelineScenes]
    );
    const routeProgress = useMemo(
      () => getRouteDrawProgress(activeScene, currentTimeSec),
      [activeScene, currentTimeSec]
    );

    const targetCamera = useMemo(() => {
      const raw = interpolateLocationCamera(activeScene, currentTimeSec);
      return {
        ...raw,
        pitch: Math.max(48, Math.min(64, raw.pitch)),
      };
    }, [activeScene, currentTimeSec]);

    const handleToggleTheme = () => {
      const nextTheme: Map3DTheme = activeTheme === 'satellite' ? 'roadmap' : 'satellite';
      setInternalTheme(nextTheme);
      onMapThemeChange?.(nextTheme);
    };

    const handleCopyPlusCode = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(officialPlusCode);
        } else {
          const ta = document.createElement('textarea');
          ta.value = officialPlusCode;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
      } catch {
        // ignore
      }
      setCopiedPlusCode(true);
      onCopyPlusCode?.(officialPlusCode);
      window.setTimeout(() => setCopiedPlusCode(false), 2200);
    };

    /**
     * Mesin pembaruan frame tunggal (dipanggil dari loop native 60fps saat play ATAU 1x saat pause/scrub).
     * Berjalan 100% langsung ke MapLibre WebGL + DOM refs tanpa memicu React re-render!
     */
    const applyFrameAtTime = (timeSec: number, forceInstant: boolean) => {
      const map = mapRef.current;
      if (!map || !webglAvailable) return;

      const scenes = timelineScenesRef.current;
      const scene = getActiveLocationScene(timeSec, scenes);
      const progress = getRouteDrawProgress(scene, timeSec);
      const rawCam = interpolateLocationCamera(scene, timeSec);
      const nextTargetCam: LocationCameraState = {
        ...rawCam,
        pitch: Math.max(48, Math.min(64, rawCam.pitch)),
      };

      const nowMs = performance.now();
      const dtSec =
        prevFrameMsRef.current > 0
          ? Math.min(0.05, Math.max(0.004, (nowMs - prevFrameMsRef.current) / 1000))
          : 0.016;
      prevFrameMsRef.current = nowMs;

      const deltaT = Math.abs(timeSec - prevTimeRef.current);
      prevTimeRef.current = timeSec;

      if (deltaT >= 0.25 || isPlayingRef.current || forceInstant) {
        userInteractingRef.current = false;
      }

      // 1. Kamera 3D Follow-Cam (Frame-rate independent exponential smoothing, 60fps–120fps)
      if (!userInteractingRef.current) {
        const shouldSnap =
          forceInstant || deltaT >= 0.5 || !smoothedCameraRef.current || !isPlayingRef.current;

        if (shouldSnap) {
          smoothedCameraRef.current = nextTargetCam;
        } else {
          const prev = smoothedCameraRef.current!;
          const alpha = 1 - Math.exp(-8.5 * dtSec);
          const diffBearing = ((nextTargetCam.bearing - prev.bearing + 540) % 360) - 180;
          smoothedCameraRef.current = {
            center: {
              lat: prev.center.lat + (nextTargetCam.center.lat - prev.center.lat) * alpha,
              lng: prev.center.lng + (nextTargetCam.center.lng - prev.center.lng) * alpha,
            },
            zoom: prev.zoom + (nextTargetCam.zoom - prev.zoom) * alpha,
            pitch: prev.pitch + (nextTargetCam.pitch - prev.pitch) * alpha,
            bearing: prev.bearing + diffBearing * alpha,
          };
        }

        const cam = smoothedCameraRef.current;
        try {
          map.jumpTo({
            center: [cam.center.lng, cam.center.lat],
            zoom: cam.zoom,
            pitch: cam.pitch,
            bearing: cam.bearing,
          });
        } catch {
          // ignore
        }
      }

      // 2. Perbarui teks sisa jarak di bar hijau langsung lewat DOM ref (0 React re-render!)
      if (navTitleRef.current) {
        const nextTitle = scene.route
          ? `${formatRemainingDistance(scene.route.distanceMeters, progress)} · ${scene.route.streetName}`
          : scene.navStreetTitle;
        if (navTitleRef.current.textContent !== nextTitle) {
          navTitleRef.current.textContent = nextTitle;
        }
      }

      // 3. Penonjolan pin landmark — HANYA ubah `.map3d-marker-inner` & HANYA saat ganti scene (ANTI-KEDIP 100%!)
      if (lastHighlightedSceneIdRef.current !== scene.id) {
        lastHighlightedSceneIdRef.current = scene.id;
        const highlightedSet = new Set<string>(scene.highlightedLandmarks);
        markersRef.current.forEach(({ root, inner }, key) => {
          const isKedai = key === 'kedai';
          const isHanamiFocus = key === 'tokoHanamiPink' && scene.sceneNumber === 2;
          const isHighlighted = highlightedSet.has(key);

          if (isHanamiFocus) {
            inner.style.opacity = '1';
            inner.style.transform = 'scale(1.06)';
            root.style.zIndex = '35';
          } else if (isKedai) {
            inner.style.opacity = '1';
            inner.style.transform = scene.sceneNumber === 7 ? 'scale(1.05)' : 'scale(1)';
            root.style.zIndex = '30';
          } else if (isHighlighted) {
            inner.style.opacity = '1';
            inner.style.transform = 'scale(0.96)';
            root.style.zIndex = '20';
          } else {
            inner.style.opacity = '0';
            inner.style.transform = 'scale(0.84)';
            root.style.zIndex = '5';
          }
        });
      }

      if (!mapLoadedRef.current) return;

      const remainingSrc = map.getSource(ROUTE_REMAINING_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;
      const traveledSrc = map.getSource(ROUTE_TRAVELED_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;
      const dotsSrc = map.getSource(ROUTE_DOTS_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;

      if (!scene.route) {
        if (lastStaticRouteSceneIdRef.current !== null) {
          remainingSrc?.setData(EMPTY_GEOJSON);
          traveledSrc?.setData(EMPTY_GEOJSON);
          dotsSrc?.setData(EMPTY_GEOJSON);
          lastStaticRouteSceneIdRef.current = null;
        }
        if (gpsPuckElRef.current && gpsPuckElRef.current.style.display !== 'none') {
          gpsPuckElRef.current.style.display = 'none';
        }
        return;
      }

      const pulsePhase = (timeSec * 0.5) % 1;
      const { fullCoords, traveledCoords, movingDots, puckPoint, puckHeadingDeg } =
        computeNavigatorRouteGeometry(scene.route.waypoints, progress, pulsePhase);

      // Perbarui garis rute utama HANYA 1x per scene (nol spam WebWorker!)
      if (lastStaticRouteSceneIdRef.current !== scene.id) {
        remainingSrc?.setData(
          fullCoords.length >= 2
            ? {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: fullCoords },
                  },
                ],
              }
            : EMPTY_GEOJSON
        );
        lastStaticRouteSceneIdRef.current = scene.id;
        lastDynamicGeoUpdateMsRef.current = 0;
      }

      // Throttle update garis telah dilewati & titik arah ke ~15fps agar tile HD & kamera tetap 60fps mulus
      if (forceInstant || nowMs - lastDynamicGeoUpdateMsRef.current >= 65) {
        lastDynamicGeoUpdateMsRef.current = nowMs;
        traveledSrc?.setData(
          traveledCoords.length >= 2
            ? {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: traveledCoords },
                  },
                ],
              }
            : EMPTY_GEOJSON
        );
        dotsSrc?.setData({
          type: 'FeatureCollection',
          features: movingDots,
        });
      }

      // Gerakkan Panah Biru GPS 60fps mulus tepat di atas jalan aspal
      if (gpsPuckMarkerRef.current && gpsPuckElRef.current && puckPoint) {
        if (gpsPuckElRef.current.style.display !== 'block') {
          gpsPuckElRef.current.style.display = 'block';
        }
        gpsPuckMarkerRef.current.setLngLat([puckPoint.lng, puckPoint.lat]);
        gpsPuckMarkerRef.current.setRotation(puckHeadingDeg);
      }
    };

    const applyFrameRef = useRef(applyFrameAtTime);
    applyFrameRef.current = applyFrameAtTime;

    // Inisialisasi MapLibre GL JS 3D dengan Google Satellite Real 2x Retina HD / Roadmap HD
    useEffect(() => {
      if (!webglAvailable || !containerRef.current) return;

      const container = containerRef.current;
      mapLoadedRef.current = false;
      usedBackupStyleRef.current = false;
      lastStaticRouteSceneIdRef.current = null;
      lastHighlightedSceneIdRef.current = null;
      smoothedCameraRef.current = null;
      setIsMapStyleLoaded(false);

      const initialTime = getMasterTimeRef.current
        ? getMasterTimeRef.current()
        : currentTimeSec;
      const initScene = getActiveLocationScene(initialTime, timelineScenesRef.current);
      const initCam = interpolateLocationCamera(initScene, initialTime);

      let map: maplibregl.Map;
      try {
        map = new maplibregl.Map({
          container,
          style: buildGoogleMaps3DStyle(activeTheme),
          center: [initCam.center.lng, initCam.center.lat],
          zoom: initCam.zoom,
          pitch: Math.max(48, Math.min(64, initCam.pitch)),
          bearing: initCam.bearing,
          maxPitch: 66,
          pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
          fadeDuration: 0,
          maxTileCacheSize: 320,
          renderWorldCopies: false,
          attributionControl: false,
          interactive: true,
        });
      } catch {
        setWebglAvailable(false);
        return;
      }

      mapRef.current = map;

      const canvas = map.getCanvas();
      const handleContextLost = (e: Event) => {
        e.preventDefault();
        mapLoadedRef.current = false;
        setWebglAvailable(false);
      };
      const handleContextRestored = () => {
        setWebglAvailable(true);
      };
      canvas.addEventListener('webglcontextlost', handleContextLost, false);
      canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

      const onDragStart = () => {
        if (!isPlayingRef.current) {
          userInteractingRef.current = true;
        }
      };
      map.on('dragstart', onDragStart);
      map.on('rotatestart', onDragStart);
      map.on('pitchstart', onDragStart);

      // Pasang pin landmark anti-kedip (transformasi hanya di `.map3d-marker-inner`)
      const markerMap = new Map<string, MarkerEntry>();
      for (const cfg of LANDMARK_PIN_CONFIGS) {
        const { root, inner } = createLandmarkPinElement(cfg);
        const marker = new maplibregl.Marker({
          element: root,
          anchor: 'bottom',
          pitchAlignment: 'viewport',
          rotationAlignment: 'viewport',
        })
          .setLngLat([cfg.coords.lng, cfg.coords.lat])
          .addTo(map);
        markerMap.set(cfg.key, { marker, root, inner });
      }
      markersRef.current = markerMap;

      // Pasang Panah Biru GPS Google Maps Driving Navigator
      const puckEl = createGpsNavigatorPuckElement();
      puckEl.style.display = 'none';
      gpsPuckElRef.current = puckEl;
      gpsPuckMarkerRef.current = new maplibregl.Marker({
        element: puckEl,
        anchor: 'center',
        pitchAlignment: 'map',
        rotationAlignment: 'map',
      })
        .setLngLat([LOCATION_TOUR_COORDS.kedai.lng, LOCATION_TOUR_COORDS.kedai.lat])
        .addTo(map);

      const setupLayers = () => {
        if (!mapRef.current) return;
        attachNavigator3DLayers(map);
        lastStaticRouteSceneIdRef.current = null;
        lastHighlightedSceneIdRef.current = null;
        lastDynamicGeoUpdateMsRef.current = 0;
        mapLoadedRef.current = true;
        setIsMapStyleLoaded(true);
        const nowT = getMasterTimeRef.current ? getMasterTimeRef.current() : prevTimeRef.current;
        applyFrameRef.current(nowT, true);
        onMapReady?.();
      };

      map.on('style.load', setupLayers);
      map.on('load', setupLayers);
      if (map.isStyleLoaded()) {
        setupLayers();
      }

      const styleFallbackTimer = window.setTimeout(() => {
        if (!mapLoadedRef.current && !usedBackupStyleRef.current && mapRef.current) {
          usedBackupStyleRef.current = true;
          map.setStyle(buildRasterBackupMapStyle(activeTheme));
        }
      }, 5000);

      const initialResizeRaf = requestAnimationFrame(() => {
        try {
          map.resize();
        } catch {
          // ignore
        }
      });

      map.on('error', () => {
        if (!mapLoadedRef.current && !usedBackupStyleRef.current) {
          usedBackupStyleRef.current = true;
          try {
            map.setStyle(buildRasterBackupMapStyle(activeTheme));
          } catch {
            setWebglAvailable(false);
          }
        }
      });

      const resizeObserver = new ResizeObserver(() => {
        try {
          map.resize();
        } catch {
          // ignore
        }
      });
      resizeObserver.observe(container);

      return () => {
        cancelAnimationFrame(initialResizeRaf);
        window.clearTimeout(styleFallbackTimer);
        resizeObserver.disconnect();
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        markerMap.forEach(({ marker }) => marker.remove());
        markerMap.clear();
        gpsPuckMarkerRef.current?.remove();
        gpsPuckMarkerRef.current = null;
        gpsPuckElRef.current = null;
        mapLoadedRef.current = false;
        mapRef.current = null;
        try {
          map.remove();
        } catch {
          // ignore
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [webglAvailable, activeTheme]);

    // Toggle kontrol interaksi manual saat jeda vs kunci saat navigasi berjalan
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      if (isPlaying) {
        userInteractingRef.current = false;
        map.dragPan.disable();
        map.scrollZoom.disable();
        map.dragRotate.disable();
        map.touchZoomRotate.disable();
      } else if (interactiveWhenPaused) {
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.dragRotate.enable();
        map.touchZoomRotate.enable();
      }
    }, [isPlaying, interactiveWhenPaused]);

    // Loop WebGL 60fps–120fps terpisah dari React state saat audio sedang diputar!
    useEffect(() => {
      if (!isPlaying || !webglAvailable) return;
      let rafId = 0;
      prevFrameMsRef.current = 0;

      const tick = () => {
        const liveTime = getMasterTimeRef.current
          ? getMasterTimeRef.current()
          : prevTimeRef.current;
        applyFrameRef.current(liveTime, false);
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }, [isPlaying, webglAvailable]);

    // Sinkronisasi presisi saat jeda, scrub (?sync=1), atau gaya peta baru selesai dimuat
    useEffect(() => {
      if (!webglAvailable) return;
      if (!isPlaying || instantJump) {
        applyFrameRef.current(currentTimeSec, instantJump || !isPlaying);
      }
    }, [currentTimeSec, isPlaying, instantJump, webglAvailable, isMapStyleLoaded, timelineScenes]);

    const renderNavigatorTurnIcon = () => {
      switch (activeScene.navTurnIcon) {
        case 'left':
          return <ArrowLeft className="w-5 h-5 text-[#FFE066]" />;
        case 'right':
          return <ArrowRight className="w-5 h-5 text-[#FFE066]" />;
        case 'turn-left':
          return <CornerUpLeft className="w-5 h-5 text-white" />;
        case 'cross':
        case 'straight':
          return <ArrowUp className="w-5 h-5 text-white" />;
        case 'arrive':
        case 'pin':
        default:
          return <MapPin className="w-5 h-5 text-[#FFE066] fill-[#FFE066]/30" />;
      }
    };

    const showHighlightBanner =
      Boolean(activeScene.highlightBadge) &&
      currentTimeSec >= (activeScene.highlightBadge?.showFromSec ?? Infinity) &&
      activeScene.sceneNumber !== 7;

    const showScene7Cta =
      activeScene.sceneNumber === 7 &&
      Boolean(activeScene.ctaOverlay) &&
      currentTimeSec >= (activeScene.ctaOverlay?.showFromSec ?? 65.2);

    const highlightMapsBtn =
      showScene7Cta &&
      currentTimeSec >= (activeScene.ctaOverlay?.mapsButtonHighlightStartSec ?? 70.6) &&
      currentTimeSec < (activeScene.ctaOverlay?.plusCodeHighlightStartSec ?? 74.3);

    const highlightPlusCodeBtn =
      showScene7Cta &&
      currentTimeSec >= (activeScene.ctaOverlay?.plusCodeHighlightStartSec ?? 74.3);

    const initialNavTitle = activeScene.route
      ? `${formatRemainingDistance(activeScene.route.distanceMeters, routeProgress)} · ${activeScene.route.streetName}`
      : activeScene.navStreetTitle;

    return (
      <div
        className={`map3d-stage-root absolute inset-0 w-full h-full overflow-hidden ${
          activeTheme === 'satellite' ? 'bg-[#18242E]' : 'bg-[#E5E3DF]'
        } text-white ${className}`}
      >
        {/* Kanvas Peta 3D Real Google Satellite 2x Retina HD / Roadmap HD */}
        {webglAvailable ? (
          <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full"
            aria-label="Navigator Satelit 3D HD Google Maps Kota Pinrang 5MR2+PRV"
          />
        ) : (
          <Map3DCssFallbackStage
            scene={activeScene}
            camera={targetCamera}
            routeProgress={routeProgress}
          />
        )}

        {/* Layar pemuatan singkat sebelum peta siap */}
        {webglAvailable && !isMapStyleLoaded && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#18242E]/90">
            <Compass className="w-8 h-8 text-[#F5B700] animate-spin mb-2" />
            <p className="text-xs font-semibold text-white tracking-wide">
              Memuat Satelit 3D HD Kota Pinrang...
            </p>
          </div>
        )}

        {/* Skrim halus bawah agar subtitle & kartu CTA selalu kontras tanpa membebani GPU */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/22 to-transparent z-10" />

        {/* TOP GOOGLE MAPS GREEN TURN-BY-TURN NAVIGATOR BANNER */}
        <div
          className="absolute inset-x-3 z-20 pointer-events-none"
          style={{ top: `${topHudOffsetPx}px` }}
        >
          <div className="p-2.5 rounded-2xl bg-gradient-to-r from-[#0F9D58] to-[#0B8043] text-white shadow-[0_8px_22px_rgba(0,0,0,0.48)] border border-white/25 flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/18 flex items-center justify-center shrink-0 mt-0.5">
              {renderNavigatorTurnIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  ref={navTitleRef}
                  className="text-[12px] sm:text-[13px] font-extrabold leading-tight truncate tabular-nums"
                >
                  {initialNavTitle}
                </span>
              </div>
              <p className="text-[10.5px] sm:text-[11px] text-white/95 font-medium leading-snug line-clamp-2 mt-0.5">
                {activeScene.navInstruction}
              </p>
            </div>
          </div>

          {/* Floating Patokan / Sisi Jalan Callout tepat di bawah bar hijau Navigator */}
          {showHighlightBanner && activeScene.highlightBadge && (
            <div className="mt-1.5 flex justify-start">
              <div
                className={`inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-xl border shadow-lg text-[10.5px] font-extrabold ${
                  activeScene.highlightBadge.tone === 'pink'
                    ? 'bg-[#831843]/95 border-[#FF70B8] text-pink-50'
                    : activeScene.highlightBadge.tone === 'emerald'
                      ? 'bg-[#064E3B]/95 border-[#34D399] text-emerald-50'
                      : activeScene.highlightBadge.tone === 'blue'
                        ? 'bg-[#0C4A6E]/95 border-[#38BDF8] text-sky-50'
                        : 'bg-[#291704]/95 border-[#FFE066] text-[#FFE066]'
                }`}
              >
                <span className="truncate">{activeScene.highlightBadge.text}</span>
              </div>
            </div>
          )}
        </div>

        {/* LEFT SIDE FLOATING NAVIGATOR GAUGES (Otomatis sembunyi saat kartu CTA Scene 7 muncul agar tidak bertabrakan) */}
        {!showScene7Cta && (
          <div
            className="absolute left-3 z-20 flex flex-col gap-2 pointer-events-none"
            style={{ bottom: `${bottomControlsClearancePx + 10}px` }}
          >
            {activeScene.simulatedSpeedKmh > 0 && (
              <div className="w-10 h-10 rounded-full bg-white/95 border border-slate-900/20 shadow-lg flex flex-col items-center justify-center text-slate-900">
                <span className="text-[11.5px] font-extrabold font-mono tabular-nums leading-none">
                  {activeScene.simulatedSpeedKmh}
                </span>
                <span className="text-[7px] font-bold text-slate-600 uppercase leading-tight">
                  km/j
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTheme();
              }}
              title={
                activeTheme === 'satellite'
                  ? 'Ganti ke Peta Jalan 3D HD'
                  : 'Ganti ke Satelit Real 3D HD'
              }
              className="pointer-events-auto w-11 h-11 rounded-full bg-white/95 hover:bg-white text-[#1A73E8] border border-[#1A73E8]/35 shadow-lg flex flex-col items-center justify-center text-[8px] font-extrabold cursor-pointer transition-transform active:scale-95"
            >
              <Layers className="w-3.5 h-3.5 mb-0.5" />
              <span>{activeTheme === 'satellite' ? 'Satelit' : 'Jalan'}</span>
            </button>
          </div>
        )}

        {/* SCENE 7 OVERLAY CARD: Jam Buka 18.30 WITA, Link Google Maps Resmi, & Salin Plus Code */}
        {showScene7Cta && activeScene.ctaOverlay && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-3 z-30 flex justify-center pointer-events-none"
            style={{
              bottom: `${bottomControlsClearancePx + 10}px`,
            }}
          >
            <div className="pointer-events-auto w-full max-w-[330px] rounded-2xl bg-slate-950/94 border border-amber-400/60 p-3 shadow-[0_14px_32px_rgba(0,0,0,0.82)]">
              <div className="flex items-center gap-2 text-amber-300 text-[11px] font-bold">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Buka {activeScene.ctaOverlay.openingHoursLabel}</span>
              </div>

              <div className="grid grid-cols-1 gap-2 mt-2.5">
                <a
                  href={officialMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    highlightMapsBtn
                      ? 'bg-[#1A73E8] text-white ring-2 ring-[#93C5FD] shadow-[0_0_18px_rgba(26,115,232,0.7)]'
                      : 'bg-slate-800/95 hover:bg-slate-700 text-white border border-white/15'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Navigation className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{activeScene.ctaOverlay.mapsButtonLabel}</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-85" />
                </a>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCopyPlusCode();
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    highlightPlusCodeBtn
                      ? 'bg-[#F5B700] text-[#2E0906] ring-2 ring-[#FEF08A] shadow-[0_0_18px_rgba(245,183,0,0.7)]'
                      : 'bg-slate-800/95 hover:bg-slate-700 text-amber-200 border border-amber-400/35'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate font-mono tabular-nums">
                      {copiedPlusCode
                        ? 'Plus Code Tersalin!'
                        : `Salin Plus Code (${officialPlusCode})`}
                    </span>
                  </span>
                  {copiedPlusCode ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 shrink-0 opacity-85" />
                  )}
                </button>
              </div>

              <p className="text-[10px] text-slate-300 text-center mt-2">
                {activeScene.ctaOverlay.pickupAppsNote}
              </p>
            </div>
          </div>
        )}

      </div>
    );
  }
);

Map3DAnimatedStage.displayName = 'Map3DAnimatedStage';
