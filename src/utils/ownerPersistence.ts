import { MenuItem, OrderRecord, StoreConfig } from '../types';
import {
  DEFAULT_EXTRA_SIDE_OPTIONS,
  DEFAULT_PORTION_PRESETS,
  DEFAULT_REAL_QRIS_URL,
  DEFAULT_SAMBAL_OPTIONS,
  INITIAL_MENU_ITEMS,
  INITIAL_STORE_CONFIG,
  NEW_OFFICIAL_MENU_IDS,
} from '../data/initialData';

export const STORAGE_KEYS = {
  STORE_CONFIG: 'nkl_store_config_v1',
  MENU_ITEMS: 'nkl_menu_items_v2',
  CART: 'nkl_cart_v1',
  ORDERS: 'nkl_orders_v1',
  SAVED_LOCATIONS: 'nkl_saved_locations_v1',
  OWNER_VERIFIED: 'nkl_owner_verified_v1',
  PENDING_SYNC: 'nkl_owner_pending_sync_v1',
  OWNER_AUTHORITY_META: 'nkl_owner_authority_meta_v1',
  QUICK_REPLY_DRAFT: 'nkl_owner_quick_reply_v1',
} as const;

export const OWNER_SECRET_PIN_VALUE = '225500';
export const EXPLICIT_OWNER_RESET_TOKEN = 'RESET_OWNER_PERMANENT';

export interface OwnerAuthorityMeta {
  lockedByOwner: boolean;
  hasCustomStore: boolean;
  hasCustomMenus: boolean;
  lastOwnerEditAt: number;
  lastServerSyncAt: number;
  lastCloudSyncAt: number;
  deletedMenuIds: string[];
}

export const EMPTY_OWNER_AUTHORITY_META: OwnerAuthorityMeta = {
  lockedByOwner: false,
  hasCustomStore: false,
  hasCustomMenus: false,
  lastOwnerEditAt: 0,
  lastServerSyncAt: 0,
  lastCloudSyncAt: 0,
  deletedMenuIds: [],
};

export interface PendingOwnerSync {
  storeDirty: boolean;
  menuDirty: boolean;
  cloudStoreDirty: boolean;
  cloudMenuDirty: boolean;
  deletedMenuIds: string[];
  ordersDirty: boolean;
  deletedOrderIds: string[];
  lastLocalEditAt: number;
}

export interface QuickReplyDraft {
  customerName: string;
  customerWa: string;
  foodSubtotal: number;
  extraSideFee: number;
  shippingFee: number;
}

export const EMPTY_PENDING_SYNC: PendingOwnerSync = {
  storeDirty: false,
  menuDirty: false,
  cloudStoreDirty: false,
  cloudMenuDirty: false,
  deletedMenuIds: [],
  ordersDirty: false,
  deletedOrderIds: [],
  lastLocalEditAt: 0,
};

const IDB_NAME = 'nkl_owner_permanent_db_v1';
const IDB_STORE = 'kv';
const IDB_VERSION = 1;

function openOwnerDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet<T>(key: string, value: T): Promise<boolean> {
  const db = await openOwnerDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openOwnerDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as T | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openOwnerDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export function normalizeStoreConfig(
  base: StoreConfig,
  incoming?: Partial<StoreConfig> | null
): StoreConfig {
  const src = incoming || {};
  const definedEntries = Object.entries(src).filter(([, val]) => val !== undefined);
  const cleanIncoming = Object.fromEntries(definedEntries) as Partial<StoreConfig>;

  const mergedPortionPresets = {
    ...DEFAULT_PORTION_PRESETS,
    ...(base.portionPresets || {}),
    ...(cleanIncoming.portionPresets || {}),
  };

  const mergedExtraSides = Array.isArray(cleanIncoming.extraSideOptions)
    ? cleanIncoming.extraSideOptions
    : Array.isArray(base.extraSideOptions)
    ? base.extraSideOptions
    : DEFAULT_EXTRA_SIDE_OPTIONS;

  const mergedSambalOptions =
    Array.isArray(cleanIncoming.sambalOptions) && cleanIncoming.sambalOptions.length > 0
      ? cleanIncoming.sambalOptions.map((opt) => {
          const fallback = DEFAULT_SAMBAL_OPTIONS.find((d) => d.id === opt.id);
          return {
            id: opt.id,
            label: opt.label ?? fallback?.label ?? opt.id,
            desc: opt.desc ?? fallback?.desc ?? '',
            enabled: typeof opt.enabled === 'boolean' ? opt.enabled : true,
          };
        })
      : Array.isArray(base.sambalOptions) && base.sambalOptions.length > 0
      ? base.sambalOptions
      : DEFAULT_SAMBAL_OPTIONS;

  const merged: StoreConfig = {
    ...INITIAL_STORE_CONFIG,
    ...base,
    ...cleanIncoming,
    portionPresets: mergedPortionPresets,
    extraSideOptions: mergedExtraSides,
    sambalOptions: mergedSambalOptions,
  };

  if ('storeLat' in src && (src.storeLat === undefined || !Number.isFinite(src.storeLat))) {
    delete merged.storeLat;
  }
  if ('storeLng' in src && (src.storeLng === undefined || !Number.isFinite(src.storeLng))) {
    delete merged.storeLng;
  }
  if ('storePlaceId' in src && !src.storePlaceId) {
    delete merged.storePlaceId;
  }
  if ('storePlaceName' in src && !src.storePlaceName) {
    delete merged.storePlaceName;
  }

  if (typeof merged.tagline === 'string') {
    merged.tagline = merged.tagline.replace(/ma[ny]ameng\s+tongeng/gi, 'Malunra Tongeng');
  }

  if (
    !merged.qrisImageUrl ||
    merged.qrisImageUrl.startsWith('data:image/svg+xml') ||
    merged.qrisImageUrl.includes('STANDAR KODE QR NASIONAL')
  ) {
    merged.qrisImageUrl = DEFAULT_REAL_QRIS_URL;
  }

  return merged;
}

export function readOwnerAuthorityMetaSync(): OwnerAuthorityMeta {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OWNER_AUTHORITY_META);
    if (!raw) return { ...EMPTY_OWNER_AUTHORITY_META };
    const parsed = JSON.parse(raw) as Partial<OwnerAuthorityMeta>;
    return {
      lockedByOwner: Boolean(parsed.lockedByOwner),
      hasCustomStore: Boolean(parsed.hasCustomStore),
      hasCustomMenus: Boolean(parsed.hasCustomMenus),
      lastOwnerEditAt: Number(parsed.lastOwnerEditAt) || 0,
      lastServerSyncAt: Number(parsed.lastServerSyncAt) || 0,
      lastCloudSyncAt: Number(parsed.lastCloudSyncAt) || 0,
      deletedMenuIds: Array.isArray(parsed.deletedMenuIds)
        ? parsed.deletedMenuIds.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return { ...EMPTY_OWNER_AUTHORITY_META };
  }
}

export async function writeOwnerAuthorityMetaPermanent(
  next: OwnerAuthorityMeta
): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEYS.OWNER_AUTHORITY_META, JSON.stringify(next));
  } catch {
    // tiny (<300 bytes) metadata rarely fails, still mirrored in IndexedDB below
  }
  await idbSet(STORAGE_KEYS.OWNER_AUTHORITY_META, next);
}

export function readLocalStoreConfigSync(): StoreConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORE_CONFIG);
    if (!raw) return normalizeStoreConfig(INITIAL_STORE_CONFIG);
    const parsed = JSON.parse(raw) as Partial<StoreConfig>;
    return normalizeStoreConfig(INITIAL_STORE_CONFIG, parsed);
  } catch {
    return normalizeStoreConfig(INITIAL_STORE_CONFIG);
  }
}

export function upgradeLegacyOfficialMenuCopy(item: MenuItem): MenuItem {
  // Preserve Owner's custom uploaded data:image or custom URLs; upgrade only old bundled landscape asset paths
  let nextImageUrl = item.imageUrl;
  if (
    typeof nextImageUrl === 'string' &&
    (nextImageUrl.includes('/src/assets/images/') ||
      /\/assets\/nasi[-_]kuning/i.test(nextImageUrl))
  ) {
    const officialMatch = INITIAL_MENU_ITEMS.find((def) => def.id === item.id);
    if (officialMatch?.imageUrl) {
      nextImageUrl = officialMatch.imageUrl;
    }
  }

  let nextName = item.name;
  let nextTag = item.signatureTag;

  if (item.id === 'nasi-kuning-ayam-sambal' && item.name === 'Nasi Kuning Ayam Sambal') {
    nextName = 'Nasi Kuning Ayam Balado';
  } else if (item.id === 'nasi-kuning-telur-sambal' && item.name === 'Nasi Kuning Telur Sambal') {
    nextName = 'Nasi Kuning Telur Sambal Saos';
    if (!nextTag || nextTag === 'Telur Sambal · Komplit') {
      nextTag = 'Telur Sambal Saos · Komplit';
    }
  } else if (item.id === 'nasi-kuning-udang-saos') {
    if (item.name === 'Nasi Kuning Udang Saos') {
      nextName = 'Nasi Kuning Udang Saos Asam Manis';
    }
    if (!nextTag || nextTag === 'Udang Saos · Komplit') {
      nextTag = 'Menu Baru · Saos Asam Manis';
    }
  } else if (
    item.id === 'nasi-kuning-cumi-tinta-hitam' &&
    (!nextTag || nextTag === 'Cumi Tinta Hitam · Komplit')
  ) {
    nextTag = 'Menu Baru · Cumi Tinta Hitam';
  } else if (
    item.id === 'nasi-kuning-ayam-bakar' &&
    (!nextTag || nextTag === 'Ayam Bakar · Komplit')
  ) {
    nextTag = 'Menu Baru · Ayam Bakar Komplit';
  }

  const nextSides = Array.isArray(item.sidesIncluded)
    ? item.sidesIncluded.map((side) => {
        if (side === 'Mie Goreng Bumbu') return 'Mie Goreng Kecap';
        if (item.id === 'nasi-kuning-udang-saos' && side === 'Udang Saos Spesial') {
          return 'Udang Saos Asam Manis';
        }
        if (item.id === 'nasi-kuning-ayam-sambal' && side === 'Ayam Sambal') {
          return 'Ayam Balado Merah';
        }
        if (item.id === 'nasi-kuning-telur-sambal' && side === 'Telur Sambal') {
          return 'Telur Sambal Saos';
        }
        return side;
      })
    : item.sidesIncluded;

  if (
    nextImageUrl === item.imageUrl &&
    nextName === item.name &&
    nextTag === item.signatureTag &&
    nextSides.every((s, idx) => s === item.sidesIncluded?.[idx])
  ) {
    return item;
  }

  return {
    ...item,
    imageUrl: nextImageUrl,
    name: nextName,
    signatureTag: nextTag,
    sidesIncluded: nextSides,
  };
}

export function mergeMissingOfficialMenus(
  stored: MenuItem[],
  defaults: MenuItem[] = INITIAL_MENU_ITEMS,
  deletedIds: string[] = [],
  ownerAuthorityLocked = false
): MenuItem[] {
  const deletedSet = new Set(deletedIds);
  // Filter out anything the owner explicitly deleted
  const filteredStored = stored.filter((m) => !deletedSet.has(m.id));
  const normalizedStored = filteredStored.map(upgradeLegacyOfficialMenuCopy);
  if (ownerAuthorityLocked) {
    // Supreme Owner Authority: never silently inject or mutate owner-curated menus
    return normalizedStored;
  }
  const existingIds = new Set(normalizedStored.map((m) => m.id));
  const newOfficialSet = new Set<string>(NEW_OFFICIAL_MENU_IDS);

  const missingNew = defaults.filter(
    (def) => newOfficialSet.has(def.id) && !existingIds.has(def.id) && !deletedSet.has(def.id)
  );
  if (missingNew.length === 0) return normalizedStored;

  const missingSpesial = missingNew.filter((m) => m.category === 'spesial');
  const missingReguler = missingNew.filter((m) => m.category !== 'spesial');

  const result = [...normalizedStored];
  if (missingSpesial.length > 0) {
    let lastSpesialIdx = -1;
    result.forEach((m, i) => {
      if (m.category === 'spesial') lastSpesialIdx = i;
    });
    result.splice(lastSpesialIdx + 1, 0, ...missingSpesial);
  }
  if (missingReguler.length > 0) {
    const firstRegulerIdx = result.findIndex((m) => m.category === 'reguler');
    if (firstRegulerIdx === -1) {
      result.push(...missingReguler);
    } else {
      result.splice(firstRegulerIdx, 0, ...missingReguler);
    }
  }
  return result;
}

export function sortMenuItemsCanonical(items: MenuItem[]): MenuItem[] {
  const officialOrder = new Map<string, number>();
  INITIAL_MENU_ITEMS.forEach((m, idx) => {
    officialOrder.set(m.id, idx);
  });

  return [...items].sort((a, b) => {
    const aIdx = officialOrder.get(a.id);
    const bIdx = officialOrder.get(b.id);
    if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
    if (aIdx !== undefined) return -1;
    if (bIdx !== undefined) return 1;
    if (a.category !== b.category) {
      return a.category === 'spesial' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'id');
  });
}

export function readLocalMenuItemsSync(fallback: MenuItem[]): MenuItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MENU_ITEMS);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const pending = readPendingSync();
    const meta = readOwnerAuthorityMetaSync();
    const deleted = Array.from(new Set([...pending.deletedMenuIds, ...meta.deletedMenuIds]));
    return mergeMissingOfficialMenus(parsed, fallback, deleted, meta.lockedByOwner);
  } catch {
    return fallback;
  }
}

export function readPendingSync(): PendingOwnerSync {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
    if (!raw) return { ...EMPTY_PENDING_SYNC };
    const parsed = JSON.parse(raw) as Partial<PendingOwnerSync>;
    const storeDirty = Boolean(parsed.storeDirty);
    const menuDirty = Boolean(parsed.menuDirty);
    return {
      storeDirty,
      menuDirty,
      cloudStoreDirty:
        typeof parsed.cloudStoreDirty === 'boolean' ? parsed.cloudStoreDirty : storeDirty,
      cloudMenuDirty:
        typeof parsed.cloudMenuDirty === 'boolean' ? parsed.cloudMenuDirty : menuDirty,
      deletedMenuIds: Array.isArray(parsed.deletedMenuIds) ? parsed.deletedMenuIds : [],
      ordersDirty: Boolean(parsed.ordersDirty),
      deletedOrderIds: Array.isArray(parsed.deletedOrderIds) ? parsed.deletedOrderIds : [],
      lastLocalEditAt: Number(parsed.lastLocalEditAt) || 0,
    };
  } catch {
    return { ...EMPTY_PENDING_SYNC };
  }
}

export async function writePendingSyncPermanent(next: PendingOwnerSync): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(next));
  } catch {
    // ignore
  }
  await idbSet(STORAGE_KEYS.PENDING_SYNC, next);
}

export async function saveStoreConfigPermanentLocal(config: StoreConfig): Promise<boolean> {
  let localOk = false;
  try {
    localStorage.setItem(STORAGE_KEYS.STORE_CONFIG, JSON.stringify(config));
    localOk = true;
  } catch {
    // localStorage may hit ~5MB quota on very large uploaded images; IndexedDB handles much larger blobs
  }
  const idbOk = await idbSet(STORAGE_KEYS.STORE_CONFIG, config);
  return idbOk || localOk;
}

export async function saveMenuItemsPermanentLocal(items: MenuItem[]): Promise<boolean> {
  let localOk = false;
  try {
    localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(items));
    localOk = true;
  } catch {
    // QuotaExceededError fallback handled by IndexedDB below — OWNER_AUTHORITY_META still records custom menus!
  }
  const idbOk = await idbSet(STORAGE_KEYS.MENU_ITEMS, items);
  return idbOk || localOk;
}

export async function saveOrdersPermanentLocal(orders: OrderRecord[]): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  } catch {
    // ignore
  }
  await idbSet(STORAGE_KEYS.ORDERS, orders);
}

export async function hydrateOwnerDataFromIndexedDb(): Promise<{
  storeConfig: StoreConfig | null;
  menuItems: MenuItem[] | null;
  pendingSync: PendingOwnerSync | null;
  authorityMeta: OwnerAuthorityMeta | null;
  orders: OrderRecord[] | null;
}> {
  const [rawStore, rawMenus, rawPending, rawMeta, rawOrders] = await Promise.all([
    idbGet<Partial<StoreConfig>>(STORAGE_KEYS.STORE_CONFIG),
    idbGet<MenuItem[]>(STORAGE_KEYS.MENU_ITEMS),
    idbGet<Partial<PendingOwnerSync>>(STORAGE_KEYS.PENDING_SYNC),
    idbGet<Partial<OwnerAuthorityMeta>>(STORAGE_KEYS.OWNER_AUTHORITY_META),
    idbGet<OrderRecord[]>(STORAGE_KEYS.ORDERS),
  ]);

  const normalizedMeta: OwnerAuthorityMeta | null = rawMeta
    ? {
        lockedByOwner: Boolean(rawMeta.lockedByOwner),
        hasCustomStore: Boolean(rawMeta.hasCustomStore),
        hasCustomMenus: Boolean(rawMeta.hasCustomMenus),
        lastOwnerEditAt: Number(rawMeta.lastOwnerEditAt) || 0,
        lastServerSyncAt: Number(rawMeta.lastServerSyncAt) || 0,
        lastCloudSyncAt: Number(rawMeta.lastCloudSyncAt) || 0,
        deletedMenuIds: Array.isArray(rawMeta.deletedMenuIds) ? rawMeta.deletedMenuIds : [],
      }
    : null;

  const normalizedPending: PendingOwnerSync | null = rawPending
    ? {
        storeDirty: Boolean(rawPending.storeDirty),
        menuDirty: Boolean(rawPending.menuDirty),
        cloudStoreDirty:
          typeof rawPending.cloudStoreDirty === 'boolean'
            ? rawPending.cloudStoreDirty
            : Boolean(rawPending.storeDirty),
        cloudMenuDirty:
          typeof rawPending.cloudMenuDirty === 'boolean'
            ? rawPending.cloudMenuDirty
            : Boolean(rawPending.menuDirty),
        deletedMenuIds: Array.isArray(rawPending.deletedMenuIds) ? rawPending.deletedMenuIds : [],
        ordersDirty: Boolean(rawPending.ordersDirty),
        deletedOrderIds: Array.isArray(rawPending.deletedOrderIds) ? rawPending.deletedOrderIds : [],
        lastLocalEditAt: Number(rawPending.lastLocalEditAt) || 0,
      }
    : null;

  const deletedIds = Array.from(
    new Set([
      ...(normalizedPending?.deletedMenuIds || []),
      ...(normalizedMeta?.deletedMenuIds || []),
    ])
  );
  const ownerLocked = Boolean(
    normalizedMeta?.lockedByOwner || rawStore || (Array.isArray(rawMenus) && rawMenus.length > 0)
  );

  return {
    storeConfig: rawStore ? normalizeStoreConfig(INITIAL_STORE_CONFIG, rawStore) : null,
    menuItems: Array.isArray(rawMenus)
      ? mergeMissingOfficialMenus(rawMenus, INITIAL_MENU_ITEMS, deletedIds, ownerLocked)
      : null,
    pendingSync: normalizedPending,
    authorityMeta: normalizedMeta,
    orders: Array.isArray(rawOrders) ? rawOrders : null,
  };
}

export async function clearOwnerCustomOverridesLocal(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEYS.STORE_CONFIG);
    localStorage.removeItem(STORAGE_KEYS.MENU_ITEMS);
    localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
    localStorage.removeItem(STORAGE_KEYS.OWNER_AUTHORITY_META);
  } catch {
    // ignore
  }
  await Promise.all([
    idbDelete(STORAGE_KEYS.STORE_CONFIG),
    idbDelete(STORAGE_KEYS.MENU_ITEMS),
    idbDelete(STORAGE_KEYS.PENDING_SYNC),
    idbDelete(STORAGE_KEYS.OWNER_AUTHORITY_META),
  ]);
}

// ===========================================================================
// SERVER-SIDE PERMANENT OWNER STATE API HELPERS
// ===========================================================================
export interface ServerOwnerStateResponse {
  storeConfig: StoreConfig | null;
  menuItems: MenuItem[] | null;
  orders: OrderRecord[];
  deletedMenuIds: string[];
  ownerAuthorityLocked: boolean;
  updatedAtMs: number;
}

export async function fetchServerOwnerState(): Promise<ServerOwnerStateResponse | null> {
  try {
    const res = await fetch('/api/owner-state', {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ServerOwnerStateResponse>;
    const pending = readPendingSync();
    const meta = readOwnerAuthorityMetaSync();
    const serverDeleted = Array.isArray(data.deletedMenuIds) ? data.deletedMenuIds : [];
    const combinedDeleted = Array.from(
      new Set([...pending.deletedMenuIds, ...meta.deletedMenuIds, ...serverDeleted])
    );
    const ownerLocked = Boolean(data.ownerAuthorityLocked || data.storeConfig || data.menuItems);
    return {
      storeConfig: data.storeConfig
        ? normalizeStoreConfig(INITIAL_STORE_CONFIG, data.storeConfig)
        : null,
      menuItems: Array.isArray(data.menuItems)
        ? mergeMissingOfficialMenus(data.menuItems, INITIAL_MENU_ITEMS, combinedDeleted, ownerLocked)
        : null,
      orders: Array.isArray(data.orders) ? data.orders : [],
      deletedMenuIds: serverDeleted,
      ownerAuthorityLocked: ownerLocked,
      updatedAtMs: Number(data.updatedAtMs) || 0,
    };
  } catch {
    return null;
  }
}

export async function saveOwnerStateToServer(payload: {
  storeConfig?: StoreConfig;
  menuItems?: MenuItem[];
  orders?: OrderRecord[];
  deletedMenuIds?: string[];
}): Promise<{ ok: boolean; updatedAtMs?: number; error?: string }> {
  try {
    // CRITICAL: Do NOT use keepalive: true here — browsers enforce a hard 64KB limit on keepalive requests,
    // which silently aborts any payload containing uploaded HD menu photos!
    const res = await fetch('/api/owner-state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Owner-Pin': OWNER_SECRET_PIN_VALUE,
      },
      body: JSON.stringify({
        pin: OWNER_SECRET_PIN_VALUE,
        ...payload,
      }),
    });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errJson = (await res.json()) as { error?: string };
        if (errJson.error) errMsg = errJson.error;
      } catch {
        // ignore
      }
      return { ok: false, error: errMsg };
    }
    const json = (await res.json()) as { ok?: boolean; updatedAtMs?: number };
    return { ok: Boolean(json.ok), updatedAtMs: json.updatedAtMs };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal menghubungi server',
    };
  }
}

export async function resetOwnerStateOnServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/owner-state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Owner-Pin': OWNER_SECRET_PIN_VALUE,
      },
      body: JSON.stringify({
        pin: OWNER_SECRET_PIN_VALUE,
        resetToDefaults: true,
        confirmExplicitOwnerReset: EXPLICIT_OWNER_RESET_TOKEN,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function logCustomerOrderToServer(order: OrderRecord): Promise<boolean> {
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
