import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  findNearestPinrangCorridor,
  findNearestPinrangLandmarks,
  isWithinPinrangArea,
  searchPinrangLocations,
} from './src/data/pinrangLocations.ts';
import type { MenuItem, OrderRecord, StoreConfig } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const OWNER_PIN_CODE = '225500';
const OWNER_STATE_FILE_PATH = path.resolve(__dirname, '.owner-permanent-state.json');
const PAYMENT_PROOF_DIR = path.resolve(__dirname, '.payment-proofs');

interface PersistedServerOwnerState {
  storeConfig: StoreConfig | null;
  menuItems: MenuItem[] | null;
  orders: OrderRecord[];
  deletedMenuIds: string[];
  ownerAuthorityLocked: boolean;
  updatedAtMs: number;
}

const OWNER_STATE_BACKUP_PATH = `${OWNER_STATE_FILE_PATH}.backup`;

function createDefaultServerOwnerState(): PersistedServerOwnerState {
  return {
    storeConfig: null,
    menuItems: null,
    orders: [],
    deletedMenuIds: [],
    ownerAuthorityLocked: false,
    updatedAtMs: 0,
  };
}

function normalizePersistedOwnerState(
  parsed: Partial<PersistedServerOwnerState>
): PersistedServerOwnerState {
  const hasCustomData = Boolean(
    parsed.storeConfig || (Array.isArray(parsed.menuItems) && parsed.menuItems.length > 0)
  );
  return {
    storeConfig: parsed.storeConfig ?? null,
    menuItems: Array.isArray(parsed.menuItems) ? parsed.menuItems : null,
    orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    deletedMenuIds: Array.isArray(parsed.deletedMenuIds)
      ? parsed.deletedMenuIds.filter((id): id is string => typeof id === 'string').slice(0, 100)
      : [],
    ownerAuthorityLocked:
      typeof parsed.ownerAuthorityLocked === 'boolean'
        ? parsed.ownerAuthorityLocked
        : hasCustomData,
    updatedAtMs: Number(parsed.updatedAtMs) || 0,
  };
}

function tryReadOwnerStateJsonFile(filePath: string): PersistedServerOwnerState | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return normalizePersistedOwnerState(parsed as Partial<PersistedServerOwnerState>);
  } catch {
    return null;
  }
}

function writeServerOwnerState(state: PersistedServerOwnerState): boolean {
  const tmpPath = `${OWNER_STATE_FILE_PATH}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    // Only back up existing file if it contains valid non-empty JSON
    if (tryReadOwnerStateJsonFile(OWNER_STATE_FILE_PATH) !== null) {
      try {
        fs.copyFileSync(OWNER_STATE_FILE_PATH, OWNER_STATE_BACKUP_PATH);
      } catch {
        // non-fatal backup copy
      }
    }
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpPath, OWNER_STATE_FILE_PATH);
    return true;
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup failure
    }
    console.error('Failed to write .owner-permanent-state.json:', err);
    return false;
  }
}

function readServerOwnerState(): PersistedServerOwnerState {
  if (!fs.existsSync(OWNER_STATE_FILE_PATH)) {
    return createDefaultServerOwnerState();
  }

  const primary = tryReadOwnerStateJsonFile(OWNER_STATE_FILE_PATH);
  if (primary) {
    return primary;
  }

  // Primary file is empty or corrupted: attempt automatic recovery from backup, otherwise self-heal with clean default JSON
  const recovered = tryReadOwnerStateJsonFile(OWNER_STATE_BACKUP_PATH);
  const nextState = recovered ?? createDefaultServerOwnerState();
  writeServerOwnerState(nextState);
  return nextState;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use(express.static(path.resolve(__dirname, 'public')));

  // ===========================================================================
  // 1. PERMANENT SERVER-SIDE OWNER STATE & CUSTOMER ORDER LOG ENDPOINTS
  // ===========================================================================
  app.get('/api/owner-state', (_req: Request, res: Response) => {
    const current = readServerOwnerState();
    res.setHeader('Cache-Control', 'no-store');
    res.json(current);
  });

  app.post('/api/owner-state', (req: Request, res: Response) => {
    try {
      const providedPin =
        typeof req.body?.pin === 'string'
          ? req.body.pin.trim()
          : typeof req.headers['x-owner-pin'] === 'string'
          ? req.headers['x-owner-pin'].trim()
          : '';

      if (providedPin !== OWNER_PIN_CODE) {
        res.status(403).json({ error: 'UNAUTHORIZED_OWNER_PIN' });
        return;
      }

      const current = readServerOwnerState();

      if (req.body?.resetToDefaults === true) {
        if (req.body?.confirmExplicitOwnerReset !== 'RESET_OWNER_PERMANENT') {
          res.status(403).json({
            error: 'EXPLICIT_RESET_CONFIRMATION_REQUIRED',
          });
          return;
        }
        const resetState: PersistedServerOwnerState = {
          storeConfig: null,
          menuItems: null,
          orders: current.orders,
          deletedMenuIds: [],
          ownerAuthorityLocked: false,
          updatedAtMs: Date.now(),
        };
        writeServerOwnerState(resetState);
        res.json({ ok: true, updatedAtMs: resetState.updatedAtMs });
        return;
      }

      const nextStoreConfig =
        req.body?.storeConfig && typeof req.body.storeConfig === 'object'
          ? (req.body.storeConfig as StoreConfig)
          : current.storeConfig;

      const incomingMenuItems = Array.isArray(req.body?.menuItems)
        ? (req.body.menuItems as MenuItem[])
        : null;

      // Protect against accidental empty wipe of owner's menu catalog
      const nextMenuItems =
        incomingMenuItems && (incomingMenuItems.length > 0 || req.body?.allowEmptyMenus === true)
          ? incomingMenuItems
          : current.menuItems;

      const nextOrders = Array.isArray(req.body?.orders)
        ? (req.body.orders as OrderRecord[])
        : current.orders;

      const nextDeletedMenuIds = Array.isArray(req.body?.deletedMenuIds)
        ? Array.from(
            new Set(
              (req.body.deletedMenuIds as unknown[]).filter(
                (id): id is string => typeof id === 'string' && id.trim().length > 0
              )
            )
          ).slice(0, 100)
        : current.deletedMenuIds;

      const nextState: PersistedServerOwnerState = {
        storeConfig: nextStoreConfig,
        menuItems: nextMenuItems,
        orders: nextOrders.slice(0, 100),
        deletedMenuIds: nextDeletedMenuIds,
        ownerAuthorityLocked: Boolean(
          current.ownerAuthorityLocked || nextStoreConfig || nextMenuItems
        ),
        updatedAtMs: Date.now(),
      };

      const saved = writeServerOwnerState(nextState);
      res.json({
        ok: saved,
        updatedAtMs: nextState.updatedAtMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/orders', (req: Request, res: Response) => {
    try {
      const order = req.body?.order as OrderRecord | undefined;
      if (!order || typeof order.id !== 'string' || !order.customerName) {
        res.status(400).json({ error: 'INVALID_ORDER' });
        return;
      }
      const current = readServerOwnerState();
      const filtered = current.orders.filter((o) => o.id !== order.id);
      const nextOrders = [order, ...filtered].slice(0, 100);
      const nextState: PersistedServerOwnerState = {
        ...current,
        orders: nextOrders,
      };
      writeServerOwnerState(nextState);
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // ===========================================================================
  // 1b. CUSTOMER PAYMENT PROOF PHOTO UPLOAD & HOSTING (FOR WHATSAPP ATTACHMENT)
  // ===========================================================================
  app.post('/api/payment-proof', (req: Request, res: Response) => {
    try {
      const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl.trim() : '';
      const match = dataUrl.match(
        /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i
      );
      if (!match) {
        res.status(400).json({ error: 'INVALID_IMAGE_FORMAT' });
        return;
      }

      const rawSubtype = match[1].toLowerCase();
      const ext = rawSubtype === 'png' ? 'png' : rawSubtype === 'webp' ? 'webp' : 'jpg';
      const buffer = Buffer.from(match[2], 'base64');

      if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
        res.status(400).json({ error: 'IMAGE_TOO_LARGE' });
        return;
      }

      fs.mkdirSync(PAYMENT_PROOF_DIR, { recursive: true });
      const filename = `bukti-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
      const targetPath = path.resolve(PAYMENT_PROOF_DIR, filename);

      if (!targetPath.startsWith(`${PAYMENT_PROOF_DIR}${path.sep}`)) {
        res.status(400).json({ error: 'INVALID_PATH' });
        return;
      }

      fs.writeFileSync(targetPath, buffer);
      res.json({
        ok: true,
        id: filename,
        urlPath: `/api/payment-proofs/${filename}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Payment proof upload error:', msg);
      res.status(500).json({ error: 'UPLOAD_FAILED' });
    }
  });

  app.get('/api/payment-proofs/:filename', (req: Request, res: Response) => {
    try {
      const rawParam = req.params.filename;
      const filename = typeof rawParam === 'string' ? rawParam : '';
      if (!/^bukti-\d+-[a-f0-9]+\.(jpg|png|webp)$/.test(filename)) {
        res.status(404).send('Not found');
        return;
      }

      const targetPath = path.resolve(PAYMENT_PROOF_DIR, filename);
      if (
        !targetPath.startsWith(`${PAYMENT_PROOF_DIR}${path.sep}`) ||
        !fs.existsSync(targetPath)
      ) {
        res.status(404).send('Not found');
        return;
      }

      const ext = path.extname(filename).toLowerCase();
      const contentType =
        ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=2592000');
      fs.createReadStream(targetPath).pipe(res);
    } catch {
      res.status(500).send('Server error');
    }
  });

  // Tutorial audio is served statically as public/audio/tutorial/full-tutorial.mp3 & click-sfx.wav (no TTS fallback).

  // ===========================================================================
  // 3. 100% FREE REVERSE GEOCODING & PLACE SEARCH (OPENSTREETMAP + PINRANG DB)
  // ===========================================================================
  interface FreeReverseGeoResult {
    streetName: string;
    streetNumber: string;
    neighborhood: string;
    kelurahan: string;
    kecamatan: string;
    city: string;
    postalCode: string;
    plusCode: string;
    detectedAlley: string;
    fullFormattedAddress: string;
    nearbyLandmarks: Array<{ name: string; relation?: string; distanceMeters?: number }>;
    source: 'osm-free';
  }

  const freeReverseGeoCache = new Map<string, FreeReverseGeoResult>();
  const freeSearchCache = new Map<
    string,
    Array<{
      id: string;
      title: string;
      subtitle: string;
      streetName: string;
      kelurahan: string;
      kecamatan: string;
      lat: number;
      lng: number;
      landmarkHint: string;
    }>
  >();

  const extractDetectedAlley = (
    streetName: string,
    neighborhood: string,
    rawFormatted: string
  ): string => {
    const candidates = [streetName, neighborhood, rawFormatted].filter(Boolean);
    for (const text of candidates) {
      const match = text.match(
        /\b(?:lorong|lr\.?|gang|gg\.?|blok)\s+[a-z0-9\-/]+(?:\s+no\.?\s*[a-z0-9\-/]+)?/i
      );
      if (match?.[0]) {
        return match[0].replace(/\s+/g, ' ').trim();
      }
    }
    return '';
  };

  const enrichWithPinrangGeodata = (
    lat: number,
    lng: number,
    base: {
      streetName: string;
      streetNumber: string;
      neighborhood: string;
      kelurahan: string;
      kecamatan: string;
      city: string;
      postalCode: string;
      detectedAlley: string;
      fullFormattedAddress: string;
      nearbyLandmarks: Array<{ name: string; relation?: string; distanceMeters?: number }>;
    }
  ): FreeReverseGeoResult => {
    const inPinrang = isWithinPinrangArea(lat, lng);
    if (!inPinrang) {
      const segs: string[] = [];
      if (base.streetName) {
        segs.push(
          base.streetNumber ? `${base.streetName} No. ${base.streetNumber}` : base.streetName
        );
      }
      if (base.neighborhood) segs.push(base.neighborhood);
      if (base.kelurahan) {
        segs.push(
          /^(kel\.?|kelurahan|desa)\b/i.test(base.kelurahan)
            ? base.kelurahan
            : `Kel. ${base.kelurahan}`
        );
      }
      if (base.kecamatan) {
        segs.push(
          /^(kec\.?|kecamatan)\b/i.test(base.kecamatan)
            ? base.kecamatan
            : `Kec. ${base.kecamatan}`
        );
      }
      if (base.city) segs.push(base.city);
      if (base.postalCode) segs.push(base.postalCode);

      return {
        ...base,
        plusCode: '',
        fullFormattedAddress:
          segs.length > 0 ? segs.join(', ') : base.fullFormattedAddress,
        source: 'osm-free',
      };
    }

    const { corridor, distanceMeters } = findNearestPinrangCorridor(lat, lng);
    const pinrangLandmarks = findNearestPinrangLandmarks(lat, lng, 3);

    let streetName = base.streetName;
    if (!streetName) {
      streetName =
        distanceMeters <= 350
          ? corridor.streetName
          : `Sekitar ${corridor.streetName}`;
    }

    const kelurahan = base.kelurahan
      ? /^(kel\.?|kelurahan|desa)\b/i.test(base.kelurahan)
        ? base.kelurahan
        : `Kel. ${base.kelurahan}`
      : corridor.kelurahan;

    const kecamatan = base.kecamatan
      ? /^(kec\.?|kecamatan)\b/i.test(base.kecamatan)
        ? base.kecamatan
        : `Kec. ${base.kecamatan}`
      : corridor.kecamatan;

    const city = base.city || 'Kabupaten Pinrang';
    const postalCode = base.postalCode || corridor.postalCode;

    const mergedLandmarks = [...base.nearbyLandmarks];
    for (const plm of pinrangLandmarks) {
      if (
        !mergedLandmarks.some(
          (existing) => existing.name.toLowerCase() === plm.name.toLowerCase()
        )
      ) {
        mergedLandmarks.push(plm);
      }
    }

    const segs: string[] = [];
    if (streetName) {
      segs.push(base.streetNumber ? `${streetName} No. ${base.streetNumber}` : streetName);
    }
    if (
      base.neighborhood &&
      !streetName.toLowerCase().includes(base.neighborhood.toLowerCase())
    ) {
      segs.push(base.neighborhood);
    }
    if (kelurahan) segs.push(kelurahan);
    if (kecamatan) segs.push(kecamatan);
    if (city) segs.push(city);
    if (postalCode) segs.push(postalCode);

    return {
      streetName,
      streetNumber: base.streetNumber,
      neighborhood: base.neighborhood || corridor.corridorArea,
      kelurahan,
      kecamatan,
      city,
      postalCode,
      plusCode: '',
      detectedAlley: base.detectedAlley,
      fullFormattedAddress: segs.join(', '),
      nearbyLandmarks: mergedLandmarks.slice(0, 4),
      source: 'osm-free',
    };
  };

  app.get('/api/reverse-geocode', async (req: Request, res: Response) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180 ||
        (lat === 0 && lng === 0)
      ) {
        res.status(400).json({ error: 'INVALID_COORDINATES' });
        return;
      }

      const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const cached = freeReverseGeoCache.get(cacheKey);
      if (cached) {
        res.json({ result: cached });
        return;
      }

      let osmStreetName = '';
      let osmStreetNumber = '';
      let osmNeighborhood = '';
      let osmKelurahan = '';
      let osmKecamatan = '';
      let osmCity = '';
      let osmPostalCode = '';
      let osmDisplayName = '';
      const osmLandmarks: Array<{
        name: string;
        relation?: string;
        distanceMeters?: number;
      }> = [];

      try {
        const osmUrl = new URL('https://nominatim.openstreetmap.org/reverse');
        osmUrl.searchParams.set('format', 'jsonv2');
        osmUrl.searchParams.set('lat', lat.toFixed(6));
        osmUrl.searchParams.set('lon', lng.toFixed(6));
        osmUrl.searchParams.set('zoom', '18');
        osmUrl.searchParams.set('addressdetails', '1');
        osmUrl.searchParams.set('accept-language', 'id');

        const osmRes = await fetch(osmUrl.toString(), {
          headers: {
            'User-Agent': 'NasiKuningLasinrangPinrang/1.0',
            Accept: 'application/json',
          },
        });

        if (osmRes.ok) {
          const osmJson = (await osmRes.json()) as {
            display_name?: string;
            name?: string;
            address?: {
              road?: string;
              pedestrian?: string;
              footway?: string;
              residential?: string;
              house_number?: string;
              neighbourhood?: string;
              hamlet?: string;
              quarter?: string;
              suburb?: string;
              village?: string;
              city_district?: string;
              municipality?: string;
              city?: string;
              town?: string;
              county?: string;
              regency?: string;
              postcode?: string;
              amenity?: string;
              building?: string;
            };
          };

          const addr = osmJson.address || {};
          osmStreetName = (
            addr.road ||
            addr.pedestrian ||
            addr.residential ||
            addr.footway ||
            ''
          ).trim();
          osmStreetNumber = (addr.house_number || '').trim();
          osmNeighborhood = (
            addr.neighbourhood ||
            addr.quarter ||
            addr.hamlet ||
            ''
          ).trim();
          osmKelurahan = (addr.village || addr.suburb || '').trim();
          osmKecamatan = (addr.city_district || addr.municipality || '').trim();
          osmCity = (addr.city || addr.town || addr.regency || addr.county || '').trim();
          osmPostalCode = (addr.postcode || '').trim();
          osmDisplayName = (osmJson.display_name || '')
            .replace(/,\s*Indonesia\s*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();

          const landmarkCandidate = (
            osmJson.name ||
            addr.amenity ||
            addr.building ||
            ''
          ).trim();
          if (
            landmarkCandidate &&
            landmarkCandidate.toLowerCase() !== osmStreetName.toLowerCase()
          ) {
            osmLandmarks.push({
              name: landmarkCandidate,
              relation: `Titik ${landmarkCandidate}`,
            });
          }
        }
      } catch {
        // fallback cleanly to Pinrang geodata
      }

      const detectedAlley = extractDetectedAlley(
        osmStreetName,
        osmNeighborhood,
        osmDisplayName
      );

      const enriched = enrichWithPinrangGeodata(lat, lng, {
        streetName: osmStreetName,
        streetNumber: osmStreetNumber,
        neighborhood: osmNeighborhood,
        kelurahan: osmKelurahan,
        kecamatan: osmKecamatan,
        city: osmCity,
        postalCode: osmPostalCode,
        detectedAlley,
        fullFormattedAddress: osmDisplayName,
        nearbyLandmarks: osmLandmarks,
      });

      if (freeReverseGeoCache.size >= 100) {
        const oldest = freeReverseGeoCache.keys().next().value;
        if (oldest) freeReverseGeoCache.delete(oldest);
      }
      freeReverseGeoCache.set(cacheKey, enriched);

      res.json({ result: enriched });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Free reverse geocode error:', msg);
      res.status(500).json({ error: 'REVERSE_GEOCODE_FAILED' });
    }
  });

  app.get('/api/search-place', async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q.length < 2) {
        res.json({ results: searchPinrangLocations(q) });
        return;
      }

      const cacheKey = q.toLowerCase();
      const cached = freeSearchCache.get(cacheKey);
      if (cached) {
        res.json({ results: cached });
        return;
      }

      const localMatches = searchPinrangLocations(q).map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        streetName: item.streetName,
        kelurahan: item.kelurahan,
        kecamatan: item.kecamatan,
        lat: item.lat,
        lng: item.lng,
        landmarkHint: item.landmarkHint,
      }));

      const osmResults: typeof localMatches = [];
      try {
        const hasPinrangWord = /pinrang|sawitto|paleteang|lasinrang/i.test(q);
        const searchQuery = hasPinrangWord ? q : `${q}, Pinrang, Sulawesi Selatan`;
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('q', searchQuery);
        url.searchParams.set('countrycodes', 'id');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('limit', '6');
        url.searchParams.set('accept-language', 'id');

        const osmRes = await fetch(url.toString(), {
          headers: {
            'User-Agent': 'NasiKuningLasinrangPinrang/1.0',
            Accept: 'application/json',
          },
        });

        if (osmRes.ok) {
          const items = (await osmRes.json()) as Array<{
            place_id?: number;
            lat?: string;
            lon?: string;
            name?: string;
            display_name?: string;
            address?: {
              road?: string;
              residential?: string;
              village?: string;
              suburb?: string;
              city_district?: string;
              municipality?: string;
              city?: string;
              town?: string;
            };
          }>;

          for (const item of items) {
            const lat = Number(item.lat);
            const lng = Number(item.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const addr = item.address || {};
            const street = (
              addr.road ||
              addr.residential ||
              item.name ||
              item.display_name?.split(',')[0] ||
              ''
            ).trim();
            const kel = (addr.village || addr.suburb || '').trim();
            const kec = (addr.city_district || addr.municipality || '').trim();
            const cleanedSubtitle = [
              kel ? (/^(kel|desa)/i.test(kel) ? kel : `Kel. ${kel}`) : '',
              kec ? (/^kec/i.test(kec) ? kec : `Kec. ${kec}`) : '',
              addr.city || addr.town || 'Pinrang',
            ]
              .filter(Boolean)
              .join(', ');

            osmResults.push({
              id: `osm_${item.place_id ?? `${lat}_${lng}`}`,
              title: item.name || street || item.display_name || q,
              subtitle: cleanedSubtitle,
              streetName: street,
              kelurahan: kel,
              kecamatan: kec,
              lat,
              lng,
              landmarkHint: item.name && item.name !== street ? `Sekitar ${item.name}` : '',
            });
          }
        }
      } catch {
        // local matches still returned
      }

      const combined = [...localMatches];
      for (const o of osmResults) {
        if (
          !combined.some(
            (existing) =>
              Math.abs(existing.lat - o.lat) < 0.0002 &&
              Math.abs(existing.lng - o.lng) < 0.0002
          )
        ) {
          combined.push(o);
        }
      }

      const sliced = combined.slice(0, 10);
      if (freeSearchCache.size >= 80) {
        const oldest = freeSearchCache.keys().next().value;
        if (oldest) freeSearchCache.delete(oldest);
      }
      freeSearchCache.set(cacheKey, sliced);

      res.json({ results: sliced });
    } catch {
      res.json({ results: [] });
    }
  });

  const httpServer = http.createServer(app);

  if (!IS_PROD) {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : { server: httpServer },
        watch: disableHmr ? null : undefined,
      },
      appType: 'spa',
    });
    if (disableHmr) {
      app.get('/@vite/client', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(`const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    if (style.parentNode) style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function injectQuery(url) {
  return url;
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Nasi Kuning Lasinrang server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
