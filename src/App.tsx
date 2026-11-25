/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MotionConfig,
  motion,
  AnimatePresence,
} from 'motion/react';
import {
  ShoppingBag,
  Flame,
  MapPin,
  Phone,
  Copy,
  Check,
  QrCode,
  Wallet,
  Utensils,
  Maximize2,
  X,
  ExternalLink,
  Plus,
  ChevronRight,
  ArrowUpRight,
  Download,
  Menu as MenuIcon,
  HeartHandshake,
  PlayCircle,
  Compass,
  Sparkles,
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  CartItem,
  MenuItem,
  OrderRecord,
  OrderStatus,
  SavedCustomerLocation,
  StoreConfig,
  ToppingOption,
} from './types';
import {
  DEFAULT_TOPPING_OPTIONS,
  INITIAL_MENU_ITEMS,
  INITIAL_STORE_CONFIG,
  NEW_OFFICIAL_MENU_IDS,
  formatRupiah,
} from './data/initialData';
import { PortionModal } from './components/PortionModal';
import { CheckoutModal } from './components/CheckoutModal';
import { OwnerPanelModal } from './components/OwnerPanelModal';
import { OwnerPinModal } from './components/OwnerPinModal';
import { FoodImage } from './components/FoodImage';
import { StoreLocationMap } from './components/StoreLocationMap';
import { TutorialVideoModal } from './components/TutorialVideoModal';
import { TutorialInlinePlayer } from './components/TutorialInlinePlayer';
import { WelcomeIntroOverlay } from './components/WelcomeIntroOverlay';
import { GallerySection } from './components/GallerySection';
import { GoogleMapsAnimatedVideoPlayer } from './components/GoogleMapsAnimatedVideoPlayer';
import { LocationVideoTourModal } from './components/LocationVideoTourModal';
import { ZoomableImageViewer } from './components/ZoomableImageViewer';
import {
  PWAInstallButton,
  OfflineIndicator,
  MobileBottomAppBar,
} from './components/PWAInstallModal';
import {
  QuickOrderHub,
  LastOrderSnapshot,
} from './components/QuickOrderHub';
import {
  QrisLogo,
  DanaLogoIcon,
  DanaLogoInline,
  GopayLogoIcon,
  GopayLogoInline,
  GoFoodLogoBadge,
  MaximLogoBadge,
} from './components/BrandLogos';
import {
  SpiceBotanicalOrnament,
  BugisWovenAccent,
  NusantaraSectionDivider,
} from './components/CulinaryOrnaments';
import { getCartItemSubtotal, toIndonesianWaDigits } from './utils/checkoutOrder';
import { buildCopyableMenuListText } from './utils/menuListFormatter';
import { safeCopyToClipboard, safeOpenWalletScheme } from './utils/safeBrowser';
import {
  auth,
  isOwnerAdminUser,
  signInWithGooglePopup,
  signOutGoogle,
} from './firebase';
import {
  clearAllOrdersFromCloud,
  CloudStoreSnapshotResult,
  deleteCustomerLocationFromCloud,
  deleteOrderFromCloud,
  fetchMenuItemsOnceFromCloud,
  fetchOwnerPrivateSettingsFromCloud,
  fetchStoreConfigOnceFromCloud,
  FirebaseVaultAuditReport,
  FullFirebaseMigrationResult,
  inspectFirebaseVaultState,
  migrateAllOwnerDataToFirebase,
  MigrationProgressEvent,
  OwnerAuditLogEntry,
  OwnerPrivateSettingsData,
  saveCustomerLocationToCloud,
  saveOrderToCloud,
  saveOwnerPrivateSettingsToCloud,
  saveStoreConfigToCloud,
  subscribeMenuItemsFromCloud,
  subscribeOrdersFromCloud,
  subscribeOwnerAuditLogsFromCloud,
  subscribeSavedLocationsFromCloud,
  subscribeStoreConfigFromCloud,
  syncMenuItemsToCloud,
  updateOrderStatusInCloud,
  writeOwnerAuditLogToCloud,
} from './services/firestoreService';
import {
  clearOwnerCustomOverridesLocal,
  EMPTY_OWNER_AUTHORITY_META,
  EMPTY_PENDING_SYNC,
  fetchServerOwnerState,
  hydrateOwnerDataFromIndexedDb,
  logCustomerOrderToServer,
  normalizeStoreConfig,
  OwnerAuthorityMeta,
  PendingOwnerSync,
  QuickReplyDraft,
  readLocalMenuItemsSync,
  readLocalStoreConfigSync,
  readOwnerAuthorityMetaSync,
  readPendingSync,
  resetOwnerStateOnServer,
  saveMenuItemsPermanentLocal,
  saveOrdersPermanentLocal,
  saveOwnerStateToServer,
  saveStoreConfigPermanentLocal,
  sortMenuItemsCanonical,
  STORAGE_KEYS,
  upgradeLegacyOfficialMenuCopy,
  writeOwnerAuthorityMetaPermanent,
  writePendingSyncPermanent,
} from './utils/ownerPersistence';
import type { CloudSyncStatusInfo } from './components/OwnerPanelModal';

const OFFICIAL_LOGO_URL = '/assets/aistudio/file_000000004bd48211a316832fba565d37_46611b00.png';

const EASE_SMOOTH: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function App() {
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(() => readLocalStoreConfigSync());
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() =>
    readLocalMenuItemsSync(INITIAL_MENU_ITEMS)
  );

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CART);
      if (!saved) return [];
      const parsed = JSON.parse(saved) as CartItem[];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => {
        if (!Array.isArray(item.toppings)) return item;
        const filtered = item.toppings.filter((t) => t.id !== 'bawang-goreng');
        if (filtered.length === item.toppings.length) return item;
        const prevToppingTotal = Number(item.toppingTotal) || 0;
        const nextToppingTotal = filtered.reduce((s, t) => s + t.unitPrice * t.quantity, 0);
        const isTotalOrder = item.toppingScope === 'total_order';
        const basePrice = isTotalOrder
          ? item.unitPrice
          : Math.max(1000, item.unitPrice - prevToppingTotal);
        return {
          ...item,
          toppings: filtered.length > 0 ? filtered : undefined,
          toppingTotal: nextToppingTotal > 0 ? nextToppingTotal : undefined,
          unitPrice: isTotalOrder ? basePrice : basePrice + nextToppingTotal,
        };
      });
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [savedLocations, setSavedLocations] = useState<SavedCustomerLocation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SAVED_LOCATIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Firebase Auth & Quota States
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [firestoreQuotaInfo, setFirestoreQuotaInfo] = useState<{
    message: string;
    upgradeUrl?: string;
  } | null>(null);

  const isAdminCloudVerified = isOwnerAdminUser(currentUser);

  // Refs & Sync State so Owner Settings NEVER suffer stale closures or race conditions
  const storeConfigRef = React.useRef<StoreConfig>(storeConfig);
  storeConfigRef.current = storeConfig;

  const menuItemsRef = React.useRef<MenuItem[]>(menuItems);
  menuItemsRef.current = menuItems;

  const ordersRef = React.useRef<OrderRecord[]>(orders);
  ordersRef.current = orders;

  const pendingSyncRef = React.useRef<PendingOwnerSync>(readPendingSync());
  const authorityMetaRef = React.useRef<OwnerAuthorityMeta>(readOwnerAuthorityMetaSync());
  const hasIdbStoreRef = React.useRef<boolean>(false);
  const hasIdbMenuRef = React.useRef<boolean>(false);
  const serverOwnerUpdatedAtRef = React.useRef<number>(0);
  const serverHydrationDoneRef = React.useRef<boolean>(false);
  const bufferedCloudStoreRef = React.useRef<CloudStoreSnapshotResult | null>(null);
  const bufferedCloudMenusRef = React.useRef<{
    items: MenuItem[];
    latestUpdatedAtMs: number;
  } | null>(null);
  const isAdminCloudVerifiedRef = React.useRef<boolean>(isAdminCloudVerified);
  isAdminCloudVerifiedRef.current = isAdminCloudVerified;

  const cloudWriteQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const storeDebounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuDebounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatusInfo>(() => ({
    status: 'idle',
    hasPendingChanges:
      pendingSyncRef.current.storeDirty ||
      pendingSyncRef.current.menuDirty ||
      pendingSyncRef.current.cloudStoreDirty ||
      pendingSyncRef.current.cloudMenuDirty ||
      pendingSyncRef.current.deletedMenuIds.length > 0,
    serverSynced: authorityMetaRef.current.lastServerSyncAt > 0,
    cloudSynced:
      authorityMetaRef.current.lastCloudSyncAt > 0 &&
      !pendingSyncRef.current.cloudStoreDirty &&
      !pendingSyncRef.current.cloudMenuDirty,
  }));
  const [ownerAuditLogs, setOwnerAuditLogs] = useState<OwnerAuditLogEntry[]>([]);
  const [ownerPrivateSettings, setOwnerPrivateSettings] =
    useState<OwnerPrivateSettingsData | null>(null);

  // UI & Modal States
  const [activeCategory, setActiveCategory] = useState<'all' | 'baru' | 'spesial' | 'reguler'>('all');
  const [heroSlideIndex, setHeroSlideIndex] = useState<number>(0);
  const [selectedMenuForPortion, setSelectedMenuForPortion] = useState<MenuItem | null>(null);
  const [preselectedToppingId, setPreselectedToppingId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isOwnerPanelOpen, setIsOwnerPanelOpen] = useState<boolean>(false);
  const [isOwnerPinModalOpen, setIsOwnerPinModalOpen] = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);
  const [isLocationTourModalOpen, setIsLocationTourModalOpen] = useState<boolean>(false);
  const [showWelcomeIntro, setShowWelcomeIntro] = useState<boolean>(true);
  const [isOwnerVerified, setIsOwnerVerified] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.OWNER_VERIFIED) === 'true';
    } catch {
      return false;
    }
  });
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    subtitle: string;
    isQris?: boolean;
  } | null>(null);
  const [isGalleryLightboxOpen, setIsGalleryLightboxOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deepLinkNotice, setDeepLinkNotice] = useState<'dana' | 'gopay' | null>(null);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  const activeStandalonePage: 'home' | 'owner-pin' | 'owner' | 'portion' | 'checkout' =
    isOwnerPanelOpen
      ? 'owner'
      : isOwnerPinModalOpen
      ? 'owner-pin'
      : selectedMenuForPortion
      ? 'portion'
      : isCheckoutOpen
      ? 'checkout'
      : 'home';

  const prevStandalonePageRef = React.useRef<typeof activeStandalonePage>('home');
  const homeScrollYRef = React.useRef<number>(0);

  // Manage scroll position & browser Back button across dedicated standalone pages
  useEffect(() => {
    const prevPage = prevStandalonePageRef.current;
    if (prevPage === activeStandalonePage) return;

    if (prevPage === 'home' && activeStandalonePage !== 'home') {
      homeScrollYRef.current = window.scrollY;
      setIsMobileMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      try {
        window.history.pushState({ nklStandalonePage: activeStandalonePage }, '');
      } catch {
        // ignore sandboxed iframe history restriction
      }
    } else if (prevPage !== 'home' && activeStandalonePage !== 'home') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } else if (prevPage !== 'home' && activeStandalonePage === 'home') {
      const savedY = homeScrollYRef.current;
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, behavior: 'instant' as ScrollBehavior });
      });
    }

    prevStandalonePageRef.current = activeStandalonePage;
  }, [activeStandalonePage]);

  const isAnyModalOpen = Boolean(
    showWelcomeIntro ||
      isTutorialOpen ||
      isLocationTourModalOpen ||
      lightboxImage ||
      isGalleryLightboxOpen
  );

  // Lock background page scroll ONLY for true fullscreen overlays/lightboxes (standalone pages use native scroll)
  useEffect(() => {
    document.body.style.overflow = isAnyModalOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);

  // Scroll & Zoom performance optimization: pause infinite CSS animations during active scroll or pinch/browser zoom
  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    let zoomTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      if (!document.body.classList.contains('is-scrolling')) {
        document.body.classList.add('is-scrolling');
      }
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        document.body.classList.remove('is-scrolling');
      }, 160);
    };

    const markZooming = (keepActive = false) => {
      if (!document.body.classList.contains('is-zooming')) {
        document.body.classList.add('is-zooming');
      }
      if (zoomTimer) clearTimeout(zoomTimer);
      if (!keepActive) {
        zoomTimer = setTimeout(() => {
          const vvScale = window.visualViewport?.scale ?? 1;
          if (vvScale <= 1.03) {
            document.body.classList.remove('is-zooming');
          }
        }, 260);
      }
    };

    const handleViewportChange = () => {
      const vvScale = window.visualViewport?.scale ?? 1;
      if (vvScale > 1.03) {
        markZooming(true);
      } else {
        markZooming(false);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        markZooming(true);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        handleViewportChange();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      if (scrollTimer) clearTimeout(scrollTimer);
      if (zoomTimer) clearTimeout(zoomTimer);
      document.body.classList.remove('is-scrolling', 'is-zooming');
    };
  }, []);

  // Close lightbox on Escape key (capture phase so underlying CheckoutModal stays open)
  useEffect(() => {
    if (!lightboxImage) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [lightboxImage]);

  const hasLocalOwnerStoreOverride = React.useCallback(() => {
    if (hasIdbStoreRef.current) return true;
    if (authorityMetaRef.current.lockedByOwner && authorityMetaRef.current.hasCustomStore) {
      return true;
    }
    try {
      return Boolean(localStorage.getItem(STORAGE_KEYS.STORE_CONFIG));
    } catch {
      return false;
    }
  }, []);

  const hasLocalOwnerMenuOverride = React.useCallback(() => {
    if (hasIdbMenuRef.current) return true;
    if (authorityMetaRef.current.lockedByOwner && authorityMetaRef.current.hasCustomMenus) {
      return true;
    }
    try {
      return Boolean(localStorage.getItem(STORAGE_KEYS.MENU_ITEMS));
    } catch {
      return false;
    }
  }, []);

  const getLatestAuthoritativeOwnerTimestamp = React.useCallback(() => {
    return Math.max(
      pendingSyncRef.current.lastLocalEditAt || 0,
      authorityMetaRef.current.lastOwnerEditAt || 0,
      serverOwnerUpdatedAtRef.current || 0
    );
  }, []);

  const applyCloudStoreIfAuthoritative = React.useCallback(
    (cloudResult: CloudStoreSnapshotResult, forceApply = false) => {
      if (!forceApply && !serverHydrationDoneRef.current) {
        bufferedCloudStoreRef.current = cloudResult;
        return;
      }
      if (!forceApply && (pendingSyncRef.current.storeDirty || pendingSyncRef.current.cloudStoreDirty)) {
        return;
      }

      const latestLocalOrServerMs = getLatestAuthoritativeOwnerTimestamp();
      // Protect unsynced local-only edits made BEFORE first cloud sync, otherwise Firebase Cloud ALWAYS wins!
      const hasNewerUnsyncedLocalEdits =
        !forceApply &&
        authorityMetaRef.current.lastCloudSyncAt === 0 &&
        authorityMetaRef.current.lastOwnerEditAt > 0 &&
        (cloudResult.updatedAtMs === 0 ||
          authorityMetaRef.current.lastOwnerEditAt > cloudResult.updatedAtMs);

      if (hasNewerUnsyncedLocalEdits) {
        return;
      }

      const isCloudAuthoritative =
        forceApply ||
        cloudResult.ownerAuthorityLocked ||
        cloudResult.updatedAtMs >= latestLocalOrServerMs ||
        !hasLocalOwnerStoreOverride();

      if (!isCloudAuthoritative) {
        return;
      }

      const merged = normalizeStoreConfig(storeConfigRef.current, cloudResult.config);
      storeConfigRef.current = merged;
      hasIdbStoreRef.current = true;
      setStoreConfig(merged);
      void saveStoreConfigPermanentLocal(merged);

      const mergedDeleted = Array.from(
        new Set([
          ...authorityMetaRef.current.deletedMenuIds,
          ...(cloudResult.deletedMenuIds || []),
        ])
      );
      authorityMetaRef.current = {
        ...authorityMetaRef.current,
        lockedByOwner:
          authorityMetaRef.current.lockedByOwner || Boolean(cloudResult.ownerAuthorityLocked),
        hasCustomStore: true,
        lastCloudSyncAt: Math.max(
          authorityMetaRef.current.lastCloudSyncAt,
          cloudResult.updatedAtMs || Date.now()
        ),
        deletedMenuIds: mergedDeleted,
      };
      void writeOwnerAuthorityMetaPermanent(authorityMetaRef.current);
      setCloudSyncStatus((prev) => ({
        ...prev,
        cloudSynced: !pendingSyncRef.current.cloudStoreDirty && !pendingSyncRef.current.cloudMenuDirty,
        lastSavedAt: Math.max(prev.lastSavedAt || 0, cloudResult.updatedAtMs || Date.now()),
      }));
    },
    [getLatestAuthoritativeOwnerTimestamp, hasLocalOwnerStoreOverride]
  );

  const applyCloudMenusIfAuthoritative = React.useCallback(
    (cloudResult: { items: MenuItem[]; latestUpdatedAtMs: number }, forceApply = false) => {
      if (cloudResult.items.length === 0) return;
      if (!forceApply && !serverHydrationDoneRef.current) {
        bufferedCloudMenusRef.current = cloudResult;
        return;
      }
      if (!forceApply && (pendingSyncRef.current.menuDirty || pendingSyncRef.current.cloudMenuDirty)) {
        return;
      }

      const latestLocalOrServerMs = getLatestAuthoritativeOwnerTimestamp();
      const hasNewerUnsyncedLocalEdits =
        !forceApply &&
        authorityMetaRef.current.lastCloudSyncAt === 0 &&
        authorityMetaRef.current.lastOwnerEditAt > 0 &&
        (cloudResult.latestUpdatedAtMs === 0 ||
          authorityMetaRef.current.lastOwnerEditAt > cloudResult.latestUpdatedAtMs);

      if (hasNewerUnsyncedLocalEdits) {
        return;
      }

      const isCloudAuthoritative =
        forceApply ||
        cloudResult.latestUpdatedAtMs >= latestLocalOrServerMs ||
        !hasLocalOwnerMenuOverride() ||
        authorityMetaRef.current.lastCloudSyncAt > 0;

      if (!isCloudAuthoritative) {
        return;
      }

      const deletedSet = new Set([
        ...pendingSyncRef.current.deletedMenuIds,
        ...authorityMetaRef.current.deletedMenuIds,
      ]);
      const filteredCloud = cloudResult.items.filter((m) => !deletedSet.has(m.id));
      if (filteredCloud.length === 0) return;

      const normalized = sortMenuItemsCanonical(
        authorityMetaRef.current.lockedByOwner
          ? filteredCloud
          : filteredCloud.map(upgradeLegacyOfficialMenuCopy)
      );
      menuItemsRef.current = normalized;
      hasIdbMenuRef.current = true;
      setMenuItems(normalized);
      void saveMenuItemsPermanentLocal(normalized);

      authorityMetaRef.current = {
        ...authorityMetaRef.current,
        lockedByOwner: true,
        hasCustomMenus: true,
        lastCloudSyncAt: Math.max(
          authorityMetaRef.current.lastCloudSyncAt,
          cloudResult.latestUpdatedAtMs || Date.now()
        ),
      };
      void writeOwnerAuthorityMetaPermanent(authorityMetaRef.current);
      setCloudSyncStatus((prev) => ({
        ...prev,
        cloudSynced: !pendingSyncRef.current.cloudStoreDirty && !pendingSyncRef.current.cloudMenuDirty,
        lastSavedAt: Math.max(prev.lastSavedAt || 0, cloudResult.latestUpdatedAtMs || Date.now()),
      }));
    },
    [getLatestAuthoritativeOwnerTimestamp, hasLocalOwnerMenuOverride]
  );

  // Hydrate Owner data from IndexedDB + Server Permanent State (/api/owner-state)
  // Runs FIRST before any Cloud snapshot is allowed to apply (prevents startup overwrite race condition!)
  useEffect(() => {
    let active = true;

    const hydrateAll = async () => {
      const [idb, serverState] = await Promise.all([
        hydrateOwnerDataFromIndexedDb(),
        fetchServerOwnerState(),
      ]);
      if (!active) return;

      if (idb.authorityMeta) {
        authorityMetaRef.current = {
          lockedByOwner:
            authorityMetaRef.current.lockedByOwner || idb.authorityMeta.lockedByOwner,
          hasCustomStore:
            authorityMetaRef.current.hasCustomStore || idb.authorityMeta.hasCustomStore,
          hasCustomMenus:
            authorityMetaRef.current.hasCustomMenus || idb.authorityMeta.hasCustomMenus,
          lastOwnerEditAt: Math.max(
            authorityMetaRef.current.lastOwnerEditAt,
            idb.authorityMeta.lastOwnerEditAt || 0
          ),
          lastServerSyncAt: Math.max(
            authorityMetaRef.current.lastServerSyncAt,
            idb.authorityMeta.lastServerSyncAt || 0
          ),
          lastCloudSyncAt: Math.max(
            authorityMetaRef.current.lastCloudSyncAt,
            idb.authorityMeta.lastCloudSyncAt || 0
          ),
          deletedMenuIds: Array.from(
            new Set([
              ...authorityMetaRef.current.deletedMenuIds,
              ...(idb.authorityMeta.deletedMenuIds || []),
            ])
          ),
        };
      }

      if (idb.pendingSync) {
        const mergedPending: PendingOwnerSync = {
          storeDirty: pendingSyncRef.current.storeDirty || idb.pendingSync.storeDirty,
          menuDirty: pendingSyncRef.current.menuDirty || idb.pendingSync.menuDirty,
          cloudStoreDirty:
            pendingSyncRef.current.cloudStoreDirty || idb.pendingSync.cloudStoreDirty,
          cloudMenuDirty:
            pendingSyncRef.current.cloudMenuDirty || idb.pendingSync.cloudMenuDirty,
          deletedMenuIds: Array.from(
            new Set([
              ...pendingSyncRef.current.deletedMenuIds,
              ...(idb.pendingSync.deletedMenuIds || []),
              ...authorityMetaRef.current.deletedMenuIds,
            ])
          ),
          ordersDirty: pendingSyncRef.current.ordersDirty || idb.pendingSync.ordersDirty,
          deletedOrderIds: Array.from(
            new Set([
              ...pendingSyncRef.current.deletedOrderIds,
              ...(idb.pendingSync.deletedOrderIds || []),
            ])
          ),
          lastLocalEditAt: Math.max(
            pendingSyncRef.current.lastLocalEditAt,
            idb.pendingSync.lastLocalEditAt || 0
          ),
        };
        pendingSyncRef.current = mergedPending;
      }

      const hasLocalStorageStore = (() => {
        try {
          return Boolean(localStorage.getItem(STORAGE_KEYS.STORE_CONFIG));
        } catch {
          return false;
        }
      })();
      const hasLocalStorageMenu = (() => {
        try {
          return Boolean(localStorage.getItem(STORAGE_KEYS.MENU_ITEMS));
        } catch {
          return false;
        }
      })();

      if (idb.storeConfig) {
        hasIdbStoreRef.current = true;
        if (!hasLocalStorageStore || pendingSyncRef.current.storeDirty || authorityMetaRef.current.hasCustomStore) {
          storeConfigRef.current = idb.storeConfig;
          setStoreConfig(idb.storeConfig);
        }
      }
      if (idb.menuItems && idb.menuItems.length > 0) {
        hasIdbMenuRef.current = true;
        // IndexedDB holds large HD menu photos even when localStorage hits 5MB quota
        if (!hasLocalStorageMenu || pendingSyncRef.current.menuDirty || authorityMetaRef.current.hasCustomMenus) {
          menuItemsRef.current = idb.menuItems;
          setMenuItems(idb.menuItems);
        }
      }

      if (serverState) {
        serverOwnerUpdatedAtRef.current = serverState.updatedAtMs || 0;
        const localEditTime = Math.max(
          pendingSyncRef.current.lastLocalEditAt || 0,
          authorityMetaRef.current.lastOwnerEditAt || 0
        );
        const hasAnyLocalCustom =
          hasLocalStorageStore ||
          hasLocalStorageMenu ||
          hasIdbStoreRef.current ||
          hasIdbMenuRef.current;

        // If local device has newer unsynced Owner edits, push them immediately to Server Permanent Storage
        if (
          localEditTime > (serverState.updatedAtMs || 0) &&
          (pendingSyncRef.current.storeDirty ||
            pendingSyncRef.current.menuDirty ||
            hasAnyLocalCustom)
        ) {
          const serverRes = await saveOwnerStateToServer({
            storeConfig: storeConfigRef.current,
            menuItems: menuItemsRef.current,
            orders: ordersRef.current,
            deletedMenuIds: Array.from(
              new Set([
                ...pendingSyncRef.current.deletedMenuIds,
                ...authorityMetaRef.current.deletedMenuIds,
              ])
            ),
          });
          if (active && serverRes.ok) {
            serverOwnerUpdatedAtRef.current = serverRes.updatedAtMs || Date.now();
            authorityMetaRef.current = {
              ...authorityMetaRef.current,
              lastServerSyncAt: serverOwnerUpdatedAtRef.current,
            };
            void writeOwnerAuthorityMetaPermanent(authorityMetaRef.current);
          }
        } else if (serverState.updatedAtMs > 0) {
          // Apply Server Permanent Owner State so all visitors & devices get the exact Owner configuration
          if (serverState.storeConfig) {
            storeConfigRef.current = serverState.storeConfig;
            setStoreConfig(serverState.storeConfig);
            void saveStoreConfigPermanentLocal(serverState.storeConfig);
          }
          if (serverState.menuItems && serverState.menuItems.length > 0) {
            menuItemsRef.current = serverState.menuItems;
            setMenuItems(serverState.menuItems);
            void saveMenuItemsPermanentLocal(serverState.menuItems);
          }
          authorityMetaRef.current = {
            ...authorityMetaRef.current,
            lockedByOwner:
              authorityMetaRef.current.lockedByOwner || serverState.ownerAuthorityLocked,
            hasCustomStore:
              authorityMetaRef.current.hasCustomStore || Boolean(serverState.storeConfig),
            hasCustomMenus:
              authorityMetaRef.current.hasCustomMenus ||
              Boolean(serverState.menuItems && serverState.menuItems.length > 0),
            lastServerSyncAt: serverState.updatedAtMs,
            deletedMenuIds: Array.from(
              new Set([
                ...authorityMetaRef.current.deletedMenuIds,
                ...(serverState.deletedMenuIds || []),
              ])
            ),
          };
          void writeOwnerAuthorityMetaPermanent(authorityMetaRef.current);
        }

        if (Array.isArray(serverState.orders) && serverState.orders.length > 0) {
          setOrders((prev) => {
            const byId = new Map<string, OrderRecord>();
            for (const o of serverState.orders) {
              if (o && o.id) byId.set(o.id, o);
            }
            for (const o of prev) {
              if (o && o.id && !byId.has(o.id)) byId.set(o.id, o);
            }
            const mergedOrders = Array.from(byId.values()).sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            );
            ordersRef.current = mergedOrders;
            return mergedOrders;
          });
        }
      } else if (idb.orders && ordersRef.current.length === 0 && idb.orders.length > 0) {
        ordersRef.current = idb.orders;
        setOrders(idb.orders);
      }

      serverHydrationDoneRef.current = true;

      // Now safely reconcile any Cloud Firestore snapshots that arrived during hydration
      if (bufferedCloudStoreRef.current) {
        const snap = bufferedCloudStoreRef.current;
        bufferedCloudStoreRef.current = null;
        applyCloudStoreIfAuthoritative(snap);
      }
      if (bufferedCloudMenusRef.current) {
        const snap = bufferedCloudMenusRef.current;
        bufferedCloudMenusRef.current = null;
        applyCloudMenusIfAuthoritative(snap);
      }
    };

    void hydrateAll();
    return () => {
      active = false;
    };
  }, [applyCloudMenusIfAuthoritative, applyCloudStoreIfAuthoritative]);

  // Dual-persist cart, orders & savedLocations locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    void saveOrdersPermanentLocal(orders);
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_LOCATIONS, JSON.stringify(savedLocations));
    } catch {
      // ignore storage quota errors
    }
  }, [savedLocations]);

  // Listen for Firestore Quota events
  useEffect(() => {
    const onFirestoreQuota = (ev: Event) => {
      const custom = ev as CustomEvent<{ message: string; upgradeUrl?: string }>;
      setFirestoreQuotaInfo(custom.detail || { message: 'Quota exceeded.' });
    };
    window.addEventListener('firestore-quota-exceeded', onFirestoreQuota);
    return () => {
      window.removeEventListener('firestore-quota-exceeded', onFirestoreQuota);
    };
  }, []);

  // Serialized Multi-Layer Permanent Write Helper (Supreme Owner Authority):
  // Saves Owner StoreConfig & MenuItems to IndexedDB + Server Disk (/api/owner-state) + Cloud Firestore
  const enqueueCloudSync = React.useCallback(
    (targets: { store?: boolean; menu?: boolean }): Promise<boolean> => {
      let ok = false;
      const run = async () => {
        setCloudSyncStatus((prev) => ({
          ...prev,
          status: 'saving',
          errorMessage: undefined,
        }));
        try {
          const allDeletedMenuIds = Array.from(
            new Set([
              ...pendingSyncRef.current.deletedMenuIds,
              ...authorityMetaRef.current.deletedMenuIds,
            ])
          );

          // 1. Always persist to Server Disk (/api/owner-state) without keepalive 64KB limit
          const serverResult = await saveOwnerStateToServer({
            storeConfig: storeConfigRef.current,
            menuItems: menuItemsRef.current,
            orders: ordersRef.current,
            deletedMenuIds: allDeletedMenuIds,
          });
          const serverSaved = serverResult.ok;
          if (serverSaved) {
            const ts = serverResult.updatedAtMs || Date.now();
            serverOwnerUpdatedAtRef.current = ts;
            authorityMetaRef.current = {
              ...authorityMetaRef.current,
              lockedByOwner: true,
              lastServerSyncAt: ts,
              deletedMenuIds: allDeletedMenuIds,
            };
          }

          // 2. Persist permanently to Cloud Firestore whenever Google Owner Admin is authenticated
          let cloudSaved = false;
          let cloudErrorMsg: string | undefined;
          const shouldWriteCloudStore = Boolean(
            targets.store || pendingSyncRef.current.cloudStoreDirty
          );
          const shouldWriteCloudMenu = Boolean(
            targets.menu || pendingSyncRef.current.cloudMenuDirty
          );

          if (isAdminCloudVerifiedRef.current) {
            try {
              if (shouldWriteCloudStore) {
                await saveStoreConfigToCloud(storeConfigRef.current, {
                  deletedMenuIds: allDeletedMenuIds,
                  ownerAuthorityLocked: true,
                });
              }
              if (shouldWriteCloudMenu) {
                await syncMenuItemsToCloud(menuItemsRef.current, allDeletedMenuIds);
              }
              cloudSaved = true;
              authorityMetaRef.current = {
                ...authorityMetaRef.current,
                lockedByOwner: true,
                lastCloudSyncAt: Date.now(),
                deletedMenuIds: allDeletedMenuIds,
              };
            } catch (cloudErr) {
              cloudSaved = false;
              const rawMsg =
                cloudErr instanceof Error ? cloudErr.message : String(cloudErr);
              cloudErrorMsg = rawMsg.includes('permission-denied')
                ? 'Akun Google belum mendapat izin tulis Cloud Firestore. Coba login ulang akun Owner.'
                : rawMsg.slice(0, 140);
            }
          }

          // CRITICAL: Only clear cloudStoreDirty/cloudMenuDirty when Cloud Firestore ACTUALLY succeeded!
          pendingSyncRef.current = {
            ...pendingSyncRef.current,
            storeDirty: serverSaved
              ? targets.store
                ? false
                : pendingSyncRef.current.storeDirty
              : pendingSyncRef.current.storeDirty,
            menuDirty: serverSaved
              ? targets.menu
                ? false
                : pendingSyncRef.current.menuDirty
              : pendingSyncRef.current.menuDirty,
            cloudStoreDirty: cloudSaved
              ? false
              : pendingSyncRef.current.cloudStoreDirty || Boolean(targets.store),
            cloudMenuDirty: cloudSaved
              ? false
              : pendingSyncRef.current.cloudMenuDirty || Boolean(targets.menu),
            deletedMenuIds: cloudSaved ? [] : allDeletedMenuIds,
            lastLocalEditAt: Math.max(pendingSyncRef.current.lastLocalEditAt, Date.now()),
          };

          await Promise.all([
            writePendingSyncPermanent(pendingSyncRef.current),
            writeOwnerAuthorityMetaPermanent(authorityMetaRef.current),
          ]);

          if (cloudSaved) {
            ok = true;
            setCloudSyncStatus({
              status: 'saved',
              hasPendingChanges: false,
              lastSavedAt: Date.now(),
              serverSynced: serverSaved,
              cloudSynced: true,
            });
          } else if (isAdminCloudVerifiedRef.current && cloudErrorMsg) {
            ok = false;
            setCloudSyncStatus({
              status: 'error',
              hasPendingChanges: true,
              serverSynced: serverSaved,
              cloudSynced: false,
              errorMessage: cloudErrorMsg,
            });
          } else if (serverSaved) {
            // Saved locally & to ephemeral server cache, but NOT YET protected in permanent Firebase Cloud!
            ok = false;
            setCloudSyncStatus({
              status: 'server-only',
              hasPendingChanges: true,
              lastSavedAt: Date.now(),
              serverSynced: true,
              cloudSynced: false,
              errorMessage: 'Login akun Google Owner agar tersimpan permanen di Firebase Cloud.',
            });
          } else {
            ok = false;
            setCloudSyncStatus({
              status: 'local-only',
              hasPendingChanges: true,
              lastSavedAt: Date.now(),
              serverSynced: false,
              cloudSynced: false,
              errorMessage:
                serverResult.error ||
                'Tersimpan sementara di perangkat. Login Google Owner untuk menyimpan permanen ke Firebase.',
            });
          }
        } catch (err) {
          ok = false;
          const msg = err instanceof Error ? err.message : 'Gagal menyimpan ke server';
          setCloudSyncStatus({
            status: 'error',
            hasPendingChanges: true,
            serverSynced: false,
            cloudSynced: false,
            errorMessage: msg.slice(0, 140),
          });
        }
      };

      const chained = cloudWriteQueueRef.current.then(run, run);
      cloudWriteQueueRef.current = chained;
      return chained.then(() => ok);
    },
    []
  );

  const flushAllPendingOwnerSaves = React.useCallback(async (): Promise<boolean> => {
    if (storeDebounceTimerRef.current) {
      clearTimeout(storeDebounceTimerRef.current);
      storeDebounceTimerRef.current = null;
    }
    if (menuDebounceTimerRef.current) {
      clearTimeout(menuDebounceTimerRef.current);
      menuDebounceTimerRef.current = null;
    }

    await Promise.all([
      saveStoreConfigPermanentLocal(storeConfigRef.current),
      saveMenuItemsPermanentLocal(menuItemsRef.current),
      writePendingSyncPermanent(pendingSyncRef.current),
      writeOwnerAuthorityMetaPermanent(authorityMetaRef.current),
    ]);

    return enqueueCloudSync({ store: true, menu: true });
  }, [enqueueCloudSync]);

  // Handle browser/device Back button smoothly when on a dedicated standalone page
  useEffect(() => {
    const handlePopState = () => {
      if (isOwnerPanelOpen) {
        void flushAllPendingOwnerSaves();
        setIsOwnerPanelOpen(false);
      } else if (isOwnerPinModalOpen) {
        setIsOwnerPinModalOpen(false);
      } else if (selectedMenuForPortion) {
        setSelectedMenuForPortion(null);
        setPreselectedToppingId(null);
      } else if (isCheckoutOpen) {
        setIsCheckoutOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [
    isOwnerPanelOpen,
    isOwnerPinModalOpen,
    selectedMenuForPortion,
    isCheckoutOpen,
    flushAllPendingOwnerSaves,
  ]);

  // Flush pending local Owner changes automatically before page closes or hides
  useEffect(() => {
    const handleFlushOnHide = () => {
      if (
        pendingSyncRef.current.storeDirty ||
        pendingSyncRef.current.menuDirty ||
        pendingSyncRef.current.cloudStoreDirty ||
        pendingSyncRef.current.cloudMenuDirty ||
        pendingSyncRef.current.deletedMenuIds.length > 0
      ) {
        void saveStoreConfigPermanentLocal(storeConfigRef.current);
        void saveMenuItemsPermanentLocal(menuItemsRef.current);
        void writePendingSyncPermanent(pendingSyncRef.current);
        void writeOwnerAuthorityMetaPermanent(authorityMetaRef.current);
        void flushAllPendingOwnerSaves();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFlushOnHide();
      }
    };
    window.addEventListener('beforeunload', handleFlushOnHide);
    window.addEventListener('pagehide', handleFlushOnHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleFlushOnHide);
      window.removeEventListener('pagehide', handleFlushOnHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushAllPendingOwnerSaves]);

  // Boot Auth listener + public store/menu cloud sync (strictly gated behind local+server hydration)
  useEffect(() => {
    let active = true;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });

    void fetchStoreConfigOnceFromCloud().then((cloudResult) => {
      if (!active || !cloudResult) return;
      applyCloudStoreIfAuthoritative(cloudResult);
    });

    const unsubPublicStore = subscribeStoreConfigFromCloud((cloudResult) => {
      if (!active) return;
      applyCloudStoreIfAuthoritative(cloudResult);
    });

    const knownIds = menuItemsRef.current.map((m) => m.id);
    void fetchMenuItemsOnceFromCloud(knownIds).then((cloudMenus) => {
      if (active && cloudMenus) {
        applyCloudMenusIfAuthoritative(cloudMenus);
      }
    });

    const unsubPublicMenuCatalog = subscribeMenuItemsFromCloud((cloudMenus) => {
      if (!active) return;
      applyCloudMenusIfAuthoritative(cloudMenus);
    }, knownIds);

    return () => {
      active = false;
      unsubAuth();
      unsubPublicStore();
      unsubPublicMenuCatalog();
    };
  }, [applyCloudMenusIfAuthoritative, applyCloudStoreIfAuthoritative]);

  // Auto-flush any pending or unsynced Owner changes to Cloud Firestore the instant Google Owner signs in
  useEffect(() => {
    if (!authReady || !isAdminCloudVerified) return;
    const hasUnsyncedCloudOwnerData =
      pendingSyncRef.current.storeDirty ||
      pendingSyncRef.current.menuDirty ||
      pendingSyncRef.current.cloudStoreDirty ||
      pendingSyncRef.current.cloudMenuDirty ||
      pendingSyncRef.current.deletedMenuIds.length > 0 ||
      (authorityMetaRef.current.lockedByOwner &&
        authorityMetaRef.current.lastOwnerEditAt > authorityMetaRef.current.lastCloudSyncAt);

    if (hasUnsyncedCloudOwnerData) {
      void flushAllPendingOwnerSaves();
    }
  }, [authReady, isAdminCloudVerified, flushAllPendingOwnerSaves]);

  // Authenticated realtime listeners (only attached once Auth is ready & user is signed in)
  useEffect(() => {
    if (!authReady || !currentUser) return;

    const unsubLocations = subscribeSavedLocationsFromCloud(currentUser.uid, (cloudLocs) => {
      setSavedLocations((prev) => {
        if (cloudLocs.length === 0 && prev.length > 0) {
          prev.forEach((localLoc) => {
            void saveCustomerLocationToCloud(currentUser.uid, localLoc, true).catch(() => {});
          });
          return prev;
        }
        return cloudLocs;
      });
    });

    const unsubOrders = subscribeOrdersFromCloud(
      currentUser.uid,
      isAdminCloudVerified,
      (cloudOrders) => {
        if (cloudOrders.length > 0) {
          setOrders((prev) => {
            const byId = new Map<string, OrderRecord>();
            for (const o of prev) byId.set(o.id, o);
            for (const o of cloudOrders) byId.set(o.id, o);
            const merged = Array.from(byId.values()).sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            );
            ordersRef.current = merged;
            return merged;
          });
        }
      }
    );

    const unsubAuditLogs = isAdminCloudVerified
      ? subscribeOwnerAuditLogsFromCloud((logs) => {
          setOwnerAuditLogs(logs);
        })
      : () => {};

    if (isAdminCloudVerified) {
      void fetchOwnerPrivateSettingsFromCloud().then((res) => {
        if (res.data) {
          setOwnerPrivateSettings(res.data);
          if (res.data.quickReplyDraft) {
            try {
              localStorage.setItem(
                STORAGE_KEYS.QUICK_REPLY_DRAFT,
                JSON.stringify(res.data.quickReplyDraft)
              );
            } catch {
              // ignore
            }
          }
          if (res.data.qrCustomUrl) {
            try {
              localStorage.setItem('nkl_qr_custom_url_v1', res.data.qrCustomUrl);
            } catch {
              // ignore
            }
          }
        }
      });
    }

    return () => {
      unsubLocations();
      unsubOrders();
      unsubAuditLogs();
    };
  }, [authReady, currentUser, isAdminCloudVerified]);

  const handleSignInGoogle = async () => {
    try {
      await signInWithGooglePopup();
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code || '')
          : '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      throw error;
    }
  };

  const handleSignOutGoogle = async () => {
    try {
      await signOutGoogle();
      setOwnerAuditLogs([]);
      setOwnerPrivateSettings(null);
    } catch {
      // ignore sign-out errors
    }
  };

  const handleSaveOwnerPrivateSettings = async (patch: {
    quickReplyDraft?: QuickReplyDraft;
    qrCustomUrl?: string;
  }) => {
    if (!isAdminCloudVerifiedRef.current) return;
    try {
      const res = await saveOwnerPrivateSettingsToCloud({
        quickReplyDraft: patch.quickReplyDraft ?? ownerPrivateSettings?.quickReplyDraft,
        qrCustomUrl: patch.qrCustomUrl ?? ownerPrivateSettings?.qrCustomUrl,
        protectedByFirebase: true,
        migrationVersion: 2,
        lastMigratedBy: currentUser?.email || undefined,
      });
      if (res.ok) {
        setOwnerPrivateSettings((prev) => ({
          quickReplyDraft: patch.quickReplyDraft ?? prev?.quickReplyDraft,
          qrCustomUrl: patch.qrCustomUrl ?? prev?.qrCustomUrl,
          protectedByFirebase: true,
          migrationVersion: 2,
          lastMigratedBy: currentUser?.email || prev?.lastMigratedBy,
          updatedAtMs: Date.now(),
        }));
      }
    } catch {
      // non-fatal private settings sync
    }
  };

  const handleInspectFirebaseVault = async (): Promise<FirebaseVaultAuditReport> => {
    return inspectFirebaseVaultState(
      menuItemsRef.current.map((m) => m.id),
      isAdminCloudVerifiedRef.current
    );
  };

  const handleMigrateAllToFirebase = async (
    onProgress?: (ev: MigrationProgressEvent) => void
  ): Promise<FullFirebaseMigrationResult> => {
    let quickReplyDraft: QuickReplyDraft | undefined;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.QUICK_REPLY_DRAFT);
      if (raw) quickReplyDraft = JSON.parse(raw) as QuickReplyDraft;
    } catch {
      // ignore
    }
    let qrCustomUrl: string | undefined;
    try {
      qrCustomUrl = localStorage.getItem('nkl_qr_custom_url_v1') || undefined;
    } catch {
      // ignore
    }

    const allDeleted = Array.from(
      new Set([
        ...pendingSyncRef.current.deletedMenuIds,
        ...authorityMetaRef.current.deletedMenuIds,
      ])
    );

    const result = await migrateAllOwnerDataToFirebase({
      storeConfig: storeConfigRef.current,
      menuItems: menuItemsRef.current,
      deletedMenuIds: allDeleted,
      orders: ordersRef.current,
      quickReplyDraft,
      qrCustomUrl,
      onProgress,
    });

    if (result.ok) {
      const now = Date.now();
      pendingSyncRef.current = {
        ...EMPTY_PENDING_SYNC,
        lastLocalEditAt: now,
      };
      authorityMetaRef.current = {
        ...authorityMetaRef.current,
        lockedByOwner: true,
        hasCustomStore: true,
        hasCustomMenus: true,
        lastCloudSyncAt: now,
        deletedMenuIds: allDeleted,
      };
      await Promise.all([
        writePendingSyncPermanent(pendingSyncRef.current),
        writeOwnerAuthorityMetaPermanent(authorityMetaRef.current),
      ]);
      setCloudSyncStatus({
        status: 'saved',
        hasPendingChanges: false,
        lastSavedAt: now,
        serverSynced: true,
        cloudSynced: true,
      });
      // Mirror back to server cache too
      void saveOwnerStateToServer({
        storeConfig: storeConfigRef.current,
        menuItems: menuItemsRef.current,
        orders: ordersRef.current,
        deletedMenuIds: allDeleted,
      });
    }

    return result;
  };

  const handlePullFromFirebase = async (): Promise<{
    ok: boolean;
    storeLoaded: boolean;
    menuCount: number;
  }> => {
    const [cloudStore, cloudMenus] = await Promise.all([
      fetchStoreConfigOnceFromCloud(),
      fetchMenuItemsOnceFromCloud(menuItemsRef.current.map((m) => m.id)),
    ]);

    let storeLoaded = false;
    let menuCount = 0;

    if (cloudStore) {
      pendingSyncRef.current = {
        ...pendingSyncRef.current,
        storeDirty: false,
        cloudStoreDirty: false,
      };
      applyCloudStoreIfAuthoritative(cloudStore, true);
      storeLoaded = true;
    }

    if (cloudMenus && cloudMenus.items.length > 0) {
      pendingSyncRef.current = {
        ...pendingSyncRef.current,
        menuDirty: false,
        cloudMenuDirty: false,
      };
      applyCloudMenusIfAuthoritative(cloudMenus, true);
      menuCount = cloudMenus.items.length;
    }

    await writePendingSyncPermanent(pendingSyncRef.current);

    if (storeLoaded || menuCount > 0) {
      setCloudSyncStatus({
        status: 'saved',
        hasPendingChanges: false,
        lastSavedAt: Date.now(),
        serverSynced: true,
        cloudSynced: true,
      });
    }

    return { ok: storeLoaded || menuCount > 0, storeLoaded, menuCount };
  };

  const handleUpdateStoreConfig = (
    updater: StoreConfig | ((prev: StoreConfig) => StoreConfig),
    options?: { immediate?: boolean }
  ) => {
    const now = Date.now();
    const nextConfig = normalizeStoreConfig(
      storeConfigRef.current,
      typeof updater === 'function' ? updater(storeConfigRef.current) : updater
    );
    storeConfigRef.current = nextConfig;
    hasIdbStoreRef.current = true;
    setStoreConfig(nextConfig);

    pendingSyncRef.current = {
      ...pendingSyncRef.current,
      storeDirty: true,
      cloudStoreDirty: true,
      lastLocalEditAt: now,
    };
    authorityMetaRef.current = {
      ...authorityMetaRef.current,
      lockedByOwner: true,
      hasCustomStore: true,
      lastOwnerEditAt: now,
    };

    void saveStoreConfigPermanentLocal(nextConfig);
    void writePendingSyncPermanent(pendingSyncRef.current);
    void writeOwnerAuthorityMetaPermanent(authorityMetaRef.current);

    if (storeDebounceTimerRef.current) {
      clearTimeout(storeDebounceTimerRef.current);
      storeDebounceTimerRef.current = null;
    }

    if (options?.immediate) {
      void enqueueCloudSync({ store: true });
    } else {
      setCloudSyncStatus((prev) => ({
        ...prev,
        status: 'saving',
        hasPendingChanges: true,
      }));
      storeDebounceTimerRef.current = setTimeout(() => {
        storeDebounceTimerRef.current = null;
        void enqueueCloudSync({ store: true });
      }, 450);
    }
  };

  const handleUpdateMenuItems = (
    updater: MenuItem[] | ((prev: MenuItem[]) => MenuItem[]),
    options?: { immediate?: boolean }
  ) => {
    const now = Date.now();
    const prevItems = menuItemsRef.current;
    const nextItems = typeof updater === 'function' ? updater(prevItems) : updater;
    const nextIdsSet = new Set(nextItems.map((m) => m.id));
    const newlyDeleted = prevItems.filter((m) => !nextIdsSet.has(m.id)).map((m) => m.id);
    const combinedDeleted = Array.from(
      new Set([
        ...pendingSyncRef.current.deletedMenuIds,
        ...authorityMetaRef.current.deletedMenuIds,
        ...newlyDeleted,
      ])
    ).filter((id) => !nextIdsSet.has(id));

    menuItemsRef.current = nextItems;
    hasIdbMenuRef.current = true;
    setMenuItems(nextItems);

    pendingSyncRef.current = {
      ...pendingSyncRef.current,
      menuDirty: true,
      cloudMenuDirty: true,
      deletedMenuIds: combinedDeleted,
      lastLocalEditAt: now,
    };
    authorityMetaRef.current = {
      ...authorityMetaRef.current,
      lockedByOwner: true,
      hasCustomMenus: true,
      lastOwnerEditAt: now,
      deletedMenuIds: combinedDeleted,
    };

    void saveMenuItemsPermanentLocal(nextItems);
    void writePendingSyncPermanent(pendingSyncRef.current);
    void writeOwnerAuthorityMetaPermanent(authorityMetaRef.current);

    if (menuDebounceTimerRef.current) {
      clearTimeout(menuDebounceTimerRef.current);
      menuDebounceTimerRef.current = null;
    }

    if (options?.immediate) {
      void enqueueCloudSync({ menu: true });
    } else {
      setCloudSyncStatus((prev) => ({
        ...prev,
        status: 'saving',
        hasPendingChanges: true,
      }));
      menuDebounceTimerRef.current = setTimeout(() => {
        menuDebounceTimerRef.current = null;
        void enqueueCloudSync({ menu: true });
      }, 450);
    }
  };

  const handleForceCloudSync = async (): Promise<boolean> => {
    return flushAllPendingOwnerSaves();
  };

  const handleSaveLocation = async (
    locInput: Omit<SavedCustomerLocation, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const existingIdx = savedLocations.findIndex(
      (l) => l.label.toLowerCase() === locInput.label.toLowerCase()
    );
    const isNew = existingIdx === -1;
    const savedRecord: SavedCustomerLocation = {
      ...locInput,
      id: isNew ? `loc_${Date.now()}` : savedLocations[existingIdx].id,
      createdAt: isNew ? now : savedLocations[existingIdx].createdAt,
      updatedAt: now,
    };

    setSavedLocations((prev) => {
      const resetDefaults = locInput.isDefault
        ? prev.map((p) => ({ ...p, isDefault: false }))
        : prev;
      if (isNew) {
        return [savedRecord, ...resetDefaults].slice(0, 15);
      }
      return resetDefaults.map((p) => (p.id === savedRecord.id ? savedRecord : p));
    });

    if (currentUser && currentUser.emailVerified) {
      try {
        await saveCustomerLocationToCloud(currentUser.uid, savedRecord, isNew);
      } catch {
        // local copy already preserved
      }
    }
    return true;
  };

  const handleDeleteLocation = async (locId: string) => {
    setSavedLocations((prev) => prev.filter((l) => l.id !== locId));
    if (currentUser && currentUser.emailVerified) {
      try {
        await deleteCustomerLocationFromCloud(currentUser.uid, locId);
      } catch {
        // ignore
      }
    }
  };

  const handleCopyText = (text: string, id: string) => {
    void safeCopyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleOpenWalletApp = (wallet: 'dana' | 'gopay') => {
    void safeCopyToClipboard(storeConfig.ewalletNumber);
    setDeepLinkNotice(wallet);
    setTimeout(() => setDeepLinkNotice(null), 4000);
    safeOpenWalletScheme(wallet);
  };

  const handleOpenMenuPortion = (item: MenuItem, toppingId?: string | null) => {
    setPreselectedToppingId(toppingId || null);
    setSelectedMenuForPortion(item);
  };

  const handleAddToCart = (newItem: CartItem) => {
    setCart((prev) => [...prev, newItem]);
    setAddedToast(`${newItem.menuItem.name} (${newItem.quantity} porsi)`);
    setIsCheckoutOpen(true);
    setTimeout(() => setAddedToast(null), 3200);
  };

  const handleQuickOrderTopItem = (menuId: string) => {
    const matched =
      menuItems.find((m) => m.id === menuId) ||
      menuItems.find((m) => m.isAvailable) ||
      menuItems[0];
    if (matched) {
      handleOpenMenuPortion(matched);
    }
  };

  const handleReorderLastOrder = (snapshot: LastOrderSnapshot) => {
    if (!snapshot.items || snapshot.items.length === 0) return;
    const fallbackMenu = menuItems.find((m) => m.isAvailable) || menuItems[0];
    const now = Date.now();

    const restoredItems: CartItem[] = snapshot.items.map((item, idx) => {
      const matchedMenu =
        (item.menuId ? menuItems.find((m) => m.id === item.menuId) : undefined) ||
        menuItems.find((m) => m.name.toLowerCase() === item.name.toLowerCase());

      const resolvedMenuItem: MenuItem = matchedMenu || {
        id: item.menuId || `reorder-${now}-${idx}`,
        name: item.name,
        category: item.unitPrice >= 15000 ? 'spesial' : 'reguler',
        basePrice: item.unitPrice,
        description: item.itemNote || item.portionLabel,
        sidesIncluded: fallbackMenu?.sidesIncluded || [
          'Nasi Kuning Harum',
          'Tempe Manis Gurih',
          'Mie Goreng Kecap',
          'Kerupuk Renyah',
        ],
        imageUrl: fallbackMenu?.imageUrl || '',
        isAvailable: true,
        spiceLevel: 'Sesuai Pesanan',
      };

      return {
        cartItemId: `reorder-${resolvedMenuItem.id}-${now}-${idx}`,
        menuItem: resolvedMenuItem,
        riceType: item.riceType || 'nasi_kuning',
        portionType: item.portionType || 'standard',
        portionLabel: item.portionLabel || 'Porsi Standar',
        unitPrice: item.unitPrice,
        quantity: Math.max(1, item.quantity),
        sambalPreference: item.sambalPreference || 'campur',
        ...(item.toppings && item.toppings.length > 0 ? { toppings: item.toppings } : {}),
        ...(item.toppingTotal && item.toppingTotal > 0 ? { toppingTotal: item.toppingTotal } : {}),
        ...(item.toppingScope ? { toppingScope: item.toppingScope } : {}),
        wantExtraSideDish: Boolean(item.wantExtraSideDish),
        extraSideDishNote: item.extraSideDishNote || '',
        ...(item.itemNote ? { itemNote: item.itemNote } : {}),
      };
    });

    setCart(restoredItems);
    setAddedToast(`Pesanan terakhir (${snapshot.totalPortions} porsi) siap dipesan ulang!`);
    setIsCheckoutOpen(true);
    setTimeout(() => setAddedToast(null), 3200);
  };

  const handleBrowseCatalogMenu = () => {
    const el = document.getElementById('katalog-menu');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleQuickAddTopping = (topping: ToppingOption) => {
    const currentCart = cart;
    if (currentCart.length > 0) {
      const targetIdx = currentCart.length - 1;
      const targetItem = currentCart[targetIdx];
      const existingToppings = Array.isArray(targetItem.toppings) ? [...targetItem.toppings] : [];
      const existingIdx = existingToppings.findIndex((t) => t.id === topping.id);
      if (existingIdx >= 0) {
        existingToppings[existingIdx] = {
          ...existingToppings[existingIdx],
          quantity: Math.min(20, existingToppings[existingIdx].quantity + 1),
        };
      } else {
        existingToppings.push({
          id: topping.id,
          name: topping.name,
          unitPrice: topping.price,
          quantity: 1,
        });
      }
      const nextToppingTotal = existingToppings.reduce(
        (sum, t) => sum + t.unitPrice * t.quantity,
        0
      );
      const prevToppingTotal = Number(targetItem.toppingTotal) || 0;
      const wasTotalOrder = targetItem.toppingScope === 'total_order';
      const baseUnitPrice = wasTotalOrder
        ? targetItem.unitPrice
        : Math.max(1000, targetItem.unitPrice - prevToppingTotal);
      const nextToppingScope: 'per_portion' | 'total_order' =
        targetItem.quantity > 1
          ? targetItem.toppingScope || 'total_order'
          : 'per_portion';
      const nextUnitPrice =
        nextToppingScope === 'total_order'
          ? baseUnitPrice
          : baseUnitPrice + nextToppingTotal;
      const toppingKey = existingToppings.map((t) => `${t.id}:${t.quantity}`).join('|');

      setCart((prev) =>
        prev.map((item, idx) =>
          idx === targetIdx
            ? {
                ...item,
                cartItemId: `${item.menuItem.id}-${toppingKey}-${Date.now()}`,
                toppings: existingToppings,
                toppingTotal: nextToppingTotal,
                toppingScope: nextToppingScope,
                unitPrice: nextUnitPrice,
              }
            : item
        )
      );
      setAddedToast(
        `+1 ${topping.name} (${formatRupiah(topping.price)}) ke ${targetItem.menuItem.name}`
      );
      setTimeout(() => setAddedToast(null), 3200);
      return;
    }

    const defaultMenu =
      menuItems.find((m) => m.id === 'nasi-kuning-ayam-bakar' && m.isAvailable) ||
      menuItems.find((m) => m.id === 'nasi-kuning-bebek-palekko' && m.isAvailable) ||
      menuItems.find((m) => m.isAvailable) ||
      menuItems[0];
    if (defaultMenu) {
      handleOpenMenuPortion(defaultMenu, topping.id);
    }
  };

  const handleUpdateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const handleUpdateCartItemNote = (cartItemId: string, newNote: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? { ...item, itemNote: newNote.trim() ? newNote : undefined }
          : item
      )
    );
  };

  const handleOrderLogged = (record: OrderRecord) => {
    setOrders((prev) => {
      const next = [record, ...prev.filter((o) => o.id !== record.id)].slice(0, 100);
      ordersRef.current = next;
      return next;
    });
    void logCustomerOrderToServer(record);
    if (currentUser && currentUser.emailVerified) {
      void saveOrderToCloud(currentUser.uid, record).catch(() => {});
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === orderId ? { ...o, status } : o));
      ordersRef.current = next;
      void saveOwnerStateToServer({ orders: next });
      return next;
    });
    if (isAdminCloudVerified) {
      void updateOrderStatusInCloud(orderId, status).catch(() => {});
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== orderId);
      ordersRef.current = next;
      void saveOwnerStateToServer({ orders: next });
      return next;
    });
    if (isAdminCloudVerified) {
      void deleteOrderFromCloud(orderId).catch(() => {});
    }
  };

  const handleClearOrders = () => {
    ordersRef.current = [];
    setOrders([]);
    void saveOrdersPermanentLocal([]);
    void saveOwnerStateToServer({ orders: [] });
    if (isAdminCloudVerifiedRef.current) {
      void clearAllOrdersFromCloud().catch(() => {});
    }
  };

  const handleResetDefaults = () => {
    const now = Date.now();
    const resetStore = normalizeStoreConfig(INITIAL_STORE_CONFIG);
    storeConfigRef.current = resetStore;
    menuItemsRef.current = INITIAL_MENU_ITEMS;
    hasIdbStoreRef.current = false;
    hasIdbMenuRef.current = false;
    setStoreConfig(resetStore);
    setMenuItems(INITIAL_MENU_ITEMS);
    pendingSyncRef.current = {
      ...EMPTY_PENDING_SYNC,
      lastLocalEditAt: now,
    };
    authorityMetaRef.current = {
      ...EMPTY_OWNER_AUTHORITY_META,
      lastOwnerEditAt: now,
    };
    void clearOwnerCustomOverridesLocal().then(() => {
      void saveStoreConfigPermanentLocal(resetStore);
      void saveMenuItemsPermanentLocal(INITIAL_MENU_ITEMS);
      void writePendingSyncPermanent(pendingSyncRef.current);
      void writeOwnerAuthorityMetaPermanent(authorityMetaRef.current);
    });
    void resetOwnerStateOnServer();
    if (isAdminCloudVerifiedRef.current) {
      void enqueueCloudSync({ store: true, menu: true }).then((ok) => {
        if (ok) {
          void writeOwnerAuditLogToCloud({
            action: 'explicit_reset',
            storeSaved: true,
            menuCount: INITIAL_MENU_ITEMS.length,
            orderCount: ordersRef.current.length,
            note: 'Reset manual ke pengaturan default dengan konfirmasi RESET',
          });
        }
      });
    }
  };

  const handleOwnerSecretClick = () => {
    let storedVerified = isOwnerVerified;
    try {
      storedVerified =
        storedVerified || localStorage.getItem(STORAGE_KEYS.OWNER_VERIFIED) === 'true';
    } catch {
      // ignore storage access errors
    }

    if (storedVerified) {
      setIsOwnerVerified(true);
      setIsOwnerPanelOpen(true);
    } else {
      setIsOwnerPinModalOpen(true);
    }
  };

  const handleOwnerPinSuccess = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.OWNER_VERIFIED, 'true');
    } catch {
      // ignore storage quota errors
    }
    setIsOwnerVerified(true);
    setIsOwnerPinModalOpen(false);
    setIsOwnerPanelOpen(true);
  };

  const handleLockOwner = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.OWNER_VERIFIED);
    } catch {
      // ignore storage errors
    }
    setIsOwnerVerified(false);
    setIsOwnerPanelOpen(false);
  };

  const totalCartPortions = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartSubtotal = cart.reduce((sum, item) => sum + getCartItemSubtotal(item), 0);

  const palekkoItem =
    menuItems.find((m) => m.id === 'nasi-kuning-bebek-palekko') ||
    menuItems.find((m) => m.category === 'spesial') ||
    menuItems[0];

  const isNewMenuEntry = (item: MenuItem): boolean =>
    (NEW_OFFICIAL_MENU_IDS as readonly string[]).includes(item.id) ||
    item.id.startsWith('menu-') ||
    /menu baru/i.test(item.signatureTag || '');

  const newMenuItems = menuItems.filter((m) => m.id !== palekkoItem?.id && isNewMenuEntry(m));

  const featuredShowcaseItems =
    newMenuItems.length > 0
      ? newMenuItems
      : menuItems.filter((m) => m.id !== palekkoItem?.id).slice(0, 3);

  const heroShowcaseSlides = React.useMemo(() => {
    const orderedMenus = palekkoItem
      ? [palekkoItem, ...menuItems.filter((m) => m.id !== palekkoItem.id)]
      : [...menuItems];

    const menuSlides = orderedMenus.map((item) => {
      const isNew =
        (NEW_OFFICIAL_MENU_IDS as readonly string[]).includes(item.id) ||
        item.id.startsWith('menu-') ||
        /menu baru/i.test(item.signatureTag || '');
      return {
        kind: 'menu' as const,
        id: item.id,
        name: item.name,
        shortName: item.name.replace(/^Nasi Kuning\s+/i, ''),
        imageUrl: item.imageUrl,
        priceText: formatRupiah(item.basePrice),
        tagLabel:
          item.id === 'nasi-kuning-bebek-palekko'
            ? 'Andalan Utama Adat Bugis'
            : isNew
            ? 'Menu Baru · Sajian Malam'
            : item.category === 'spesial'
            ? 'Menu Spesial · Favorit'
            : 'Menu Reguler · Komplit',
        subtitle: `${formatRupiah(item.basePrice)} · ${item.sidesIncluded.join(' + ')}`,
        menuItem: item,
      };
    });

    const bakwan = DEFAULT_TOPPING_OPTIONS[0];
    if (!bakwan) return menuSlides;

    return [
      ...menuSlides,
      {
        kind: 'topping' as const,
        id: `topping-${bakwan.id}`,
        name: bakwan.name,
        shortName: 'Bakwan Goreng',
        imageUrl: bakwan.imageUrl || '',
        priceText: `+${formatRupiah(bakwan.price)}`,
        tagLabel: 'Toping Favorit · Seribuan',
        subtitle: `+${formatRupiah(bakwan.price)} · ${bakwan.description}`,
        topping: bakwan,
      },
    ];
  }, [menuItems, palekkoItem]);

  // Preload & decode ALL menu & topping images immediately on mount so zero black frames ever appear
  useEffect(() => {
    if (typeof window === 'undefined') return;
    heroShowcaseSlides.forEach((slide) => {
      if (!slide.imageUrl) return;
      const img = new window.Image();
      img.referrerPolicy = 'no-referrer';
      img.src = slide.imageUrl;
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {});
      }
    });
  }, [heroShowcaseSlides]);

  // Auto-rotate hero showcase across ALL menus every 5 seconds
  useEffect(() => {
    if (heroShowcaseSlides.length <= 1) return;
    if (activeStandalonePage !== 'home' || isAnyModalOpen) return;
    const timer = window.setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % heroShowcaseSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [heroShowcaseSlides.length, activeStandalonePage, isAnyModalOpen]);

  const activeHeroMainSlide =
    heroShowcaseSlides.length > 0
      ? heroShowcaseSlides[heroSlideIndex % heroShowcaseSlides.length]
      : null;

  const activeHeroMiniSlides = React.useMemo(() => {
    if (heroShowcaseSlides.length === 0) return [];
    const total = heroShowcaseSlides.length;
    const count = Math.min(4, Math.max(0, total - 1));
    return Array.from({ length: count }, (_, idx) => {
      const slideIdx = (heroSlideIndex + idx + 1) % total;
      return heroShowcaseSlides[slideIdx];
    });
  }, [heroShowcaseSlides, heroSlideIndex]);

  const filteredMenuItems = menuItems.filter((item) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'baru') return isNewMenuEntry(item);
    return item.category === activeCategory;
  });

  const displayMenuCount = menuItems.length;
  const regulerItems = menuItems.filter((m) => m.category === 'reguler');
  const spesialItems = menuItems.filter((m) => m.category === 'spesial');
  const regulerCount = regulerItems.length;
  const spesialCount = spesialItems.length;
  const minRegulerPrice =
    regulerItems.length > 0
      ? Math.min(...regulerItems.map((m) => m.basePrice))
      : 10000;
  const minSpesialPrice =
    spesialItems.length > 0
      ? Math.min(...spesialItems.map((m) => m.basePrice))
      : palekkoItem?.basePrice ?? 15000;
  const heroBrandHeading =
    storeConfig.brandName.trim().toUpperCase() === 'NASI KUNING LASINRANG'
      ? 'Nasi Kuning Lasinrang'
      : storeConfig.brandName;

  const normalizedStoreWa =
    toIndonesianWaDigits(storeConfig.whatsappNumber) || '6282363953662';

  const arrangeCourierWaUrl = `https://wa.me/${normalizedStoreWa}?text=${encodeURIComponent(
    `Halo Admin *${storeConfig.brandName}* 🙏, saya ingin pesan Nasi Kuning dengan pengantaran kurir area Kota Pinrang ke alamat saya.`
  )}`;

  const eventOrderWaUrl = `https://wa.me/${normalizedStoreWa}?text=${encodeURIComponent(
    `Assalamu'alaikum / Halo Admin *${storeConfig.brandName}* 🌿, saya ingin menanyakan & memesan paket acara / partai (Jum'at Berkah / Syukuran / Pengajian / Rapat Kantor / Hajatan). Mohon info jumlah porsi, pilihan menu, dan jadwalnya ya.`
  )}`;

  return (
    <MotionConfig reducedMotion="user">
      <WelcomeIntroOverlay
        isOpen={showWelcomeIntro}
        onComplete={() => setShowWelcomeIntro(false)}
        logoUrl={OFFICIAL_LOGO_URL}
        brandName={heroBrandHeading}
      />

      {activeStandalonePage === 'owner' ? (
        <OwnerPanelModal
          isOpen={isOwnerPanelOpen}
          onClose={() => setIsOwnerPanelOpen(false)}
          storeConfig={storeConfig}
          onUpdateStoreConfig={handleUpdateStoreConfig}
          menuItems={menuItems}
          onUpdateMenuItems={handleUpdateMenuItems}
          orders={orders}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onDeleteOrder={handleDeleteOrder}
          onClearOrders={handleClearOrders}
          onResetDefaults={handleResetDefaults}
          currentCartSubtotal={totalCartSubtotal}
          onLockOwner={handleLockOwner}
          currentUser={currentUser}
          isAdminCloudVerified={isAdminCloudVerified}
          onSignInGoogle={handleSignInGoogle}
          onSignOutGoogle={handleSignOutGoogle}
          onForceCloudSync={handleForceCloudSync}
          onMigrateAllToFirebase={handleMigrateAllToFirebase}
          onPullFromFirebase={handlePullFromFirebase}
          onInspectFirebaseVault={handleInspectFirebaseVault}
          onSaveOwnerPrivateSettings={handleSaveOwnerPrivateSettings}
          ownerPrivateSettings={ownerPrivateSettings}
          ownerAuditLogs={ownerAuditLogs}
          cloudSyncStatus={cloudSyncStatus}
        />
      ) : activeStandalonePage === 'owner-pin' ? (
        <OwnerPinModal
          isOpen={isOwnerPinModalOpen}
          onClose={() => setIsOwnerPinModalOpen(false)}
          onSuccess={handleOwnerPinSuccess}
        />
      ) : activeStandalonePage === 'portion' ? (
        <PortionModal
          menuItem={selectedMenuForPortion}
          storeConfig={storeConfig}
          initialToppingId={preselectedToppingId}
          onClose={() => {
            setSelectedMenuForPortion(null);
            setPreselectedToppingId(null);
          }}
          onAddToCart={handleAddToCart}
        />
      ) : activeStandalonePage === 'checkout' ? (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          cart={cart}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveCartItem}
          onUpdateItemNote={handleUpdateCartItemNote}
          onClearCart={() => {
            setCart([]);
            setAddedToast(null);
          }}
          storeConfig={storeConfig}
          onOrderLogged={handleOrderLogged}
          savedLocations={savedLocations}
          currentUser={currentUser}
          onSignInGoogle={handleSignInGoogle}
          onSaveLocation={handleSaveLocation}
          onDeleteLocation={handleDeleteLocation}
          onOpenTutorial={() => {
            setIsTutorialOpen(true);
          }}
          onOpenQrisLightbox={() =>
            setLightboxImage({
              url: storeConfig.qrisImageUrl,
              title: `QRIS Resmi — ${storeConfig.qrisMerchantName}`,
              subtitle: `NMID: ${storeConfig.qrisNmid} (${storeConfig.qrisTerminalId}) · Dicetak oleh: ${storeConfig.qrisPrintedBy} (${storeConfig.qrisVersion})`,
              isQris: true,
            })
          }
        />
      ) : (
      <div className="relative min-h-screen bg-culinary-canvas text-[#30251F] flex flex-col overflow-x-clip">
        {firestoreQuotaInfo && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs text-center sticky top-0 z-50 shadow-xs flex items-center justify-center gap-3">
            <span>
              Kuota harian database Firestore tercapai dan akan direset besok. Data lokal perangkat Anda tetap aman.
              {firestoreQuotaInfo.upgradeUrl && (
                <>
                  {' '}
                  <a
                    href={firestoreQuotaInfo.upgradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold text-amber-950"
                  >
                    Lihat Console Firebase
                  </a>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => setFirestoreQuotaInfo(null)}
              className="font-bold text-amber-950 underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        <OfflineIndicator />

        {/* =====================================================================
            MODERN FLOATING GLASSMORPHIC HOSPITALITY NAVIGATION (3-ZONE CONTRACT)
           ===================================================================== */}
        <header className="sticky top-0 z-40 bg-header-royal-bugis px-2 sm:px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-6 px-3 sm:px-7 py-2 sm:py-3 my-1.5 sm:my-2 rounded-2xl bg-header-royal-inner relative overflow-hidden">
            {/* Subtle Top Gold Filigree Shimmer Line */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#F3C969]/70 to-transparent"
            />

            {/* Zone 1: Brand Identity with Lontara Bugis Royal Accent (Zero Clipping on Mobile) */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 lg:flex-initial group relative z-10"
            >
              <div className="relative shrink-0">
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="Logo Resmi Nasi Kuning Lasinrang"
                  loading="eager"
                  decoding="async"
                  draggable={false}
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-contain shrink-0 bg-white ring-2 ring-[#F3C969] shadow-md"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.14em] sm:tracking-[0.2em] uppercase text-[#FFD24C] leading-none mb-0.5 truncate">
                  ✦ ᨊᨔᨗ ᨀᨘᨊᨗ ᨒᨔᨗᨑ ✦
                </span>
                <span className="text-xs sm:text-xl font-bold tracking-tight text-white group-hover:text-[#FFD24C] transition-colors font-serif-display leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
                  {heroBrandHeading}
                </span>
              </div>
            </a>

            {/* Zone 2: Clean Single-Line Navigation Links on Royal Pill Bar */}
            <nav
              aria-label="Navigasi Utama"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#042417]/80 border border-[#FFD24C]/40 text-sm font-bold text-white relative z-10"
            >
              <a
                href="#unggulan"
                className="px-3 py-1 rounded-full hover:bg-[#FFD24C]/20 hover:text-[#FFD24C] transition-colors whitespace-nowrap shrink-0"
              >
                Spesial
              </a>
              <a
                href="#katalog-menu"
                className="px-3 py-1 rounded-full hover:bg-[#FFD24C]/20 hover:text-[#FFD24C] transition-colors whitespace-nowrap shrink-0"
              >
                Menu ({displayMenuCount})
              </a>
              <a
                href="#galeri-suasana"
                className="px-3 py-1 rounded-full hover:bg-[#FFD24C]/20 hover:text-[#FFD24C] transition-colors whitespace-nowrap shrink-0"
              >
                Galeri
              </a>
              <a
                href="#ojol-hub"
                className="px-3 py-1 rounded-full hover:bg-[#FFD24C]/20 hover:text-[#FFD24C] transition-colors whitespace-nowrap shrink-0"
              >
                Ojol &amp; Kurir
              </a>
              <a
                href="#pembayaran-qris"
                className="px-3 py-1 rounded-full hover:bg-[#FFD24C]/20 hover:text-[#FFD24C] transition-colors whitespace-nowrap shrink-0"
              >
                QRIS
              </a>
              <a
                href="#lokasi-kedai"
                className="px-3 py-1 rounded-full hover:bg-[#FFD24C]/20 hover:text-[#FFD24C] transition-colors whitespace-nowrap shrink-0"
              >
                Lokasi
              </a>
            </nav>

            {/* Zone 3: In-App PWA Install Button + Primary Cart Action + Mobile Menu Trigger */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 relative z-10">
              <PWAInstallButton
                brandName={heroBrandHeading}
                logoUrl={OFFICIAL_LOGO_URL}
                variant="header"
              />

              <motion.button
                type="button"
                key={totalCartPortions}
                initial={totalCartPortions > 0 ? { scale: 0.96 } : false}
                animate={{ scale: 1 }}
                transition={{ duration: 0.16, ease: EASE_SMOOTH }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsCheckoutOpen(true)}
                className={`min-h-[38px] sm:min-h-[42px] px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-extrabold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-all shadow-md border ${
                  totalCartPortions > 0
                    ? 'bg-[#D91B24] hover:bg-[#B8141C] text-white border-[#FFD24C]/70'
                    : 'bg-gradient-to-r from-[#FFC72C] to-[#FFD24C] hover:from-[#F2B705] hover:to-[#FFC72C] text-[#051F14] border-white/60'
                }`}
              >
                <ShoppingBag
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                    totalCartPortions > 0 ? 'text-[#FFD24C]' : 'text-[#064E3B]'
                  }`}
                />
                <span className="sm:hidden font-mono-tabular">
                  {totalCartPortions > 0
                    ? `${totalCartPortions} Porsi`
                    : 'Pesan'}
                </span>
                <span className="hidden sm:inline font-mono-tabular">
                  {totalCartPortions > 0
                    ? `${totalCartPortions} Porsi · ${formatRupiah(totalCartSubtotal)}`
                    : 'Keranjang Pesanan'}
                </span>
              </motion.button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="lg:hidden min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] rounded-full bg-[#042417]/90 hover:bg-[#084C32] border border-[#FFD24C]/65 text-[#FFD24C] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                aria-label="Buka Navigasi"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="w-4 h-4" />
                ) : (
                  <MenuIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="bg-bugis-woven-band -mx-2 sm:-mx-4" aria-hidden="true" />

          {/* Mobile Clean Rounded Drawer */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.nav
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="lg:hidden -mx-2 sm:-mx-4 px-4 pb-5 pt-3 border-t border-[#FFD24C]/40 bg-[#063825] space-y-2.5 shadow-xl"
              >
                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-[#064E3B]">
                  <PWAInstallButton
                    brandName={heroBrandHeading}
                    logoUrl={OFFICIAL_LOGO_URL}
                    variant="drawer"
                  />
                  <a
                    href="#unggulan"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#064E3B]/15 flex items-center justify-between"
                  >
                    <span>Menu Spesial</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#B87300]" />
                  </a>
                  <a
                    href="#katalog-menu"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#064E3B]/15 flex items-center justify-between"
                  >
                    <span>Semua Menu ({displayMenuCount})</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#B87300]" />
                  </a>
                  <a
                    href="#galeri-suasana"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#064E3B]/15 flex items-center justify-between"
                  >
                    <span>Galeri Suasana</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#B87300]" />
                  </a>
                  <a
                    href="#ojol-hub"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#064E3B]/15 flex items-center justify-between"
                  >
                    <span>GoFood &amp; Maxim</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#B87300]" />
                  </a>
                  <a
                    href="#pembayaran-qris"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#064E3B]/15 flex items-center justify-between"
                  >
                    <span>QRIS &amp; E-Wallet</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#B87300]" />
                  </a>
                  <a
                    href="#lokasi-kedai"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#064E3B]/15 flex items-center justify-between"
                  >
                    <span>Lokasi &amp; Rute 3D</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#B87300]" />
                  </a>
                  <a
                    href="#video-tutorial-section"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="col-span-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#084C32] text-white border border-[#FFD24C]/45 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-[#FFD24C] shrink-0" />
                      <span>Video Panduan Cara Pesan</span>
                    </span>
                    <span className="text-xs font-bold text-[#FFD24C]">Putar</span>
                  </a>
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </header>

        <main id="top" className="relative z-10 flex-1">
          {/* =====================================================================
              1. ROYAL BUGIS LUXURY HERO STAGE — LIPA' SABBE & SULAPPA EPPA' HERITAGE
             ===================================================================== */}
          <div className="bg-bugis-woven-band" aria-hidden="true" />
          <section className="relative bg-royal-bugis-hero pt-6 sm:pt-12 lg:pt-16 pb-14 sm:pb-22 border-b-2 border-[#D9A52E]/45 overflow-hidden">
            {/* Subtle Royal Bugis Ornaments */}
            <BugisWovenAccent className="pointer-events-none absolute top-4 right-6 w-64 h-28 opacity-30 hidden lg:block" />
            <SpiceBotanicalOrnament className="pointer-events-none absolute bottom-6 left-4 w-52 h-52 opacity-20 hidden lg:block" />

            <div className="max-w-7xl mx-auto px-4 sm:px-8">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: EASE_SMOOTH }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center"
              >
                {/* Left 5 Columns: Royal Bugis Identity, NASI KUNING LASINRANG Headline & CTAs */}
                <div className="lg:col-span-5 space-y-5 sm:space-y-6">
                  {/* Adat Bugis Lontara Royal Crest Badge (Responsive Rounded Box on Mobile so Multi-line Never Clips) */}
                  <div className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-2xl sm:rounded-full bg-[#084C32] border border-[#FFD24C]/75 shadow-[0_4px_18px_rgba(255,210,76,0.25)]">
                    <span className="text-xs font-bold text-[#FFD24C] tracking-wider">
                      ✦ ᨊᨔᨗ ᨀᨘᨊᨗ ᨒᨔᨗᨑ ✦
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.08em] sm:tracking-[0.16em] text-white">
                      Warisan Kuliner Adat Bugis · Pinrang
                    </span>
                  </div>

                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="text-xs font-bold text-[#FFD24C] flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>Depan Patung Lasinrang, Pinrang</span>
                      <span aria-hidden="true">·</span>
                      <span>{storeConfig.operatingHours}</span>
                    </div>

                    <h1 className="text-3xl sm:text-5xl lg:text-[3.5rem] font-extrabold font-serif-display leading-[1.08] tracking-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.55)] break-words">
                      NASI KUNING{' '}
                      <span className="text-gold-luminous block sm:inline">LASINRANG</span>
                    </h1>

                    <NusantaraSectionDivider className="max-w-xs opacity-100 pt-1" />

                    <p className="text-sm sm:text-lg font-serif-display italic font-semibold text-[#FFD24C] leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
                      “Malunra Tongeng, Marasa na Masempo — Adat Sipakalebbi ri Bumi Lasinrang”
                    </p>
                  </div>

                  <p className="text-sm sm:text-base text-white font-medium leading-relaxed">
                    Nasi kuning santan kunyit asli yang ditanak dengan tradisi dapur Bugis Pinrang,
                    disajikan hangat setiap malam bersama{' '}
                    <strong className="text-[#FFD24C] font-bold">
                      {displayMenuCount} pilihan lauk komplit
                    </strong>{' '}
                    mulai Bebek Palekko Bugis, Cumi Tinta Hitam, Udang Saos Asam Manis, Ayam Bakar,
                    hingga Bakwan Goreng Renyah.
                  </p>

                  {/* 3-Pillar Falsafah Adat Bugis Strip (Tactile 3D Pop) */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
                    <div className="p-2.5 sm:p-3 rounded-2xl bg-[#073B27] fx-2d-dark-chip text-center space-y-0.5">
                      <div className="text-xs font-bold text-[#FFD24C]">ᨄᨒᨛᨀᨚ</div>
                      <div className="text-[11px] font-bold text-white leading-tight">Rempah Bugis</div>
                      <div className="text-[10px] font-medium text-[#FFF3C4] leading-tight">Bumbu Palekko</div>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-2xl bg-[#073B27] fx-2d-dark-chip text-center space-y-0.5">
                      <div className="text-xs font-bold text-[#FFD24C]">ᨊᨔᨗ ᨀᨘᨊᨗ</div>
                      <div className="text-[11px] font-bold text-white leading-tight">Santan Kunyit</div>
                      <div className="text-[10px] font-medium text-[#FFF3C4] leading-tight">Kukusan Hangat</div>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-2xl bg-[#073B27] fx-2d-dark-chip text-center space-y-0.5">
                      <div className="text-xs font-bold text-[#FFD24C]">ᨔᨗᨄᨀᨒᨛᨅᨗ</div>
                      <div className="text-[11px] font-bold text-white leading-tight">Sipakalebbi</div>
                      <div className="text-[10px] font-medium text-[#FFF3C4] leading-tight">Pelayanan Ramah</div>
                    </div>
                  </div>

                  {/* Primary Action Buttons + In-App PWA Install Button (Tactile 3D Pop) */}
                  <div className="pt-1 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3">
                    <a
                      href="#katalog-menu"
                      className="col-span-1 min-h-[48px] px-4 sm:px-7 py-3.5 rounded-2xl bg-[#FFC72C] hover:bg-[#FFD24C] text-[#051F14] fx-2d-gold font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Utensils className="w-4 h-4 text-[#051F14] shrink-0" />
                      <span>Lihat Menu</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setIsCheckoutOpen(true)}
                      className="col-span-1 min-h-[48px] px-4 sm:px-6 py-3.5 rounded-2xl bg-[#D91B24] hover:bg-[#B8141C] text-white fx-2d-crimson font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4 text-[#FFD24C] shrink-0" />
                      <span>Pesan Sekarang</span>
                    </button>

                    <div className="col-span-2 sm:col-span-1 flex items-center gap-2.5">
                      <div className="flex-1 sm:flex-initial empty:hidden">
                        <PWAInstallButton
                          brandName={heroBrandHeading}
                          logoUrl={OFFICIAL_LOGO_URL}
                          variant="hero"
                        />
                      </div>

                      <a
                        href="#video-tutorial-section"
                        className="flex-1 sm:flex-initial min-h-[48px] px-4 sm:px-5 py-3.5 rounded-2xl bg-[#073B27] hover:bg-[#084C32] text-white fx-2d-dark-chip font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <PlayCircle className="w-4 h-4 text-[#FFD24C] shrink-0" />
                        <span>Panduan</span>
                      </a>
                    </div>
                  </div>

                  {/* Trust Summary */}
                  <div className="pt-3 border-t border-[#FFD24C]/35 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs font-medium text-white">
                    <div>
                      Menu Reguler{' '}
                      <strong className="font-mono-tabular font-bold text-[#FFD24C]">
                        {formatRupiah(minRegulerPrice)}
                      </strong>
                    </div>
                    <span aria-hidden="true" className="text-[#FFD24C]">✦</span>
                    <div>
                      Menu Spesial{' '}
                      <strong className="font-mono-tabular font-bold text-[#FFD24C]">
                        {formatRupiah(minSpesialPrice)}
                      </strong>
                    </div>
                    <span aria-hidden="true" className="text-[#FFD24C]">✦</span>
                    <div>
                      Bakwan Goreng{' '}
                      <strong className="font-mono-tabular font-bold text-[#FFD24C]">
                        Rp 1.000
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Right 7 Columns: Auto-Rotating Uncropped Full-Poster Showcase Stage (All Menus · Every 5s) */}
                <div className="lg:col-span-7">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
                    {/* Main Flagship Poster Card — 3D Premium Sculpted Frame, Cycles Every 5 Seconds */}
                    {activeHeroMainSlide && (
                      <div className="sm:col-span-7 menu-card-3d-dark rounded-3xl flex flex-col justify-between group">
                        <div className="relative aspect-[3/4] w-full menu-poster-3d-frame overflow-hidden border-b border-[#FFD24C]/45">
                          <FoodImage
                            src={activeHeroMainSlide.imageUrl}
                            alt={activeHeroMainSlide.name}
                            fit="poster"
                            eager
                            onClick={() =>
                              setLightboxImage({
                                url: activeHeroMainSlide.imageUrl,
                                title: activeHeroMainSlide.name,
                                subtitle: activeHeroMainSlide.subtitle,
                              })
                            }
                            className="group-hover:scale-103"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImage({
                                url: activeHeroMainSlide.imageUrl,
                                title: activeHeroMainSlide.name,
                                subtitle: activeHeroMainSlide.subtitle,
                              })
                            }
                            aria-label={`Perbesar foto ${activeHeroMainSlide.name}`}
                            className="absolute bottom-3 right-3 z-20 w-9 h-9 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md border border-[#FFD24C]/70 text-white flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <Maximize2 className="w-4 h-4 text-[#FFD24C]" />
                          </button>
                        </div>

                        {/* Dish Info Bar BELOW the Photo — Synced Price & Title */}
                        <div className="p-4 sm:p-5 bg-[#052E1E]/95 border-t border-[#FFD24C]/45 flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FFD24C] block">
                              {activeHeroMainSlide.tagLabel}
                            </span>
                            <h2 className="text-base sm:text-lg font-bold font-serif-display text-white leading-snug break-words">
                              {activeHeroMainSlide.name}
                            </h2>
                            <span className="text-base font-mono-tabular font-extrabold text-[#FFD24C]">
                              {activeHeroMainSlide.priceText}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={
                              activeHeroMainSlide.kind === 'menu' &&
                              !activeHeroMainSlide.menuItem.isAvailable
                            }
                            onClick={() =>
                              activeHeroMainSlide.kind === 'menu'
                                ? handleOpenMenuPortion(activeHeroMainSlide.menuItem)
                                : handleQuickAddTopping(activeHeroMainSlide.topping)
                            }
                            className="min-h-[42px] px-4 py-2.5 rounded-xl bg-[#FFC72C] hover:bg-[#FFD24C] text-[#051F14] fx-2d-gold font-extrabold text-xs cursor-pointer shrink-0"
                          >
                            Pesan Sekarang
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Right Side 2x2 Mini Portrait Poster Gallery — 3D Premium Cards, Rotate Every 5s */}
                    <div className="sm:col-span-5 grid grid-cols-2 gap-3 content-between">
                      {activeHeroMiniSlides.map((slide, slotIdx) => (
                        <div
                          key={`hero-mini-slot-${slotIdx}`}
                          onClick={() =>
                            slide.kind === 'menu'
                              ? handleOpenMenuPortion(slide.menuItem)
                              : handleQuickAddTopping(slide.topping)
                          }
                          className="rounded-2xl menu-mini-3d-card flex flex-col justify-between cursor-pointer group"
                        >
                          <div className="relative aspect-[3/4] w-full menu-poster-3d-frame overflow-hidden border-b border-[#FFD24C]/35">
                            <FoodImage
                              src={slide.imageUrl}
                              alt={slide.name}
                              fit="poster"
                              eager
                              className="group-hover:scale-105"
                            />
                          </div>
                          <div className="p-2.5 bg-[#052E1E]/95 border-t border-[#FFD24C]/35 flex flex-col justify-between gap-0.5">
                            <span className="text-[11px] font-bold text-white leading-snug break-words">
                              {slide.shortName}
                            </span>
                            <span className="text-[11px] font-mono-tabular font-extrabold text-[#FFD24C]">
                              {slide.priceText}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* =====================================================================
              2. SIGNATURE & NEW CURATIONS — FULL PORTRAIT POSTER SHOWCASE
             ===================================================================== */}
          <section
            id="unggulan"
            className="relative py-16 sm:py-24 bg-[#FAF5E8] border-b border-[#FFC72C]/35 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12 sm:space-y-16">
              {/* Section Heading with Adat Bugis Ornament */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#B87300] block">
                    ✦ Sajian Unggulan Bumi Lasinrang ✦
                  </span>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif-display text-[#064E3B] leading-[1.1]">
                    Hidangan Spesial, Menu Baru &amp; Bakwan
                  </h2>
                </div>
                <p className="text-xs sm:text-sm font-medium text-[#241C17] max-w-md leading-relaxed">
                  Seluruh foto menu ditampilkan utuh dan jelas. Setiap porsi disajikan komplit
                  bersama nasi kuning harum, tempe manis gurih, mie goreng kecap, dan kerupuk.
                </p>
              </div>

              {/* Flagship Bebek Palekko Spotlight Card — Full Uncropped Portrait Poster */}
              {palekkoItem && (
                <div
                  id="spesial-palekko"
                  className="editorial-plate-dark grid grid-cols-1 lg:grid-cols-12 items-center"
                >
                  <div className="lg:col-span-5 relative aspect-[3/4] max-h-[520px] w-full menu-poster-3d-frame overflow-hidden group border-b lg:border-b-0 lg:border-r border-[#FFD24C]/45">
                    <FoodImage
                      src={palekkoItem.imageUrl}
                      alt={palekkoItem.name}
                      fit="poster"
                      onClick={() =>
                        setLightboxImage({
                          url: palekkoItem.imageUrl,
                          title: palekkoItem.name,
                          subtitle: `${formatRupiah(
                            palekkoItem.basePrice
                          )} · ${palekkoItem.sidesIncluded.join(' + ')}`,
                        })
                      }
                      className="group-hover:scale-103"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxImage({
                          url: palekkoItem.imageUrl,
                          title: palekkoItem.name,
                          subtitle: `${formatRupiah(
                            palekkoItem.basePrice
                          )} · ${palekkoItem.sidesIncluded.join(' + ')}`,
                        })
                      }
                      className="absolute bottom-4 right-4 z-20 px-3.5 py-2 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md border border-[#FFD24C]/65 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-[#FFD24C]" />
                      <span>Perbesar Poster</span>
                    </button>
                  </div>

                  <div className="lg:col-span-7 p-6 sm:p-9 lg:p-11 flex flex-col justify-between gap-7 text-white">
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFD24C]/20 border border-[#FFD24C]/60 text-xs font-extrabold text-[#FFD24C]">
                        <Flame className="w-4 h-4 text-[#FFD24C]" />
                        <span>Kuliner Khas Adat Bugis · {palekkoItem.spiceLevel}</span>
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-2xl sm:text-4xl font-bold font-serif-display text-white leading-snug">
                          {palekkoItem.name}
                        </h3>
                        <div className="text-2xl sm:text-3xl font-mono-tabular font-extrabold text-[#FFD24C]">
                          {formatRupiah(palekkoItem.basePrice)}
                          <span className="text-xs font-medium text-[#FFF3C4] ml-2">
                            / porsi komplit
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#042417]/80 border border-[#FFD24C]/45 space-y-1.5">
                        <span className="text-xs font-extrabold text-[#FFD24C] block">
                          Isi Komplit Dalam 1 Porsi:
                        </span>
                        <p className="text-xs sm:text-sm text-white leading-relaxed font-semibold">
                          {palekkoItem.sidesIncluded.join(' · ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[#FFD24C]/35">
                      <span className="text-xs font-medium text-[#FFF3C4]">
                        Bisa pilih Nasi Kuning atau Nasi Putih · Porsi Standar, Lebih Puas &amp; Jumbo
                      </span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        disabled={!palekkoItem.isAvailable}
                        onClick={() => handleOpenMenuPortion(palekkoItem)}
                        className="min-h-[48px] px-7 py-3.5 rounded-xl bg-[#FFC72C] hover:bg-[#FFD24C] text-[#051F14] fx-2d-gold font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-45"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>
                          {palekkoItem.isAvailable
                            ? 'Pesan Sekarang'
                            : 'Stok Habis Malam Ini'}
                        </span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4-Column Full-Poster Grid: 3 Menu Baru + Bakwan Goreng Renyah */}
              <div id="menu-baru-kedai" className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#B87300] block">
                      Poster Menu Utuh &amp; Jelas
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold font-serif-display text-[#064E3B]">
                      3 Sajian Baru &amp; Toping Bakwan Goreng Renyah
                    </h3>
                  </div>
                  <a
                    href="#katalog-menu"
                    onClick={() => setActiveCategory('all')}
                    className="text-xs font-extrabold text-[#064E3B] hover:text-[#D91B24] inline-flex items-center gap-1 transition-colors"
                  >
                    <span>Lihat Semua {displayMenuCount} Menu</span>
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                  {featuredShowcaseItems.map((item) => (
                    <article
                      key={`new-card-${item.id}`}
                      className="editorial-plate flex flex-col justify-between group"
                    >
                      <div>
                        {/* Tall 3:4 Uncropped Portrait Poster Frame */}
                        <div className="relative aspect-[3/4] w-full menu-poster-3d-frame overflow-hidden border-b border-[#FFC72C]/45">
                          <FoodImage
                            src={item.imageUrl}
                            alt={item.name}
                            fit="poster"
                            onClick={() =>
                              setLightboxImage({
                                url: item.imageUrl,
                                title: item.name,
                                subtitle: `${formatRupiah(item.basePrice)} · ${item.sidesIncluded.join(' + ')}`,
                              })
                            }
                            className="group-hover:scale-103"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImage({
                                url: item.imageUrl,
                                title: item.name,
                                subtitle: `${formatRupiah(item.basePrice)} · ${item.sidesIncluded.join(' + ')}`,
                              })
                            }
                            className="absolute bottom-3 right-3 z-20 w-8 h-8 rounded-full bg-black/75 hover:bg-black/90 border border-[#FFD24C]/60 text-white flex items-center justify-center transition-colors cursor-pointer"
                            aria-label={`Perbesar foto ${item.name}`}
                          >
                            <Maximize2 className="w-3.5 h-3.5 text-[#FFD24C]" />
                          </button>
                        </div>

                        <div className="p-5 space-y-2">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF8E6] border border-[#FFC72C]/60 text-[11px] font-extrabold text-[#B87300]">
                            <span>Menu Baru</span>
                            <span>·</span>
                            <span>{item.spiceLevel}</span>
                          </div>
                          <h4 className="text-lg font-bold font-serif-display text-[#064E3B] leading-snug">
                            {item.name}
                          </h4>
                        </div>
                      </div>

                      <div className="px-5 py-4 bg-[#FDFBF7] border-t border-[#FFC72C]/35 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold text-[#3D3028] block">
                            Porsi Komplit
                          </span>
                          <span className="text-lg font-extrabold font-mono-tabular text-[#064E3B]">
                            {formatRupiah(item.basePrice)}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={!item.isAvailable}
                          onClick={() => handleOpenMenuPortion(item)}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#084C32] hover:bg-[#063825] text-white fx-2d-forest font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#FFD24C]" />
                          <span>{item.isAvailable ? 'Pesan Sekarang' : 'Habis'}</span>
                        </button>
                      </div>
                    </article>
                  ))}

                  {/* 4th Full Portrait Poster Card: Bakwan Goreng Renyah */}
                  {DEFAULT_TOPPING_OPTIONS.map((topping) => (
                    <article
                      id="toping-tambahan"
                      key={topping.id}
                      className="editorial-plate flex flex-col justify-between group"
                    >
                      <div>
                        <div className="relative aspect-[3/4] w-full menu-poster-3d-frame overflow-hidden border-b border-[#FFC72C]/45">
                          {topping.imageUrl && (
                            <FoodImage
                              src={topping.imageUrl}
                              alt={topping.name}
                              fit="poster"
                              onClick={() =>
                                setLightboxImage({
                                  url: topping.imageUrl || '',
                                  title: topping.name,
                                  subtitle: `${formatRupiah(topping.price)} (${topping.unitLabel})`,
                                })
                              }
                              className="group-hover:scale-103"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImage({
                                url: topping.imageUrl || '',
                                title: topping.name,
                                subtitle: `${formatRupiah(topping.price)} (${topping.unitLabel})`,
                              })
                            }
                            className="absolute bottom-3 right-3 z-20 w-8 h-8 rounded-full bg-black/75 hover:bg-black/90 border border-[#FFD24C]/60 text-white flex items-center justify-center transition-colors cursor-pointer"
                            aria-label={`Perbesar foto ${topping.name}`}
                          >
                            <Maximize2 className="w-3.5 h-3.5 text-[#FFD24C]" />
                          </button>
                        </div>

                        <div className="p-5 space-y-2">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D91B24]/10 border border-[#D91B24]/35 text-[11px] font-extrabold text-[#D91B24]">
                            <span>Toping Pelengkap Hangat</span>
                          </div>
                          <h4 className="text-lg font-bold font-serif-display text-[#064E3B] leading-snug">
                            {topping.name}
                          </h4>
                        </div>
                      </div>

                      <div className="px-5 py-4 bg-[#FDFBF7] border-t border-[#FFC72C]/35 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold text-[#3D3028] block">
                            Harga Satuan
                          </span>
                          <span className="text-lg font-extrabold font-mono-tabular text-[#D91B24]">
                            +{formatRupiah(topping.price)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickAddTopping(topping)}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#D91B24] hover:bg-[#B8141C] text-white fx-2d-crimson font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {cart.length > 0 ? '+ Tambah' : 'Pesan + Bakwan'}
                          </span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================================
              3. COMPLETE MENU CATALOG — 100% UNCROPPED PORTRAIT POSTER GALLERY
             ===================================================================== */}
          <section
            id="katalog-menu"
            className="relative py-20 sm:py-28 bg-[#FDFBF7] overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-10">
              {/* Royal Bugis Section Header & Segmented Pill Filter */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#B87300] block">
                    ✦ Katalog Resmi {storeConfig.brandName} · {displayMenuCount} Menu + Toping Bakwan ✦
                  </span>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif-display text-[#064E3B] leading-[1.1]">
                    Daftar Menu Lengkap &amp; Harga Resmi
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-[#241C17] leading-relaxed">
                    Setiap porsi sudah termasuk{' '}
                    <strong className="text-[#064E3B] font-bold">
                      Nasi Kuning Harum (atau Nasi Putih), Lauk Utama Pilihan, Tempe Manis Gurih,
                      Mie Goreng Kecap, dan Kerupuk Renyah
                    </strong>
                    . Ketuk foto untuk memperbesar atau klik <strong className="text-[#064E3B]">Pesan Sekarang</strong>.
                  </p>
                </div>

                {/* Segmented Filter Control + Copy Menu Utility (Tactile 3D Pop) */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                  <div className="grid grid-cols-2 sm:flex items-center p-1.5 bg-[#FAF5E8] border border-[#FFC72C]/45 rounded-2xl gap-1.5">
                    {[
                      { id: 'all' as const, label: `Semua (${displayMenuCount})` },
                      {
                        id: 'spesial' as const,
                        label: `Spesial (${spesialCount})`,
                      },
                      {
                        id: 'reguler' as const,
                        label: `Reguler (${regulerCount})`,
                      },
                      {
                        id: 'baru' as const,
                        label: `Menu Baru`,
                      },
                    ].map((tab) => {
                      const isActive = activeCategory === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveCategory(tab.id)}
                          className={`min-h-[40px] px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0 ${
                            isActive
                              ? 'bg-[#084C32] text-[#FFD24C] fx-2d-forest'
                              : 'bg-white text-[#1F1814] hover:text-[#064E3B] fx-2d-ivory'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        buildCopyableMenuListText(storeConfig, menuItems),
                        'copy-all-menu-catalog'
                      )
                    }
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-[#FAF5E8] text-[#064E3B] fx-2d-ivory text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedId === 'copy-all-menu-catalog' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#064E3B]" />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#B87300]" />
                        <span>Salin Daftar Menu</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Uniform Portrait Poster Grid — Every Menu Poster + Bakwan Goreng is 100% Uncropped & Crystal Clear */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-7 items-stretch">
                {filteredMenuItems.map((item) => {
                  const isNew = isNewMenuEntry(item);
                  const isSpecial = item.category === 'spesial';

                  return (
                    <article
                      key={item.id}
                      className="editorial-plate flex flex-col justify-between group"
                    >
                      <div>
                        {/* Full Uncropped 3:4 Portrait Poster Stage — Zero Badges Blocking the Top Title! */}
                        <div className="relative aspect-[3/4] w-full overflow-hidden menu-poster-3d-frame border-b border-[#FFC72C]/45">
                          <FoodImage
                            src={item.imageUrl}
                            alt={item.name}
                            fit="poster"
                            onClick={() =>
                              setLightboxImage({
                                url: item.imageUrl,
                                title: item.name,
                                subtitle: `${formatRupiah(item.basePrice)} · ${item.sidesIncluded.join(' + ')}`,
                              })
                            }
                            className="group-hover:scale-103"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImage({
                                url: item.imageUrl,
                                title: item.name,
                                subtitle: `${formatRupiah(item.basePrice)} · ${item.sidesIncluded.join(' + ')}`,
                              })
                            }
                            className="absolute bottom-3 right-3 z-20 w-8 h-8 rounded-full bg-black/75 hover:bg-black/90 border border-[#FFD24C]/65 text-white flex items-center justify-center transition-colors cursor-pointer"
                            aria-label={`Perbesar foto ${item.name}`}
                          >
                            <Maximize2 className="w-3.5 h-3.5 text-[#FFD24C]" />
                          </button>
                        </div>

                        {/* Clean Uncluttered Card Copy Below Poster (Full Text Visible Without Truncation) */}
                        <div className="p-5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                                isSpecial
                                  ? 'bg-[#084C32] text-[#FFD24C]'
                                  : isNew
                                  ? 'bg-[#D91B24] text-white'
                                  : 'bg-[#FAF5E8] text-[#064E3B] border border-[#FFC72C]/55'
                              }`}
                            >
                              {isSpecial
                                ? 'Menu Spesial'
                                : isNew
                                ? 'Menu Baru'
                                : 'Menu Reguler'}
                            </span>
                            <span className="text-[11px] font-bold text-[#B87300]">
                              {item.spiceLevel}
                            </span>
                          </div>

                          <h3 className="text-lg sm:text-xl font-bold font-serif-display text-[#064E3B] leading-snug break-words">
                            {item.name}
                          </h3>

                          <div className="pt-1 text-[11px] text-[#3D3028] font-semibold leading-relaxed break-words">
                            Komplit: {item.sidesIncluded.join(' · ')}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer with Tabular Price & Rounded CTA */}
                      <div className="px-5 py-4 bg-[#FDFBF7] border-t border-[#FFC72C]/35 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10.5px] font-bold text-[#3D3028] block">
                            Porsi Komplit
                          </span>
                          <span className="text-lg font-extrabold font-mono-tabular text-[#064E3B]">
                            {formatRupiah(item.basePrice)}
                          </span>
                        </div>

                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          disabled={!item.isAvailable}
                          onClick={() => handleOpenMenuPortion(item)}
                          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#084C32] hover:bg-[#063825] text-white fx-2d-forest font-extrabold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#FFD24C]" />
                          <span>{item.isAvailable ? 'Pesan Sekarang' : 'Habis'}</span>
                        </motion.button>
                      </div>
                    </article>
                  );
                })}

                {/* Dedicated Full Portrait Card for Bakwan Goreng inside the Menu Catalog */}
                {DEFAULT_TOPPING_OPTIONS.map((topping) => (
                  <article
                    key={`catalog-topping-${topping.id}`}
                    className="editorial-plate flex flex-col justify-between group"
                  >
                    <div>
                      <div className="relative aspect-[3/4] w-full overflow-hidden menu-poster-3d-frame border-b border-[#FFC72C]/45">
                        {topping.imageUrl && (
                          <FoodImage
                            src={topping.imageUrl}
                            alt={topping.name}
                            fit="poster"
                            onClick={() =>
                              setLightboxImage({
                                url: topping.imageUrl || '',
                                title: topping.name,
                                subtitle: `${formatRupiah(topping.price)} (${topping.unitLabel})`,
                              })
                            }
                            className="group-hover:scale-103"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImage({
                              url: topping.imageUrl || '',
                              title: topping.name,
                              subtitle: `${formatRupiah(topping.price)} (${topping.unitLabel})`,
                            })
                          }
                          className="absolute bottom-3 right-3 z-20 w-8 h-8 rounded-full bg-black/75 hover:bg-black/90 border border-[#FFD24C]/65 text-white flex items-center justify-center transition-colors cursor-pointer"
                          aria-label={`Perbesar foto ${topping.name}`}
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-[#FFD24C]" />
                        </button>
                      </div>

                      <div className="p-5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-[#D91B24] text-white">
                            Toping Favorit
                          </span>
                          <span className="text-[11px] font-bold text-[#B87300]">
                            Hangat &amp; Renyah
                          </span>
                        </div>

                        <h3 className="text-lg sm:text-xl font-bold font-serif-display text-[#064E3B] leading-snug break-words">
                          {topping.name}
                        </h3>

                        <div className="pt-1 text-[11px] text-[#3D3028] font-semibold leading-relaxed break-words">
                          Pelengkap nikmat untuk semua varian Nasi Kuning
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-4 bg-[#FDFBF7] border-t border-[#FFC72C]/35 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10.5px] font-bold text-[#3D3028] block">
                          {topping.unitLabel}
                        </span>
                        <span className="text-lg font-extrabold font-mono-tabular text-[#D91B24]">
                          +{formatRupiah(topping.price)}
                        </span>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleQuickAddTopping(topping)}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-[#D91B24] hover:bg-[#B8141C] text-white fx-2d-crimson font-extrabold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {cart.length > 0 ? '+ Tambah Bakwan' : 'Pesan + Bakwan'}
                        </span>
                      </motion.button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* =====================================================================
              4. QUICK ORDER HUB & JUM'AT BERKAH / PESANAN ACARA (HIGHLIGHTED)
             ===================================================================== */}
          <section className="relative py-16 sm:py-24 bg-[#FAF5E8] border-y border-[#FFC72C]/35">
            <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-8 sm:space-y-12">
              <QuickOrderHub
                menuItems={menuItems}
                onOrderTopItem={handleQuickOrderTopItem}
                onReorderLastOrder={handleReorderLastOrder}
                onBrowseMenu={handleBrowseCatalogMenu}
              />

              {/* Full-Width Prominent Pesan Acara & Jum'at Berkah Spotlight Banner */}
              <div
                id="pesan-acara-berkah"
                className="w-full editorial-plate-dark p-7 sm:p-10 lg:p-12 border-2 border-[#FFD24C]/75 shadow-[0_24px_60px_-15px_rgba(4,36,23,0.45)]"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
                  <div className="lg:col-span-7 space-y-5">
                    <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#FFD24C]/20 border border-[#FFD24C]/65 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#FFD24C]">
                      <HeartHandshake className="w-4 h-4 text-[#FFD24C] shrink-0" />
                      <span>✦ Pesanan Acara, Berkah &amp; Partai Besar ✦</span>
                    </div>

                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif-display text-white leading-[1.12]">
                      Pesan Acara &amp; Jum&apos;at Berkah
                    </h2>

                    <p className="text-sm sm:text-base text-[#FFFDF7] font-medium leading-relaxed max-w-2xl">
                      Melayani pesanan nasi kuning hangat dalam kemasan rapi dan higienis mulai{' '}
                      <strong className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-[#FFD24C] text-[#051F14] font-mono-tabular font-extrabold text-sm sm:text-base">
                        Rp 10.000 / porsi
                      </strong>{' '}
                      komplit atau dapat disesuaikan dengan anggaran acara &amp; sedekah Anda di Kota Pinrang.
                    </p>

                    <div className="pt-1">
                      <a
                        href={eventOrderWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto min-h-[54px] px-7 py-4 rounded-2xl bg-[#FFC72C] hover:bg-[#FFD24C] text-[#051F14] fx-2d-gold font-extrabold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 shadow-lg"
                      >
                        <Phone className="w-5 h-5 shrink-0" />
                        <span>Konsultasi Pesanan Acara &amp; Partai Besar via WA</span>
                        <ArrowUpRight className="w-5 h-5 shrink-0" />
                      </a>
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-3">
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#FFD24C] block">
                      Cocok Untuk Berbagai Kebutuhan Acara:
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        'Jum’at Berkah',
                        'Syukuran & Aqiqah',
                        'Pengajian & Arisan',
                        'Rapat Instansi',
                        'Ulang Tahun',
                        'Acara Keluarga',
                      ].map((ev) => (
                        <div
                          key={ev}
                          className="px-4 py-3.5 rounded-2xl bg-[#073B27] border border-[#FFD24C]/40 fx-2d-dark-chip text-white font-extrabold text-xs sm:text-sm flex items-center gap-2"
                        >
                          <Sparkles className="w-4 h-4 text-[#FFD24C] shrink-0" />
                          <span>{ev}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================================
              5. BENTO PHOTO GALLERY MOSAIC
             ===================================================================== */}
          <GallerySection onLightboxStateChange={setIsGalleryLightboxOpen} />

          {/* =====================================================================
              7. INTERACTIVE VIDEO TUTORIAL STAGE
             ===================================================================== */}
          <TutorialInlinePlayer
            storeConfig={storeConfig}
            menuItems={menuItems}
            onOpenTheaterModal={() => setIsTutorialOpen(true)}
          />

          {/* =====================================================================
              8. DELIVERY & OJOL HUB (GOFOOD, MAXIM & STORE COURIER)
             ===================================================================== */}
          <section
            id="ojol-hub"
            className="relative py-20 sm:py-28 bg-[#FDFBF7] border-t border-[#FFC72C]/35 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#B87300] block">
                    Layanan Pesan Antar Malam
                  </span>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif-display text-[#064E3B] leading-[1.1]">
                    Pesan via GoFood, Maxim &amp; Kurir Kedai
                  </h2>
                </div>
                <p className="text-xs sm:text-sm font-medium text-[#241C17] max-w-md leading-relaxed">
                  Salin titik penjemputan resmi kami dalam satu ketukan untuk aplikasi ojek online,
                  atau pilih layanan Kurir Area Kota Pinrang untuk pengantaran langsung ke rumah Anda.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
                {/* Left 5 Columns: Official Pickup Coordinate Card */}
                <div className="lg:col-span-5 editorial-plate-dark p-6 sm:p-8 flex flex-col justify-between gap-7">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-extrabold text-[#FFD24C]">
                      <span>Titik Penjemputan Resmi Ojol</span>
                      <MapPin className="w-5 h-5 text-[#FFD24C] fx-2d-svg-emblem shrink-0" />
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-medium text-white block">
                        Tempelkan koordinat ini pada aplikasi Gojek atau Maxim:
                      </span>
                      <div className="p-4 rounded-2xl bg-[#073B27] fx-2d-dark-chip font-mono-tabular text-sm sm:text-base font-extrabold text-[#FFD24C] break-words leading-relaxed">
                        {storeConfig.pickupCoordinatesText}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-white">
                      <div className="font-bold text-[#FFD24C]">Alamat Lapak:</div>
                      <p className="leading-relaxed font-medium">{storeConfig.locationAddress}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(storeConfig.pickupCoordinatesText, 'pickup-coord')
                    }
                    className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-[#FFC72C] hover:bg-[#FFD24C] text-[#051F14] fx-2d-gold font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copiedId === 'pickup-coord' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Titik Jemput Berhasil Disalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Titik Jemput Ojol</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Right 7 Columns: 3 Clean Rounded Delivery Cards */}
                <div className="lg:col-span-7 flex flex-col justify-between gap-4">
                  <div className="editorial-plate p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-md">
                      <GoFoodLogoBadge />
                      <h3 className="text-lg font-bold font-serif-display text-[#064E3B] pt-1">
                        GoFood &amp; GoSend Pinrang
                      </h3>
                      <p className="text-xs font-medium text-[#241C17] leading-relaxed">
                        Cari <strong className="text-[#064E3B] font-bold">{heroBrandHeading}</strong> di
                        aplikasi Gojek, atau pesan via WA lalu kirim driver GoSend.
                      </p>
                    </div>
                    <a
                      href={storeConfig.gofoodUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#084C32] hover:bg-[#063825] text-white fx-2d-forest font-extrabold text-xs inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <span>Buka GoFood</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#FFD24C]" />
                    </a>
                  </div>

                  <div className="editorial-plate p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-md">
                      <MaximLogoBadge />
                      <h3 className="text-lg font-bold font-serif-display text-[#064E3B] pt-1">
                        Maxim Delivery &amp; Food Pinrang
                      </h3>
                      <p className="text-xs font-medium text-[#241C17] leading-relaxed">
                        Tempel koordinat{' '}
                        <strong className="text-[#064E3B] font-bold">
                          {storeConfig.pickupCoordinatesText}
                        </strong>{' '}
                        pada kolom penjemputan Maxim untuk pengantaran cepat.
                      </p>
                    </div>
                    <a
                      href={storeConfig.maximUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#FFC72C] hover:bg-[#FFD24C] text-[#051F14] fx-2d-gold font-extrabold text-xs inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <span>Buka Maxim</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="editorial-plate p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 max-w-md">
                      <span className="text-xs font-extrabold text-[#B87300] block">
                        Layanan Antar Lokal · Kota Pinrang
                      </span>
                      <h3 className="text-lg font-bold font-serif-display text-[#064E3B]">
                        Kurir Area Kota Pinrang
                      </h3>
                      <p className="text-xs font-medium text-[#241C17] leading-relaxed">
                        Pesan langsung dari website ini dan pilih metode Kurir Area Kota Pinrang
                        untuk pengantaran hangat langsung ke alamat Anda.
                      </p>
                    </div>
                    <a
                      href={arrangeCourierWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#D91B24] hover:bg-[#B8141C] text-white fx-2d-crimson font-extrabold text-xs inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Pesan Antar via WA</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================================
              9. OFFICIAL QRIS & DIGITAL PAYMENT (NON-COD)
             ===================================================================== */}
          <section
            id="pembayaran-qris"
            className="relative py-20 sm:py-28 bg-[#FAF5E8] border-t border-[#FFC72C]/35 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#B87300] block">
                    Transaksi Non-Tunai Resmi (Non-COD)
                  </span>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif-display text-[#064E3B] leading-[1.1]">
                    Pembayaran QRIS, GoPay &amp; DANA
                  </h2>
                </div>
                <p className="text-xs sm:text-sm font-medium text-[#241C17] max-w-md leading-relaxed">
                  Scan kode QRIS GPN resmi kami dari aplikasi bank atau e-wallet mana pun, atau
                  transfer langsung ke nomor GoPay &amp; DANA resmi di bawah ini.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
                {/* Left 5 Columns: Official QRIS Card */}
                <div className="lg:col-span-5 editorial-plate p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <QrisLogo />
                      <h3 className="text-lg font-bold font-serif-display text-[#064E3B] pt-1">
                        {storeConfig.qrisMerchantName}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#084C32] text-[#FFD24C] fx-2d-icon-box flex items-center justify-center shrink-0">
                      <QrCode className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="relative aspect-[586/825] w-full max-w-[300px] mx-auto bg-white p-2.5 rounded-2xl border border-[#064E3B]/15 shadow-xs flex items-center justify-center">
                    <img
                      src={storeConfig.qrisImageUrl}
                      alt={`QRIS Resmi ${storeConfig.qrisMerchantName}`}
                      loading="eager"
                      decoding="async"
                      draggable={false}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={storeConfig.qrisImageUrl}
                      download="QRIS-Resmi-Nasi-Kuning-Lasinrang.jpg"
                      className="min-h-[42px] px-3 py-2.5 rounded-xl bg-[#FDFBF7] hover:bg-[#FAF5E8] text-[#064E3B] fx-2d-ivory text-xs font-extrabold flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>Unduh QRIS</span>
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxImage({
                          url: storeConfig.qrisImageUrl,
                          title: `QRIS Resmi — ${storeConfig.qrisMerchantName}`,
                          subtitle: `NMID: ${storeConfig.qrisNmid} (${storeConfig.qrisTerminalId}) · Dicetak oleh: ${storeConfig.qrisPrintedBy} (${storeConfig.qrisVersion})`,
                          isQris: true,
                        })
                      }
                      className="min-h-[42px] px-3 py-2.5 rounded-xl bg-[#084C32] hover:bg-[#063825] text-white fx-2d-forest text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-[#FFD24C] shrink-0" />
                      <span>Perbesar QRIS</span>
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#FDFBF7] fx-2d-ivory text-xs font-mono-tabular text-[#3D3028] space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-bold">NMID</span>
                      <span className="font-extrabold text-[#064E3B]">
                        {storeConfig.qrisNmid} ({storeConfig.qrisTerminalId})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right 7 Columns: GoPay, DANA & Policy Cards */}
                <div className="lg:col-span-7 flex flex-col justify-between gap-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* GoPay Card */}
                    <div className="editorial-plate p-6 flex flex-col justify-between space-y-5">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <GopayLogoIcon className="w-10 h-10 shrink-0" />
                          <div>
                            <div className="text-base font-bold text-[#064E3B]">GoPay Resmi</div>
                            <div className="text-xs font-semibold text-[#3D3028]">Transfer 11 Digit</div>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#FFC72C]/35">
                          <div className="text-xs font-semibold text-[#3D3028]">Nomor Tujuan GoPay</div>
                          <div className="text-2xl font-extrabold font-mono-tabular text-[#064E3B] tracking-tight mt-0.5">
                            {storeConfig.ewalletNumber}
                          </div>
                          <div className="text-xs font-medium text-[#241C17] font-mono-tabular mt-0.5">
                            {storeConfig.ewalletDisplay}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <button
                          type="button"
                          onClick={() => handleOpenWalletApp('gopay')}
                          className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-[#084C32] hover:bg-[#063825] text-white fx-2d-forest font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <GopayLogoInline className="w-4 h-4 shrink-0" />
                          <span>Buka Aplikasi GoPay</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-[#FFD24C]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText(storeConfig.ewalletNumber, 'copy-gopay')}
                          className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-[#FDFBF7] hover:bg-[#FAF5E8] text-[#064E3B] fx-2d-ivory text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {copiedId === 'copy-gopay' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Nomor GoPay Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#B87300]" />
                              <span>Salin {storeConfig.ewalletNumber}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* DANA Card */}
                    <div className="editorial-plate p-6 flex flex-col justify-between space-y-5">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <DanaLogoIcon className="w-10 h-10 shrink-0" />
                          <div>
                            <div className="text-base font-bold text-[#064E3B]">DANA Resmi</div>
                            <div className="text-xs font-bold text-[#0B76C4]">Transfer 11 Digit</div>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#FFC72C]/35">
                          <div className="text-xs font-semibold text-[#3D3028]">Nomor Tujuan DANA</div>
                          <div className="text-2xl font-extrabold font-mono-tabular text-[#064E3B] tracking-tight mt-0.5">
                            {storeConfig.ewalletNumber}
                          </div>
                          <div className="text-xs font-medium text-[#241C17] font-mono-tabular mt-0.5">
                            {storeConfig.ewalletDisplay}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <button
                          type="button"
                          onClick={() => handleOpenWalletApp('dana')}
                          className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-[#108EE9] hover:bg-[#0D79C7] text-white fx-2d-blue font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <DanaLogoInline className="w-4 h-4 shrink-0" />
                          <span>Buka Aplikasi DANA</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText(storeConfig.ewalletNumber, 'copy-dana')}
                          className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-[#FDFBF7] hover:bg-[#FAF5E8] text-[#064E3B] fx-2d-ivory text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {copiedId === 'copy-dana' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Nomor DANA Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#B87300]" />
                              <span>Salin {storeConfig.ewalletNumber}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {deepLinkNotice && (
                    <div className="p-4 rounded-2xl bg-[#084C32] text-white text-xs font-semibold">
                      Membuka aplikasi {deepLinkNotice === 'dana' ? 'DANA' : 'GoPay'}... Nomor{' '}
                      <strong className="text-[#FFD24C] font-mono-tabular">
                        {storeConfig.ewalletNumber}
                      </strong>{' '}
                      telah disalin otomatis ke clipboard perangkat Anda.
                    </div>
                  )}

                  <div className="editorial-plate p-6 flex flex-col sm:flex-row items-start gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#084C32] text-[#FFD24C] fx-2d-icon-box flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 text-xs leading-relaxed">
                      <h4 className="text-base font-bold font-serif-display text-[#064E3B]">
                        Lampirkan Bukti Bayar Langsung Saat Checkout
                      </h4>
                      <p className="font-medium text-[#241C17]">
                        Kedai melayani pembayaran non-tunai via{' '}
                        <strong className="text-[#064E3B] font-bold">QRIS GPN, GoPay, atau DANA</strong>{' '}
                        (Non-COD). Anda dapat mengunggah foto bukti transfer langsung di halaman
                        checkout agar terkirim rapi bersama rincian pesanan ke WhatsApp{' '}
                        <span className="font-mono-tabular font-extrabold text-[#064E3B]">
                          {storeConfig.whatsappDisplay}
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================================
              10. LOCATION & 3D SATELLITE NAVIGATION
             ===================================================================== */}
          <section
            id="lokasi-kedai"
            className="relative py-20 sm:py-28 bg-[#FDFBF7] border-t border-[#FFC72C]/35 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#B87300] block">
                    Lokasi Lapak &amp; Navigasi 3D
                  </span>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif-display text-[#064E3B] leading-[1.1]">
                    Depan Patung Lasinrang, Pinrang
                  </h2>
                </div>
                <div className="text-xs sm:text-sm space-y-0.5">
                  <div className="font-extrabold text-[#064E3B]">{storeConfig.locationAddress}</div>
                  <div className="font-semibold text-[#B87300]">{storeConfig.operatingHours}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
                <div className="lg:col-span-6 editorial-plate p-5 sm:p-6">
                  <GoogleMapsAnimatedVideoPlayer
                    storeConfig={storeConfig}
                    onOpenFullscreenModal={() => setIsLocationTourModalOpen(true)}
                  />
                </div>

                <div className="lg:col-span-6 editorial-plate p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-[#B87300] block">
                        Peta Lokasi Resmi
                      </span>
                      <h3 className="text-xl font-bold font-serif-display text-[#064E3B]">
                        Titik Lapak Jl. Jenderal Sudirman
                      </h3>
                    </div>
                    <MapPin className="w-6 h-6 text-[#D91B24] fx-2d-svg-emblem shrink-0" />
                  </div>

                  <StoreLocationMap
                    storeConfig={storeConfig}
                    heightClassName="h-[310px] sm:h-[380px]"
                  />

                  <a
                    href={`https://wa.me/${normalizedStoreWa}?text=${encodeURIComponent(
                      'Halo Admin Nasi Kuning Lasinrang, saya ingin memesan / menanyakan lokasi kedai.'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[46px] py-3 px-6 rounded-xl bg-[#084C32] hover:bg-[#063825] text-white fx-2d-forest font-extrabold text-xs flex items-center justify-center gap-2 text-center cursor-pointer"
                  >
                    <Phone className="w-4 h-4 shrink-0 text-[#FFD24C]" />
                    <span>Hubungi WhatsApp Resmi ({storeConfig.whatsappDisplay})</span>
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* =====================================================================
            MODERN HOSPITALITY FOOTER
           ===================================================================== */}
        <footer
          className={`relative z-10 bg-forest-architectural border-t border-[#FFD24C]/40 overflow-hidden ${
            totalCartPortions > 0 && !isCheckoutOpen ? 'pb-36 sm:pb-16' : 'pb-24 sm:pb-14'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-14 sm:pt-16 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-10 border-b border-white/15">
              <div className="lg:col-span-4 space-y-3.5">
                <div className="flex items-center gap-3.5">
                  <img
                    src={OFFICIAL_LOGO_URL}
                    alt="Logo Nasi Kuning Lasinrang"
                    loading="eager"
                    decoding="async"
                    draggable={false}
                    className="w-11 h-11 rounded-full object-contain shrink-0 bg-white ring-2 ring-[#FFD24C]"
                  />
                  <div>
                    <div className="text-xl font-bold font-serif-display text-white">
                      {storeConfig.brandName}
                    </div>
                    <div className="text-xs text-[#FFD24C] font-serif-display italic font-semibold">
                      “{storeConfig.tagline}”
                    </div>
                  </div>
                </div>
                <p className="text-xs text-white font-medium leading-relaxed">
                  Warisan cita rasa nasi kuning rempah santan kunyit asli dan kurasi lauk khas Bugis
                  di jantung Kota Pinrang, Sulawesi Selatan.
                </p>
              </div>

              <div className="lg:col-span-3 space-y-2.5">
                <div className="text-xs font-extrabold text-[#FFD24C]">Navigasi Menu</div>
                <ul className="space-y-2 text-xs font-medium text-white">
                  <li>
                    <a href="#unggulan" className="hover:text-[#FFD24C] transition-colors">
                      Hidangan Spesial &amp; Baru
                    </a>
                  </li>
                  <li>
                    <a href="#katalog-menu" className="hover:text-[#FFD24C] transition-colors">
                      Katalog Lengkap ({displayMenuCount} Menu)
                    </a>
                  </li>
                  <li>
                    <a href="#ojol-hub" className="hover:text-[#FFD24C] transition-colors">
                      Layanan GoFood &amp; Maxim
                    </a>
                  </li>
                  <li>
                    <a href="#galeri-suasana" className="hover:text-[#FFD24C] transition-colors">
                      Galeri Suasana Malam
                    </a>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-2 space-y-2.5">
                <div className="text-xs font-extrabold text-[#FFD24C]">Panduan Interaktif</div>
                <div className="flex flex-col items-start gap-2 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setIsTutorialOpen(true)}
                    className="inline-flex items-center gap-1.5 text-white hover:text-[#FFD24C] cursor-pointer transition-colors text-left"
                  >
                    <PlayCircle className="w-3.5 h-3.5 text-[#FFD24C] shrink-0" />
                    <span>Video Panduan Pesan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLocationTourModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-white hover:text-[#FFD24C] cursor-pointer transition-colors text-left"
                  >
                    <Compass className="w-3.5 h-3.5 text-[#FFD24C] shrink-0" />
                    <span>Tur Satelit 3D Lapak</span>
                  </button>
                  <a
                    href="#pembayaran-qris"
                    className="text-white hover:text-[#FFD24C] transition-colors"
                  >
                    QRIS Resmi &amp; E-Wallet
                  </a>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-2.5 text-xs">
                <div className="text-xs font-extrabold text-[#FFD24C]">Lokasi &amp; Kontak</div>
                <p className="text-white font-medium leading-relaxed">{storeConfig.locationAddress}</p>
                <div className="text-[#FFD24C] font-bold">{storeConfig.operatingHours}</div>
                <div className="pt-1 space-y-1 font-mono-tabular text-[11.5px] font-semibold text-white">
                  <div>WA: {storeConfig.whatsappDisplay}</div>
                  <div>GoPay / DANA: {storeConfig.ewalletNumber}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-[#FFF3C4]">
              <span>
                © {new Date().getFullYear()} {storeConfig.brandName} · Pinrang, Sulawesi Selatan
              </span>
              <button
                type="button"
                onClick={handleOwnerSecretClick}
                className="text-[11px] font-normal text-white/30 hover:text-[#FFD24C] transition-colors cursor-pointer select-none bg-transparent border-0 px-2 py-1"
              >
                Owner
              </button>
            </div>
          </div>
        </footer>

        {/* =====================================================================
            ADD-TO-CART TOAST FEEDBACK (ROUNDED PILL)
           ===================================================================== */}
        <AnimatePresence>
          {addedToast && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.18, ease: EASE_SMOOTH }}
              className="fixed bottom-32 sm:bottom-20 inset-x-3 sm:inset-x-auto sm:right-6 z-40 sm:max-w-sm rounded-2xl bg-[#12291D] text-[#F7F3E9] px-4 py-3.5 shadow-2xl border border-[#D9A52E]/40 flex items-center justify-between gap-3"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Check className="w-4 h-4 text-[#D9A52E] shrink-0" />
                <div className="text-xs leading-snug min-w-0">
                  <span className="font-semibold text-[11px] text-[#E8C56E] block">
                    Ditambahkan ke Keranjang
                  </span>
                  <span className="text-white font-bold break-words block">{addedToast}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddedToast(null);
                  setIsCheckoutOpen(true);
                }}
                className="text-xs font-bold text-[#E8C56E] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Buka →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* =====================================================================
            FLOATING MODERN ROUNDED CART DOCK (ABOVE MOBILE BOTTOM APP BAR)
           ===================================================================== */}
        <AnimatePresence>
          {totalCartPortions > 0 && !isCheckoutOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.18, ease: EASE_SMOOTH }}
              className="fixed bottom-16 sm:bottom-5 inset-x-2.5 sm:inset-x-4 z-30 max-w-xl mx-auto pb-[env(safe-area-inset-bottom,0px)]"
            >
              <div className="w-full p-2 rounded-2xl bg-[#12291D]/95 backdrop-blur-xl text-[#F7F3E9] border border-[#D9A52E]/40 shadow-[0_20px_50px_-12px_rgba(16,38,27,0.55)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(true)}
                  className="flex-1 min-w-0 py-1.5 px-2.5 sm:px-3 rounded-xl hover:bg-white/5 flex items-center justify-between gap-2 sm:gap-3 font-bold text-xs sm:text-sm cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#D9A52E]/20 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4 text-[#E8C56E]" />
                    </div>
                    <div className="text-left min-w-0">
                      <span className="block text-white font-bold leading-tight">
                        {totalCartPortions} Porsi
                      </span>
                      <span className="block text-[10px] sm:text-[11px] font-normal text-[#F7F3E9]/75 leading-tight">
                        Lanjut pesan
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-tabular font-bold text-xs sm:text-base text-[#E8C56E]">
                      {formatRupiah(totalCartSubtotal)}
                    </span>
                    <span className="text-[11px] sm:text-xs rounded-xl bg-[#A83A2D] text-white px-3 py-2 font-bold whitespace-nowrap shadow-xs">
                      Checkout →
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setAddedToast(null);
                  }}
                  aria-label="Batalkan Pesanan"
                  title="Kosongkan keranjang"
                  className="px-2.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#F7F3E9] text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* =====================================================================
            NATIVE-LIKE MOBILE BOTTOM APP BAR (PWA NAVIGATION)
           ===================================================================== */}
        <MobileBottomAppBar
          totalCartPortions={totalCartPortions}
          onOpenCart={() => setIsCheckoutOpen(true)}
          brandName={heroBrandHeading}
          logoUrl={OFFICIAL_LOGO_URL}
          menuCount={displayMenuCount}
        />
      </div>
      )}

      {/* =====================================================================
          GLOBAL FULLSCREEN OVERLAYS & ZOOM LIGHTBOX (Available across pages)
         ===================================================================== */}
      <TutorialVideoModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        storeConfig={storeConfig}
        menuItems={menuItems}
        onStartOrdering={() => {
          setIsCheckoutOpen(false);
          setSelectedMenuForPortion(null);
          setIsOwnerPanelOpen(false);
          setIsOwnerPinModalOpen(false);
          requestAnimationFrame(() => {
            const el = document.getElementById('katalog-menu');
            el?.scrollIntoView({ behavior: 'smooth' });
          });
        }}
      />

      <LocationVideoTourModal
        isOpen={isLocationTourModalOpen}
        onClose={() => setIsLocationTourModalOpen(false)}
        storeConfig={storeConfig}
      />

      {/* Tap-to-Zoom Image & Official QRIS Lightbox (Portaled directly to document.body) */}
      {typeof document !== 'undefined' &&
        lightboxImage &&
        createPortal(
          <div
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-[10010] w-screen h-[100dvh] bg-[#12241A]/92 flex items-center justify-center p-3 sm:p-4 overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-2xl w-full max-h-[90dvh] flex flex-col overflow-hidden bg-[#F7F3E9] border border-[#30251F]/15 rounded-2xl shadow-2xl"
            >
              <div className="px-5 py-3.5 bg-white border-b border-[#30251F]/10 flex items-center justify-between gap-4 shrink-0">
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-[#193D2B] font-serif-display truncate">
                    {lightboxImage.title}
                  </h4>
                  <p className="text-xs text-[#6E5D53] font-mono-tabular truncate">
                    {lightboxImage.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="w-9 h-9 rounded-full bg-[#EFE9DC] hover:bg-[#E5DEC9] text-[#193D2B] flex items-center justify-center border border-[#30251F]/12 cursor-pointer shrink-0 transition-colors"
                  aria-label="Tutup Zoom"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 sm:p-4 flex flex-col items-center justify-center bg-[#EFE9DC] flex-1 min-h-0 overflow-hidden gap-3">
                <div
                  className={
                    lightboxImage.isQris
                      ? 'w-full max-w-md h-[62dvh] sm:h-[66dvh] rounded-2xl overflow-hidden bg-white border border-[#30251F]/15 shadow-lg'
                      : 'w-full h-[62dvh] sm:h-[68dvh] rounded-xl overflow-hidden bg-[#083B28] border border-[#D9A52E]/45 shadow-lg'
                  }
                >
                  <ZoomableImageViewer
                    key={lightboxImage.url}
                    src={lightboxImage.url}
                    alt={lightboxImage.title}
                    stageBgClassName={lightboxImage.isQris ? 'bg-white' : 'bg-[#083B28]'}
                    imgClassName={
                      lightboxImage.isQris
                        ? 'max-w-full max-h-full object-contain bg-white p-2'
                        : 'max-w-full max-h-full object-contain'
                    }
                  />
                </div>
                {lightboxImage.isQris && (
                  <a
                    href={lightboxImage.url}
                    download="QRIS-Resmi-Nasi-Kuning-Lasinrang.jpg"
                    className="btn-3d-bernyawa-crimson min-h-[42px] px-5 py-2.5 font-bold text-xs flex items-center gap-2 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Simpan / Unduh Gambar QRIS ke Galeri HP</span>
                  </a>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </MotionConfig>
  );
}
