import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  checkFirestoreQuotaError,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  MenuItem,
  OrderRecord,
  OrderStatus,
  PortionPresetConfig,
  SambalOptionConfig,
  SavedCustomerLocation,
  StoreConfig,
} from '../types';
import {
  DEFAULT_PORTION_PRESETS,
  DEFAULT_SAMBAL_OPTIONS,
  INITIAL_MENU_ITEMS,
} from '../data/initialData';
import { ensureDataUrlWithinFirestoreLimit } from '../utils/imageHelper';
import type { QuickReplyDraft } from '../utils/ownerPersistence';

function clampString(val: string | undefined, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

function clampStringPreserveSpaces(val: string | undefined, maxLen: number): string {
  return (val ?? '').slice(0, maxLen);
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val) return val;
  return new Date().toISOString();
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export function isPermissionDeniedError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === 'permission-denied' ||
    message.includes('permission-denied') ||
    message.includes('Missing or insufficient permissions')
  );
}

function logSnapshotListenerError(
  error: unknown,
  operationType: OperationType,
  path: string
): void {
  checkFirestoreQuotaError(error);
  if (isPermissionDeniedError(error)) {
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Firestore listener (${operationType}) on ${path}:`, message);
}

function sanitizePortionPresets(raw?: Partial<PortionPresetConfig>): PortionPresetConfig {
  const src = raw || {};
  return {
    extraPuasLabel:
      clampString(src.extraPuasLabel, 60) || DEFAULT_PORTION_PRESETS.extraPuasLabel,
    extraPuasRegulerDelta: Math.max(
      0,
      Math.min(
        1000000,
        Number(src.extraPuasRegulerDelta ?? DEFAULT_PORTION_PRESETS.extraPuasRegulerDelta) || 0
      )
    ),
    extraPuasSpesialDelta: Math.max(
      0,
      Math.min(
        1000000,
        Number(src.extraPuasSpesialDelta ?? DEFAULT_PORTION_PRESETS.extraPuasSpesialDelta) || 0
      )
    ),
    jumboLabel: clampString(src.jumboLabel, 60) || DEFAULT_PORTION_PRESETS.jumboLabel,
    jumboRegulerDelta: Math.max(
      0,
      Math.min(
        1000000,
        Number(src.jumboRegulerDelta ?? DEFAULT_PORTION_PRESETS.jumboRegulerDelta) || 0
      )
    ),
    jumboSpesialDelta: Math.max(
      0,
      Math.min(
        1000000,
        Number(src.jumboSpesialDelta ?? DEFAULT_PORTION_PRESETS.jumboSpesialDelta) || 0
      )
    ),
  };
}

function sanitizeSambalOptions(raw?: SambalOptionConfig[]): SambalOptionConfig[] {
  const list = Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_SAMBAL_OPTIONS;
  return list.slice(0, 10).map((opt) => ({
    id: opt.id === 'pisah' || opt.id === 'tanpa' ? opt.id : 'campur',
    label: clampStringPreserveSpaces(opt.label, 120) || opt.id,
    desc: clampStringPreserveSpaces(opt.desc, 220),
    enabled: Boolean(opt.enabled),
  }));
}

function mapStoreSnapshotData(data: Record<string, unknown>): Partial<StoreConfig> {
  const next: Partial<StoreConfig> = {};

  if (typeof data.brandName === 'string') next.brandName = data.brandName;
  if (typeof data.tagline === 'string') next.tagline = data.tagline;
  if (typeof data.locationAddress === 'string') next.locationAddress = data.locationAddress;
  if (typeof data.pickupCoordinatesText === 'string')
    next.pickupCoordinatesText = data.pickupCoordinatesText;
  if (typeof data.operatingHours === 'string') next.operatingHours = data.operatingHours;
  if (typeof data.isOpenLive === 'boolean') next.isOpenLive = data.isOpenLive;
  if (typeof data.liveStatusText === 'string') next.liveStatusText = data.liveStatusText;
  if (typeof data.whatsappNumber === 'string') next.whatsappNumber = data.whatsappNumber;
  if (typeof data.whatsappDisplay === 'string') next.whatsappDisplay = data.whatsappDisplay;
  if (typeof data.ewalletNumber === 'string') next.ewalletNumber = data.ewalletNumber;
  if (typeof data.ewalletDisplay === 'string') next.ewalletDisplay = data.ewalletDisplay;
  if (typeof data.qrisMerchantName === 'string') next.qrisMerchantName = data.qrisMerchantName;
  if (typeof data.qrisNmid === 'string') next.qrisNmid = data.qrisNmid;
  if (typeof data.qrisTerminalId === 'string') next.qrisTerminalId = data.qrisTerminalId;
  if (typeof data.qrisPrintedBy === 'string') next.qrisPrintedBy = data.qrisPrintedBy;
  if (typeof data.qrisVersion === 'string') next.qrisVersion = data.qrisVersion;
  if (typeof data.qrisImageUrl === 'string' && data.qrisImageUrl.length > 0) {
    next.qrisImageUrl = data.qrisImageUrl;
  }
  if (typeof data.gofoodUrl === 'string') next.gofoodUrl = data.gofoodUrl;
  if (typeof data.maximUrl === 'string') next.maximUrl = data.maximUrl;
  if (typeof data.googleMapsQuery === 'string') next.googleMapsQuery = data.googleMapsQuery;
  if (data.portionPresets && typeof data.portionPresets === 'object') {
    next.portionPresets = sanitizePortionPresets(
      data.portionPresets as Partial<PortionPresetConfig>
    );
  }
  if (Array.isArray(data.extraSideOptions)) {
    next.extraSideOptions = data.extraSideOptions.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    );
  }
  if (Array.isArray(data.sambalOptions)) {
    next.sambalOptions = sanitizeSambalOptions(data.sambalOptions as SambalOptionConfig[]);
  }
  if (typeof data.storeLat === 'number' && typeof data.storeLng === 'number') {
    next.storeLat = data.storeLat;
    next.storeLng = data.storeLng;
  }
  if (typeof data.storePlaceId === 'string') {
    next.storePlaceId = data.storePlaceId;
  }
  if (typeof data.storePlaceName === 'string') {
    next.storePlaceName = data.storePlaceName;
  }

  return next;
}

export interface CloudStoreSnapshotResult {
  config: Partial<StoreConfig>;
  updatedAtMs: number;
  ownerAuthorityLocked: boolean;
  deletedMenuIds: string[];
}

function mapStoreSnapshotMeta(data: Record<string, unknown>): CloudStoreSnapshotResult {
  const updatedAtMs =
    data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0;
  const deletedMenuIds = Array.isArray(data.deletedMenuIds)
    ? data.deletedMenuIds
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, 100)
    : [];
  const ownerAuthorityLocked =
    typeof data.ownerAuthorityLocked === 'boolean' ? data.ownerAuthorityLocked : true;
  return {
    config: mapStoreSnapshotData(data),
    updatedAtMs,
    ownerAuthorityLocked,
    deletedMenuIds,
  };
}

export async function fetchStoreConfigOnceFromCloud(): Promise<CloudStoreSnapshotResult | null> {
  try {
    const snap = await getDocFromServer(doc(db, 'store', 'main'));
    if (!snap.exists()) return null;
    return mapStoreSnapshotMeta(snap.data() as Record<string, unknown>);
  } catch (error) {
    checkFirestoreQuotaError(error);
    return null;
  }
}

export function subscribeStoreConfigFromCloud(
  onData: (result: CloudStoreSnapshotResult) => void
): () => void {
  const ref = doc(db, 'store', 'main');
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) return;
      onData(mapStoreSnapshotMeta(snapshot.data() as Record<string, unknown>));
    },
    (error) => {
      logSnapshotListenerError(error, OperationType.GET, 'store/main');
    }
  );
}

export async function saveStoreConfigToCloud(
  config: StoreConfig,
  options?: { deletedMenuIds?: string[]; ownerAuthorityLocked?: boolean }
): Promise<void> {
  const path = 'store/main';
  const safeWhatsapp = clampString(config.whatsappNumber, 25);
  const safeEwallet = clampString(config.ewalletNumber, 25);
  const safeDeletedIds = Array.isArray(options?.deletedMenuIds)
    ? Array.from(
        new Set(
          options.deletedMenuIds
            .map((id) => clampString(id, 128))
            .filter(Boolean)
        )
      ).slice(0, 100)
    : [];

  // Re-compress oversized QRIS data URL instead of corrupting it via .slice()
  const safeQrisImageUrl = await ensureDataUrlWithinFirestoreLimit(
    config.qrisImageUrl,
    310000
  );

  const payload: Record<string, unknown> = {
    brandName: clampString(config.brandName, 120) || 'NASI KUNING LASINRANG',
    tagline: clampString(config.tagline, 240),
    locationAddress: clampString(config.locationAddress, 360) || 'Pinrang',
    pickupCoordinatesText: clampString(config.pickupCoordinatesText, 360),
    operatingHours: clampString(config.operatingHours, 200),
    isOpenLive: Boolean(config.isOpenLive),
    liveStatusText: clampString(config.liveStatusText, 200),
    whatsappNumber: safeWhatsapp.length >= 6 ? safeWhatsapp : '6282363953662',
    whatsappDisplay: clampString(config.whatsappDisplay, 30),
    ewalletNumber: safeEwallet.length >= 6 ? safeEwallet : '08215089754',
    ewalletDisplay: clampString(config.ewalletDisplay, 30),
    qrisMerchantName: clampString(config.qrisMerchantName, 140),
    qrisNmid: clampString(config.qrisNmid, 50),
    qrisTerminalId: clampString(config.qrisTerminalId, 20),
    qrisPrintedBy: clampString(config.qrisPrintedBy, 40),
    qrisVersion: clampString(config.qrisVersion, 40),
    qrisImageUrl: safeQrisImageUrl,
    gofoodUrl: clampString(config.gofoodUrl, 500),
    maximUrl: clampString(config.maximUrl, 500),
    googleMapsQuery: clampString(config.googleMapsQuery, 360),
    portionPresets: sanitizePortionPresets(config.portionPresets),
    extraSideOptions: Array.isArray(config.extraSideOptions)
      ? config.extraSideOptions
          .map((s) => clampString(s, 60))
          .filter(Boolean)
          .slice(0, 25)
      : [],
    sambalOptions: sanitizeSambalOptions(config.sambalOptions),
    ownerAuthorityLocked: options?.ownerAuthorityLocked ?? true,
    deletedMenuIds: safeDeletedIds,
    updatedAt: serverTimestamp(),
  };

  if (typeof config.storeLat === 'number' && Number.isFinite(config.storeLat)) {
    payload.storeLat = Math.max(-90, Math.min(90, config.storeLat));
  }
  if (typeof config.storeLng === 'number' && Number.isFinite(config.storeLng)) {
    payload.storeLng = Math.max(-180, Math.min(180, config.storeLng));
  }
  if (config.storePlaceId) {
    payload.storePlaceId = clampString(config.storePlaceId, 160);
  }
  if (config.storePlaceName) {
    payload.storePlaceName = clampString(config.storePlaceName, 200);
  }

  try {
    await setDoc(doc(db, 'store', 'main'), payload, { merge: false });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncMenuItemsToCloud(
  items: MenuItem[],
  previousIds: string[] = []
): Promise<void> {
  const currentIds = new Set<string>();
  const deleteIds = new Set<string>(previousIds.map((id) => sanitizeId(id)));

  // Also fetch live Firestore doc IDs when list is allowed so deletions never resurrect
  try {
    const existingSnap = await getDocs(collection(db, 'menuItems'));
    existingSnap.docs.forEach((docSnap) => {
      deleteIds.add(docSnap.id);
    });
  } catch {
    // fallback gracefully to provided previousIds
  }

  items.forEach((item) => {
    currentIds.add(sanitizeId(item.id));
  });

  const toDelete = Array.from(deleteIds).filter((id) => !currentIds.has(id));

  let currentBatch = writeBatch(db);
  let opCount = 0;
  let approxBatchBytes = 0;

  // Keep every batch well under Firestore's 10MB request limit even when every menu has an HD base64 photo
  const commitBatchIfNeeded = async (force = false) => {
    if (opCount === 0) return;
    if (force || opCount >= 3 || approxBatchBytes >= 800000) {
      const batchToCommit = currentBatch;
      currentBatch = writeBatch(db);
      opCount = 0;
      approxBatchBytes = 0;
      await batchToCommit.commit();
    }
  };

  try {
    for (const item of items) {
      const id = sanitizeId(item.id);
      const docRef = doc(db, 'menuItems', id);
      const safeImageUrl = await ensureDataUrlWithinFirestoreLimit(item.imageUrl, 290000);
      currentBatch.set(docRef, {
        id,
        name: clampString(item.name, 140) || 'Menu Lasinrang',
        category: item.category === 'spesial' ? 'spesial' : 'reguler',
        basePrice: Math.max(1000, Math.min(10000000, Number(item.basePrice) || 10000)),
        description: clampString(item.description, 700),
        sidesIncluded: (item.sidesIncluded || []).slice(0, 15).map((s) => clampString(s, 80)),
        imageUrl: safeImageUrl,
        signatureTag: clampString(item.signatureTag, 120),
        isAvailable: Boolean(item.isAvailable),
        spiceLevel: clampString(item.spiceLevel, 120) || 'Gurih',
        updatedAt: serverTimestamp(),
      });
      opCount += 1;
      approxBatchBytes += safeImageUrl.length + 1024;
      await commitBatchIfNeeded(false);
    }

    for (const delId of toDelete) {
      currentBatch.delete(doc(db, 'menuItems', delId));
      opCount += 1;
      approxBatchBytes += 256;
      await commitBatchIfNeeded(false);
    }

    await commitBatchIfNeeded(true);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'menuItems');
  }
}

function mapMenuSnapshotDoc(
  docId: string,
  data: Record<string, unknown>
): { item: MenuItem; updatedAtMs: number } | null {
  if (typeof data.name !== 'string' || !data.name.trim()) return null;
  const updatedAtMs =
    data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0;

  return {
    item: {
      id: (typeof data.id === 'string' && data.id.trim()) || docId,
      name: data.name.trim(),
      category: data.category === 'spesial' ? 'spesial' : 'reguler',
      basePrice: Math.max(1000, Number(data.basePrice) || 10000),
      description: typeof data.description === 'string' ? data.description : '',
      sidesIncluded: Array.isArray(data.sidesIncluded)
        ? data.sidesIncluded.filter((s): s is string => typeof s === 'string')
        : [],
      imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
      signatureTag:
        typeof data.signatureTag === 'string' ? data.signatureTag : undefined,
      isAvailable:
        typeof data.isAvailable === 'boolean' ? data.isAvailable : true,
      spiceLevel:
        typeof data.spiceLevel === 'string' && data.spiceLevel.trim()
          ? data.spiceLevel
          : 'Gurih',
    },
    updatedAtMs,
  };
}

/**
 * Fallback single-document loader for menuItems/{itemId}.
 * Guarantees Owner's saved menu items & HD photos ALWAYS load directly from Firebase Cloud
 * even if a collection-wide `list` query on /menuItems is temporarily restricted.
 */
export async function fetchMenuItemsByIdsFromCloud(
  candidateIds: string[] = []
): Promise<{ items: MenuItem[]; latestUpdatedAtMs: number } | null> {
  const uniqueIds = Array.from(
    new Set([
      ...INITIAL_MENU_ITEMS.map((m) => sanitizeId(m.id)),
      ...candidateIds.map((id) => sanitizeId(id)),
    ])
  ).filter(Boolean);

  if (uniqueIds.length === 0) return null;

  try {
    const snapshots = await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          const snap = await getDocFromServer(doc(db, 'menuItems', id));
          if (!snap.exists()) return null;
          return mapMenuSnapshotDoc(snap.id, snap.data() as Record<string, unknown>);
        } catch (err) {
          checkFirestoreQuotaError(err);
          return null;
        }
      })
    );

    const mapped = snapshots.filter(
      (x): x is { item: MenuItem; updatedAtMs: number } => x !== null
    );
    if (mapped.length === 0) return null;

    const latestUpdatedAtMs = mapped.reduce(
      (max, entry) => Math.max(max, entry.updatedAtMs),
      0
    );
    return {
      items: mapped.map((entry) => entry.item),
      latestUpdatedAtMs,
    };
  } catch (error) {
    checkFirestoreQuotaError(error);
    return null;
  }
}

export async function fetchMenuItemsOnceFromCloud(
  knownMenuIds: string[] = []
): Promise<{
  items: MenuItem[];
  latestUpdatedAtMs: number;
  usedSingleDocFallback?: boolean;
} | null> {
  try {
    const snap = await getDocsFromServer(collection(db, 'menuItems'));
    if (snap.empty) return null;
    const mapped = snap.docs
      .map((d) => mapMenuSnapshotDoc(d.id, d.data() as Record<string, unknown>))
      .filter((x): x is { item: MenuItem; updatedAtMs: number } => x !== null);
    if (mapped.length === 0) return null;
    const latestUpdatedAtMs = mapped.reduce(
      (max, entry) => Math.max(max, entry.updatedAtMs),
      0
    );
    return {
      items: mapped.map((entry) => entry.item),
      latestUpdatedAtMs,
      usedSingleDocFallback: false,
    };
  } catch (error) {
    checkFirestoreQuotaError(error);
    if (isPermissionDeniedError(error)) {
      const fallback = await fetchMenuItemsByIdsFromCloud(knownMenuIds);
      return fallback ? { ...fallback, usedSingleDocFallback: true } : null;
    }
    return null;
  }
}

export function subscribeMenuItemsFromCloud(
  onData: (result: { items: MenuItem[]; latestUpdatedAtMs: number }) => void,
  knownMenuIds: string[] = []
): () => void {
  const colRef = collection(db, 'menuItems');
  let active = true;
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (!active || snapshot.empty) return;
      const mapped = snapshot.docs
        .map((d) => mapMenuSnapshotDoc(d.id, d.data() as Record<string, unknown>))
        .filter((x): x is { item: MenuItem; updatedAtMs: number } => x !== null);
      if (mapped.length === 0) return;
      const latestUpdatedAtMs = mapped.reduce(
        (max, entry) => Math.max(max, entry.updatedAtMs),
        0
      );
      onData({
        items: mapped.map((entry) => entry.item),
        latestUpdatedAtMs,
      });
    },
    (error) => {
      if (isPermissionDeniedError(error) && active) {
        void fetchMenuItemsByIdsFromCloud(knownMenuIds).then((fallback) => {
          if (active && fallback && fallback.items.length > 0) {
            onData(fallback);
          }
        });
        return;
      }
      logSnapshotListenerError(error, OperationType.LIST, 'menuItems');
    }
  );
}

// ===========================================================================
// ADMIN-ONLY PRIVATE SETTINGS (/ownerPrivate/settings) & AUDIT LOGS
// ===========================================================================
export interface OwnerPrivateSettingsData {
  quickReplyDraft?: QuickReplyDraft;
  qrCustomUrl?: string;
  protectedByFirebase: boolean;
  migrationVersion?: number;
  lastMigratedBy?: string;
  updatedAtMs: number;
}

export interface OwnerAuditLogEntry {
  id: string;
  action: 'migration' | 'cloud_save' | 'backup_restore' | 'explicit_reset';
  actorUid: string;
  actorEmail: string;
  storeSaved: boolean;
  menuCount: number;
  orderCount: number;
  note?: string;
  createdAt: string;
}

export async function fetchOwnerPrivateSettingsFromCloud(): Promise<{
  data: OwnerPrivateSettingsData | null;
  rulesSupported: boolean;
}> {
  try {
    const snap = await getDocFromServer(doc(db, 'ownerPrivate', 'settings'));
    if (!snap.exists()) {
      return { data: null, rulesSupported: true };
    }
    const raw = snap.data() as Record<string, unknown>;
    const qrd = raw.quickReplyDraft as Partial<QuickReplyDraft> | undefined;
    return {
      rulesSupported: true,
      data: {
        quickReplyDraft:
          qrd && typeof qrd === 'object'
            ? {
                customerName:
                  typeof qrd.customerName === 'string' ? qrd.customerName : 'Kak Pelanggan',
                customerWa: typeof qrd.customerWa === 'string' ? qrd.customerWa : '',
                foodSubtotal: Number(qrd.foodSubtotal) || 25000,
                extraSideFee: Number(qrd.extraSideFee) || 0,
                shippingFee: Number(qrd.shippingFee) || 7000,
              }
            : undefined,
        qrCustomUrl: typeof raw.qrCustomUrl === 'string' ? raw.qrCustomUrl : undefined,
        protectedByFirebase: Boolean(raw.protectedByFirebase),
        migrationVersion:
          typeof raw.migrationVersion === 'number' ? raw.migrationVersion : undefined,
        lastMigratedBy:
          typeof raw.lastMigratedBy === 'string' ? raw.lastMigratedBy : undefined,
        updatedAtMs: raw.updatedAt instanceof Timestamp ? raw.updatedAt.toMillis() : 0,
      },
    };
  } catch (error) {
    checkFirestoreQuotaError(error);
    if (isPermissionDeniedError(error)) {
      return { data: null, rulesSupported: false };
    }
    return { data: null, rulesSupported: true };
  }
}

export async function saveOwnerPrivateSettingsToCloud(input: {
  quickReplyDraft?: QuickReplyDraft;
  qrCustomUrl?: string;
  protectedByFirebase?: boolean;
  migrationVersion?: number;
  lastMigratedBy?: string;
}): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  const payload: Record<string, unknown> = {
    protectedByFirebase: input.protectedByFirebase ?? true,
    updatedAt: serverTimestamp(),
  };

  if (input.quickReplyDraft) {
    payload.quickReplyDraft = {
      customerName: clampString(input.quickReplyDraft.customerName, 100),
      customerWa: clampString(input.quickReplyDraft.customerWa, 30),
      foodSubtotal: Math.max(
        0,
        Math.min(100000000, Number(input.quickReplyDraft.foodSubtotal) || 0)
      ),
      extraSideFee: Math.max(
        0,
        Math.min(100000000, Number(input.quickReplyDraft.extraSideFee) || 0)
      ),
      shippingFee: Math.max(
        0,
        Math.min(100000000, Number(input.quickReplyDraft.shippingFee) || 0)
      ),
    };
  }
  if (typeof input.qrCustomUrl === 'string') {
    payload.qrCustomUrl = clampString(input.qrCustomUrl, 500);
  }
  if (typeof input.migrationVersion === 'number') {
    payload.migrationVersion = Math.max(0, Math.min(1000, Math.round(input.migrationVersion)));
  }
  if (input.lastMigratedBy) {
    payload.lastMigratedBy = clampString(input.lastMigratedBy, 160);
  }

  try {
    await setDoc(doc(db, 'ownerPrivate', 'settings'), payload, { merge: false });
    return { ok: true };
  } catch (error) {
    checkFirestoreQuotaError(error);
    if (isPermissionDeniedError(error)) {
      return { ok: false, permissionDenied: true };
    }
    handleFirestoreError(error, OperationType.WRITE, 'ownerPrivate/settings');
  }
}

export async function writeOwnerAuditLogToCloud(entry: {
  action: OwnerAuditLogEntry['action'];
  storeSaved: boolean;
  menuCount: number;
  orderCount: number;
  note?: string;
}): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  const user = auth.currentUser;
  if (!user || !user.email) return { ok: false };
  const id = sanitizeId(`log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const payload: Record<string, unknown> = {
    id,
    action: entry.action,
    actorUid: sanitizeId(user.uid),
    actorEmail: clampString(user.email, 160),
    storeSaved: Boolean(entry.storeSaved),
    menuCount: Math.max(0, Math.min(500, Math.round(entry.menuCount))),
    orderCount: Math.max(0, Math.min(10000, Math.round(entry.orderCount))),
    createdAt: serverTimestamp(),
  };
  if (entry.note) {
    payload.note = clampString(entry.note, 300);
  }

  try {
    await setDoc(doc(db, 'ownerAuditLogs', id), payload);
    return { ok: true };
  } catch (error) {
    checkFirestoreQuotaError(error);
    if (isPermissionDeniedError(error)) {
      return { ok: false, permissionDenied: true };
    }
    return { ok: false };
  }
}

export function subscribeOwnerAuditLogsFromCloud(
  onData: (logs: OwnerAuditLogEntry[]) => void
): () => void {
  const q = query(
    collection(db, 'ownerAuditLogs'),
    orderBy('createdAt', 'desc'),
    limit(15)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const logs: OwnerAuditLogEntry[] = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: (typeof data.id === 'string' && data.id) || d.id,
          action: (data.action as OwnerAuditLogEntry['action']) || 'cloud_save',
          actorUid: typeof data.actorUid === 'string' ? data.actorUid : '',
          actorEmail: typeof data.actorEmail === 'string' ? data.actorEmail : '',
          storeSaved: Boolean(data.storeSaved),
          menuCount: Number(data.menuCount) || 0,
          orderCount: Number(data.orderCount) || 0,
          note: typeof data.note === 'string' ? data.note : undefined,
          createdAt: toIsoString(data.createdAt),
        };
      });
      onData(logs);
    },
    (error) => {
      logSnapshotListenerError(error, OperationType.LIST, 'ownerAuditLogs');
    }
  );
}

// ===========================================================================
// CUSTOMER SAVED LOCATIONS & ORDERS
// ===========================================================================
export function subscribeSavedLocationsFromCloud(
  userId: string,
  onData: (locations: SavedCustomerLocation[]) => void
): () => void {
  const path = `users/${userId}/locations`;
  const q = query(
    collection(db, 'users', userId, 'locations'),
    where('userId', '==', userId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: SavedCustomerLocation[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            label: data.label,
            recipientName: data.recipientName,
            recipientPhone: data.recipientPhone,
            deliveryAddress: data.deliveryAddress,
            alleyDetail: typeof data.alleyDetail === 'string' ? data.alleyDetail : '',
            landmark: data.landmark,
            lat: Number(data.lat),
            lng: Number(data.lng),
            googleMapsLink: data.googleMapsLink,
            isDefault: Boolean(data.isDefault),
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onData(list);
    },
    (error) => {
      logSnapshotListenerError(error, OperationType.LIST, path);
    }
  );
}

export async function saveCustomerLocationToCloud(
  userId: string,
  loc: SavedCustomerLocation,
  isNew: boolean
): Promise<void> {
  const id = sanitizeId(loc.id);
  const path = `users/${userId}/locations/${id}`;
  const ref = doc(db, 'users', userId, 'locations', id);

  try {
    if (isNew) {
      await setDoc(ref, {
        id,
        userId,
        label: clampString(loc.label, 60) || 'Alamat Tersimpan',
        recipientName: clampString(loc.recipientName, 100),
        recipientPhone: clampString(loc.recipientPhone, 25),
        deliveryAddress: clampString(loc.deliveryAddress, 450) || 'Alamat Pinrang',
        alleyDetail: clampString(loc.alleyDetail, 240),
        landmark: clampString(loc.landmark, 240),
        lat: Math.max(-90, Math.min(90, loc.lat)),
        lng: Math.max(-180, Math.min(180, loc.lng)),
        googleMapsLink: clampString(loc.googleMapsLink, 450),
        isDefault: Boolean(loc.isDefault),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        label: clampString(loc.label, 60) || 'Alamat Tersimpan',
        recipientName: clampString(loc.recipientName, 100),
        recipientPhone: clampString(loc.recipientPhone, 25),
        deliveryAddress: clampString(loc.deliveryAddress, 450) || 'Alamat Pinrang',
        alleyDetail: clampString(loc.alleyDetail, 240),
        landmark: clampString(loc.landmark, 240),
        lat: Math.max(-90, Math.min(90, loc.lat)),
        lng: Math.max(-180, Math.min(180, loc.lng)),
        googleMapsLink: clampString(loc.googleMapsLink, 450),
        isDefault: Boolean(loc.isDefault),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      path
    );
  }
}

export async function deleteCustomerLocationFromCloud(
  userId: string,
  locationId: string
): Promise<void> {
  const id = sanitizeId(locationId);
  const path = `users/${userId}/locations/${id}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'locations', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeOrdersFromCloud(
  userId: string,
  isAdmin: boolean,
  onData: (orders: OrderRecord[]) => void
): () => void {
  const colRef = collection(db, 'orders');
  let activeUnsub: (() => void) | null = null;
  let disposed = false;

  const mapSnapshot = (snapshot: {
    docs: Array<{ id: string; data: () => Record<string, unknown> }>;
  }) => {
    const orders: OrderRecord[] = snapshot.docs
      .map((d) => {
        const data = d.data();
        return {
          id: (typeof data.id === 'string' && data.id) || d.id,
          userId: typeof data.userId === 'string' ? data.userId : '',
          createdAt: toIsoString(data.createdAt),
          customerName: typeof data.customerName === 'string' ? data.customerName : '',
          customerPhone: typeof data.customerPhone === 'string' ? data.customerPhone : '',
          fulfillment: data.fulfillment as OrderRecord['fulfillment'],
          deliveryAddress: typeof data.deliveryAddress === 'string' ? data.deliveryAddress : '',
          landmark: typeof data.landmark === 'string' ? data.landmark : '',
          googleMapsLink: typeof data.googleMapsLink === 'string' ? data.googleMapsLink : '',
          customerLat:
            typeof data.customerLat === 'number' ? data.customerLat : undefined,
          customerLng:
            typeof data.customerLng === 'number' ? data.customerLng : undefined,
          courierInfo: typeof data.courierInfo === 'string' ? data.courierInfo : '',
          customerNotes: typeof data.customerNotes === 'string' ? data.customerNotes : '',
          paymentMethod: data.paymentMethod as OrderRecord['paymentMethod'],
          paymentProofUrl:
            typeof data.paymentProofUrl === 'string' && data.paymentProofUrl
              ? data.paymentProofUrl
              : undefined,
          itemsSummary: Array.isArray(data.itemsSummary)
            ? (data.itemsSummary as OrderRecord['itemsSummary'])
            : [],
          foodSubtotal: Number(data.foodSubtotal) || 0,
          status: data.status as OrderStatus,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    onData(orders);
  };

  const attachListener = (useAdminQuery: boolean) => {
    if (disposed) return;
    const q = useAdminQuery
      ? query(colRef, orderBy('createdAt', 'desc'))
      : query(colRef, where('userId', '==', userId));

    activeUnsub = onSnapshot(
      q,
      mapSnapshot,
      (error) => {
        if (useAdminQuery && isPermissionDeniedError(error) && !disposed) {
          if (activeUnsub) {
            activeUnsub();
            activeUnsub = null;
          }
          attachListener(false);
          return;
        }
        logSnapshotListenerError(error, OperationType.LIST, 'orders');
      }
    );
  };

  attachListener(isAdmin);

  return () => {
    disposed = true;
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
  };
}

export async function saveOrderToCloud(
  userId: string,
  order: OrderRecord
): Promise<void> {
  const id = sanitizeId(order.id);
  const path = `orders/${id}`;
  const safeFulfillment =
    order.fulfillment === 'own_courier' || order.fulfillment === 'help_courier'
      ? order.fulfillment
      : 'pickup';
  const safePayment =
    order.paymentMethod === 'gopay' || order.paymentMethod === 'dana'
      ? order.paymentMethod
      : 'qris';

  const payload: Record<string, unknown> = {
    id,
    userId,
    customerName: clampString(order.customerName, 100) || 'Pelanggan',
    customerPhone:
      clampString(order.customerPhone, 25).length >= 6
        ? clampString(order.customerPhone, 25)
        : '080000000',
    fulfillment: safeFulfillment,
    deliveryAddress: clampString(order.deliveryAddress, 450),
    landmark: clampString(order.landmark, 240),
    googleMapsLink: clampString(order.googleMapsLink, 450),
    courierInfo: clampString(order.courierInfo, 240),
    customerNotes: clampString(order.customerNotes, 450),
    paymentMethod: safePayment,
    itemsSummary:
      Array.isArray(order.itemsSummary) && order.itemsSummary.length > 0
        ? order.itemsSummary.slice(0, 50)
        : [{ name: 'Pesanan Nasi Kuning', quantity: 1, unitPrice: 10000 }],
    foodSubtotal: Math.max(1, Math.min(100000000, Number(order.foodSubtotal) || 1000)),
    status: 'Menunggu Konfirmasi',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (
    typeof order.paymentProofUrl === 'string' &&
    order.paymentProofUrl.trim() &&
    order.paymentProofUrl.trim().length <= 500
  ) {
    payload.paymentProofUrl = clampString(order.paymentProofUrl, 500);
  }

  if (
    typeof order.customerLat === 'number' &&
    typeof order.customerLng === 'number' &&
    Number.isFinite(order.customerLat) &&
    Number.isFinite(order.customerLng)
  ) {
    payload.customerLat = Math.max(-90, Math.min(90, order.customerLat));
    payload.customerLng = Math.max(-180, Math.min(180, order.customerLng));
  }

  try {
    await setDoc(doc(db, 'orders', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateOrderStatusInCloud(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const id = sanitizeId(orderId);
  const path = `orders/${id}`;
  try {
    await updateDoc(doc(db, 'orders', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrderFromCloud(orderId: string): Promise<void> {
  const id = sanitizeId(orderId);
  const path = `orders/${id}`;
  try {
    await deleteDoc(doc(db, 'orders', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearAllOrdersFromCloud(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    if (snap.empty) return;
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'orders');
  }
}

export async function migrateOrdersToCloud(
  adminUid: string,
  orders: OrderRecord[]
): Promise<{ migratedCount: number; skippedExistingCount: number }> {
  let migratedCount = 0;
  let skippedExistingCount = 0;

  for (const order of orders.slice(0, 100)) {
    const id = sanitizeId(order.id);
    const ref = doc(db, 'orders', id);
    try {
      const existing = await getDocFromServer(ref);
      if (existing.exists()) {
        skippedExistingCount += 1;
        continue;
      }
    } catch {
      // Proceed to create if read throws not-found
    }

    try {
      await saveOrderToCloud(adminUid, order);
      if (order.status === 'Diproses' || order.status === 'Selesai') {
        await updateOrderStatusInCloud(id, order.status);
      }
      migratedCount += 1;
    } catch {
      // Skip malformed individual order without aborting full vault migration
    }
  }

  return { migratedCount, skippedExistingCount };
}

// ===========================================================================
// SERVER-VERIFIED FIREBASE VAULT AUDIT & 1-CLICK PROFESSIONAL MIGRATION
// ===========================================================================
export interface FirebaseVaultAuditReport {
  checkedAtMs: number;
  storeExists: boolean;
  storeUpdatedAtMs: number;
  storeBrandName?: string;
  ownerAuthorityLocked: boolean;
  menuCount: number;
  customPhotoCount: number;
  latestMenuUpdatedAtMs: number;
  menuListAllowed: boolean;
  privateSettingsExists: boolean;
  privateRulesReady: boolean;
  orderCount: number;
  ordersReadable: boolean;
}

export async function inspectFirebaseVaultState(
  knownMenuIds: string[] = [],
  isAdminVerified = false
): Promise<FirebaseVaultAuditReport> {
  const checkedAtMs = Date.now();

  // 1. Check store/main directly from server
  let storeExists = false;
  let storeUpdatedAtMs = 0;
  let storeBrandName: string | undefined;
  let ownerAuthorityLocked = false;
  try {
    const storeSnap = await getDocFromServer(doc(db, 'store', 'main'));
    if (storeSnap.exists()) {
      const meta = mapStoreSnapshotMeta(storeSnap.data() as Record<string, unknown>);
      storeExists = true;
      storeUpdatedAtMs = meta.updatedAtMs;
      storeBrandName = meta.config.brandName;
      ownerAuthorityLocked = meta.ownerAuthorityLocked;
    }
  } catch (err) {
    checkFirestoreQuotaError(err);
  }

  // 2. Check menuItems directly from server (testing collection list + single-doc fallback)
  let menuCount = 0;
  let customPhotoCount = 0;
  let latestMenuUpdatedAtMs = 0;
  let menuListAllowed = true;
  try {
    const menuSnap = await getDocsFromServer(collection(db, 'menuItems'));
    const mapped = menuSnap.docs
      .map((d) => mapMenuSnapshotDoc(d.id, d.data() as Record<string, unknown>))
      .filter((x): x is { item: MenuItem; updatedAtMs: number } => x !== null);
    menuCount = mapped.length;
    customPhotoCount = mapped.filter((m) => m.item.imageUrl.startsWith('data:image/')).length;
    latestMenuUpdatedAtMs = mapped.reduce((max, m) => Math.max(max, m.updatedAtMs), 0);
  } catch (err) {
    checkFirestoreQuotaError(err);
    if (isPermissionDeniedError(err)) {
      menuListAllowed = false;
      const fallback = await fetchMenuItemsByIdsFromCloud(knownMenuIds);
      if (fallback) {
        menuCount = fallback.items.length;
        customPhotoCount = fallback.items.filter((m) =>
          m.imageUrl.startsWith('data:image/')
        ).length;
        latestMenuUpdatedAtMs = fallback.latestUpdatedAtMs;
      }
    }
  }

  // 3. Check Admin-only private settings & orders
  let privateSettingsExists = false;
  let privateRulesReady = false;
  let orderCount = 0;
  let ordersReadable = false;

  if (isAdminVerified) {
    const priv = await fetchOwnerPrivateSettingsFromCloud();
    privateRulesReady = priv.rulesSupported;
    privateSettingsExists = Boolean(priv.data);

    try {
      const ordersSnap = await getDocsFromServer(collection(db, 'orders'));
      orderCount = ordersSnap.size;
      ordersReadable = true;
    } catch (err) {
      checkFirestoreQuotaError(err);
      ordersReadable = false;
    }
  }

  return {
    checkedAtMs,
    storeExists,
    storeUpdatedAtMs,
    storeBrandName,
    ownerAuthorityLocked,
    menuCount,
    customPhotoCount,
    latestMenuUpdatedAtMs,
    menuListAllowed,
    privateSettingsExists,
    privateRulesReady,
    orderCount,
    ordersReadable,
  };
}

export interface MigrationProgressEvent {
  step: number;
  totalSteps: number;
  label: string;
}

export interface FullFirebaseMigrationResult {
  ok: boolean;
  errorMessage?: string;
  storeSaved: boolean;
  menuCountSaved: number;
  ordersMigrated: number;
  ordersAlreadyInCloud: number;
  privateSettingsSaved: boolean;
  auditLogSaved: boolean;
  verifiedAudit?: FirebaseVaultAuditReport;
}

export async function migrateAllOwnerDataToFirebase(params: {
  storeConfig: StoreConfig;
  menuItems: MenuItem[];
  deletedMenuIds: string[];
  orders: OrderRecord[];
  quickReplyDraft?: QuickReplyDraft;
  qrCustomUrl?: string;
  onProgress?: (ev: MigrationProgressEvent) => void;
}): Promise<FullFirebaseMigrationResult> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !user.email) {
    return {
      ok: false,
      errorMessage: 'Silakan login terlebih dahulu dengan akun Google Owner yang terverifikasi.',
      storeSaved: false,
      menuCountSaved: 0,
      ordersMigrated: 0,
      ordersAlreadyInCloud: 0,
      privateSettingsSaved: false,
      auditLogSaved: false,
    };
  }

  const totalSteps = 6;
  const emit = (step: number, label: string) => {
    params.onProgress?.({ step, totalSteps, label });
  };

  try {
    emit(1, 'Memverifikasi otoritas akun Google Owner & menyiapkan optimasi gambar...');
    const optimizedQris = await ensureDataUrlWithinFirestoreLimit(
      params.storeConfig.qrisImageUrl,
      310000
    );
    const optimizedStoreConfig: StoreConfig = {
      ...params.storeConfig,
      qrisImageUrl: optimizedQris,
    };

    const optimizedMenus: MenuItem[] = [];
    for (const item of params.menuItems) {
      const safeImg = await ensureDataUrlWithinFirestoreLimit(item.imageUrl, 290000);
      optimizedMenus.push({
        ...item,
        imageUrl: safeImg,
      });
    }

    emit(2, 'Menyimpan Pengaturan Toko, Koordinat Kedai, QRIS & Opsi ke Firebase (store/main)...');
    await saveStoreConfigToCloud(optimizedStoreConfig, {
      deletedMenuIds: params.deletedMenuIds,
      ownerAuthorityLocked: true,
    });

    emit(3, `Memindahkan ${optimizedMenus.length} Katalog Menu & Foto HD ke Firebase (menuItems)...`);
    await syncMenuItemsToCloud(optimizedMenus, params.deletedMenuIds);

    emit(4, 'Memindahkan Pengaturan Privat Admin & Riwayat Pesanan ke Firebase...');
    const privRes = await saveOwnerPrivateSettingsToCloud({
      quickReplyDraft: params.quickReplyDraft,
      qrCustomUrl: params.qrCustomUrl,
      protectedByFirebase: true,
      migrationVersion: 2,
      lastMigratedBy: user.email,
    });

    const ordersRes = await migrateOrdersToCloud(user.uid, params.orders);

    emit(5, 'Mencatat jejak audit proteksi permanen ke Firebase...');
    const auditRes = await writeOwnerAuditLogToCloud({
      action: 'migration',
      storeSaved: true,
      menuCount: optimizedMenus.length,
      orderCount: ordersRes.migratedCount + ordersRes.skippedExistingCount,
      note: `Migrasi penuh & proteksi permanen oleh ${user.email}`,
    });

    emit(6, 'Memverifikasi ulang seluruh data langsung dari server Firebase...');
    const verifiedAudit = await inspectFirebaseVaultState(
      optimizedMenus.map((m) => m.id),
      true
    );

    return {
      ok: verifiedAudit.storeExists && verifiedAudit.menuCount >= optimizedMenus.length,
      storeSaved: verifiedAudit.storeExists,
      menuCountSaved: verifiedAudit.menuCount,
      ordersMigrated: ordersRes.migratedCount,
      ordersAlreadyInCloud: ordersRes.skippedExistingCount,
      privateSettingsSaved: privRes.ok,
      auditLogSaved: auditRes.ok,
      verifiedAudit,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const friendly = isPermissionDeniedError(err)
      ? `Akses tulis ke Firebase ditolak untuk akun ${user.email}. Pastikan Anda login dengan akun Google Owner terdaftar dan aturan keamanan sudah aktif.`
      : rawMsg.slice(0, 180);
    return {
      ok: false,
      errorMessage: friendly,
      storeSaved: false,
      menuCountSaved: 0,
      ordersMigrated: 0,
      ordersAlreadyInCloud: 0,
      privateSettingsSaved: false,
      auditLogSaved: false,
    };
  }
}
