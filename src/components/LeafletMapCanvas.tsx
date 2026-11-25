import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LatLngPoint } from '../utils/mapsConfig';

export interface MapMarkerPoint {
  lat: number;
  lng: number;
  title?: string;
  subtitle?: string;
}

interface LeafletMapCanvasProps {
  center: LatLngPoint;
  zoom?: number;
  heightClassName?: string;
  storeMarker?: MapMarkerPoint | null;
  customerMarker?: MapMarkerPoint | null;
  customerAccuracyMeters?: number | null;
  interactiveMode?: 'readonly' | 'customer' | 'store';
  onSelectCoords?: (coords: LatLngPoint) => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createPinIcon(variant: 'store' | 'customer'): L.DivIcon {
  if (variant === 'store') {
    return L.divIcon({
      className: 'nkl-leaflet-pin-store',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,calc(-100% + 5px));">
          <div style="background:#A81410;color:#FFE066;border:2.5px solid #FFE066;box-shadow:0 4px 12px rgba(46,9,6,0.45);border-radius:9999px;padding:4px 9px;font-size:11px;font-weight:800;white-space:nowrap;font-family:sans-serif;line-height:1.1;">
            Kedai Lasinrang
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #A81410;margin-top:-1px;"></div>
          <div style="width:10px;height:10px;border-radius:9999px;background:#A81410;border:2px solid #FFFDF9;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  return L.divIcon({
    className: 'nkl-leaflet-pin-customer',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,calc(-100% + 6px));cursor:grab;">
        <div style="background:#1B5E20;color:#FFFDF9;border:2.5px solid #FFE066;box-shadow:0 4px 14px rgba(27,94,32,0.5);border-radius:9999px;padding:4px 10px;font-size:11px;font-weight:800;white-space:nowrap;font-family:sans-serif;line-height:1.1;">
          Titik Antar Anda
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #1B5E20;margin-top:-1px;"></div>
        <div style="width:12px;height:12px;border-radius:9999px;background:#1B5E20;border:2.5px solid #FFFDF9;box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export const LeafletMapCanvas: React.FC<LeafletMapCanvasProps> = ({
  center,
  zoom = 16,
  heightClassName = 'h-[260px] sm:h-[300px]',
  storeMarker,
  customerMarker,
  customerAccuracyMeters,
  interactiveMode = 'readonly',
  onSelectCoords,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const storeLayerRef = useRef<L.Marker | null>(null);
  const customerLayerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const isZoomingRef = useRef<boolean>(false);
  const prevZoomPropRef = useRef<number>(zoom);
  const onSelectCoordsRef = useRef(onSelectCoords);
  onSelectCoordsRef.current = onSelectCoords;
  const interactiveModeRef = useRef(interactiveMode);
  interactiveModeRef.current = interactiveMode;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      attributionControl: true,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    });

    map.on('zoomstart', () => {
      isZoomingRef.current = true;
    });
    map.on('zoomend', () => {
      isZoomingRef.current = false;
    });

    const tileLayer = L.tileLayer(
      'https://mt{s}.google.com/vt/lyrs=m&hl=id&x={x}&y={y}&z={z}',
      {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 21,
        maxNativeZoom: 20,
        keepBuffer: 6,
        updateWhenZooming: false,
        updateWhenIdle: true,
        attribution: '&copy; Google Maps',
      }
    );
    tileLayer.on('tileerror', () => {
      // ignore transient tile fetch errors cleanly
    });
    tileLayer.addTo(map);

    map.on('click', (ev: L.LeafletMouseEvent) => {
      if (interactiveModeRef.current === 'readonly') return;
      onSelectCoordsRef.current?.({
        lat: ev.latlng.lat,
        lng: ev.latlng.lng,
      });
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      try {
        if (mapRef.current && !isZoomingRef.current) {
          map.invalidateSize({ animate: false });
        }
      } catch {
        // ignore layout resize errors during teardown
      }
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      storeLayerRef.current = null;
      customerLayerRef.current = null;
      accuracyCircleRef.current = null;
      routeLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter smoothly when center or zoom prop explicitly changes without breaking manual zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isZoomingRef.current) return;
    const zoomChanged = prevZoomPropRef.current !== zoom;
    prevZoomPropRef.current = zoom;
    const targetZoom = zoomChanged ? zoom : map.getZoom();
    map.setView([center.lat, center.lng], targetZoom, { animate: true });
  }, [center.lat, center.lng, zoom]);

  // Update Store marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (storeLayerRef.current) {
      storeLayerRef.current.remove();
      storeLayerRef.current = null;
    }

    if (storeMarker) {
      const marker = L.marker([storeMarker.lat, storeMarker.lng], {
        icon: createPinIcon('store'),
        draggable: interactiveMode === 'store',
        title: storeMarker.title || 'Kedai Nasi Kuning Lasinrang',
      }).addTo(map);

      if (storeMarker.title || storeMarker.subtitle) {
        marker.bindPopup(
          `<div style="font-size:12px;color:#2E0906;line-height:1.35;">
            <strong style="color:#A81410;">${escapeHtml(storeMarker.title || 'Kedai Lasinrang')}</strong>
            ${storeMarker.subtitle ? `<div style="margin-top:2px;">${escapeHtml(storeMarker.subtitle)}</div>` : ''}
          </div>`
        );
      }

      if (interactiveMode === 'store') {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onSelectCoordsRef.current?.({ lat: pos.lat, lng: pos.lng });
        });
      }

      storeLayerRef.current = marker;
    }
  }, [
    storeMarker?.lat,
    storeMarker?.lng,
    storeMarker?.title,
    storeMarker?.subtitle,
    interactiveMode,
  ]);

  // Update Customer delivery marker + accuracy circle + distance dashed line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (customerLayerRef.current) {
      customerLayerRef.current.remove();
      customerLayerRef.current = null;
    }
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    if (customerMarker) {
      if (
        typeof customerAccuracyMeters === 'number' &&
        Number.isFinite(customerAccuracyMeters) &&
        customerAccuracyMeters > 0 &&
        customerAccuracyMeters <= 2500
      ) {
        accuracyCircleRef.current = L.circle(
          [customerMarker.lat, customerMarker.lng],
          {
            radius: customerAccuracyMeters,
            color: customerAccuracyMeters <= 35 ? '#1B5E20' : '#D97706',
            weight: 1.5,
            opacity: 0.65,
            fillColor: customerAccuracyMeters <= 35 ? '#2E7D32' : '#F59E0B',
            fillOpacity: 0.12,
            interactive: false,
          }
        ).addTo(map);
      }

      const marker = L.marker([customerMarker.lat, customerMarker.lng], {
        icon: createPinIcon('customer'),
        draggable: interactiveMode === 'customer',
        title: customerMarker.title || 'Titik Antar Anda',
      }).addTo(map);

      if (customerMarker.title || customerMarker.subtitle) {
        marker.bindPopup(
          `<div style="font-size:12px;color:#2E0906;line-height:1.35;">
            <strong style="color:#1B5E20;">${escapeHtml(customerMarker.title || 'Titik Pengantaran')}</strong>
            ${customerMarker.subtitle ? `<div style="margin-top:2px;">${escapeHtml(customerMarker.subtitle)}</div>` : ''}
          </div>`
        );
      }

      if (interactiveMode === 'customer') {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onSelectCoordsRef.current?.({ lat: pos.lat, lng: pos.lng });
        });
      }

      customerLayerRef.current = marker;

      if (storeMarker) {
        routeLineRef.current = L.polyline(
          [
            [storeMarker.lat, storeMarker.lng],
            [customerMarker.lat, customerMarker.lng],
          ],
          {
            color: '#1B5E20',
            weight: 2.5,
            opacity: 0.7,
            dashArray: '6, 6',
          }
        ).addTo(map);
      }
    }
  }, [
    customerMarker?.lat,
    customerMarker?.lng,
    customerMarker?.title,
    customerMarker?.subtitle,
    customerAccuracyMeters,
    storeMarker?.lat,
    storeMarker?.lng,
    interactiveMode,
  ]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClassName} rounded-2xl overflow-hidden border border-[#2E0906]/20 bg-[#EFE0C1] shadow-sm relative z-[1]`}
    />
  );
};
