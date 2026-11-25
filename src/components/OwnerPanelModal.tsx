import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowLeft,
  MessageSquare,
  Settings,
  Copy,
  Check,
  Send,
  RotateCcw,
  Upload,
  Sparkles,
  Store,
  Utensils,
  QrCode,
  Lock,
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  MapPin,
  SlidersHorizontal,
  Cloud,
  Image as ImageIcon,
  ExternalLink,
  Download,
  ShieldCheck,
  ShieldAlert,
  Database,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  MenuItem,
  OrderRecord,
  OrderStatus,
  StoreConfig,
} from '../types';
import {
  DEFAULT_EXTRA_SIDE_OPTIONS,
  DEFAULT_PORTION_PRESETS,
  DEFAULT_SAMBAL_OPTIONS,
  INITIAL_MENU_ITEMS,
  formatRupiah,
  HERO_IMAGE_URL,
} from '../data/initialData';
import { QrPrintGeneratorWidget } from './QrPrintGeneratorWidget';
import { FoodImage } from './FoodImage';
import { StoreLocationMap } from './StoreLocationMap';
import { ZoomableImageViewer } from './ZoomableImageViewer';
import { FirebaseVaultPanel } from './FirebaseVaultPanel';
import { compressImageFileToDataUrl } from '../utils/imageHelper';
import {
  buildCustomerWaMeUrl,
  getCartItemSubtotal,
  getFulfillmentLabel,
  getRiceTypeLabel,
  getSambalPlainText,
  toIndonesianWaDigits,
} from '../utils/checkoutOrder';
import { QuickReplyDraft, STORAGE_KEYS } from '../utils/ownerPersistence';
import { buildCopyableMenuListText } from '../utils/menuListFormatter';
import { safeCopyToClipboard } from '../utils/safeBrowser';
import { auth, formatFirebaseAuthError } from '../firebase';
import type {
  FirebaseVaultAuditReport,
  FullFirebaseMigrationResult,
  MigrationProgressEvent,
  OwnerAuditLogEntry,
  OwnerPrivateSettingsData,
} from '../services/firestoreService';

export interface CloudSyncStatusInfo {
  status: 'idle' | 'saving' | 'saved' | 'server-only' | 'error' | 'local-only';
  hasPendingChanges: boolean;
  lastSavedAt?: number;
  errorMessage?: string;
  serverSynced?: boolean;
  cloudSynced?: boolean;
}

interface OwnerPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeConfig: StoreConfig;
  onUpdateStoreConfig: (
    updater: StoreConfig | ((prev: StoreConfig) => StoreConfig),
    options?: { immediate?: boolean }
  ) => void;
  menuItems: MenuItem[];
  onUpdateMenuItems: (
    updater: MenuItem[] | ((prev: MenuItem[]) => MenuItem[]),
    options?: { immediate?: boolean }
  ) => void;
  orders: OrderRecord[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onDeleteOrder: (orderId: string) => void;
  onClearOrders: () => void;
  onResetDefaults: () => void;
  currentCartSubtotal: number;
  onLockOwner?: () => void;
  currentUser: FirebaseUser | null;
  isAdminCloudVerified: boolean;
  onSignInGoogle: () => Promise<void>;
  onSignOutGoogle?: () => Promise<void>;
  onForceCloudSync?: () => Promise<boolean>;
  onMigrateAllToFirebase?: (
    onProgress?: (ev: MigrationProgressEvent) => void
  ) => Promise<FullFirebaseMigrationResult>;
  onPullFromFirebase?: () => Promise<{
    ok: boolean;
    storeLoaded: boolean;
    menuCount: number;
  }>;
  onInspectFirebaseVault?: () => Promise<FirebaseVaultAuditReport>;
  onSaveOwnerPrivateSettings?: (patch: {
    quickReplyDraft?: QuickReplyDraft;
    qrCustomUrl?: string;
  }) => Promise<void>;
  ownerPrivateSettings?: OwnerPrivateSettingsData | null;
  ownerAuditLogs?: OwnerAuditLogEntry[];
  cloudSyncStatus?: CloudSyncStatusInfo;
}

interface MenuFormState {
  name: string;
  category: 'reguler' | 'spesial';
  basePrice: number;
  spiceLevel: string;
  signatureTag: string;
  description: string;
  sidesText: string;
  imageUrl: string;
}

const EMPTY_MENU_FORM: MenuFormState = {
  name: '',
  category: 'reguler',
  basePrice: 10000,
  spiceLevel: 'Gurih Rempah Harum',
  signatureTag: 'Menu Baru · Komplit',
  description: '',
  sidesText: 'Nasi Kuning Harum, Tempe Manis Gurih, Mie Goreng Kecap, Kerupuk Renyah',
  imageUrl: HERO_IMAGE_URL,
};

export const OwnerPanelModal: React.FC<OwnerPanelModalProps> = ({
  isOpen,
  onClose,
  storeConfig,
  onUpdateStoreConfig,
  menuItems,
  onUpdateMenuItems,
  orders,
  onUpdateOrderStatus,
  onDeleteOrder,
  onClearOrders,
  onResetDefaults,
  currentCartSubtotal,
  onLockOwner,
  currentUser,
  isAdminCloudVerified,
  onSignInGoogle,
  onSignOutGoogle,
  onForceCloudSync,
  onMigrateAllToFirebase,
  onPullFromFirebase,
  onInspectFirebaseVault,
  onSaveOwnerPrivateSettings,
  ownerPrivateSettings,
  ownerAuditLogs = [],
  cloudSyncStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'quick-reply' | 'settings' | 'vault'>('orders');
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [previewProofOrder, setPreviewProofOrder] = useState<{
    url: string;
    customerName: string;
  } | null>(null);

  // Persistent Admin Quick Reply Generator State
  const initialReplyDraft = ((): QuickReplyDraft => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.QUICK_REPLY_DRAFT);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<QuickReplyDraft>;
        return {
          customerName: parsed.customerName ?? 'Kak Pelanggan',
          customerWa: parsed.customerWa ?? '',
          foodSubtotal:
            typeof parsed.foodSubtotal === 'number'
              ? parsed.foodSubtotal
              : currentCartSubtotal > 0
              ? currentCartSubtotal
              : 25000,
          extraSideFee: typeof parsed.extraSideFee === 'number' ? parsed.extraSideFee : 0,
          shippingFee: typeof parsed.shippingFee === 'number' ? parsed.shippingFee : 7000,
        };
      }
    } catch {
      // ignore
    }
    return {
      customerName: 'Kak Pelanggan',
      customerWa: '',
      foodSubtotal: currentCartSubtotal > 0 ? currentCartSubtotal : 25000,
      extraSideFee: 0,
      shippingFee: 7000,
    };
  })();

  const [customerName, setCustomerName] = useState<string>(initialReplyDraft.customerName);
  const [customerWa, setCustomerWa] = useState<string>(initialReplyDraft.customerWa);
  const [foodSubtotal, setFoodSubtotal] = useState<number>(initialReplyDraft.foodSubtotal);
  const [extraSideFee, setExtraSideFee] = useState<number>(initialReplyDraft.extraSideFee);
  const [shippingFee, setShippingFee] = useState<number>(initialReplyDraft.shippingFee);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const hasHydratedCloudDraftRef = useRef(false);
  const skipNextPrivateDraftSyncRef = useRef(true);

  // Hydrate quick reply draft from Firebase private admin settings when available
  useEffect(() => {
    const cloudDraft = ownerPrivateSettings?.quickReplyDraft;
    if (!cloudDraft || hasHydratedCloudDraftRef.current) return;
    hasHydratedCloudDraftRef.current = true;
    skipNextPrivateDraftSyncRef.current = true;
    setCustomerName(cloudDraft.customerName ?? 'Kak Pelanggan');
    setCustomerWa(cloudDraft.customerWa ?? '');
    setFoodSubtotal(typeof cloudDraft.foodSubtotal === 'number' ? cloudDraft.foodSubtotal : 25000);
    setExtraSideFee(typeof cloudDraft.extraSideFee === 'number' ? cloudDraft.extraSideFee : 0);
    setShippingFee(typeof cloudDraft.shippingFee === 'number' ? cloudDraft.shippingFee : 7000);
  }, [ownerPrivateSettings]);

  useEffect(() => {
    const payload: QuickReplyDraft = {
      customerName,
      customerWa,
      foodSubtotal,
      extraSideFee,
      shippingFee,
    };
    try {
      localStorage.setItem(STORAGE_KEYS.QUICK_REPLY_DRAFT, JSON.stringify(payload));
    } catch {
      // ignore
    }

    if (skipNextPrivateDraftSyncRef.current) {
      skipNextPrivateDraftSyncRef.current = false;
      return;
    }
    if (!isAdminCloudVerified || !onSaveOwnerPrivateSettings) return;

    const timer = window.setTimeout(() => {
      void onSaveOwnerPrivateSettings({ quickReplyDraft: payload });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    customerName,
    customerWa,
    foodSubtotal,
    extraSideFee,
    shippingFee,
    isAdminCloudVerified,
    onSaveOwnerPrivateSettings,
  ]);

  // Full Menu CRUD States
  const [isAddingMenu, setIsAddingMenu] = useState<boolean>(false);
  const [newMenuForm, setNewMenuForm] = useState<MenuFormState>(EMPTY_MENU_FORM);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [editMenuForm, setEditMenuForm] = useState<MenuFormState>(EMPTY_MENU_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmResetDefaultsOpen, setConfirmResetDefaultsOpen] = useState<boolean>(false);
  const [resetConfirmPhrase, setResetConfirmPhrase] = useState<string>('');
  const [confirmClearOrdersOpen, setConfirmClearOrdersOpen] = useState<boolean>(false);

  // Extra side dish chip input
  const [newSideChipInput, setNewSideChipInput] = useState<string>('');
  const [showCopyMenuPreview, setShowCopyMenuPreview] = useState<boolean>(false);

  const portionPresets = storeConfig.portionPresets || DEFAULT_PORTION_PRESETS;
  const extraSideOptions = Array.isArray(storeConfig.extraSideOptions)
    ? storeConfig.extraSideOptions
    : DEFAULT_EXTRA_SIDE_OPTIONS;
  const sambalOptions = storeConfig.sambalOptions || DEFAULT_SAMBAL_OPTIONS;

  const handleCloseAndFlush = () => {
    if (onForceCloudSync) {
      void onForceCloudSync();
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen || !previewProofOrder) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewProofOrder(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, previewProofOrder]);

  const finalTotal =
    (Number(foodSubtotal) || 0) + (Number(extraSideFee) || 0) + (Number(shippingFee) || 0);

  const templates = [
    {
      id: 'tpl-total',
      badge: 'Template 1 · Konfirmasi Total Akhir & Pembayaran',
      title: 'Rincian Total + Ongkir + GoPay/DANA Resmi',
      content: [
        `Halo *${customerName.trim() || 'Kak'}* 🙏✨`,
        `Terima kasih telah memesan di *${storeConfig.brandName}* _(Depan Patung Lasinrang Pinrang)_.`,
        ``,
        `Berikut rincian total akhir pesanan Kakak:`,
        `• Subtotal Makanan: *${formatRupiah(foodSubtotal)}*`,
        extraSideFee > 0
          ? `• Tambahan Lauk Ekstra: *${formatRupiah(extraSideFee)}*`
          : `• Tambahan Lauk Ekstra: Rp 0`,
        `• Ongkir Sesuai Jarak: *${formatRupiah(shippingFee)}*`,
        `------------------------------------------`,
        `💰 *TOTAL AKHIR: ${formatRupiah(finalTotal)}*`,
        `------------------------------------------`,
        ``,
        `💳 *Pembayaran Langsung Resmi (Tidak Melayani COD):*`,
        `1️⃣ *GoPay / DANA:* \`${storeConfig.ewalletNumber}\` (${storeConfig.ewalletDisplay})`,
        `2️⃣ *QRIS Resmi:* ${storeConfig.qrisMerchantName} (NMID: ${storeConfig.qrisNmid})`,
        ``,
        `Mohon lakukan pembayaran langsung & konfirmasinya ya Kak agar pesanan segera kami siapkan hangat-hangat! 🍛🔥`,
      ].join('\n'),
    },
    {
      id: 'tpl-cooking',
      badge: 'Template 2 · Status Sedang Dimasak / Disiapkan',
      title: 'Pesanan Sedang Diracik Hangat',
      content: [
        `Halo *${customerName.trim() || 'Kak'}* 🍛🔥`,
        `Pesanan Nasi Kuning Lasinrang Kakak sebesar *${formatRupiah(
          finalTotal
        )}* saat ini *SEDANG DISIAPKAN / DIRACIK HANGAT* di kedai kami depan Patung Lasinrang.`,
        ``,
        `Sambal dan seluruh lauk komplit (Tempe, Mie Goreng, Kerupuk) sudah kami pastikan sesuai request Kakak.`,
        `Mohon ditunggu sebentar ya Kak, segera kami kabari begitu kurir berangkat! 🙏✨`,
      ].join('\n'),
    },
    {
      id: 'tpl-courier',
      badge: 'Template 3 · Status Kurir Menuju Lokasi',
      title: 'Kurir Sedang Dalam Perjalanan',
      content: [
        `Halo *${customerName.trim() || 'Kak'}* 🛵💨`,
        `Kabar gembira! Pesanan *${storeConfig.brandName}* Kakak sudah selesai dibungkus hangat dan *KURIR SEDANG MENUJU LOKASI KAKAK* sekarang.`,
        ``,
        `• Total Tagihan: *${formatRupiah(finalTotal)}*`,
        `• Info Transfer GoPay/DANA: \`${storeConfig.ewalletNumber}\` (jika belum transfer)`,
        ``,
        `Mohon pastikan nomor HP aktif ya Kak. Selamat menikmati & Malunra Tongeng! 🌟🍛`,
      ].join('\n'),
    },
  ];

  const triggerSaveFeedback = (msg: string) => {
    setSaveBanner(msg);
    setTimeout(() => setSaveBanner(null), 2600);
  };

  const handleCopyText = (text: string, id: string) => {
    void safeCopyToClipboard(text);
    setCopiedTemplateId(id);
    setTimeout(() => setCopiedTemplateId(null), 2000);
  };

  const handleLoadOrderIntoReply = (order: OrderRecord) => {
    setCustomerName(order.customerName);
    setCustomerWa(order.customerPhone);
    setFoodSubtotal(order.foodSubtotal);
    setShippingFee(order.fulfillment === 'pickup' ? 0 : 7000);
    setActiveTab('quick-reply');
    triggerSaveFeedback(`Data pesanan ${order.customerName} dimuat ke Kalkulator WA!`);
  };

  const handleMenuPriceChange = (id: string, newPrice: number) => {
    onUpdateMenuItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, basePrice: Math.max(1000, newPrice || 1000) } : item
      )
    );
  };

  const handleMenuAvailabilityToggle = (id: string) => {
    onUpdateMenuItems(
      (prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, isAvailable: !item.isAvailable } : item
        ),
      { immediate: true }
    );
    triggerSaveFeedback('Status stok menu disimpan permanen!');
  };

  const handleMenuImageChange = (id: string, newUrl: string) => {
    onUpdateMenuItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, imageUrl: newUrl } : item))
    );
  };

  const handlePhotoUploadForForm = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<MenuFormState>>,
    immediateItemId?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFileToDataUrl(file, 820, 0.80, 240000);
      setter((prev) => ({ ...prev, imageUrl: compressedDataUrl }));
      if (immediateItemId) {
        onUpdateMenuItems(
          (prev) =>
            prev.map((item) =>
              item.id === immediateItemId ? { ...item, imageUrl: compressedDataUrl } : item
            ),
          { immediate: true }
        );
      }
      triggerSaveFeedback(
        isAdminCloudVerified
          ? 'Foto menu HD terkompres & dikunci permanen ke Cloud Firestore + Server + Perangkat!'
          : 'Foto menu HD tersimpan ke Server & Perangkat! Tautkan Google Owner agar terkunci selamanya di Cloud.'
      );
    } catch {
      triggerSaveFeedback('Gagal memproses file foto. Pastikan file berupa gambar JPG/PNG/WebP.');
    } finally {
      e.target.value = '';
    }
  };

  const handleAddNewMenuSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuForm.name.trim()) return;
    const slug = newMenuForm.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const created: MenuItem = {
      id: `menu-${slug || 'baru'}-${Date.now()}`,
      name: newMenuForm.name.trim(),
      category: newMenuForm.category,
      basePrice: Math.max(1000, Number(newMenuForm.basePrice) || 10000),
      spiceLevel: newMenuForm.spiceLevel.trim() || 'Gurih Rempah Harum',
      signatureTag: newMenuForm.signatureTag.trim() || 'Menu Baru · Komplit',
      description:
        newMenuForm.description.trim() ||
        'Sajian Nasi Kuning hangat khas Lasinrang lengkap dengan lauk pendamping dan kerupuk renyah.',
      sidesIncluded: newMenuForm.sidesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      imageUrl: newMenuForm.imageUrl.trim() || HERO_IMAGE_URL,
      isAvailable: true,
    };
    onUpdateMenuItems((prev) => [...prev, created], { immediate: true });
    setNewMenuForm(EMPTY_MENU_FORM);
    setIsAddingMenu(false);
    triggerSaveFeedback(`Menu "${created.name}" disimpan permanen & tampil otomatis di seluruh website!`);
  };

  const startEditingMenu = (item: MenuItem) => {
    setEditingMenuId(item.id);
    setEditMenuForm({
      name: item.name,
      category: item.category,
      basePrice: item.basePrice,
      spiceLevel: item.spiceLevel,
      signatureTag: item.signatureTag || '',
      description: item.description,
      sidesText: item.sidesIncluded.join(', '),
      imageUrl: item.imageUrl,
    });
  };

  const handleSaveEditMenu = (id: string) => {
    if (!editMenuForm.name.trim()) return;
    onUpdateMenuItems(
      (prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                name: editMenuForm.name.trim(),
                category: editMenuForm.category,
                basePrice: Math.max(1000, Number(editMenuForm.basePrice) || item.basePrice),
                spiceLevel: editMenuForm.spiceLevel.trim() || item.spiceLevel,
                signatureTag: editMenuForm.signatureTag.trim() || item.signatureTag,
                description: editMenuForm.description.trim() || item.description,
                sidesIncluded: editMenuForm.sidesText
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                imageUrl: editMenuForm.imageUrl.trim() || item.imageUrl,
              }
            : item
        ),
      { immediate: true }
    );
    setEditingMenuId(null);
    triggerSaveFeedback('Detail menu disimpan permanen!');
  };

  const handleDeleteMenu = (id: string) => {
    onUpdateMenuItems((prev) => prev.filter((item) => item.id !== id), { immediate: true });
    setConfirmDeleteId(null);
    if (editingMenuId === id) setEditingMenuId(null);
    triggerSaveFeedback('Menu dihapus permanen dari daftar.');
  };

  const handleQrisFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 1000, 0.86, 310000);
      onUpdateStoreConfig(
        (prev) => ({
          ...prev,
          qrisImageUrl: compressed,
        }),
        { immediate: true }
      );
      triggerSaveFeedback('Gambar QRIS resmi disimpan permanen!');
    } catch {
      triggerSaveFeedback('Gagal membaca file QRIS.');
    }
  };

  const handleAddSideChip = () => {
    const trimmed = newSideChipInput.trim();
    if (!trimmed) return;
    if (extraSideOptions.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setNewSideChipInput('');
      return;
    }
    onUpdateStoreConfig(
      (prev) => {
        const cur = Array.isArray(prev.extraSideOptions)
          ? prev.extraSideOptions
          : DEFAULT_EXTRA_SIDE_OPTIONS;
        return {
          ...prev,
          extraSideOptions: [...cur, trimmed],
        };
      },
      { immediate: true }
    );
    setNewSideChipInput('');
    triggerSaveFeedback('Opsi lauk tambahan disimpan permanen!');
  };

  const handleRemoveSideChip = (target: string) => {
    onUpdateStoreConfig(
      (prev) => {
        const cur = Array.isArray(prev.extraSideOptions)
          ? prev.extraSideOptions
          : DEFAULT_EXTRA_SIDE_OPTIONS;
        return {
          ...prev,
          extraSideOptions: cur.filter((s) => s !== target),
        };
      },
      { immediate: true }
    );
    triggerSaveFeedback('Opsi lauk tambahan dihapus permanen.');
  };

  const handleExportOwnerBackup = () => {
    try {
      const backupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        brandName: storeConfig.brandName,
        storeConfig,
        menuItems,
      };
      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cadangan-owner-nasi-kuning-lasinrang-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      triggerSaveFeedback('File cadangan permanen Owner (.json) berhasil diunduh!');
    } catch {
      triggerSaveFeedback('Gagal mengunduh file cadangan.');
    }
  };

  const handleImportOwnerBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}')) as {
          storeConfig?: StoreConfig;
          menuItems?: MenuItem[];
        };
        if (parsed.storeConfig && typeof parsed.storeConfig === 'object') {
          onUpdateStoreConfig(parsed.storeConfig, { immediate: true });
        }
        if (Array.isArray(parsed.menuItems) && parsed.menuItems.length > 0) {
          onUpdateMenuItems(parsed.menuItems, { immediate: true });
        }
        triggerSaveFeedback(
          'Cadangan Owner berhasil dipulihkan & dikunci permanen ke Server Utama dan Perangkat!'
        );
      } catch {
        triggerSaveFeedback('File cadangan tidak valid. Pilih file .json hasil unduhan Owner.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const normalizedCustomerWa = toIndonesianWaDigits(customerWa);
  const pendingOrdersCount = orders.filter((o) => o.status === 'Menunggu Konfirmasi').length;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="min-h-screen w-full bg-[#F7F3E9] text-[#30251F] flex flex-col lg:flex-row"
      role="main"
      aria-labelledby="owner-panel-title"
    >
      {/* MODERN EXECUTIVE SIDEBAR (Desktop Left Rail / Mobile Compact Masthead) */}
      <aside className="w-full lg:w-76 xl:w-80 shrink-0 bg-[#12291D] text-[#F7F3E9] border-b lg:border-b-0 lg:border-r border-[#D9A52E]/20 flex flex-col lg:sticky lg:top-0 lg:h-screen z-40">
        {/* Top Brand Crest & Executive Identity */}
        <div className="p-4 sm:p-5 border-b border-[#D9A52E]/15 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/file_000000004bd48211a316832fba565d37_46611b00.png"
              alt="Logo Nasi Kuning Lasinrang"
              loading="eager"
              decoding="async"
              draggable={false}
              className="w-10 h-10 rounded-full object-contain shrink-0 ring-1 ring-[#D9A52E]/80 bg-white emblem-3d-hd"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#E8C56E]">
                Dashboard Owner
              </div>
              <h1
                id="owner-panel-title"
                className="text-sm sm:text-base font-bold text-white font-serif-display truncate"
              >
                {storeConfig.brandName}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseAndFlush}
            className="lg:hidden px-3 py-1.5 rounded-xl bg-[#D9A52E] text-[#12291D] text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Selesai</span>
          </button>
        </div>

        {/* Live Store & Cloud Protection Status Dossier */}
        <div className="px-4 sm:px-5 py-3 bg-[#0E2017] border-b border-[#D9A52E]/15 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                storeConfig.isOpenLive
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : 'bg-red-400'
              }`}
            />
            <span className="font-bold text-[#F7F3E9]/90">
              {storeConfig.isOpenLive ? 'Kedai Buka' : 'Tutup Sementara'}
            </span>
          </div>
          <span className="text-[10px] font-mono-tabular font-bold text-[#E8C56E]">
            {isAdminCloudVerified ? 'Cloud Aktif' : 'PIN Lokal'}
          </span>
        </div>

        {/* Navigation Modules (Vertical on Desktop, Horizontal Scroll on Mobile) */}
        <nav
          aria-label="Navigasi Dashboard Owner"
          className="p-3 sm:p-4 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar flex-1"
        >
          <div className="hidden lg:block px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#E8C56E]/75">
            Menu Utama
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-3 rounded-xl text-left text-xs font-bold flex items-center justify-between gap-2.5 transition-all cursor-pointer whitespace-nowrap lg:whitespace-normal shrink-0 ${
              activeTab === 'orders'
                ? 'bg-[#D9A52E] text-[#12291D] shadow-sm'
                : 'bg-[#193D2B]/65 text-[#F7F3E9]/85 border border-[#D9A52E]/15 hover:border-[#D9A52E]/45 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="truncate">Pesanan Masuk</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono-tabular font-extrabold ${
                activeTab === 'orders'
                  ? 'bg-[#12291D] text-[#E8C56E]'
                  : pendingOrdersCount > 0
                  ? 'bg-[#A83A2D] text-white'
                  : 'bg-[#12291D]/70 text-[#F7F3E9]'
              }`}
            >
              {pendingOrdersCount > 0 ? `${pendingOrdersCount} Baru` : orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quick-reply')}
            className={`px-3.5 py-3 rounded-xl text-left text-xs font-bold flex items-center justify-between gap-2.5 transition-all cursor-pointer whitespace-nowrap lg:whitespace-normal shrink-0 ${
              activeTab === 'quick-reply'
                ? 'bg-[#D9A52E] text-[#12291D] shadow-sm'
                : 'bg-[#193D2B]/65 text-[#F7F3E9]/85 border border-[#D9A52E]/15 hover:border-[#D9A52E]/45 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="truncate">Balasan WA &amp; Ongkir</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-3 rounded-xl text-left text-xs font-bold flex items-center justify-between gap-2.5 transition-all cursor-pointer whitespace-nowrap lg:whitespace-normal shrink-0 ${
              activeTab === 'settings'
                ? 'bg-[#D9A52E] text-[#12291D] shadow-sm'
                : 'bg-[#193D2B]/65 text-[#F7F3E9]/85 border border-[#D9A52E]/15 hover:border-[#D9A52E]/45 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Settings className="w-4 h-4 shrink-0" />
              <span className="truncate">Kelola Menu &amp; QRIS</span>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono-tabular bg-[#12291D]/45 text-[#E8C56E]">
              {menuItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            className={`px-3.5 py-3 rounded-xl text-left text-xs font-bold flex items-center justify-between gap-2.5 transition-all cursor-pointer whitespace-nowrap lg:whitespace-normal shrink-0 ${
              activeTab === 'vault'
                ? 'bg-[#D9A52E] text-[#12291D] shadow-sm'
                : isAdminCloudVerified
                ? 'bg-[#193D2B]/85 text-[#E8C56E] border border-[#D9A52E]/35 hover:bg-[#193D2B]'
                : 'bg-amber-950/70 text-amber-200 border border-amber-400/50 hover:bg-amber-900/70'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isAdminCloudVerified ? (
                <ShieldCheck className="w-4 h-4 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">
                Cloud Firebase {!isAdminCloudVerified ? '· Login' : ''}
              </span>
            </div>
          </button>

          <div className="hidden lg:block pt-3 px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#E8C56E]/75">
            Alat &amp; Keamanan
          </div>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById('qr-print-generator')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 bg-[#0E2017] text-[#E8C56E] border border-[#D9A52E]/25 hover:bg-[#193D2B]"
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span>Cetak Kartu QR</span>
          </button>

          {onLockOwner && (
            <button
              type="button"
              onClick={onLockOwner}
              title="Kunci kembali akses Owner di perangkat ini"
              className="px-3.5 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 bg-[#0E2017] text-[#F7F3E9]/75 border border-[#F7F3E9]/15 hover:text-white"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Kunci Akses PIN</span>
            </button>
          )}
        </nav>

        {/* Sidebar Bottom Return Action (Desktop) */}
        <div className="hidden lg:flex flex-col gap-2 p-4 border-t border-[#D9A52E]/15 bg-[#0E2017]">
          <button
            type="button"
            onClick={handleCloseAndFlush}
            className="w-full py-3 px-4 rounded-xl bg-[#D9A52E] hover:bg-[#E8C56E] text-[#12291D] text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            aria-label="Simpan dan Tutup Halaman Owner"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>Selesai &amp; Kembali</span>
          </button>
        </div>
      </aside>

      {/* MAIN EXECUTIVE DASHBOARD WORKSPACE */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Executive Workspace Header & KPI Cards */}
        <div className="bg-[#EFE9DC]/70 border-b border-[#30251F]/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
            {/* Top Bar: Active Module Title & Quick Return */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9A7013]">
                  Panel Manajemen · {storeConfig.brandName}
                </div>
                <h2 className="text-lg sm:text-2xl font-bold font-serif-display text-[#193D2B]">
                  {activeTab === 'orders'
                    ? 'Daftar Pesanan Pelanggan'
                    : activeTab === 'quick-reply'
                    ? 'Kalkulator Ongkir & Balasan WhatsApp'
                    : activeTab === 'settings'
                    ? 'Pengaturan Kedai, Menu & QRIS'
                    : 'Penyimpanan Cloud Firebase'}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseAndFlush}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#193D2B] hover:text-[#F7F3E9] text-[#193D2B] text-xs font-bold flex items-center gap-1.5 border border-[#30251F]/15 cursor-pointer transition-all shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Beranda</span>
                </button>
              </div>
            </div>

            {/* 4-Column KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="editorial-plate bg-white p-3.5 text-left cursor-pointer"
              >
                <div className="text-[10px] font-semibold text-[#6E5D53]">
                  Total Pesanan
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[#193D2B]">
                    {orders.length}
                  </span>
                  <span className="text-[11px] font-bold text-[#9A7013]">Riwayat</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="editorial-plate bg-white p-3.5 text-left cursor-pointer"
              >
                <div className="text-[10px] font-semibold text-[#6E5D53]">
                  Perlu Diproses
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span
                    className={`text-xl sm:text-2xl font-extrabold font-mono-tabular ${
                      pendingOrdersCount > 0 ? 'text-[#A83A2D]' : 'text-[#193D2B]'
                    }`}
                  >
                    {pendingOrdersCount}
                  </span>
                  <span className="text-[11px] font-bold text-[#6E5D53]">Pesanan Baru</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="editorial-plate bg-white p-3.5 text-left cursor-pointer"
              >
                <div className="text-[10px] font-semibold text-[#6E5D53]">
                  Katalog Menu
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[#193D2B]">
                    {menuItems.length}
                  </span>
                  <span className="text-[11px] font-bold text-[#193D2B]">Menu Aktif</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vault')}
                className="editorial-plate bg-white p-3.5 text-left cursor-pointer"
              >
                <div className="text-[10px] font-semibold text-[#6E5D53]">
                  Status Cloud
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span
                    className={`text-sm sm:text-base font-extrabold ${
                      isAdminCloudVerified && cloudSyncStatus?.cloudSynced
                        ? 'text-[#193D2B]'
                        : 'text-amber-700'
                    }`}
                  >
                    {isAdminCloudVerified && cloudSyncStatus?.cloudSynced
                      ? 'Tersinkron'
                      : 'Mode Lokal'}
                  </span>
                  <span className="text-[11px] font-bold text-[#9A7013]">Firebase</span>
                </div>
              </button>
            </div>

            {saveBanner && (
              <div className="px-4 py-2.5 rounded-xl bg-[#E9F0EC] border border-[#193D2B]/25 text-[#193D2B] text-xs font-bold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{saveBanner}</span>
              </div>
            )}

            {/* Honest Firebase Cloud Protection Status Strip */}
            <div
              className={`px-4 py-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2.5 text-xs ${
                cloudSyncStatus?.status === 'error'
                  ? 'bg-red-50 border-red-300'
                  : isAdminCloudVerified && cloudSyncStatus?.cloudSynced
                  ? 'bg-white border-[#193D2B]/25'
                  : 'bg-amber-50 border-amber-300'
              }`}
            >
              <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                {cloudSyncStatus?.status === 'error' ? (
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-red-600" />
                ) : cloudSyncStatus?.status === 'saving' || isCloudSyncing ? (
                  <Cloud className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-[#9A7013] animate-pulse" />
                ) : isAdminCloudVerified && cloudSyncStatus?.cloudSynced ? (
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-[#193D2B]" />
                ) : (
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-amber-700" />
                )}

                {cloudSyncStatus?.status === 'saving' || isCloudSyncing ? (
                  <span className="text-[#9A7013] font-bold">
                    Menyimpan perubahan admin secara permanen ke Cloud Firestore Firebase...
                  </span>
                ) : cloudSyncStatus?.status === 'error' ? (
                  <span className="text-red-700 font-bold leading-snug">
                    {cloudSyncStatus.errorMessage ||
                      'Gagal menyinkronkan ke Firebase Cloud. Perubahan masih tersimpan lokal — coba simpan ulang.'}
                  </span>
                ) : isAdminCloudVerified && cloudSyncStatus?.cloudSynced ? (
                  <span className="text-[#193D2B] font-bold leading-snug">
                    ✓ Tersimpan Permanen di Cloud Firebase ({currentUser?.email}) — Semua pengaturan &amp; foto menu aman lintas perangkat.
                  </span>
                ) : isAdminCloudVerified ? (
                  <span className="text-amber-900 font-bold leading-snug">
                    Akun Google Owner aktif ({currentUser?.email}), tetapi data belum diverifikasi tersimpan di Firebase Cloud. Klik &ldquo;Simpan ke Firebase&rdquo;.
                  </span>
                ) : (
                  <span className="text-amber-950 font-bold leading-snug">
                    Mode Lokal (PIN) — Login Google Owner agar pengaturan &amp; foto menu tersimpan permanen di Cloud Firebase.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {isAdminCloudVerified ? (
                  <>
                    {onForceCloudSync && (
                      <button
                        type="button"
                        disabled={isCloudSyncing}
                        onClick={async () => {
                          setIsCloudSyncing(true);
                          const ok = await onForceCloudSync();
                          setIsCloudSyncing(false);
                          triggerSaveFeedback(
                            ok
                              ? 'Semua pengaturan & foto menu Owner berhasil dikunci permanen di Cloud Firestore Firebase!'
                              : 'Gagal menyinkronkan ke Firebase Cloud. Periksa koneksi atau buka tab Cloud Firebase.'
                          );
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#193D2B] hover:bg-[#122E20] text-white text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isCloudSyncing ? 'Menyimpan...' : 'Simpan ke Firebase'}</span>
                      </button>
                    )}
                    {activeTab !== 'vault' && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('vault')}
                        className="px-3 py-1.5 rounded-xl bg-[#F7F3E9] hover:bg-[#E4DCCB] border border-[#30251F]/15 text-[#30251F] text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Database className="w-3.5 h-3.5 text-[#193D2B]" />
                        <span>Cloud Firebase</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await onSignInGoogle();
                          if (auth.currentUser) {
                            setActiveTab('vault');
                            triggerSaveFeedback(
                              'Akun Google Owner terhubung! Silakan jalankan migrasi permanen di Cloud Firebase.'
                            );
                          }
                        } catch (err) {
                          const parsed = formatFirebaseAuthError(err);
                          setActiveTab('vault');
                          triggerSaveFeedback(parsed.message);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#A83A2D] hover:bg-[#8C2D22] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#E8C56E]" />
                      <span>Login Google Owner</span>
                    </button>
                    {activeTab !== 'vault' && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('vault')}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 border border-amber-400 text-amber-950 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>Buka Cloud</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Full-Page Executive Workspace Body */}
        <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-16 space-y-6">
              {activeTab === 'orders' ? (
                /* TAB 1: INCOMING ORDERS LOG */
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-white border border-[#30251F]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-[#30251F] font-serif-display flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-[#A83A2D]" />
                        <span>Riwayat &amp; Status Pesanan Pelanggan ({orders.length})</span>
                      </h4>
                      <p className="text-xs text-[#6E5D53] mt-0.5">
                        Setiap pesanan yang dikirim pelanggan melalui formulir WhatsApp otomatis tercatat di perangkat ini untuk memudahkan pengecekan dan tindak lanjut.
                      </p>
                    </div>
                    {orders.length > 0 && (
                      confirmClearOrdersOpen ? (
                        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                          <span className="text-[11px] font-bold text-red-800">
                            Hapus {orders.length} riwayat?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onClearOrders();
                              setConfirmClearOrdersOpen(false);
                              triggerSaveFeedback('Riwayat pesanan dibersihkan.');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Ya, Bersihkan
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmClearOrdersOpen(false)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-700 text-[11px] font-semibold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmClearOrdersOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold cursor-pointer shrink-0 self-start sm:self-auto"
                        >
                          Bersihkan Riwayat
                        </button>
                      )
                    )}
                  </div>

                  {orders.length === 0 ? (
                    <div className="p-10 rounded-2xl bg-white border border-[#30251F]/10 text-center space-y-2">
                      <ClipboardList className="w-8 h-8 text-[#9A7013] mx-auto opacity-80" />
                      <div className="text-sm font-bold text-[#30251F]">
                        Belum Ada Pesanan Tercatat di Sesi Ini
                      </div>
                      <p className="text-xs text-[#6E5D53] max-w-md mx-auto">
                        Saat pelanggan menekan tombol “KIRIM KE WHATSAPP” di halaman pratinjau checkout, rincian pesanan akan langsung muncul di sini.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          className="p-4 sm:p-5 rounded-2xl bg-white border border-[#30251F]/12 space-y-3 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#30251F]/10 pb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-[#30251F]">
                                  {order.customerName}
                                </span>
                                {buildCustomerWaMeUrl(order.customerPhone) ? (
                                  <a
                                    href={buildCustomerWaMeUrl(order.customerPhone) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-mono-tabular font-bold text-[#193D2B] hover:underline"
                                    title="Chat WhatsApp Pembeli"
                                  >
                                    ({order.customerPhone})
                                  </a>
                                ) : (
                                  <span className="text-xs font-mono-tabular text-[#6E5D53]">
                                    ({order.customerPhone})
                                  </span>
                                )}
                                <span
                                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                                    order.status === 'Selesai'
                                      ? 'bg-[#E9F0EC] text-[#193D2B]'
                                      : order.status === 'Diproses'
                                      ? 'bg-[#F7F3E9] text-[#9A7013]'
                                      : 'bg-red-50 text-[#A83A2D]'
                                  }`}
                                >
                                  {order.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#6E5D53] mt-0.5">
                                {new Date(order.createdAt).toLocaleString('id-ID')} ·{' '}
                                {getFulfillmentLabel(order.fulfillment, storeConfig)} · Metode:{' '}
                                <span className="uppercase font-semibold">{order.paymentMethod}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xs text-[#6E5D53]">Subtotal Makanan</div>
                              <div className="text-base font-extrabold font-mono-tabular text-[#A83A2D]">
                                {formatRupiah(order.foodSubtotal)}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-xs text-[#30251F]">
                            {order.itemsSummary.map((it, idx) => (
                              <div key={idx} className="flex justify-between gap-2">
                                <span>
                                  <strong>
                                    {it.quantity}× {it.name}
                                  </strong>{' '}
                                  <span className="text-[#6E5D53]">
                                    ({getRiceTypeLabel(it.riceType)} · {it.portionLabel} ·{' '}
                                    {getSambalPlainText(it.sambalPreference)})
                                  </span>
                                  {it.toppings && it.toppings.length > 0 && (
                                    <span className="text-[#9A7013] font-semibold">
                                      {' '}
                                      · +Toping{it.toppingScope === 'total_order' ? ' (Total)' : ''}:{' '}
                                      {it.toppings
                                        .map(
                                          (t) =>
                                            `${t.name} ×${t.quantity} (${formatRupiah(
                                              t.unitPrice * t.quantity
                                            )})`
                                        )
                                        .join(', ')}
                                    </span>
                                  )}
                                  {it.wantExtraSideDish && (
                                    <span className="text-[#193D2B]">
                                      {' '}
                                      · +Lauk: {it.extraSideDishNote || 'Konfirmasi WA'}
                                    </span>
                                  )}
                                  {it.itemNote && (
                                    <span className="italic text-[#6E5D53]">
                                      {' '}
                                      · "{it.itemNote}"
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono-tabular font-semibold shrink-0">
                                  {formatRupiah(getCartItemSubtotal(it))}
                                </span>
                              </div>
                            ))}
                          </div>

                          {(order.deliveryAddress ||
                            order.googleMapsLink ||
                            order.courierInfo ||
                            order.customerNotes ||
                            order.paymentProofUrl) && (
                            <div className="p-2.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/10 text-[11px] text-[#4A3C34] space-y-1.5">
                              {order.deliveryAddress && (
                                <div>
                                  <MapPin className="w-3 h-3 inline mr-1 text-[#A83A2D]" />
                                  {order.deliveryAddress}
                                  {order.landmark ? ` (Patokan: ${order.landmark})` : ''}
                                </div>
                              )}
                              {order.courierInfo && <div>Kurir: {order.courierInfo}</div>}
                              {order.customerNotes && (
                                <div className="italic text-[#6E5D53]">
                                  Catatan Pelanggan: {order.customerNotes}
                                </div>
                              )}
                              {order.googleMapsLink && (
                                <a
                                  href={order.googleMapsLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#193D2B] font-semibold underline block truncate"
                                >
                                  {order.googleMapsLink}
                                </a>
                              )}
                              {order.paymentProofUrl && (
                                <div className="pt-1.5 mt-1 border-t border-[#30251F]/10 flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewProofOrder({
                                        url: order.paymentProofUrl!,
                                        customerName: order.customerName,
                                      })
                                    }
                                    className="w-12 h-12 rounded-lg overflow-hidden border border-[#193D2B]/30 bg-white shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                                    title="Perbesar foto bukti pembayaran"
                                  >
                                    <img
                                      src={order.paymentProofUrl}
                                      alt={`Bukti pembayaran ${order.customerName}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="font-bold text-[#193D2B] flex items-center gap-1">
                                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                                      <span>Foto Bukti Pembayaran Terlampir</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewProofOrder({
                                            url: order.paymentProofUrl!,
                                            customerName: order.customerName,
                                          })
                                        }
                                        className="px-2 py-0.5 rounded bg-[#E9F0EC] hover:bg-[#DAE6DF] text-[#193D2B] font-semibold cursor-pointer"
                                      >
                                        Perbesar Foto
                                      </button>
                                      <a
                                        href={order.paymentProofUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-0.5 rounded bg-white border border-[#30251F]/15 hover:border-[#193D2B] text-[#30251F] font-semibold inline-flex items-center gap-1"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        <span>Buka Tab Baru</span>
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#30251F]/10">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {(['Menunggu Konfirmasi', 'Diproses', 'Selesai'] as OrderStatus[]).map(
                                (st) => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => {
                                      onUpdateOrderStatus(order.id, st);
                                      triggerSaveFeedback(`Status pesanan diubah ke "${st}".`);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                                      order.status === st
                                        ? 'bg-[#193D2B] text-white border-[#193D2B]'
                                        : 'bg-[#F7F3E9] text-[#6E5D53] border-[#30251F]/15 hover:border-[#D9A52E]'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                )
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleLoadOrderIntoReply(order)}
                                className="px-3 py-1.5 rounded-lg bg-[#A83A2D] hover:bg-[#8C2D22] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Buat Balasan WA</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteOrder(order.id)}
                                className="p-1.5 rounded-lg bg-[#F7F3E9] hover:bg-red-50 border border-[#30251F]/12 text-red-700 cursor-pointer"
                                aria-label="Hapus riwayat pesanan ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'quick-reply' ? (
                /* TAB 2: QUICK REPLY & MANUAL SHIPPING CALCULATOR */
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-white border border-[#30251F]/12 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#30251F]/10 pb-3">
                      <div>
                        <h4 className="text-base font-bold text-[#30251F] font-serif-display flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#9A7013]" />
                          <span>Kalkulator Total Akhir, Lauk Ekstra &amp; Ongkir Manual</span>
                        </h4>
                        <p className="text-xs text-[#6E5D53]">
                          Masukkan nominal pesanan pelanggan untuk membuat 3 balasan WhatsApp otomatis siap kirim.
                        </p>
                      </div>
                      {currentCartSubtotal > 0 && (
                        <button
                          type="button"
                          onClick={() => setFoodSubtotal(currentCartSubtotal)}
                          className="px-3 py-1.5 rounded-lg bg-[#EFE9DC] hover:bg-[#E4DCCB] border border-[#30251F]/12 text-[#30251F] text-xs font-semibold cursor-pointer self-start sm:self-auto"
                        >
                          Ambil Subtotal Keranjang ({formatRupiah(currentCartSubtotal)})
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                          Nama Pelanggan
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Contoh: Kak Andi"
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#30251F] focus:outline-none focus:border-[#A83A2D]"
                        />
                        <input
                          type="tel"
                          value={customerWa}
                          onChange={(e) => setCustomerWa(e.target.value)}
                          placeholder="No. WA Pelanggan (Opsional)"
                          className="mt-2 w-full bg-[#F7F3E9] border border-[#30251F]/15 rounded-xl px-3.5 py-2 text-xs text-[#30251F] placeholder:text-[#6E5D53]/60 focus:outline-none focus:border-[#A83A2D]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                          Subtotal Makanan (Rp)
                        </label>
                        <input
                          type="number"
                          step={1000}
                          min={0}
                          value={foodSubtotal}
                          onChange={(e) => setFoodSubtotal(Number(e.target.value))}
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-sm font-mono-tabular text-[#30251F] focus:outline-none focus:border-[#A83A2D]"
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                          {[10000, 15000, 20000, 25000, 35000].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setFoodSubtotal(val)}
                              className="px-2 py-0.5 rounded bg-[#EFE9DC] hover:bg-[#E4DCCB] text-[11px] font-mono-tabular text-[#30251F] border border-[#30251F]/12 cursor-pointer"
                            >
                              {val / 1000}k
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                          Biaya Lauk Ekstra (Manual Rp)
                        </label>
                        <input
                          type="number"
                          step={1000}
                          min={0}
                          value={extraSideFee}
                          onChange={(e) => setExtraSideFee(Number(e.target.value))}
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-sm font-mono-tabular text-[#30251F] focus:outline-none focus:border-[#A83A2D]"
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                          {[0, 3000, 5000, 7000, 10000].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setExtraSideFee(val)}
                              className="px-2 py-0.5 rounded bg-[#EFE9DC] hover:bg-[#E4DCCB] text-[11px] font-mono-tabular text-[#30251F] border border-[#30251F]/12 cursor-pointer"
                            >
                              {val === 0 ? 'Rp0' : `+${val / 1000}k`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                          Ongkir Sesuai Jarak (Manual Rp)
                        </label>
                        <input
                          type="number"
                          step={1000}
                          min={0}
                          value={shippingFee}
                          onChange={(e) => setShippingFee(Number(e.target.value))}
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-sm font-mono-tabular text-[#30251F] focus:outline-none focus:border-[#A83A2D]"
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                          {[0, 5000, 7000, 10000, 12000, 15000].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setShippingFee(val)}
                              className="px-2 py-0.5 rounded bg-[#EFE9DC] hover:bg-[#E4DCCB] text-[11px] font-mono-tabular text-[#30251F] border border-[#30251F]/12 cursor-pointer"
                            >
                              {val === 0 ? 'Free' : `${val / 1000}k`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#EFE9DC] border border-[#30251F]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-[#6E5D53] space-x-2">
                        <span>
                          Makanan:{' '}
                          <strong className="font-mono-tabular text-[#30251F]">
                            {formatRupiah(foodSubtotal)}
                          </strong>
                        </span>
                        <span>+</span>
                        <span>
                          Lauk Ekstra:{' '}
                          <strong className="font-mono-tabular text-[#30251F]">
                            {formatRupiah(extraSideFee)}
                          </strong>
                        </span>
                        <span>+</span>
                        <span>
                          Ongkir:{' '}
                          <strong className="font-mono-tabular text-[#30251F]">
                            {formatRupiah(shippingFee)}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs uppercase tracking-wider text-[#193D2B] font-bold">
                          Total Tagihan Akhir:
                        </span>
                        <span className="text-xl font-extrabold text-[#A83A2D] font-mono-tabular">
                          {formatRupiah(finalTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3 Generated WhatsApp Templates */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="p-4 rounded-2xl bg-white border border-[#30251F]/12 flex flex-col justify-between gap-4 shadow-sm"
                      >
                        <div className="space-y-2.5">
                          <div className="text-[11px] font-semibold text-[#9A7013] tracking-wide">
                            {tpl.badge}
                          </div>
                          <h5 className="text-sm font-bold text-[#30251F]">{tpl.title}</h5>
                          <pre className="p-3 rounded-xl bg-[#F7F3E9] border border-[#30251F]/10 text-xs text-[#30251F]/90 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto">
                            {tpl.content}
                          </pre>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyText(tpl.content, tpl.id)}
                            className="w-full py-2.5 px-3 rounded-xl bg-[#A83A2D] hover:bg-[#8C2D22] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            {copiedTemplateId === tpl.id ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Teks Balasan Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Salin Teks Balasan WA</span>
                              </>
                            )}
                          </button>

                          {normalizedCustomerWa && (
                            <a
                              href={`https://wa.me/${normalizedCustomerWa}?text=${encodeURIComponent(
                                tpl.content
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2 px-3 rounded-xl bg-[#E9F0EC] hover:bg-[#E9F0EC] border border-[#193D2B]/20 text-[#193D2B] font-semibold text-xs flex items-center justify-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Kirim Langsung ke WA Pelanggan</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : activeTab === 'vault' ? (
                /* TAB 4: FIREBASE VAULT, FULL MIGRATION & PROTECTION */
                <FirebaseVaultPanel
                  storeConfig={storeConfig}
                  menuItems={menuItems}
                  orders={orders}
                  currentUser={currentUser}
                  isAdminCloudVerified={isAdminCloudVerified}
                  cloudSyncStatus={cloudSyncStatus}
                  ownerAuditLogs={ownerAuditLogs}
                  onSignInGoogle={onSignInGoogle}
                  onSignOutGoogle={onSignOutGoogle}
                  onInspectFirebaseVault={onInspectFirebaseVault}
                  onMigrateAllToFirebase={onMigrateAllToFirebase}
                  onPullFromFirebase={onPullFromFirebase}
                  onExportOwnerBackup={handleExportOwnerBackup}
                  onImportOwnerBackup={handleImportOwnerBackup}
                  onNotify={triggerSaveFeedback}
                />
              ) : (
                /* TAB 3: SETTINGS, PORTION/SIDE/SAMBAL OPTIONS, MENU CRUD & QRIS */
                <div className="space-y-6">
                  {/* 1. Store Identity, Live Status, Contacts & Links */}
                  <div className="p-5 rounded-2xl bg-white border border-[#30251F]/12 space-y-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-[#30251F] font-serif-display flex items-center gap-2">
                          <Store className="w-4 h-4 text-[#193D2B]" />
                          <span>Identitas Kedai, Kontak &amp; Status Operasional</span>
                        </h4>
                        <p className="text-xs text-[#6E5D53] mt-0.5">
                          Pengaturan prioritas tertinggi website — langsung menggantikan tampilan beranda, WhatsApp, GoPay/DANA, dan nota pesanan.
                        </p>
                      </div>
                      {confirmResetDefaultsOpen ? (
                        <div className="flex flex-wrap items-center gap-2 bg-red-50 border border-red-300 px-3 py-2.5 rounded-xl w-full sm:w-auto">
                          <span className="text-[11px] font-bold text-red-800">
                            Perlindungan Otoritas Owner: ketik <code className="bg-red-100 px-1 rounded">RESET</code> untuk menghapus kustomisasi &amp; kembali ke default:
                          </span>
                          <input
                            type="text"
                            value={resetConfirmPhrase}
                            onChange={(e) => setResetConfirmPhrase(e.target.value)}
                            placeholder="Ketik RESET"
                            className="w-28 bg-white border border-red-300 rounded-lg px-2 py-1 text-[11px] font-mono-tabular uppercase text-red-900 focus:outline-none focus:border-red-600"
                          />
                          <button
                            type="button"
                            disabled={resetConfirmPhrase.trim().toUpperCase() !== 'RESET'}
                            onClick={() => {
                              onResetDefaults();
                              setConfirmResetDefaultsOpen(false);
                              setResetConfirmPhrase('');
                              triggerSaveFeedback(
                                `Seluruh data dikembalikan ke ${INITIAL_MENU_ITEMS.length} menu & pengaturan resmi awal!`
                              );
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold cursor-pointer"
                          >
                            Ya, Reset Permanen
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmResetDefaultsOpen(false);
                              setResetConfirmPhrase('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-700 text-[11px] font-semibold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setResetConfirmPhrase('');
                            setConfirmResetDefaultsOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset ke Default Resmi ({INITIAL_MENU_ITEMS.length} Menu)</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/12 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-[#30251F]">
                            Status Kedai Malam Ini
                          </div>
                          <div className="text-[11px] text-[#6E5D53] mt-0.5">
                            {storeConfig.isOpenLive
                              ? 'Sedang Buka & Menerima Pesanan'
                              : 'Sedang Tutup / Habis Terjual'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateStoreConfig(
                              (prev) => ({
                                ...prev,
                                isOpenLive: !prev.isOpenLive,
                                liveStatusText: !prev.isOpenLive
                                  ? 'LIVE • SEDANG BUKA DI DEPAN PATUNG LASINRANG'
                                  : 'TUTUP SEMENTARA • BUKA KEMBALI PUKUL 18.30 WITA',
                              }),
                              { immediate: true }
                            );
                            triggerSaveFeedback('Status kedai disimpan permanen!');
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                            storeConfig.isOpenLive
                              ? 'bg-[#E9F0EC] text-[#193D2B] border border-[#193D2B]/30'
                              : 'bg-amber-100 text-[#9A7013] border border-[#D9A52E]/40'
                          }`}
                        >
                          {storeConfig.isOpenLive ? 'Buka (Aktif)' : 'Tutup'}
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Teks Status Header Live
                        </label>
                        <input
                          type="text"
                          value={storeConfig.liveStatusText}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              liveStatusText: e.target.value,
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Nama Brand / Kedai
                        </label>
                        <input
                          type="text"
                          value={storeConfig.brandName}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              brandName: e.target.value,
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Slogan / Tagline Kedai
                        </label>
                        <input
                          type="text"
                          value={storeConfig.tagline}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              tagline: e.target.value,
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Jam Buka / Operasional
                        </label>
                        <input
                          type="text"
                          value={storeConfig.operatingHours}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              operatingHours: e.target.value,
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Query Pencarian Google Maps Kedai
                        </label>
                        <input
                          type="text"
                          value={storeConfig.googleMapsQuery}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              googleMapsQuery: e.target.value,
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Alamat Lengkap Kedai
                        </label>
                        <input
                          type="text"
                          value={storeConfig.locationAddress}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              locationAddress: e.target.value,
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Teks Titik Jemput Kurir / Ojol (Untuk Copy-Paste Pelanggan &amp; Driver)
                        </label>
                        <input
                          type="text"
                          value={storeConfig.pickupCoordinatesText}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              pickupCoordinatesText: e.target.value,
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Nomor WhatsApp Tujuan Order (Format 628...)
                        </label>
                        <input
                          type="text"
                          value={storeConfig.whatsappNumber}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              whatsappNumber: e.target.value.replace(/\D/g, ''),
                            }))
                          }
                          placeholder="6282363953662"
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs font-mono-tabular text-[#30251F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Tampilan Nomor WhatsApp di Website
                        </label>
                        <input
                          type="text"
                          value={storeConfig.whatsappDisplay}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              whatsappDisplay: e.target.value,
                            }))
                          }
                          placeholder="+62 823-6395-3662"
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs font-mono-tabular text-[#30251F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Nomor Resmi GoPay / DANA
                        </label>
                        <input
                          type="text"
                          value={storeConfig.ewalletNumber}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              ewalletNumber: e.target.value.replace(/\D/g, ''),
                            }))
                          }
                          placeholder="08215089754"
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs font-mono-tabular text-[#30251F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Tampilan Nomor GoPay / DANA
                        </label>
                        <input
                          type="text"
                          value={storeConfig.ewalletDisplay}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              ewalletDisplay: e.target.value,
                            }))
                          }
                          placeholder="+62 821-5089-754"
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs font-mono-tabular text-[#30251F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Link GoFood / Gojek Kedai
                        </label>
                        <input
                          type="url"
                          value={storeConfig.gofoodUrl}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              gofoodUrl: e.target.value,
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#30251F] mb-1">
                          Link Maxim Delivery
                        </label>
                        <input
                          type="url"
                          value={storeConfig.maximUrl}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              maximUrl: e.target.value,
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 1b. Store Google Maps Pin Placement (Permanent) */}
                  <div className="p-5 rounded-2xl bg-white border border-[#30251F]/12 space-y-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-[#30251F] font-serif-display flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#A83A2D]" />
                          <span>Titik Pin Google Maps Kedai (Permanen)</span>
                        </h4>
                        <p className="text-xs text-[#6E5D53]">
                          Atur posisi akurat kedai di peta atau isi koordinat manual untuk patokan rute pembeli dan jarak ongkir kurir.
                        </p>
                      </div>
                    </div>

                    <StoreLocationMap
                      storeConfig={storeConfig}
                      editable={true}
                      heightClassName="h-[250px]"
                      onSelectStoreCoords={({ lat, lng, placeId, placeName }) => {
                        onUpdateStoreConfig(
                          (prev) => ({
                            ...prev,
                            storeLat: lat,
                            storeLng: lng,
                            storePlaceId: placeId || prev.storePlaceId,
                            storePlaceName: placeName || prev.storePlaceName,
                          }),
                          { immediate: true }
                        );
                        triggerSaveFeedback('Titik koordinat Google Maps kedai disimpan permanen!');
                      }}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                          Latitude Kedai (Manual / Otomatis dari Peta)
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          value={storeConfig.storeLat ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            const parsed = Number(val);
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              storeLat:
                                val === ''
                                  ? undefined
                                  : Number.isFinite(parsed)
                                  ? parsed
                                  : prev.storeLat,
                            }));
                          }}
                          placeholder="-3.785600"
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                          Longitude Kedai (Manual / Otomatis dari Peta)
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          value={storeConfig.storeLng ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            const parsed = Number(val);
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              storeLng:
                                val === ''
                                  ? undefined
                                  : Number.isFinite(parsed)
                                  ? parsed
                                  : prev.storeLng,
                            }));
                          }}
                          placeholder="119.652400"
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Portion Presets, Extra Side Dishes & Sambal Options */}
                  <div className="p-5 rounded-2xl bg-white border border-[#30251F]/12 space-y-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-[#9A7013]" />
                      <h4 className="text-base font-bold text-[#30251F] font-serif-display">
                        Kelola Opsi Porsi (Reguler &amp; Spesial), Lauk Tambahan &amp; Pilihan Sambal
                      </h4>
                    </div>

                    {/* Portion Increments (Reguler & Spesial) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                          Label Porsi Menengah
                        </label>
                        <input
                          type="text"
                          value={portionPresets.extraPuasLabel}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              portionPresets: {
                                ...(prev.portionPresets || DEFAULT_PORTION_PRESETS),
                                extraPuasLabel: e.target.value,
                              },
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                          Tambah Harga Menengah Reguler (Rp)
                        </label>
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={portionPresets.extraPuasRegulerDelta}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              portionPresets: {
                                ...(prev.portionPresets || DEFAULT_PORTION_PRESETS),
                                extraPuasRegulerDelta: Math.max(0, Number(e.target.value) || 0),
                              },
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                          Tambah Harga Menengah Spesial (Rp)
                        </label>
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={portionPresets.extraPuasSpesialDelta}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              portionPresets: {
                                ...(prev.portionPresets || DEFAULT_PORTION_PRESETS),
                                extraPuasSpesialDelta: Math.max(0, Number(e.target.value) || 0),
                              },
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                          Label Porsi Besar / Jumbo
                        </label>
                        <input
                          type="text"
                          value={portionPresets.jumboLabel}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              portionPresets: {
                                ...(prev.portionPresets || DEFAULT_PORTION_PRESETS),
                                jumboLabel: e.target.value,
                              },
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                          Tambah Harga Jumbo Reguler (Rp)
                        </label>
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={portionPresets.jumboRegulerDelta}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              portionPresets: {
                                ...(prev.portionPresets || DEFAULT_PORTION_PRESETS),
                                jumboRegulerDelta: Math.max(0, Number(e.target.value) || 0),
                              },
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                          Tambah Harga Jumbo Spesial (Rp)
                        </label>
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={portionPresets.jumboSpesialDelta}
                          onChange={(e) =>
                            onUpdateStoreConfig((prev) => ({
                              ...prev,
                              portionPresets: {
                                ...(prev.portionPresets || DEFAULT_PORTION_PRESETS),
                                jumboSpesialDelta: Math.max(0, Number(e.target.value) || 0),
                              },
                            }))
                          }
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                        />
                      </div>
                    </div>

                    {/* Extra Side Dish Quick Chips */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-[#30251F]">
                        Daftar Opsi Cepat Lauk Tambahan (Muncul saat Pelanggan Centang Lauk Ekstra)
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {extraSideOptions.map((chip) => (
                          <span
                            key={chip}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F3E9] border border-[#30251F]/15 text-xs text-[#30251F]"
                          >
                            <span>{chip}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSideChip(chip)}
                              className="text-red-600 hover:text-red-800 cursor-pointer"
                              aria-label={`Hapus ${chip}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 max-w-md">
                        <input
                          type="text"
                          value={newSideChipInput}
                          onChange={(e) => setNewSideChipInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSideChip();
                            }
                          }}
                          placeholder="Tambah opsi lauk ekstra (misal: Ayam Suwir)..."
                          className="flex-1 bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                        />
                        <button
                          type="button"
                          onClick={handleAddSideChip}
                          className="px-3 py-1.5 rounded-lg bg-[#193D2B] text-white text-xs font-bold cursor-pointer"
                        >
                          Tambah
                        </button>
                      </div>
                    </div>

                    {/* Sambal Options Toggle, Label & Description Edit */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-[#30251F]">
                        Opsi Sambal yang Ditampilkan ke Pelanggan (Label, Deskripsi &amp; Status Aktif)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {sambalOptions.map((opt, idx) => (
                          <div
                            key={opt.id}
                            className="p-3 rounded-xl bg-[#F7F3E9] border border-[#30251F]/12 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase text-[#193D2B]">
                                {opt.id}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateStoreConfig(
                                    (prev) => {
                                      const cur = prev.sambalOptions || DEFAULT_SAMBAL_OPTIONS;
                                      return {
                                        ...prev,
                                        sambalOptions: cur.map((s, sIdx) =>
                                          sIdx === idx ? { ...s, enabled: !s.enabled } : s
                                        ),
                                      };
                                    },
                                    { immediate: true }
                                  );
                                  triggerSaveFeedback('Opsi sambal disimpan permanen!');
                                }}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                                  opt.enabled
                                    ? 'bg-[#E9F0EC] text-[#193D2B]'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {opt.enabled ? 'Aktif' : 'Nonaktif'}
                              </button>
                            </div>
                            <input
                              type="text"
                              value={opt.label}
                              onChange={(e) => {
                                const val = e.target.value;
                                onUpdateStoreConfig((prev) => {
                                  const cur = prev.sambalOptions || DEFAULT_SAMBAL_OPTIONS;
                                  return {
                                    ...prev,
                                    sambalOptions: cur.map((s, sIdx) =>
                                      sIdx === idx ? { ...s, label: val } : s
                                    ),
                                  };
                                });
                              }}
                              placeholder="Judul opsi sambal"
                              className="w-full bg-white border border-[#30251F]/15 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#30251F]"
                            />
                            <input
                              type="text"
                              value={opt.desc}
                              onChange={(e) => {
                                const val = e.target.value;
                                onUpdateStoreConfig((prev) => {
                                  const cur = prev.sambalOptions || DEFAULT_SAMBAL_OPTIONS;
                                  return {
                                    ...prev,
                                    sambalOptions: cur.map((s, sIdx) =>
                                      sIdx === idx ? { ...s, desc: val } : s
                                    ),
                                  };
                                });
                              }}
                              placeholder="Keterangan singkat..."
                              className="w-full bg-white border border-[#30251F]/15 rounded-lg px-2.5 py-1 text-[11px] text-[#6E5D53]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 3. QRIS Image & Metadata Manager */}
                  <div className="p-5 rounded-2xl bg-white border border-[#30251F]/12 space-y-4 shadow-sm">
                    <h4 className="text-base font-bold text-[#30251F] font-serif-display flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[#9A7013]" />
                      <span>QRIS Resmi Kedai ({storeConfig.qrisMerchantName})</span>
                    </h4>

                    <div className="flex flex-col sm:flex-row items-start gap-5">
                      <div className="w-40 aspect-[586/825] rounded-xl overflow-hidden border border-[#30251F]/15 bg-white shrink-0 p-1 flex items-center justify-center self-center sm:self-start">
                        <img
                          src={storeConfig.qrisImageUrl}
                          alt="Preview QRIS Resmi"
                          loading="eager"
                          decoding="async"
                          draggable={false}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain rounded-lg bg-white"
                        />
                      </div>
                      <div className="flex-1 space-y-3 w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                              Nama Merchant QRIS
                            </label>
                            <input
                              type="text"
                              value={storeConfig.qrisMerchantName}
                              onChange={(e) =>
                                onUpdateStoreConfig((prev) => ({
                                  ...prev,
                                  qrisMerchantName: e.target.value,
                                }))
                              }
                              className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                              NMID Resmi
                            </label>
                            <input
                              type="text"
                              value={storeConfig.qrisNmid}
                              onChange={(e) =>
                                onUpdateStoreConfig((prev) => ({
                                  ...prev,
                                  qrisNmid: e.target.value,
                                }))
                              }
                              className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                              Terminal ID
                            </label>
                            <input
                              type="text"
                              value={storeConfig.qrisTerminalId}
                              onChange={(e) =>
                                onUpdateStoreConfig((prev) => ({
                                  ...prev,
                                  qrisTerminalId: e.target.value,
                                }))
                              }
                              className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                              Printed By
                            </label>
                            <input
                              type="text"
                              value={storeConfig.qrisPrintedBy}
                              onChange={(e) =>
                                onUpdateStoreConfig((prev) => ({
                                  ...prev,
                                  qrisPrintedBy: e.target.value,
                                }))
                              }
                              className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                              Versi QRIS
                            </label>
                            <input
                              type="text"
                              value={storeConfig.qrisVersion}
                              onChange={(e) =>
                                onUpdateStoreConfig((prev) => ({
                                  ...prev,
                                  qrisVersion: e.target.value,
                                }))
                              }
                              className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                              URL Gambar QRIS (atau Upload File di bawah)
                            </label>
                            <input
                              type="url"
                              value={
                                storeConfig.qrisImageUrl.startsWith('data:')
                                  ? ''
                                  : storeConfig.qrisImageUrl
                              }
                              onChange={(e) =>
                                onUpdateStoreConfig((prev) => ({
                                  ...prev,
                                  qrisImageUrl: e.target.value,
                                }))
                              }
                              placeholder={
                                storeConfig.qrisImageUrl.startsWith('data:')
                                  ? 'File gambar QRIS lokal/upload aktif'
                                  : 'https://...'
                              }
                              className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <label className="px-4 py-2 rounded-xl bg-[#A83A2D] hover:bg-[#8C2D22] text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer">
                            <Upload className="w-4 h-4" />
                            <span>Upload File Foto QRIS Baru</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleQrisFileUpload}
                              className="hidden"
                            />
                          </label>
                          <a
                            href={storeConfig.qrisImageUrl}
                            download="QRIS-Resmi-Nasi-Kuning-Lasinrang.jpg"
                            className="px-4 py-2 rounded-xl bg-[#EFE9DC] hover:bg-[#E4DCCB] border border-[#30251F]/12 text-[#30251F] font-semibold text-xs inline-flex items-center gap-2"
                          >
                            <span>Unduh File QRIS Ini</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Full Menu CRUD Manager */}
                  <div className="p-5 rounded-2xl bg-white border border-[#30251F]/12 space-y-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base font-bold text-[#30251F] font-serif-display flex items-center gap-2">
                          <Utensils className="w-4 h-4 text-[#193D2B]" />
                          <span>
                            Kelola Daftar Menu, Harga, Stok &amp; Foto ({menuItems.length} Item)
                          </span>
                        </h4>
                        <p className="text-xs text-[#6E5D53]">
                          Total {menuItems.length} menu ({menuItems.filter((m) => m.category === 'spesial').length} Spesial · {menuItems.filter((m) => m.category !== 'spesial').length} Reguler) — setiap penambahan/ubah menu langsung memperbarui beranda, katalog, daftar siap salin, dan video tutorial.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              buildCopyableMenuListText(storeConfig, menuItems),
                              'owner-all-menus'
                            )
                          }
                          className="px-3.5 py-2 rounded-xl bg-[#EFE9DC] hover:bg-[#E4DCCB] border border-[#30251F]/15 text-[#30251F] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedTemplateId === 'owner-all-menus' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#193D2B]" />
                              <span className="text-[#193D2B]">Tersalin ({menuItems.length})!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin Daftar Menu ({menuItems.length})</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCopyMenuPreview((prev) => !prev)}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-[#F7F3E9] border border-[#30251F]/15 text-[#6E5D53] font-semibold text-xs cursor-pointer"
                        >
                          {showCopyMenuPreview ? 'Tutup Teks' : 'Lihat Teks Siap Salin'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingMenu((prev) => !prev)}
                          className="px-4 py-2 rounded-xl bg-[#193D2B] hover:bg-[#122E20] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{isAddingMenu ? 'Batal Tambah' : 'Tambah Menu Baru'}</span>
                        </button>
                      </div>
                    </div>

                    {showCopyMenuPreview && (
                      <div className="p-3.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/15 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#193D2B]">
                            Teks Semua Daftar Menu Siap Salin ({menuItems.length} Menu Live)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                buildCopyableMenuListText(storeConfig, menuItems),
                                'owner-all-menus-box'
                              )
                            }
                            className="px-3 py-1 rounded-lg bg-[#A83A2D] hover:bg-[#8C2D22] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedTemplateId === 'owner-all-menus-box' ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Salin Semua</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-3 rounded-lg bg-white border border-[#30251F]/10 text-[11px] text-[#30251F] whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto select-all">
                          {buildCopyableMenuListText(storeConfig, menuItems)}
                        </pre>
                      </div>
                    )}

                    {/* Add New Menu Form */}
                    {isAddingMenu && (
                      <form
                        onSubmit={handleAddNewMenuSubmit}
                        className="p-4 rounded-xl bg-[#F7F3E9] border border-[#193D2B]/25 space-y-3"
                      >
                        <div className="text-xs font-bold text-[#193D2B] uppercase tracking-wider">
                          Form Tambah Menu Baru
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-[#30251F] mb-1">
                              Nama Menu *
                            </label>
                            <input
                              type="text"
                              required
                              value={newMenuForm.name}
                              onChange={(e) =>
                                setNewMenuForm((p) => ({ ...p, name: e.target.value }))
                              }
                              placeholder="Contoh: Nasi Kuning Telur Pindang"
                              className="w-full bg-white border border-[#30251F]/20 rounded-lg px-3 py-2 text-xs text-[#30251F]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-[#30251F] mb-1">
                                Kategori
                              </label>
                              <select
                                value={newMenuForm.category}
                                onChange={(e) =>
                                  setNewMenuForm((p) => ({
                                    ...p,
                                    category: e.target.value as 'reguler' | 'spesial',
                                  }))
                                }
                                className="w-full bg-white border border-[#30251F]/20 rounded-lg px-2.5 py-2 text-xs text-[#30251F]"
                              >
                                <option value="reguler">Reguler</option>
                                <option value="spesial">Spesial</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#30251F] mb-1">
                                Harga (Rp)
                              </label>
                              <input
                                type="number"
                                step={1000}
                                min={1000}
                                value={newMenuForm.basePrice}
                                onChange={(e) =>
                                  setNewMenuForm((p) => ({
                                    ...p,
                                    basePrice: Number(e.target.value),
                                  }))
                                }
                                className="w-full bg-white border border-[#30251F]/20 rounded-lg px-2.5 py-2 text-xs font-mono-tabular text-[#30251F]"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#30251F] mb-1">
                              Karakter Rasa / Pedas
                            </label>
                            <input
                              type="text"
                              value={newMenuForm.spiceLevel}
                              onChange={(e) =>
                                setNewMenuForm((p) => ({ ...p, spiceLevel: e.target.value }))
                              }
                              className="w-full bg-white border border-[#30251F]/20 rounded-lg px-3 py-2 text-xs text-[#30251F]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#30251F] mb-1">
                              Label Singkat
                            </label>
                            <input
                              type="text"
                              value={newMenuForm.signatureTag}
                              onChange={(e) =>
                                setNewMenuForm((p) => ({ ...p, signatureTag: e.target.value }))
                              }
                              className="w-full bg-white border border-[#30251F]/20 rounded-lg px-3 py-2 text-xs text-[#30251F]"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-[#30251F] mb-1">
                              Deskripsi Singkat Menu
                            </label>
                            <textarea
                              rows={2}
                              value={newMenuForm.description}
                              onChange={(e) =>
                                setNewMenuForm((p) => ({ ...p, description: e.target.value }))
                              }
                              placeholder="Jelaskan cita rasa dan lauk utama hidangan..."
                              className="w-full bg-white border border-[#30251F]/20 rounded-lg px-3 py-2 text-xs text-[#30251F]"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-[#30251F] mb-1">
                              Isian Komplit (pisahkan dengan koma)
                            </label>
                            <input
                              type="text"
                              value={newMenuForm.sidesText}
                              onChange={(e) =>
                                setNewMenuForm((p) => ({ ...p, sidesText: e.target.value }))
                              }
                              className="w-full bg-white border border-[#30251F]/20 rounded-lg px-3 py-2 text-xs text-[#30251F]"
                            />
                          </div>
                          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#30251F]/15 bg-[#E4DCCB] shrink-0">
                              <FoodImage src={newMenuForm.imageUrl} alt={newMenuForm.name || 'Pratinjau foto'} />
                            </div>
                            <input
                              type="text"
                              value={newMenuForm.imageUrl.startsWith('data:') ? '' : newMenuForm.imageUrl}
                              onChange={(e) =>
                                setNewMenuForm((p) => ({ ...p, imageUrl: e.target.value }))
                              }
                              placeholder={
                                newMenuForm.imageUrl.startsWith('data:')
                                  ? '✓ Foto upload siap (tersimpan permanen) — atau tempel link URL baru'
                                  : 'Tempel URL foto menu atau klik Upload Foto'
                              }
                              className="flex-1 min-w-[200px] bg-white border border-[#30251F]/20 rounded-lg px-3 py-2 text-xs text-[#30251F]"
                            />
                            <label className="px-3 py-2 rounded-lg bg-[#EFE9DC] hover:bg-[#E4DCCB] border border-[#30251F]/15 text-[#30251F] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                              <Upload className="w-3.5 h-3.5" />
                              <span>{newMenuForm.imageUrl.startsWith('data:') ? 'Ganti Foto' : 'Upload Foto'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePhotoUploadForForm(e, setNewMenuForm)}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="submit"
                              className="px-4 py-2 rounded-lg bg-[#A83A2D] hover:bg-[#8C2D22] text-white text-xs font-bold cursor-pointer"
                            >
                              Simpan Menu Baru
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* Menu Rows */}
                    <div className="space-y-3">
                      {menuItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/12 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-[#30251F]/12 bg-[#E4DCCB]">
                                <FoodImage src={item.imageUrl} alt={item.name} />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-[#30251F]">{item.name}</div>
                                <div className="text-xs text-[#9A7013] font-mono-tabular font-semibold">
                                  {formatRupiah(item.basePrice)} ·{' '}
                                  <span className="text-[#6E5D53] font-sans font-normal">
                                    {item.category === 'spesial' ? 'Spesial' : 'Reguler'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-[#6E5D53]">Rp</span>
                                <input
                                  type="number"
                                  step={1000}
                                  value={item.basePrice}
                                  onChange={(e) =>
                                    handleMenuPriceChange(item.id, Number(e.target.value))
                                  }
                                  aria-label={`Harga ${item.name}`}
                                  className="w-24 bg-white border border-[#30251F]/20 rounded-lg px-2.5 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleMenuAvailabilityToggle(item.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                  item.isAvailable
                                    ? 'bg-[#E9F0EC] text-[#193D2B] border border-[#193D2B]/25'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                              >
                                {item.isAvailable ? 'Tersedia' : 'Habis'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  editingMenuId === item.id
                                    ? setEditingMenuId(null)
                                    : startEditingMenu(item)
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#E4DCCB] border border-[#30251F]/15 text-[#30251F] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>{editingMenuId === item.id ? 'Tutup' : 'Edit'}</span>
                              </button>

                              {confirmDeleteId === item.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMenu(item.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer"
                                  >
                                    Ya, Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-1.5 rounded-lg bg-white border border-[#30251F]/15 text-xs text-[#6E5D53] cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  className="p-1.5 rounded-lg bg-white hover:bg-red-50 border border-[#30251F]/15 text-red-700 cursor-pointer"
                                  aria-label={`Hapus ${item.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Inline Full Edit Drawer for Item */}
                          {editingMenuId === item.id && (
                            <div className="pt-3 border-t border-[#30251F]/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                                  Nama Menu
                                </label>
                                <input
                                  type="text"
                                  value={editMenuForm.name}
                                  onChange={(e) =>
                                    setEditMenuForm((p) => ({ ...p, name: e.target.value }))
                                  }
                                  className="w-full bg-white border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                                    Kategori
                                  </label>
                                  <select
                                    value={editMenuForm.category}
                                    onChange={(e) =>
                                      setEditMenuForm((p) => ({
                                        ...p,
                                        category: e.target.value as 'reguler' | 'spesial',
                                      }))
                                    }
                                    className="w-full bg-white border border-[#30251F]/20 rounded-lg px-2 py-1.5 text-xs text-[#30251F]"
                                  >
                                    <option value="reguler">Reguler</option>
                                    <option value="spesial">Spesial</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                                    Harga (Rp)
                                  </label>
                                  <input
                                    type="number"
                                    step={1000}
                                    min={1000}
                                    value={editMenuForm.basePrice}
                                    onChange={(e) =>
                                      setEditMenuForm((p) => ({
                                        ...p,
                                        basePrice: Number(e.target.value),
                                      }))
                                    }
                                    className="w-full bg-white border border-[#30251F]/20 rounded-lg px-2 py-1.5 text-xs font-mono-tabular text-[#30251F]"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                                  Karakter Rasa
                                </label>
                                <input
                                  type="text"
                                  value={editMenuForm.spiceLevel}
                                  onChange={(e) =>
                                    setEditMenuForm((p) => ({
                                      ...p,
                                      spiceLevel: e.target.value,
                                    }))
                                  }
                                  className="w-full bg-white border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                                  Label Singkat (Signature Tag)
                                </label>
                                <input
                                  type="text"
                                  value={editMenuForm.signatureTag}
                                  onChange={(e) =>
                                    setEditMenuForm((p) => ({
                                      ...p,
                                      signatureTag: e.target.value,
                                    }))
                                  }
                                  className="w-full bg-white border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                                  Deskripsi Menu
                                </label>
                                <textarea
                                  rows={2}
                                  value={editMenuForm.description}
                                  onChange={(e) =>
                                    setEditMenuForm((p) => ({
                                      ...p,
                                      description: e.target.value,
                                    }))
                                  }
                                  className="w-full bg-white border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-medium text-[#6E5D53] mb-1">
                                  Isian Komplit (pisahkan dengan koma)
                                </label>
                                <input
                                  type="text"
                                  value={editMenuForm.sidesText}
                                  onChange={(e) =>
                                    setEditMenuForm((p) => ({ ...p, sidesText: e.target.value }))
                                  }
                                  className="w-full bg-white border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                                />
                              </div>
                              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#30251F]/15 bg-[#E4DCCB] shrink-0">
                                  <FoodImage src={editMenuForm.imageUrl} alt={editMenuForm.name} />
                                </div>
                                <input
                                  type="text"
                                  value={editMenuForm.imageUrl.startsWith('data:') ? '' : editMenuForm.imageUrl}
                                  onChange={(e) => {
                                    setEditMenuForm((p) => ({ ...p, imageUrl: e.target.value }));
                                    handleMenuImageChange(item.id, e.target.value);
                                  }}
                                  placeholder={
                                    editMenuForm.imageUrl.startsWith('data:')
                                      ? '✓ Foto upload aktif (tersimpan permanen) — atau tempel link URL baru'
                                      : 'URL Foto Menu atau klik Upload Foto'
                                  }
                                  className="flex-1 min-w-[180px] bg-white border border-[#30251F]/20 rounded-lg px-3 py-1.5 text-xs text-[#30251F]"
                                />
                                <label className="px-3 py-1.5 rounded-lg bg-[#EFE9DC] hover:bg-[#E4DCCB] border border-[#30251F]/15 text-[#30251F] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>{editMenuForm.imageUrl.startsWith('data:') ? 'Ganti Foto' : 'Upload Foto'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handlePhotoUploadForForm(e, setEditMenuForm, item.id)
                                    }
                                    className="hidden"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditMenu(item.id)}
                                  className="px-4 py-1.5 rounded-lg bg-[#193D2B] hover:bg-[#122E20] text-white text-xs font-bold cursor-pointer"
                                >
                                  Simpan Perubahan
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5. Explicit Master Permanent Save & Firebase Vault Card */}
                  <div
                    className={`p-5 rounded-2xl border space-y-4 shadow-sm ${
                      isAdminCloudVerified
                        ? 'bg-[#E9F0EC] border-[#193D2B]/30'
                        : 'bg-amber-50 border-amber-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div
                          className={`text-sm font-extrabold flex items-center gap-2 ${
                            isAdminCloudVerified ? 'text-[#193D2B]' : 'text-amber-900'
                          }`}
                        >
                          {isAdminCloudVerified ? (
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                          )}
                          <span>
                            {isAdminCloudVerified
                              ? 'Proteksi Permanen Cloud Firestore Firebase Aktif'
                              : 'Aktifkan Proteksi Permanen Firebase Cloud'}
                          </span>
                        </div>
                        <p className="text-xs text-[#30251F] leading-relaxed">
                          {isAdminCloudVerified ? (
                            <>
                              Semua foto menu HD, harga, nama kedai, alamat, koordinat kedai, status buka/tutup, nomor WA, DANA/GoPay, dan QRIS disimpan permanen ke <strong>Cloud Firestore Firebase</strong> atas otoritas akun <strong>{currentUser?.email}</strong>. Tidak akan pernah kembali ke default atau tertimpa update website.
                            </>
                          ) : (
                            <>
                              Saat ini perubahan baru tersimpan di perangkat ini. Hubungkan <strong>Akun Google Owner</strong> di tab <strong>Vault Firebase</strong> untuk memindahkan &amp; mengunci permanen seluruh pengaturan toko, foto menu HD, QRIS, dan riwayat pesanan ke server Cloud Firestore Firebase.
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                        {isAdminCloudVerified && onForceCloudSync ? (
                          <button
                            type="button"
                            disabled={isCloudSyncing}
                            onClick={async () => {
                              setIsCloudSyncing(true);
                              const ok = await onForceCloudSync();
                              setIsCloudSyncing(false);
                              triggerSaveFeedback(
                                ok
                                  ? 'Semua pengaturan & foto menu Owner berhasil disimpan permanen ke Firebase Cloud!'
                                  : 'Gagal menyinkronkan ke Firebase Cloud. Periksa koneksi atau buka tab Vault Firebase.'
                              );
                            }}
                            className="px-5 py-3 rounded-xl bg-[#193D2B] hover:bg-[#122E20] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                          >
                            <Check className="w-4 h-4 shrink-0" />
                            <span>
                              {isCloudSyncing
                                ? 'Menyimpan ke Firebase...'
                                : 'Simpan Permanen ke Firebase'}
                            </span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setActiveTab('vault')}
                          className={`px-4 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                            isAdminCloudVerified
                              ? 'bg-white hover:bg-[#F7F3E9] border border-[#193D2B]/30 text-[#193D2B]'
                              : 'bg-[#A83A2D] hover:bg-[#8C2D22] text-white'
                          }`}
                        >
                          <Database className="w-4 h-4 shrink-0" />
                          <span>
                            {isAdminCloudVerified
                              ? 'Buka Vault & Audit'
                              : 'Buka Vault & Migrasi Firebase'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#30251F]/12 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#6E5D53]">
                        Cadangan File Master Owner Offline (arsip pribadi HP/laptop):
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleExportOwnerBackup}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F7F3E9] border border-[#193D2B]/30 text-[#193D2B] text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh Cadangan (.json)</span>
                        </button>
                        <label className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F7F3E9] border border-[#30251F]/20 text-[#30251F] text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Pulihkan Cadangan (.json)</span>
                          <input
                            type="file"
                            accept="application/json,.json"
                            onChange={handleImportOwnerBackup}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Always-Accessible Print-Ready QR Code Generator Widget */}
              <div id="qr-print-generator">
                <QrPrintGeneratorWidget
                  storeConfig={storeConfig}
                  cloudCustomUrl={ownerPrivateSettings?.qrCustomUrl}
                  onSaveCloudCustomUrl={(url) => {
                    void onSaveOwnerPrivateSettings?.({ qrCustomUrl: url });
                  }}
                />
              </div>
        </div>
      </div>

      {typeof document !== 'undefined' &&
        previewProofOrder &&
        createPortal(
          <div
            onClick={(e) => {
              e.stopPropagation();
              setPreviewProofOrder(null);
            }}
            className="fixed inset-0 z-[10010] bg-black/85 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden border border-[#D9A52E]/40 shadow-2xl"
            >
              <div className="px-4 py-3 bg-white border-b border-[#30251F]/12 flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-bold text-[#30251F] truncate">
                  Bukti Pembayaran — {previewProofOrder.customerName}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewProofOrder(null)}
                  className="w-8 h-8 rounded-full bg-[#EFE9DC] text-[#30251F] flex items-center justify-center cursor-pointer"
                  aria-label="Tutup Pratinjau Bukti Pembayaran"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-[#0F1E16] h-[65dvh] w-full overflow-hidden">
                <ZoomableImageViewer
                  src={previewProofOrder.url}
                  alt={`Bukti pembayaran ${previewProofOrder.customerName}`}
                  stageBgClassName="bg-[#0F1E16]"
                  imgClassName="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
