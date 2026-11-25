import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Truck,
  Store,
  QrCode,
  Copy,
  Check,
  Send,
  ShoppingBag,
  Maximize2,
  ArrowUpRight,
  Download,
  AlertCircle,
  User,
  Phone,
  FileText,
  ExternalLink,
  HelpCircle,
  ChevronLeft,
  Pencil,
  Wallet,
  PlayCircle,
  Upload,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  CartItem,
  CustomerOrderDraft,
  FulfillmentType,
  OrderRecord,
  SavedCustomerLocation,
  StoreConfig,
} from '../types';
import { formatRupiah } from '../data/initialData';
import { ZoomableImageViewer } from './ZoomableImageViewer';
import {
  QrisLogo,
  DanaLogoIcon,
  DanaLogoInline,
  GopayLogoIcon,
  GopayLogoInline,
} from './BrandLogos';
import { FoodImage } from './FoodImage';
import { CustomerLocationMapPicker } from './CustomerLocationMapPicker';
import {
  buildCustomerWaMeUrl,
  buildStructuredWhatsAppMessage,
  buildValidGoogleMapsCoordUrl,
  buildWhatsAppOrderUrl,
  formatIndonesianPhoneDisplay,
  getCartItemSubtotal,
  getFulfillmentLabel,
  getPaymentMethodLabel,
  getRiceTypeLabel,
  getSambalPlainText,
  isValidIndonesianMobilePhone,
  parseCoordsFromGoogleMapsUrl,
  validateCheckoutOrder,
  CheckoutValidationResult,
} from '../utils/checkoutOrder';
import { safeCopyToClipboard, safeOpenWalletScheme } from '../utils/safeBrowser';
import { compressImageFileToDataUrl } from '../utils/imageHelper';
import {
  LAST_ORDER_STORAGE_KEY,
  LAST_ORDER_UPDATED_EVENT,
  LastOrderSnapshot,
} from './QuickOrderHub';

const DRAFT_STORAGE_KEY = 'nkl_customer_draft_v1';
const PREVIEW_THANKS_AUDIO_SRC = '/audio/order-preview-thanks.mp3';
const PREVIEW_THANKS_SESSION_KEY = 'nkl_preview_thanks_played_v1';

function readThanksPlayedSession(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(PREVIEW_THANKS_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function dataUrlToImageFile(dataUrl: string, fileName?: string): File | null {
  try {
    const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!match) return null;
    const mime = match[1].toLowerCase();
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const safeBase = (fileName || 'bukti-pembayaran')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .slice(0, 40) || 'bukti-pembayaran';
    return new File([bytes], `${safeBase}.${ext}`, { type: mime });
  } catch {
    return null;
  }
}

async function dataUrlToPngBlob(dataUrl: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      if (/^https?:\/\//i.test(dataUrl)) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 800;
          canvas.height = img.naturalHeight || img.height || 800;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}

function supportsWebShareWithImageFile(): boolean {
  try {
    if (typeof navigator === 'undefined') return false;
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
      return false;
    }
    const testFile = new File([new Uint8Array([137, 80, 78, 71])], 'test.png', {
      type: 'image/png',
    });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

const INITIAL_DRAFT: CustomerOrderDraft = {
  customerName: '',
  customerPhone: '',
  whatsappActiveConfirmed: true,
  fulfillment: '',
  deliveryAddress: '',
  alleyDetail: '',
  landmark: '',
  googleMapsLink: '',
  courierInfo: '',
  customerNotes: '',
  paymentMethod: 'qris',
};

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onUpdateItemNote?: (cartItemId: string, note: string) => void;
  onClearCart: () => void;
  storeConfig: StoreConfig;
  onOpenQrisLightbox: () => void;
  onOrderLogged?: (order: OrderRecord) => void;
  savedLocations: SavedCustomerLocation[];
  currentUser: FirebaseUser | null;
  onSignInGoogle: () => Promise<void>;
  onSaveLocation: (loc: Omit<SavedCustomerLocation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  onDeleteLocation: (locId: string) => Promise<void>;
  onOpenTutorial?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateItemNote,
  onClearCart,
  storeConfig,
  onOpenQrisLightbox,
  onOrderLogged,
  savedLocations,
  currentUser,
  onSignInGoogle,
  onSaveLocation,
  onDeleteLocation,
  onOpenTutorial,
}) => {
  const [draft, setDraft] = useState<CustomerOrderDraft>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const safeMethod =
          parsed?.paymentMethod === 'gopay' || parsed?.paymentMethod === 'dana'
            ? parsed.paymentMethod
            : 'qris';
        return { ...INITIAL_DRAFT, ...parsed, paymentMethod: safeMethod };
      }
      return INITIAL_DRAFT;
    } catch {
      return INITIAL_DRAFT;
    }
  });

  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [validation, setValidation] = useState<CheckoutValidationResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [walletNotice, setWalletNotice] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [waSentPendingNotice, setWaSentPendingNotice] = useState<boolean>(false);
  const [proofImageAutoCopied, setProofImageAutoCopied] = useState<boolean>(false);
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);
  const [proofUploadError, setProofUploadError] = useState<string | null>(null);
  const [proofShareNotice, setProofShareNotice] = useState<string | null>(null);
  const [isProofLightboxOpen, setIsProofLightboxOpen] = useState<boolean>(false);
  const proofFileInputRef = useRef<HTMLInputElement | null>(null);
  const proofFileRef = useRef<File | null>(null);
  const proofPngBlobRef = useRef<Blob | null>(null);
  const lastLoggedOrderSigRef = useRef<string>('');
  const thanksAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedThanksRef = useRef<boolean>(readThanksPlayedSession());
  const canShareFiles = React.useMemo(() => supportsWebShareWithImageFile(), []);

  // Pre-fill default saved location if deliveryAddress & coordinates are empty
  useEffect(() => {
    if (savedLocations.length === 0) return;
    setDraft((prev) => {
      if (prev.deliveryAddress.trim() || prev.googleMapsLink.trim()) return prev;
      const def = savedLocations.find((l) => l.isDefault) || savedLocations[0];
      if (!def) return prev;
      return {
        ...prev,
        customerName: prev.customerName || def.recipientName || '',
        customerPhone: prev.customerPhone || def.recipientPhone || '',
        deliveryAddress: def.deliveryAddress,
        alleyDetail: def.alleyDetail || '',
        landmark: def.landmark || '',
        googleMapsLink: def.googleMapsLink,
        customerLat: def.lat,
        customerLng: def.lng,
      };
    });
  }, [savedLocations]);

  // Persist customer form draft so data is never lost
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      try {
        const compactDraft: CustomerOrderDraft = {
          ...draft,
          paymentProofDataUrl: undefined,
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(compactDraft));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [draft]);

  useEffect(() => {
    if (!isOpen) return;
    setValidation(null);
    setWaSentPendingNotice(false);
    setProofImageAutoCopied(false);
    setWalletNotice(null);
    setProofShareNotice(null);
    setIsProofLightboxOpen(false);
    lastLoggedOrderSigRef.current = '';
  }, [isOpen]);

  useEffect(() => {
    if (!isProofLightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProofLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [isProofLightboxOpen]);

  const stopPreviewThanksAudio = () => {
    const audio = thanksAudioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore audio reset errors
    }
  };

  const resetThanksAudioMarker = () => {
    hasPlayedThanksRef.current = false;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(PREVIEW_THANKS_SESSION_KEY);
      }
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const audio = new Audio(PREVIEW_THANKS_AUDIO_SRC);
    audio.loop = false;
    audio.preload = 'auto';
    thanksAudioRef.current = audio;

    return () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore cleanup errors
      }
      if (thanksAudioRef.current === audio) {
        thanksAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopPreviewThanksAudio();
    }
  }, [isOpen]);

  useEffect(() => {
    if (cart.length === 0) {
      stopPreviewThanksAudio();
      resetThanksAudioMarker();
    }
  }, [cart.length]);

  useEffect(() => {
    if (cart.length === 0 && step === 'preview') {
      setStep('form');
    }
  }, [cart.length, step]);

  const updateDraft = <K extends keyof CustomerOrderDraft>(
    key: K,
    value: CustomerOrderDraft[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (validation) {
      setValidation(null);
    }
  };

  const patchDraft = (patch: Partial<CustomerOrderDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    if (validation) {
      setValidation(null);
    }
  };

  const foodSubtotal = cart.reduce((acc, item) => acc + getCartItemSubtotal(item), 0);
  const totalPortions = cart.reduce((acc, item) => acc + item.quantity, 0);
  const hasExtraSideDishRequest = cart.some((item) => item.wantExtraSideDish);

  const handleCopy = (text: string, key: string) => {
    void safeCopyToClipboard(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenWalletApp = (wallet: 'dana' | 'gopay') => {
    void safeCopyToClipboard(storeConfig.ewalletNumber);
    setCopiedKey('ewallet');
    setWalletNotice(
      `Nomor ${storeConfig.ewalletNumber} disalin! Membuka aplikasi ${
        wallet === 'dana' ? 'DANA' : 'GoPay'
      }... Jika belum terbuka otomatis di browser, buka aplikasi & tempel nomor di atas.`
    );
    window.setTimeout(() => setWalletNotice(null), 6000);
    safeOpenWalletScheme(wallet);
  };

  const activeProofPreviewSrc =
    draft.paymentProofDataUrl || draft.paymentProofUrl || '';

  // Pre-build File & PNG Blob whenever payment proof changes so ClipboardItem & Web Share
  // execute synchronously inside user click gestures without losing tab focus or iOS/Android permissions.
  useEffect(() => {
    let cancelled = false;

    if (!activeProofPreviewSrc) {
      proofFileRef.current = null;
      proofPngBlobRef.current = null;
      return;
    }

    if (draft.paymentProofDataUrl) {
      proofFileRef.current = dataUrlToImageFile(
        draft.paymentProofDataUrl,
        draft.paymentProofName || 'bukti-pembayaran-lasinrang.jpg'
      );
    }

    const prepareProofAssets = async () => {
      try {
        const pngBlob = await dataUrlToPngBlob(activeProofPreviewSrc);
        if (!cancelled && pngBlob) {
          proofPngBlobRef.current = pngBlob;
          if (!proofFileRef.current) {
            proofFileRef.current = new File(
              [pngBlob],
              (draft.paymentProofName || 'bukti-pembayaran-lasinrang').replace(/\.[^.]+$/, '') + '.png',
              { type: 'image/png' }
            );
          }
        }
      } catch {
        // ignore conversion errors
      }

      if (!cancelled && !proofFileRef.current && draft.paymentProofUrl) {
        try {
          const res = await fetch(draft.paymentProofUrl);
          if (!res.ok) return;
          const blob = await res.blob();
          if (!cancelled) {
            proofFileRef.current = new File(
              [blob],
              draft.paymentProofName || 'bukti-pembayaran-lasinrang.jpg',
              { type: blob.type || 'image/jpeg' }
            );
          }
        } catch {
          // ignore network errors
        }
      }
    };

    void prepareProofAssets();
    return () => {
      cancelled = true;
    };
  }, [activeProofPreviewSrc, draft.paymentProofDataUrl, draft.paymentProofName, draft.paymentProofUrl]);

  const handlePaymentProofFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProofUploadError('Mohon pilih file foto/gambar (JPG, PNG, atau WebP).');
      return;
    }

    setProofUploadError(null);
    setProofShareNotice(null);
    setIsUploadingProof(true);

    try {
      const compressedDataUrl = await compressImageFileToDataUrl(
        file,
        1280,
        0.85,
        320000
      );

      patchDraft({
        paymentProofDataUrl: compressedDataUrl,
        paymentProofName: file.name || 'bukti-pembayaran.jpg',
        paymentProofUrl: undefined,
      });

      try {
        const res = await fetch('/api/payment-proof', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: compressedDataUrl }),
        });

        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean; urlPath?: string };
          if (data.ok && data.urlPath) {
            const fullUrl = new URL(
              data.urlPath,
              window.location.origin
            ).toString();
            patchDraft({
              paymentProofDataUrl: compressedDataUrl,
              paymentProofName: file.name || 'bukti-pembayaran.jpg',
              paymentProofUrl: fullUrl,
            });
          }
        }
      } catch {
        // Fallback: local compressed image still attached via Web Share / Clipboard
      }
    } catch {
      setProofUploadError(
        'Gagal membaca foto bukti pembayaran. Silakan coba pilih foto lain.'
      );
    } finally {
      setIsUploadingProof(false);
      if (proofFileInputRef.current) {
        proofFileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePaymentProof = () => {
    patchDraft({
      paymentProofUrl: undefined,
      paymentProofDataUrl: undefined,
      paymentProofName: undefined,
    });
    proofFileRef.current = null;
    proofPngBlobRef.current = null;
    setProofImageAutoCopied(false);
    setProofUploadError(null);
    setProofShareNotice(null);
    setIsProofLightboxOpen(false);
    if (proofFileInputRef.current) {
      proofFileInputRef.current.value = '';
    }
  };

  const copyProofImageToClipboard = async (silent = false): Promise<boolean> => {
    const src = activeProofPreviewSrc;
    if (!src) return false;
    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.clipboard ||
        typeof navigator.clipboard.write !== 'function' ||
        typeof ClipboardItem === 'undefined'
      ) {
        if (!silent) {
          setProofShareNotice(
            'Browser ini tidak mendukung salin gambar otomatis. Gunakan tombol "Kirim Gambar ke WA" atau "Unduh" lalu lampirkan di chat WhatsApp.'
          );
        }
        return false;
      }

      const readyPngBlob = proofPngBlobRef.current;
      if (readyPngBlob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': readyPngBlob }),
        ]);
      } else {
        const pngPromise = dataUrlToPngBlob(src).then((blob) => {
          if (!blob) {
            throw new Error('Failed to build PNG blob');
          }
          proofPngBlobRef.current = blob;
          return blob;
        });
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngPromise }),
        ]);
      }

      setProofImageAutoCopied(true);
      if (!silent) {
        setCopiedKey('proof-image');
        setTimeout(() => setCopiedKey(null), 2500);
        setProofShareNotice(
          'Gambar bukti berhasil disalin! Di chat WhatsApp, cukup tekan Tempel / Paste (Ctrl+V atau ikon gambar di keyboard) agar muncul langsung di bawah chat.'
        );
      }
      return true;
    } catch {
      setProofImageAutoCopied(false);
      if (!silent) {
        setProofShareNotice(
          'Gagal menyalin gambar ke clipboard di browser ini. Ketuk "Kirim Gambar ke WA" atau "Unduh" untuk mengirim fotonya langsung di chat WhatsApp.'
        );
      }
      return false;
    }
  };

  const handleSaveCurrentLocationFromPicker = async (label: string): Promise<boolean> => {
    if (typeof draft.customerLat !== 'number' || typeof draft.customerLng !== 'number') {
      return false;
    }
    const mapsLink =
      draft.googleMapsLink.trim() ||
      buildValidGoogleMapsCoordUrl(draft.customerLat, draft.customerLng) ||
      '';
    return onSaveLocation({
      label,
      recipientName: draft.customerName.trim(),
      recipientPhone: draft.customerPhone.trim(),
      deliveryAddress:
        draft.deliveryAddress.trim() ||
        `Koordinat ${draft.customerLat.toFixed(5)}, ${draft.customerLng.toFixed(5)}`,
      alleyDetail: (draft.alleyDetail || '').trim(),
      landmark: draft.landmark.trim(),
      lat: draft.customerLat,
      lng: draft.customerLng,
      googleMapsLink: mapsLink,
      isDefault: true,
    });
  };

  const playPreviewThanksAudioOnce = () => {
    if (hasPlayedThanksRef.current) return;
    hasPlayedThanksRef.current = true;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(PREVIEW_THANKS_SESSION_KEY, '1');
      }
    } catch {
      // ignore storage errors
    }

    if (typeof Audio === 'undefined') return;
    let audio = thanksAudioRef.current;
    if (!audio) {
      audio = new Audio(PREVIEW_THANKS_AUDIO_SRC);
      thanksAudioRef.current = audio;
    }
    audio.loop = false;
    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // ignore autoplay restriction errors gracefully
        });
      }
    } catch {
      // ignore playback errors
    }
  };

  const handleCloseCheckout = () => {
    stopPreviewThanksAudio();
    onClose();
  };

  const handleProceedToPreview = () => {
    const result = validateCheckoutOrder(cart, draft);
    if (!result.isValid) {
      setValidation(result);
      if (result.fieldErrors.customerName) {
        document.getElementById('checkout-customer-name')?.focus();
      } else if (result.fieldErrors.customerPhone) {
        document.getElementById('checkout-customer-phone')?.focus();
      } else if (result.fieldErrors.fulfillment) {
        document
          .getElementById('checkout-fulfillment-section')
          ?.scrollIntoView({ behavior: 'smooth' });
      } else if (result.fieldErrors.courierInfo) {
        document.getElementById('checkout-courier-info')?.focus();
      } else if (result.fieldErrors.deliveryAddress) {
        document.getElementById('checkout-delivery-address')?.focus();
      } else if (result.fieldErrors.googleMapsLink) {
        document.getElementById('checkout-maps-link')?.focus();
      }
      return;
    }

    playPreviewThanksAudioOnce();
    setValidation(null);
    setWaSentPendingNotice(false);
    setStep('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const logOrderIfNeeded = () => {
    const currentSignature = JSON.stringify({
      customerName: draft.customerName.trim(),
      customerPhone: draft.customerPhone.trim(),
      fulfillment: draft.fulfillment,
      deliveryAddress: draft.deliveryAddress.trim(),
      alleyDetail: (draft.alleyDetail || '').trim(),
      paymentMethod: draft.paymentMethod,
      paymentProofUrl: draft.paymentProofUrl || '',
      foodSubtotal,
      items: cart.map(
        (c) =>
          `${c.menuItem.id}:${c.riceType || 'nasi_kuning'}:${c.quantity}:${c.unitPrice}:${c.sambalPreference}:${c.toppingScope || 'per_portion'}:${(c.toppings || [])
            .map((t) => `${t.id}x${t.quantity}`)
            .join(',')}`
      ),
    });

    if (onOrderLogged && draft.fulfillment && lastLoggedOrderSigRef.current !== currentSignature) {
      lastLoggedOrderSigRef.current = currentSignature;
      const record: OrderRecord = {
        id: `ORD-${Date.now()}`,
        createdAt: new Date().toISOString(),
        customerName: draft.customerName.trim(),
        customerPhone: draft.customerPhone.trim(),
        fulfillment: draft.fulfillment,
        deliveryAddress: [draft.deliveryAddress.trim(), (draft.alleyDetail || '').trim()]
          .filter(Boolean)
          .join(' · '),
        landmark: draft.landmark.trim(),
        googleMapsLink:
          draft.googleMapsLink.trim() ||
          (typeof draft.customerLat === 'number' && typeof draft.customerLng === 'number'
            ? buildValidGoogleMapsCoordUrl(draft.customerLat, draft.customerLng) || ''
            : ''),
        customerLat: draft.customerLat,
        customerLng: draft.customerLng,
        courierInfo: draft.courierInfo.trim(),
        customerNotes: draft.customerNotes.trim(),
        paymentMethod: draft.paymentMethod,
        ...(draft.paymentProofUrl ? { paymentProofUrl: draft.paymentProofUrl } : {}),
        itemsSummary: cart.map((c) => ({
          name: c.menuItem.name,
          quantity: c.quantity,
          riceType: c.riceType || 'nasi_kuning',
          portionLabel: c.portionLabel,
          unitPrice: c.unitPrice,
          sambalPreference: c.sambalPreference,
          ...(c.toppings && c.toppings.length > 0 ? { toppings: c.toppings } : {}),
          ...(c.toppingTotal && c.toppingTotal > 0 ? { toppingTotal: c.toppingTotal } : {}),
          ...(c.toppingScope ? { toppingScope: c.toppingScope } : {}),
          wantExtraSideDish: c.wantExtraSideDish,
          extraSideDishNote: c.extraSideDishNote,
          itemNote: c.itemNote,
        })),
        foodSubtotal,
        status: 'Menunggu Konfirmasi',
      };
      onOrderLogged(record);
    }

    if (cart.length > 0) {
      try {
        const snapshot: LastOrderSnapshot = {
          orderId: `ORD-${Date.now()}`,
          savedAt: new Date().toISOString(),
          customerName: draft.customerName.trim() || undefined,
          totalPrice: foodSubtotal,
          totalPortions,
          items: cart.map((c) => ({
            menuId: c.menuItem.id,
            name: c.menuItem.name,
            quantity: c.quantity,
            riceType: c.riceType || 'nasi_kuning',
            portionType: c.portionType,
            portionLabel: c.portionLabel,
            unitPrice: c.unitPrice,
            sambalPreference: c.sambalPreference,
            ...(c.toppings && c.toppings.length > 0 ? { toppings: c.toppings } : {}),
            ...(c.toppingTotal && c.toppingTotal > 0 ? { toppingTotal: c.toppingTotal } : {}),
            ...(c.toppingScope ? { toppingScope: c.toppingScope } : {}),
            wantExtraSideDish: c.wantExtraSideDish,
            extraSideDishNote: c.extraSideDishNote,
            itemNote: c.itemNote,
          })),
        };
        localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(snapshot));
        window.dispatchEvent(new Event(LAST_ORDER_UPDATED_EVENT));
      } catch {
        // ignore storage quota errors
      }
    }
  };

  const whatsappMessage = buildStructuredWhatsAppMessage(cart, draft, storeConfig);
  const whatsappUrl = buildWhatsAppOrderUrl(cart, draft, storeConfig);

  const resolveReadyProofFile = async (): Promise<File | null> => {
    if (proofFileRef.current) return proofFileRef.current;

    let fileToShare: File | null = draft.paymentProofDataUrl
      ? dataUrlToImageFile(
          draft.paymentProofDataUrl,
          draft.paymentProofName || 'bukti-pembayaran-lasinrang.jpg'
        )
      : null;

    if (!fileToShare && draft.paymentProofUrl) {
      try {
        const res = await fetch(draft.paymentProofUrl);
        const blob = await res.blob();
        fileToShare = new File(
          [blob],
          draft.paymentProofName || 'bukti-pembayaran-lasinrang.jpg',
          { type: blob.type || 'image/jpeg' }
        );
      } catch {
        fileToShare = null;
      }
    }

    if (fileToShare) {
      proofFileRef.current = fileToShare;
    }
    return fileToShare;
  };

  // Direct 1-Tap WhatsApp Admin Flow:
  // Always routes directly to Admin's wa.me chat without forcing the customer to save Admin's contact.
  // Uploaded payment proof URL is automatically included in the structured WA message, and the
  // proof image is non-blockingly copied to clipboard for optional 1-tap paste inside the chat.
  const handleDirectWhatsAppSend = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isUploadingProof) {
      e.preventDefault();
      return;
    }
    stopPreviewThanksAudio();
    resetThanksAudioMarker();
    setWaSentPendingNotice(true);
    logOrderIfNeeded();

    if (activeProofPreviewSrc) {
      setProofShareNotice(
        draft.paymentProofUrl
          ? `Chat WhatsApp Admin (${storeConfig.whatsappDisplay}) langsung terbuka tanpa perlu simpan nomor — rincian pesanan & foto bukti pembayaran sudah terisi otomatis.`
          : `Chat WhatsApp Admin (${storeConfig.whatsappDisplay}) langsung terbuka tanpa perlu simpan nomor. Jika perlu, Anda juga bisa menyalin/melampirkan foto bukti di chat.`
      );
      void copyProofImageToClipboard(true);
    }
  };

  // Optional OS file share (only if customer explicitly prefers Share Sheet with saved contacts)
  const handleOptionalWebShareProof = async () => {
    const fileToShare = await resolveReadyProofFile();
    if (
      !fileToShare ||
      typeof navigator === 'undefined' ||
      typeof navigator.share !== 'function'
    ) {
      return;
    }
    try {
      await navigator.share({
        files: [fileToShare],
        title: `Pesanan & Bukti Pembayaran - ${storeConfig.brandName}`,
        text: whatsappMessage,
      });
    } catch {
      // ignore user cancel or share failure
    }
  };

  const fulfillmentOptions: Array<{
    id: FulfillmentType;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'pickup',
      title: '1. Ambil Sendiri di Tempat',
      desc: 'Saya akan mengambil pesanan langsung di kedai depan Patung Lasinrang (Bebas Ongkir).',
      icon: <Store className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'own_courier',
      title: '2. Pakai Jasa GoFood atau Maxim',
      desc: 'Saya memesan driver GoFood, GoSend, atau Maxim dengan titik jemput kedai.',
      icon: <Truck className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'help_courier',
      title: '3. Pakai Kurir Area Kota Pinrang',
      desc: 'Pesanan langsung diantar oleh kurir area Kota Pinrang ke alamat saya.',
      icon: <HelpCircle className="w-4 h-4 shrink-0" />,
    },
  ];

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="min-h-screen w-full bg-[#F7F3E9] text-[#30251F] flex flex-col"
      role="main"
      aria-labelledby="checkout-modal-title"
    >
      {/* Sleek Modern Glass Header */}
      <header className="sticky top-0 z-40 bg-[#F7F3E9]/90 backdrop-blur-xl border-b border-[#30251F]/10 shadow-[0_4px_24px_rgba(25,61,43,0.05)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (step === 'preview') {
                  setStep('form');
                  setWaSentPendingNotice(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  handleCloseCheckout();
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#193D2B] hover:text-[#F7F3E9] text-[#193D2B] text-xs font-bold flex items-center gap-1.5 border border-[#30251F]/12 cursor-pointer shrink-0 transition-all shadow-xs"
              aria-label={step === 'preview' ? 'Kembali ke Formulir Pesanan' : 'Kembali ke Beranda'}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline">
                {step === 'preview' ? 'Ubah Data' : 'Kembali'}
              </span>
            </button>
            <img
              src="/assets/aistudio/file_000000004bd48211a316832fba565d37_46611b00.png"
              alt="Logo Nasi Kuning Lasinrang"
              loading="eager"
              decoding="async"
              draggable={false}
              className="w-10 h-10 rounded-full object-contain shrink-0 ring-1 ring-[#D9A52E]/70 bg-white emblem-3d-hd"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9A7013]">
                {step === 'preview' ? 'Langkah 2 dari 2 · Konfirmasi Akhir' : 'Langkah 1 dari 2 · Detail Pesanan'}
              </div>
              <h1
                id="checkout-modal-title"
                className="text-base sm:text-xl font-bold text-[#193D2B] font-serif-display truncate"
              >
                {step === 'preview'
                  ? 'Pratinjau & Kirim Pesanan'
                  : 'Penyelesaian Pesanan Anda'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden md:flex flex-col items-end pr-3 border-r border-[#30251F]/12">
              <span className="text-[10px] font-semibold text-[#6E5D53]">
                Total ({totalPortions} Porsi)
              </span>
              <span className="text-sm font-bold font-mono-tabular text-[#A83A2D]">
                {formatRupiah(foodSubtotal)}
              </span>
            </div>
            {onOpenTutorial && (
              <button
                type="button"
                onClick={() => {
                  stopPreviewThanksAudio();
                  onOpenTutorial();
                }}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#EFE9DC] text-[#193D2B] border border-[#D9A52E]/50 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                title="Putar Video Tutorial Cara Pesan & Bayar"
              >
                <PlayCircle className="w-3.5 h-3.5 text-[#9A7013] shrink-0" />
                <span className="hidden sm:inline">Panduan Video</span>
                <span className="sm:hidden">Tutorial</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Modern 2-Column Split Checkout Workspace */}
      <div className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-9 pb-14">
              {cart.length === 0 ? (
                <div className="editorial-plate bg-white p-12 text-center max-w-xl mx-auto my-8 space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-[#F7F3E9] border border-[#30251F]/10 flex items-center justify-center mx-auto text-[#9A7013]">
                    <ShoppingBag className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-xl font-bold font-serif-display text-[#193D2B]">
                      Keranjang Pesanan Masih Kosong
                    </h4>
                    <p className="text-xs text-[#6E5D53] max-w-sm mx-auto leading-relaxed">
                      Silakan pilih menu favorit {storeConfig.brandName} dari katalog utama untuk mulai memesan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseCheckout}
                    className="px-6 py-3 rounded-xl bg-[#193D2B] hover:bg-[#12291D] text-[#F7F3E9] font-bold text-xs cursor-pointer transition-colors shadow-sm"
                  >
                    Lihat Katalog Menu
                  </button>
                </div>
              ) : step === 'form' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-9 items-start">
                  {/* LEFT 5 COLUMNS: ORDER TRAY & SUMMARY */}
                  <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
                    <div className="editorial-plate bg-white p-4 sm:p-5 space-y-4">
                      <div className="pb-3 border-b border-[#30251F]/10 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9A7013]">
                            Ringkasan Menu
                          </div>
                          <span className="text-sm font-bold font-serif-display text-[#193D2B]">
                            Menu Dipilih ({totalPortions} Porsi)
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              stopPreviewThanksAudio();
                              resetThanksAudioMarker();
                              handleRemovePaymentProof();
                              onClearCart();
                              setWaSentPendingNotice(false);
                              setStep('form');
                              onClose();
                            }}
                            className="text-[11px] text-red-700 hover:text-red-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCloseCheckout}
                            className="px-2.5 py-1 rounded-lg bg-[#F7F3E9] hover:bg-[#193D2B] hover:text-[#F7F3E9] border border-[#30251F]/12 text-[11px] text-[#193D2B] font-bold cursor-pointer transition-colors"
                          >
                            + Menu
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {cart.map((item) => (
                          <div
                            key={item.cartItemId}
                            className="p-3.5 rounded-2xl bg-[#FBF9F4] border border-[#30251F]/10 space-y-2.5"
                          >
                          <div className="flex items-start justify-between gap-3">
                            <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-[#30251F]/10 bg-[#E4DCCB] photo-3d-hd">
                              <FoodImage
                                src={item.menuItem.imageUrl}
                                alt={item.menuItem.name}
                                className="w-full h-full object-cover culinary-photo"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-[#30251F] truncate">
                                {item.menuItem.name}
                              </h4>
                              <p className="text-xs text-[#193D2B] font-semibold mt-0.5">
                                {getRiceTypeLabel(item.riceType)}
                              </p>
                              <p className="text-xs text-[#9A7013] font-semibold mt-0.5">
                                {item.portionLabel}
                              </p>
                              <p className="text-xs text-[#6E5D53] mt-0.5">
                                {getSambalPlainText(item.sambalPreference, storeConfig)}
                              </p>
                              {item.toppings && item.toppings.length > 0 && (
                                <p className="text-[11px] text-[#9A7013] font-semibold mt-1">
                                  Toping{item.toppingScope === 'total_order' ? ' (Total pesanan ini)' : item.quantity > 1 ? ' (Per porsi)' : ''}:{' '}
                                  {item.toppings
                                    .map((t) =>
                                      item.toppingScope === 'total_order'
                                        ? `${t.name} ×${t.quantity} (+${formatRupiah(
                                            t.unitPrice * t.quantity
                                          )})`
                                        : item.quantity > 1
                                        ? `${t.name} ×${t.quantity}/porsi (+${formatRupiah(
                                            t.unitPrice * t.quantity * item.quantity
                                          )})`
                                        : `${t.name} ×${t.quantity} (+${formatRupiah(
                                            t.unitPrice * t.quantity
                                          )})`
                                    )
                                    .join(', ')}
                                </p>
                              )}
                              {item.wantExtraSideDish && (
                                <p className="text-[11px] text-[#193D2B] font-medium mt-1 bg-[#E9F0EC] inline-block px-2 py-0.5 rounded border border-[#193D2B]/15">
                                  Tambahan lauk:{' '}
                                  {item.extraSideDishNote || 'Konfirmasi Admin WA'}
                                </p>
                              )}
                              {item.itemNote && editingNoteId !== item.cartItemId && (
                                <p className="text-[11px] text-[#6E5D53] italic mt-1">
                                  Catatan: {item.itemNote}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                              <span className="text-sm font-bold text-[#30251F] font-mono-tabular">
                                {formatRupiah(getCartItemSubtotal(item))}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    item.quantity === 1
                                      ? onRemoveItem(item.cartItemId)
                                      : onUpdateQuantity(item.cartItemId, -1)
                                  }
                                  className="w-7 h-7 rounded-lg bg-[#EFE9DC] hover:bg-red-100 text-[#30251F] flex items-center justify-center border border-[#30251F]/12 cursor-pointer"
                                  aria-label="Kurangi"
                                >
                                  {item.quantity === 1 ? (
                                    <Trash2 className="w-3.5 h-3.5 text-red-700" />
                                  ) : (
                                    <Minus className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <span className="w-6 text-center text-xs font-bold font-mono-tabular text-[#30251F]">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                                  className="w-7 h-7 rounded-lg bg-[#EFE9DC] hover:bg-[#E4DCCB] text-[#30251F] flex items-center justify-center border border-[#30251F]/12 cursor-pointer"
                                  aria-label="Tambah"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Quick inline edit note per item */}
                          {onUpdateItemNote && (
                            <div className="pt-2 border-t border-[#30251F]/8">
                              {editingNoteId === item.cartItemId ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={item.itemNote || ''}
                                    onChange={(e) =>
                                      onUpdateItemNote(item.cartItemId, e.target.value)
                                    }
                                    placeholder="Tulis catatan khusus untuk porsi ini..."
                                    className="flex-1 bg-[#F7F3E9] border border-[#30251F]/20 rounded-lg px-2.5 py-1.5 text-xs text-[#30251F] focus:outline-none focus:border-[#A83A2D]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditingNoteId(null)}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#193D2B] text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    Selesai
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(item.cartItemId)}
                                  className="text-[11px] font-medium text-[#6E5D53] hover:text-[#A83A2D] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>
                                    {item.itemNote ? 'Ubah catatan item' : 'Tambah catatan item'}
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      </div>

                      {/* Live Architectural Price Ledger inside Left Sticky Column */}
                      <div className="pt-3 border-t border-[#30251F]/15 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[#6E5D53]">
                          <span>Subtotal Sajian ({totalPortions} Porsi)</span>
                          <span className="font-mono-tabular font-bold text-[#30251F]">
                            {formatRupiah(foodSubtotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#6E5D53]">
                          <span>Metode Penerimaan</span>
                          <span className="font-semibold text-[#193D2B]">
                            {draft.fulfillment ? getFulfillmentLabel(draft.fulfillment, storeConfig) : 'Belum dipilih'}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-[#30251F]/12 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#193D2B]">
                            Total Tagihan Menu
                          </span>
                          <span className="text-base font-extrabold text-[#A83A2D] font-mono-tabular">
                            {formatRupiah(foodSubtotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT 7 COLUMNS: RECIPIENT DOSSIER, FULFILLMENT & PAYMENT SETTLEMENT */}
                  <div className="lg:col-span-7 space-y-6">
                  {/* 2. Customer Identity */}
                  <div className="editorial-plate bg-white p-5 sm:p-6 space-y-4">
                    <div className="pb-2.5 border-b border-[#30251F]/12 flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#193D2B] flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[#9A7013]" />
                        <span>02. Identitas Penerima Pesanan</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#A83A2D]">
                        WAJIB DIISI
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label
                          htmlFor="checkout-customer-name"
                          className="block text-xs font-semibold text-[#30251F] mb-1"
                        >
                          Nama lengkap <span className="text-[#A83A2D]">*</span>
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-[#6E5D53]/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="checkout-customer-name"
                            type="text"
                            value={draft.customerName}
                            onChange={(e) => updateDraft('customerName', e.target.value)}
                            placeholder="Masukkan nama penerima pesanan."
                            className={`w-full bg-white border rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-[#30251F] placeholder:text-[#6E5D53]/60 focus:outline-none ${
                              validation?.fieldErrors.customerName
                                ? 'border-red-500 ring-1 ring-red-200'
                                : 'border-[#30251F]/20 focus:border-[#A83A2D]'
                            }`}
                          />
                        </div>
                        {validation?.fieldErrors.customerName && (
                          <p className="text-[11px] text-red-700 mt-1">
                            {validation.fieldErrors.customerName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="checkout-customer-phone"
                          className="block text-xs font-semibold text-[#30251F] mb-1"
                        >
                          Nomor WhatsApp Aktif (Untuk Kurir &amp; Admin){' '}
                          <span className="text-[#A83A2D]">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-[#6E5D53]/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="checkout-customer-phone"
                            type="tel"
                            inputMode="tel"
                            value={draft.customerPhone}
                            onChange={(e) => updateDraft('customerPhone', e.target.value)}
                            placeholder="Contoh: 0823xxxxxxxx"
                            className={`w-full bg-white border rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono-tabular text-[#30251F] placeholder:font-sans placeholder:text-[#6E5D53]/60 focus:outline-none ${
                              validation?.fieldErrors.customerPhone
                                ? 'border-red-500 ring-1 ring-red-200'
                                : 'border-[#30251F]/20 focus:border-[#A83A2D]'
                            }`}
                          />
                        </div>
                        {validation?.fieldErrors.customerPhone ? (
                          <p className="text-[11px] text-red-700 mt-1">
                            {validation.fieldErrors.customerPhone}
                          </p>
                        ) : draft.customerPhone.trim() &&
                          isValidIndonesianMobilePhone(draft.customerPhone) ? (
                          <p className="text-[11px] text-[#193D2B] font-semibold mt-1 flex items-center gap-1">
                            <Check className="w-3 h-3 shrink-0" />
                            <span>
                              WA Aktif siap dihubungi kurir:{' '}
                              {formatIndonesianPhoneDisplay(draft.customerPhone)}
                            </span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-[#6E5D53] mt-1">
                            Pastikan nomor aktif WhatsApp &amp; bisa ditelepon kurir saat pengantaran.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. Three Explicit Fulfillment Choices */}
                  <div id="checkout-fulfillment-section" className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" />
                      <span>
                        3. Metode Penerimaan Pesanan <span className="text-[#A83A2D]">*</span>
                      </span>
                    </label>

                    <div className="grid grid-cols-1 gap-2.5">
                      {fulfillmentOptions.map((opt) => {
                        const isSelected = draft.fulfillment === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateDraft('fulfillment', opt.id)}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                              isSelected
                                ? 'bg-white border-[#A83A2D] ring-2 ring-[#A83A2D]/15 text-[#30251F] shadow-sm'
                                : 'bg-white/75 border-[#30251F]/12 text-[#6E5D53] hover:border-[#D9A52E]'
                            }`}
                          >
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                isSelected
                                  ? 'bg-[#A83A2D] text-white'
                                  : 'bg-[#EFE9DC] text-[#193D2B]'
                              }`}
                            >
                              {opt.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-[#30251F]">{opt.title}</div>
                              <p className="text-xs text-[#6E5D53] mt-0.5 leading-relaxed">
                                {opt.desc}
                              </p>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                                isSelected
                                  ? 'border-[#A83A2D] bg-[#A83A2D] text-white'
                                  : 'border-[#30251F]/25'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {validation?.fieldErrors.fulfillment && (
                      <p className="text-[11px] text-red-700">
                        {validation.fieldErrors.fulfillment}
                      </p>
                    )}

                    {/* Conditional: A. AMBIL SENDIRI */}
                    {draft.fulfillment === 'pickup' && (
                      <div className="p-3.5 rounded-xl bg-[#E9F0EC] border border-[#193D2B]/20 text-xs space-y-2">
                        <div className="font-bold text-[#193D2B] flex items-center gap-1.5">
                          <Store className="w-4 h-4 shrink-0" />
                          <span>Pengambilan Langsung di Kedai (Bebas Ongkir)</span>
                        </div>
                        <p className="text-[#30251F]/85 leading-relaxed">
                          Lokasi kedai: <strong>{storeConfig.pickupCoordinatesText}</strong>. Tidak
                          perlu mengisi alamat pengantaran.
                        </p>
                        <a
                          href={
                            (typeof storeConfig.storeLat === 'number' &&
                            typeof storeConfig.storeLng === 'number'
                              ? buildValidGoogleMapsCoordUrl(
                                  storeConfig.storeLat,
                                  storeConfig.storeLng
                                )
                              : null) ||
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              storeConfig.googleMapsQuery
                            )}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-semibold text-[#193D2B] hover:underline"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Lihat Rute Menuju Patung Lasinrang</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Conditional: 2. PAKAI JASA GOFOOD ATAU MAXIM */}
                    {draft.fulfillment === 'own_courier' && (
                      <div className="p-4 rounded-xl bg-white border border-[#30251F]/15 space-y-3">
                        <div className="p-3 rounded-lg bg-[#EFE9DC] border border-[#30251F]/10 space-y-1.5 text-xs">
                          <div className="font-semibold text-[#193D2B]">
                            Titik Penjemputan Kedai (Copy-Paste ke GoFood / GoSend / Maxim):
                          </div>
                          <div className="font-mono-tabular font-bold text-[#30251F]">
                            {storeConfig.pickupCoordinatesText}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(storeConfig.pickupCoordinatesText, 'copy-pickup-own')
                            }
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#A83A2D] hover:underline cursor-pointer"
                          >
                            {copiedKey === 'copy-pickup-own' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#193D2B]" />
                                <span className="text-[#193D2B]">Titik jemput tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Salin Titik Jemput Kedai</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="checkout-courier-info"
                            className="block text-xs font-semibold text-[#30251F]"
                          >
                            Pilih atau Tulis Jasa Ojol yang Dipakai <span className="text-[#A83A2D]">*</span>
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {['GoFood', 'GoSend', 'Maxim Delivery'].map((svc) => (
                              <button
                                key={svc}
                                type="button"
                                onClick={() => updateDraft('courierInfo', svc)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                                  draft.courierInfo === svc
                                    ? 'bg-[#193D2B] text-white border-[#193D2B]'
                                    : 'bg-[#F7F3E9] text-[#30251F] border-[#30251F]/20 hover:border-[#D9A52E]'
                                }`}
                              >
                                {svc}
                              </button>
                            ))}
                          </div>
                          <input
                            id="checkout-courier-info"
                            type="text"
                            value={draft.courierInfo}
                            onChange={(e) => updateDraft('courierInfo', e.target.value)}
                            placeholder="Contoh: GoFood, GoSend, atau Maxim Delivery"
                            className={`w-full bg-[#F7F3E9] border rounded-xl px-3.5 py-2.5 text-xs text-[#30251F] placeholder:text-[#6E5D53]/60 focus:outline-none ${
                              validation?.fieldErrors.courierInfo
                                ? 'border-red-500 ring-1 ring-red-200'
                                : 'border-[#30251F]/20 focus:border-[#A83A2D]'
                            }`}
                          />
                          {validation?.fieldErrors.courierInfo && (
                            <p className="text-[11px] text-red-700 mt-1">
                              {validation.fieldErrors.courierInfo}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Conditional: 3. PAKAI KURIR DARI AREA PINRANG */}
                    {draft.fulfillment === 'help_courier' && (
                      <div className="p-3.5 rounded-xl bg-[#F7F3E9] border border-[#D9A52E]/45 text-xs text-[#30251F] leading-relaxed">
                        <strong className="text-[#9A7013] block mb-0.5">
                          Pengantaran Kurir Area Kota Pinrang:
                        </strong>
                        Pesanan Anda diantar langsung oleh kurir area Kota Pinrang ke alamat
                        tujuan. Rincian ongkos kirim dan jadwal pengantaran akan dikonfirmasi
                        melalui WhatsApp.
                      </div>
                    )}
                  </div>

                  {/* 4. Interactive Google Maps Pin & Location System */}
                  {(draft.fulfillment === 'help_courier' || draft.fulfillment === 'own_courier') && (
                    <div className="space-y-4 p-4 rounded-2xl bg-white border border-[#30251F]/12">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#A83A2D]" />
                        <span>
                          4. Titik Google Maps &amp; Alamat Pengantaran{' '}
                          {draft.fulfillment === 'own_courier' ? '(Opsional)' : ''}
                        </span>
                      </div>

                      <CustomerLocationMapPicker
                        storeConfig={storeConfig}
                        customerLat={draft.customerLat}
                        customerLng={draft.customerLng}
                        customerPhone={draft.customerPhone}
                        deliveryAddress={draft.deliveryAddress}
                        alleyDetail={draft.alleyDetail || ''}
                        landmark={draft.landmark}
                        savedLocations={savedLocations}
                        currentUser={currentUser}
                        onSignInGoogle={onSignInGoogle}
                        onSelectCoordinates={({
                          lat,
                          lng,
                          googleMapsLink,
                          suggestedAddress,
                          suggestedAlleyDetail,
                        }) => {
                          patchDraft({
                            customerLat: lat,
                            customerLng: lng,
                            googleMapsLink,
                            ...(suggestedAddress ? { deliveryAddress: suggestedAddress } : {}),
                            ...(suggestedAlleyDetail && !(draft.alleyDetail || '').trim()
                              ? { alleyDetail: suggestedAlleyDetail }
                              : {}),
                          });
                        }}
                        onApplySavedLocation={(loc) => {
                          patchDraft({
                            customerName: draft.customerName || loc.recipientName || '',
                            customerPhone: draft.customerPhone || loc.recipientPhone || '',
                            deliveryAddress: loc.deliveryAddress,
                            alleyDetail: loc.alleyDetail || '',
                            landmark: loc.landmark || '',
                            googleMapsLink: loc.googleMapsLink,
                            customerLat: loc.lat,
                            customerLng: loc.lng,
                          });
                        }}
                        onSaveCurrentLocation={handleSaveCurrentLocationFromPicker}
                        onDeleteSavedLocation={onDeleteLocation}
                        onSuggestLandmark={(suggested) => {
                          updateDraft('landmark', suggested);
                        }}
                        onFocusPhone={() => {
                          const phoneEl = document.getElementById('checkout-customer-phone');
                          phoneEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          phoneEl?.focus();
                        }}
                      />

                      <div>
                        <label
                          htmlFor="checkout-delivery-address"
                          className="block text-xs font-semibold text-[#30251F] mb-1"
                        >
                          Alamat Jalan, Kelurahan &amp; Kecamatan (Otomatis dari Pin / GPS){' '}
                          {draft.fulfillment === 'help_courier' && (
                            <span className="text-[#A83A2D]">*</span>
                          )}
                        </label>
                        <textarea
                          id="checkout-delivery-address"
                          rows={2}
                          value={draft.deliveryAddress}
                          onChange={(e) => updateDraft('deliveryAddress', e.target.value)}
                          placeholder="Tekan AMBIL LOKASI SAYA di peta atau tulis nama jalan, kelurahan & kecamatan."
                          className={`w-full bg-[#F7F3E9] border rounded-xl px-3.5 py-2.5 text-xs text-[#30251F] placeholder:text-[#6E5D53]/60 focus:outline-none ${
                            validation?.fieldErrors.deliveryAddress
                              ? 'border-red-500 ring-1 ring-red-200'
                              : 'border-[#30251F]/20 focus:border-[#A83A2D]'
                          }`}
                        />
                        {validation?.fieldErrors.deliveryAddress && (
                          <p className="text-[11px] text-red-700 mt-1">
                            {validation.fieldErrors.deliveryAddress}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="checkout-alley-detail"
                          className="block text-xs font-semibold text-[#30251F]"
                        >
                          Lorong Berapa / Gang / Nomor Rumah / RT-RW (Agar Kurir Tidak Bingung)
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: 'Lorong 1', value: 'Lorong 1, No. ' },
                            { label: 'Lorong 2', value: 'Lorong 2, No. ' },
                            { label: 'Lorong 3', value: 'Lorong 3, No. ' },
                            { label: 'Lorong 4', value: 'Lorong 4, No. ' },
                            { label: 'Pinggir Jalan Poros (Tanpa Lorong)', value: 'Langsung pinggir jalan poros (tanpa masuk lorong)' },
                          ].map((chip) => {
                            const active = (draft.alleyDetail || '')
                              .toLowerCase()
                              .includes(chip.label.toLowerCase());
                            return (
                              <button
                                key={chip.label}
                                type="button"
                                onClick={() => {
                                  updateDraft('alleyDetail', chip.value);
                                  document.getElementById('checkout-alley-detail')?.focus();
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#193D2B] text-white border-[#193D2B]'
                                    : 'bg-[#F7F3E9] text-[#4A3C34] border-[#30251F]/15 hover:border-[#193D2B]'
                                }`}
                              >
                                {chip.label}
                              </button>
                            );
                          })}
                        </div>
                        <input
                          id="checkout-alley-detail"
                          type="text"
                          value={draft.alleyDetail || ''}
                          onChange={(e) => updateDraft('alleyDetail', e.target.value)}
                          placeholder="Contoh: Lorong 2, Rumah No. 14, Pagar Hijau / Kost Melati Kamar 3"
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F] placeholder:text-[#6E5D53]/60 focus:outline-none focus:border-[#A83A2D]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="checkout-landmark"
                          className="block text-xs font-semibold text-[#30251F] mb-1"
                        >
                          Patokan Terdekat / Ciri Rumah (Opsional)
                        </label>
                        <input
                          id="checkout-landmark"
                          type="text"
                          value={draft.landmark}
                          onChange={(e) => updateDraft('landmark', e.target.value)}
                          placeholder="Contoh: dekat masjid, pagar biru, atau samping minimarket."
                          className="w-full bg-[#F7F3E9] border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F] placeholder:text-[#6E5D53]/60 focus:outline-none focus:border-[#A83A2D]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="checkout-maps-link"
                          className="block text-xs font-semibold text-[#30251F]"
                        >
                          Link Titik Google Maps (Otomatis terisi dari peta, atau tempel manual)
                        </label>
                        <input
                          id="checkout-maps-link"
                          type="url"
                          value={draft.googleMapsLink}
                          onChange={(e) => {
                            const val = e.target.value;
                            const parsed = parseCoordsFromGoogleMapsUrl(val);
                            if (parsed) {
                              patchDraft({
                                googleMapsLink: val,
                                customerLat: parsed.lat,
                                customerLng: parsed.lng,
                              });
                            } else {
                              updateDraft('googleMapsLink', val);
                            }
                          }}
                          placeholder="https://www.google.com/maps?q=..."
                          className={`w-full bg-[#F7F3E9] border rounded-xl px-3.5 py-2 text-xs font-mono-tabular text-[#30251F] placeholder:font-sans placeholder:text-[#6E5D53]/60 focus:outline-none ${
                            validation?.fieldErrors.googleMapsLink
                              ? 'border-red-500 ring-1 ring-red-200'
                              : 'border-[#30251F]/20 focus:border-[#A83A2D]'
                          }`}
                        />
                        {validation?.fieldErrors.googleMapsLink && (
                          <p className="text-[11px] text-red-700">
                            {validation.fieldErrors.googleMapsLink}
                          </p>
                        )}
                      </div>

                      {/* Ringkasan Kesiapan Data Kurir */}
                      <div className="p-3 rounded-xl bg-[#EFE9DC]/70 border border-[#30251F]/12 space-y-1.5 text-[11px]">
                        <div className="font-bold text-[#30251F] flex items-center justify-between gap-2">
                          <span>Ringkasan Titik Antar untuk Kurir</span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              draft.deliveryAddress.trim() &&
                              isValidIndonesianMobilePhone(draft.customerPhone)
                                ? 'bg-[#E9F0EC] text-[#193D2B]'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {draft.deliveryAddress.trim() &&
                            isValidIndonesianMobilePhone(draft.customerPhone)
                              ? 'Siap Diantar'
                              : 'Lengkapi Alamat & WA'}
                          </span>
                        </div>
                        <div className="text-[#4A3C34] space-y-0.5">
                          <div>
                            <strong>Nama Jalan:</strong>{' '}
                            {draft.deliveryAddress.trim() || (
                              <span className="text-[#A83A2D]">Belum terisi</span>
                            )}
                          </div>
                          <div>
                            <strong>Lorong / No. Rumah:</strong>{' '}
                            {(draft.alleyDetail || '').trim() || (
                              <span className="text-[#9A7013]">Belum diisi (opsional jika pinggir jalan)</span>
                            )}
                          </div>
                          <div>
                            <strong>WhatsApp Aktif Kurir:</strong>{' '}
                            {isValidIndonesianMobilePhone(draft.customerPhone) ? (
                              <span className="font-mono-tabular font-bold text-[#193D2B]">
                                {formatIndonesianPhoneDisplay(draft.customerPhone)}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById('checkout-customer-phone');
                                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  el?.focus();
                                }}
                                className="text-[#A83A2D] font-bold underline cursor-pointer"
                              >
                                Belum diisi — ketuk untuk isi nomor WA aktif
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. Additional Notes */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="checkout-customer-notes"
                      className="text-xs font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>
                        {draft.fulfillment === 'help_courier' || draft.fulfillment === 'own_courier'
                          ? '5.'
                          : '4.'}{' '}
                        Catatan Tambahan (Opsional)
                      </span>
                    </label>
                    <input
                      id="checkout-customer-notes"
                      type="text"
                      value={draft.customerNotes}
                      onChange={(e) => updateDraft('customerNotes', e.target.value)}
                      placeholder="Contoh: Tolong siapkan sendok, atau kirim jam 19.30 WITA..."
                      className="w-full bg-white border border-[#30251F]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#30251F] placeholder:text-[#6E5D53]/60 focus:outline-none focus:border-[#A83A2D]"
                    />
                  </div>

                  {/* 6. Payment Method Selector (Hanya Pembayaran Langsung — Tanpa COD) */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" />
                        <span>
                          {draft.fulfillment === 'help_courier' || draft.fulfillment === 'own_courier'
                            ? '6.'
                            : '5.'}{' '}
                          Pembayaran Langsung (Non-COD) &amp; Bukti Bayar
                        </span>
                      </label>
                      <span className="text-[11px] font-semibold text-[#A83A2D]">
                        Tidak melayani COD
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => updateDraft('paymentMethod', 'qris')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          draft.paymentMethod === 'qris'
                            ? 'bg-white border-[#D9A52E] ring-2 ring-[#D9A52E]/25 text-[#30251F] shadow-sm'
                            : 'bg-white/75 border-[#30251F]/12 text-[#6E5D53] hover:border-[#D9A52E]'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-md bg-[#EFE9DC] border border-[#30251F]/10 flex items-center justify-center mb-1.5">
                          <QrCode className="w-3.5 h-3.5 text-[#9A7013]" />
                        </div>
                        <div className="text-xs font-bold text-[#30251F]">QRIS GPN</div>
                        <div className="text-[11px] text-[#6E5D53] truncate">Semua E-Wallet &amp; Bank</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateDraft('paymentMethod', 'gopay')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          draft.paymentMethod === 'gopay'
                            ? 'bg-white border-[#00AA13] ring-2 ring-[#00AA13]/20 text-[#30251F] shadow-sm'
                            : 'bg-white/75 border-[#30251F]/12 text-[#6E5D53] hover:border-[#00AA13]/45'
                        }`}
                      >
                        <GopayLogoIcon className="w-6 h-6 mb-1.5" />
                        <div className="text-xs font-bold text-[#30251F]">GoPay</div>
                        <div className="text-[11px] text-[#6E5D53] font-mono-tabular truncate">
                          {storeConfig.ewalletNumber}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateDraft('paymentMethod', 'dana')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          draft.paymentMethod === 'dana'
                            ? 'bg-white border-[#108EE9] ring-2 ring-[#108EE9]/20 text-[#30251F] shadow-sm'
                            : 'bg-white/75 border-[#30251F]/12 text-[#6E5D53] hover:border-[#108EE9]/45'
                        }`}
                      >
                        <DanaLogoIcon className="w-6 h-6 mb-1.5" />
                        <div className="text-xs font-bold text-[#30251F]">DANA</div>
                        <div className="text-[11px] text-[#6E5D53] font-mono-tabular truncate">
                          {storeConfig.ewalletNumber}
                        </div>
                      </button>
                    </div>

                    {/* Conditional Payment Instruction Panel */}
                    {draft.paymentMethod === 'qris' && (
                      <div className="p-4 rounded-2xl bg-white border border-[#30251F]/12 flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative w-28 aspect-[586/825] rounded-xl overflow-hidden bg-white border border-[#30251F]/15 shrink-0 group p-0.5 flex items-center justify-center qris-frame-3d">
                          <img
                            src={storeConfig.qrisImageUrl}
                            alt="QRIS Resmi Nasi Kuning Lasinrang"
                            loading="eager"
                            decoding="async"
                            draggable={false}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain rounded-lg bg-white"
                          />
                          <button
                            type="button"
                            onClick={onOpenQrisLightbox}
                            className="absolute inset-0 bg-[#30251F]/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                          >
                            <Maximize2 className="w-4 h-4" />
                            <span>Perbesar</span>
                          </button>
                        </div>
                        <div className="space-y-1.5 text-center sm:text-left flex-1">
                          <div className="flex justify-center sm:justify-start">
                            <QrisLogo />
                          </div>
                          <div className="text-sm font-bold text-[#30251F] pt-0.5">
                            {storeConfig.qrisMerchantName}
                          </div>
                          <div className="text-xs font-mono-tabular text-[#6E5D53]">
                            NMID: {storeConfig.qrisNmid} ({storeConfig.qrisTerminalId})
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <button
                              type="button"
                              onClick={onOpenQrisLightbox}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EFE9DC] hover:bg-[#E4DCCB] text-[#30251F] border border-[#30251F]/12 text-xs font-semibold cursor-pointer"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>Perbesar QRIS</span>
                            </button>
                            <a
                              href={storeConfig.qrisImageUrl}
                              download="QRIS-Resmi-Nasi-Kuning-Lasinrang.jpg"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#EFE9DC] text-[#30251F] border border-[#30251F]/15 text-xs font-semibold"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Unduh QRIS</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {(draft.paymentMethod === 'gopay' || draft.paymentMethod === 'dana') && (
                      <div
                        className={`p-4 rounded-2xl bg-white border space-y-3 ${
                          draft.paymentMethod === 'dana'
                            ? 'border-[#108EE9]/35'
                            : 'border-[#00AA13]/35'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {draft.paymentMethod === 'dana' ? (
                            <DanaLogoIcon className="w-8 h-8 shrink-0" />
                          ) : (
                            <GopayLogoIcon className="w-8 h-8 shrink-0" />
                          )}
                          <div>
                            <div className="text-xs text-[#6E5D53] font-semibold">
                              Nomor Resmi {draft.paymentMethod === 'gopay' ? 'GoPay' : 'DANA'} (11 Digit):
                            </div>
                            <div className="text-lg font-extrabold font-mono-tabular text-[#30251F]">
                              {storeConfig.ewalletNumber}{' '}
                              <span className="text-xs font-normal text-[#6E5D53]">
                                ({storeConfig.ewalletDisplay})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenWalletApp(
                                draft.paymentMethod === 'dana' ? 'dana' : 'gopay'
                              )
                            }
                            className={`py-2.5 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer ${
                              draft.paymentMethod === 'dana'
                                ? 'bg-[#108EE9] hover:bg-[#0D7FD4]'
                                : 'bg-[#00AA13] hover:bg-[#009610]'
                            }`}
                          >
                            {draft.paymentMethod === 'dana' ? (
                              <DanaLogoInline className="w-4 h-4 shrink-0" />
                            ) : (
                              <GopayLogoInline className="w-4 h-4 shrink-0" />
                            )}
                            <span>
                              Bayar Langsung via {draft.paymentMethod === 'dana' ? 'DANA' : 'GoPay'}
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopy(storeConfig.ewalletNumber, 'ewallet')}
                            className="py-2.5 px-3.5 rounded-xl bg-[#EFE9DC] hover:bg-[#E4DCCB] border border-[#30251F]/15 text-[#30251F] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {copiedKey === 'ewallet' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#193D2B]" />
                                <span className="text-[#193D2B]">Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-[#6E5D53]" />
                                <span>Salin Nomor ({storeConfig.ewalletNumber})</span>
                              </>
                            )}
                          </button>
                        </div>

                        {walletNotice && (
                          <div className="p-2.5 rounded-lg bg-[#E9F0EC] border border-[#193D2B]/25 text-[#193D2B] text-[11px] font-semibold">
                            {walletNotice}
                          </div>
                        )}

                        <p className="text-[11px] text-[#6E5D53] leading-relaxed">
                          💡 Ketuk tombol di atas untuk langsung membuka aplikasi DANA/GoPay di HP
                          Anda, atau gunakan QRIS dan Salin Nomor. Jika membutuhkan kurir, tunggu
                          konfirmasi total akhir dari Admin via WA sebelum transfer.
                        </p>
                      </div>
                    )}

                    {/* Hidden File Input for Payment Proof Upload (Shared by Step 1 & Step 2) */}
                    <input
                      ref={proofFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePaymentProofFileChange}
                      className="hidden"
                    />

                    {/* Upload Foto Bukti Pembayaran Card */}
                    <div className="p-4 rounded-2xl bg-white border border-[#193D2B]/25 space-y-3 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#E9F0EC] text-[#193D2B] flex items-center justify-center shrink-0">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#30251F]">
                              Unggah Foto Bukti Pembayaran
                            </div>
                            <div className="text-[11px] text-[#6E5D53]">
                              Dikirim langsung sebagai gambar di chat WhatsApp Admin (bukan link)
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-[#E9F0EC] text-[#193D2B] text-[10.5px] font-bold">
                          {activeProofPreviewSrc ? 'Gambar Siap' : 'Kirim Gambar WA'}
                        </span>
                      </div>

                      {!activeProofPreviewSrc ? (
                        <button
                          type="button"
                          disabled={isUploadingProof}
                          onClick={() => proofFileInputRef.current?.click()}
                          className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-[#193D2B]/35 hover:border-[#193D2B] bg-[#F7F3E9]/75 hover:bg-[#E9F0EC]/50 text-[#193D2B] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {isUploadingProof ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Memproses foto bukti pembayaran...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 shrink-0" />
                              <span>Pilih / Unggah Foto Bukti Pembayaran</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="p-3 rounded-xl bg-[#F7F3E9] border border-[#193D2B]/20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsProofLightboxOpen(true)}
                            className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#30251F]/15 bg-white shrink-0 group cursor-pointer"
                            title="Perbesar foto bukti pembayaran"
                          >
                            <img
                              src={activeProofPreviewSrc}
                              alt="Preview Bukti Pembayaran"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Maximize2 className="w-4 h-4" />
                            </span>
                          </button>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#193D2B]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Foto Bukti Siap Masuk ke Chat WhatsApp Admin</span>
                            </div>
                            <p className="text-[11px] text-[#6E5D53] truncate">
                              {draft.paymentProofName || 'bukti-pembayaran.jpg'} · Langsung terbawa otomatis ke WA Admin tanpa perlu simpan nomor
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setIsProofLightboxOpen(true)}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EFE9DC] border border-[#30251F]/15 text-[#30251F] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Maximize2 className="w-3 h-3" />
                                <span>Lihat</span>
                              </button>
                              <button
                                type="button"
                                disabled={isUploadingProof}
                                onClick={() => proofFileInputRef.current?.click()}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EFE9DC] border border-[#30251F]/15 text-[#193D2B] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Ganti Foto</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleRemovePaymentProof}
                                className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {proofUploadError && (
                        <p className="text-[11px] text-red-700 font-medium">
                          {proofUploadError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 7. Order Summary Box (Bright Warm Ivory & Gold-Trimmed High-Contrast Card) */}
                  <div className="editorial-plate bg-gradient-to-br from-[#FFFDF9] via-[#FFFFFF] to-[#FAF3DF] border-2 border-[#D9A52E]/65 p-5 sm:p-6 space-y-2.5 text-[#16110E] shadow-[0_12px_30px_-14px_rgba(154,112,19,0.18)]">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-[#9A7013]">
                      RINGKASAN PENYELESAIAN AKHIR
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-[#4A3C34]">
                      <span>Subtotal Makanan ({totalPortions} Porsi)</span>
                      <span className="font-mono-tabular font-bold text-[#16110E]">
                        {formatRupiah(foodSubtotal)}
                      </span>
                    </div>
                    {hasExtraSideDishRequest && (
                      <div className="flex items-center justify-between gap-2 text-xs text-[#084C32] font-semibold">
                        <span>Tambahan Lauk Ekstra</span>
                        <span className="font-bold">Dikonfirmasi Admin via WA</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-xs text-[#4A3C34]">
                      <span>Penerimaan</span>
                      <span className="font-bold text-[#084C32] text-right">
                        {draft.fulfillment ? getFulfillmentLabel(draft.fulfillment, storeConfig) : 'Belum dipilih'}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-[#D9A52E]/35 flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold uppercase tracking-[0.08em] text-[#16110E]">
                        Total Pembayaran
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-[#FAF5E8] border border-[#D9A52E]/60 text-lg sm:text-xl font-extrabold text-[#084C32] font-mono-tabular shadow-2xs">
                        {formatRupiah(foodSubtotal)}
                      </span>
                    </div>
                  </div>

                  {/* Validation Summary Banner */}
                  {validation && !validation.isValid && (
                    <div
                      role="alert"
                      className="p-4 bg-red-50 border border-red-300 text-red-800 text-xs space-y-1.5"
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>Mohon lengkapi data berikut sebelum melanjutkan:</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {validation.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  </div>
                </div>
              ) : (
                /* STEP 2: PRATINJAU PESANAN — 2-COLUMN ARCHITECTURAL VERIFICATION SUITE */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
                  <div className="lg:col-span-7 space-y-5">
                  <div className="editorial-plate bg-white p-5 space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#193D2B] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#9A7013]" />
                      <span>01. Identitas Pelanggan</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[#6E5D53] block">Nama Penerima</span>
                        <span className="font-bold text-[#30251F] text-sm">
                          {draft.customerName}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#6E5D53] block">Nomor WhatsApp Aktif</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold font-mono-tabular text-[#30251F] text-sm">
                            {formatIndonesianPhoneDisplay(draft.customerPhone)}
                          </span>
                          {buildCustomerWaMeUrl(draft.customerPhone) && (
                            <a
                              href={buildCustomerWaMeUrl(draft.customerPhone) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold text-[#193D2B] underline"
                            >
                              (Link Chat WA Kurir)
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#30251F]/12 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Rincian Produk ({totalPortions} Porsi)</span>
                    </div>
                    <div className="divide-y divide-[#30251F]/10">
                      {cart.map((item, idx) => (
                        <div
                          key={`prev-${item.cartItemId}`}
                          className="py-2.5 first:pt-0 last:pb-0 space-y-1"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-bold text-[#30251F]">
                              {idx + 1}. {item.menuItem.name}{' '}
                              <span className="text-[#A83A2D]">({item.quantity} porsi)</span>
                            </div>
                            <span className="text-sm font-bold font-mono-tabular text-[#30251F] shrink-0">
                              {formatRupiah(getCartItemSubtotal(item))}
                            </span>
                          </div>
                          <div className="text-xs text-[#6E5D53] space-y-0.5 pl-3">
                            <div>Jenis Nasi: {getRiceTypeLabel(item.riceType)}</div>
                            <div>Porsi: {item.portionLabel}</div>
                            <div>Sambal: {getSambalPlainText(item.sambalPreference, storeConfig)}</div>
                            {item.toppings && item.toppings.length > 0 && (
                              <div className="text-[#9A7013] font-semibold">
                                Toping{item.toppingScope === 'total_order' ? ' (Total pesanan ini)' : item.quantity > 1 ? ' (Per porsi)' : ''}:{' '}
                                {item.toppings
                                  .map((t) =>
                                    item.toppingScope === 'total_order'
                                      ? `${t.name} ×${t.quantity} (+${formatRupiah(
                                          t.unitPrice * t.quantity
                                        )})`
                                      : item.quantity > 1
                                      ? `${t.name} ×${t.quantity}/porsi (+${formatRupiah(
                                          t.unitPrice * t.quantity * item.quantity
                                        )})`
                                      : `${t.name} ×${t.quantity} (+${formatRupiah(
                                          t.unitPrice * t.quantity
                                        )})`
                                  )
                                  .join(', ')}
                              </div>
                            )}
                            {item.wantExtraSideDish && (
                              <div className="text-[#193D2B] font-medium">
                                Tambahan lauk: {item.extraSideDishNote || 'Konfirmasi via WhatsApp'}
                              </div>
                            )}
                            {item.itemNote && <div className="italic">Catatan: {item.itemNote}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#30251F]/12 space-y-2.5 text-xs">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#A83A2D]" />
                      <span>Informasi Penerimaan &amp; Lokasi</span>
                    </div>

                    <div className="space-y-1.5 text-[#30251F]">
                      <div>
                        <span className="text-[#6E5D53]">Metode: </span>
                        <strong>{getFulfillmentLabel(draft.fulfillment, storeConfig)}</strong>
                      </div>

                      {draft.fulfillment === 'pickup' && (
                        <div>
                          <span className="text-[#6E5D53]">Lokasi Ambil: </span>
                          <span>{storeConfig.pickupCoordinatesText}</span>
                        </div>
                      )}

                      {draft.fulfillment !== 'pickup' && draft.deliveryAddress.trim() && (
                        <div>
                          <span className="text-[#6E5D53]">Alamat Jalan: </span>
                          <span className="font-semibold">{draft.deliveryAddress.trim()}</span>
                        </div>
                      )}

                      {draft.fulfillment !== 'pickup' && (draft.alleyDetail || '').trim() && (
                        <div>
                          <span className="text-[#6E5D53]">Lorong / No. Rumah: </span>
                          <span className="font-semibold">{draft.alleyDetail?.trim()}</span>
                        </div>
                      )}

                      {draft.fulfillment !== 'pickup' && draft.landmark.trim() && (
                        <div>
                          <span className="text-[#6E5D53]">Patokan: </span>
                          <span>{draft.landmark.trim()}</span>
                        </div>
                      )}

                      {draft.fulfillment !== 'pickup' && draft.googleMapsLink.trim() && (
                        <div className="break-all">
                          <span className="text-[#6E5D53]">Google Maps: </span>
                          <a
                            href={draft.googleMapsLink.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#193D2B] font-semibold underline"
                          >
                            {draft.googleMapsLink.trim()}
                          </a>
                        </div>
                      )}

                      {draft.fulfillment === 'own_courier' && (
                        <div>
                          <span className="text-[#6E5D53]">Informasi Kurir: </span>
                          <strong>{draft.courierInfo.trim()}</strong>
                        </div>
                      )}

                      {draft.fulfillment === 'help_courier' && (
                        <div className="p-2.5 rounded-lg bg-[#F7F3E9] border border-[#D9A52E]/40 text-[#30251F]">
                          Pengantaran menggunakan kurir area Kota Pinrang — info ongkos kirim &amp;
                          jadwal antar akan dikonfirmasi via WhatsApp.
                        </div>
                      )}

                      {draft.customerNotes.trim() && (
                        <div>
                          <span className="text-[#6E5D53]">Catatan Tambahan: </span>
                          <span>{draft.customerNotes.trim()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>

                  <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-5">
                  <div className="editorial-plate bg-gradient-to-br from-[#FFFDF9] via-[#FFFFFF] to-[#FAF3DF] border-2 border-[#D9A52E]/65 p-5 space-y-2.5 text-xs text-[#16110E] shadow-[0_12px_30px_-14px_rgba(154,112,19,0.18)]">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-[#9A7013]">
                      RINGKASAN TAGIHAN &amp; PEMBAYARAN
                    </div>
                    <div className="flex justify-between gap-2 text-[#4A3C34]">
                      <span>Metode Pembayaran</span>
                      <span className="font-bold text-[#084C32] text-right">
                        {getPaymentMethodLabel(draft.paymentMethod, storeConfig)}
                      </span>
                    </div>
                    {(hasExtraSideDishRequest || draft.fulfillment === 'help_courier') && (
                      <>
                        <div className="flex justify-between gap-2 text-[#4A3C34]">
                          <span>Subtotal Menu</span>
                          <span className="font-mono-tabular font-bold text-[#16110E]">
                            {formatRupiah(foodSubtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 text-[#084C32] font-semibold">
                          <span>
                            {hasExtraSideDishRequest && draft.fulfillment === 'help_courier'
                              ? 'Konfirmasi Tambahan Lauk & Ongkir'
                              : hasExtraSideDishRequest
                              ? 'Konfirmasi Tambahan Lauk'
                              : 'Konfirmasi Ongkos Kirim Kurir'}
                          </span>
                          <span className="font-bold">Via Admin WA</span>
                        </div>
                      </>
                    )}
                    <div className="pt-2.5 border-t border-[#D9A52E]/35 flex justify-between items-center gap-2">
                      <span className="text-sm font-extrabold text-[#16110E]">Total Pembayaran</span>
                      <span className="px-3 py-1 rounded-xl bg-[#FAF5E8] border border-[#D9A52E]/60 text-lg font-extrabold text-[#084C32] font-mono-tabular shadow-2xs">
                        {formatRupiah(foodSubtotal)}
                      </span>
                    </div>
                  </div>

                  {/* Bukti Pembayaran Card in Preview Step */}
                  <input
                    ref={proofFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePaymentProofFileChange}
                    className="hidden"
                  />
                  <div className="p-4 rounded-2xl bg-white border border-[#193D2B]/25 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold uppercase tracking-wider text-[#193D2B] flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Bukti Pembayaran untuk Admin WA</span>
                      </div>
                      {activeProofPreviewSrc && (
                        <span className="px-2 py-0.5 rounded-md bg-[#E9F0EC] text-[#193D2B] text-[10.5px] font-bold">
                          Terlampir
                        </span>
                      )}
                    </div>

                    {!activeProofPreviewSrc ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <p className="text-[11px] text-[#6E5D53] leading-relaxed">
                          Jika sudah transfer atau scan QRIS, unggah foto bukti pembayaran di sini
                          agar langsung terbawa otomatis saat membuka chat WhatsApp Admin (tidak
                          perlu simpan nomor Admin).
                        </p>
                        <button
                          type="button"
                          disabled={isUploadingProof}
                          onClick={() => proofFileInputRef.current?.click()}
                          className="px-3.5 py-2 rounded-xl bg-[#E9F0EC] hover:bg-[#DAE6DF] border border-[#193D2B]/30 text-[#193D2B] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          {isUploadingProof ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Memproses...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              <span>Unggah Bukti Bayar</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsProofLightboxOpen(true)}
                            className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#30251F]/15 bg-white shrink-0 group cursor-pointer"
                          >
                            <img
                              src={activeProofPreviewSrc}
                              alt="Bukti Pembayaran Pelanggan"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Maximize2 className="w-4 h-4" />
                            </span>
                          </button>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-bold text-[#193D2B] flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {isUploadingProof
                                  ? 'Menyiapkan Foto Bukti Pembayaran...'
                                  : 'Siap Dikirim Langsung ke WhatsApp Admin'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#6E5D53] leading-relaxed">
                              Cukup tekan tombol{' '}
                              <strong>&ldquo;KIRIM PESANAN &amp; BUKTI KE WA&rdquo;</strong> di
                              bawah — langsung masuk ke chat WhatsApp Admin (
                              {storeConfig.whatsappDisplay}) tanpa perlu simpan nomor.
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setIsProofLightboxOpen(true)}
                                className="px-2.5 py-1 rounded-lg bg-[#F7F3E9] hover:bg-[#EFE9DC] border border-[#30251F]/15 text-[#30251F] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Maximize2 className="w-3 h-3" />
                                <span>Perbesar</span>
                              </button>
                              <button
                                type="button"
                                disabled={isUploadingProof}
                                onClick={() => proofFileInputRef.current?.click()}
                                className="px-2.5 py-1 rounded-lg bg-[#F7F3E9] hover:bg-[#EFE9DC] border border-[#30251F]/15 text-[#193D2B] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Ganti</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleRemovePaymentProof}
                                className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {proofShareNotice && (
                          <p className="text-[11px] text-[#193D2B] bg-[#E9F0EC] border border-[#193D2B]/20 rounded-lg px-2.5 py-1.5 font-medium">
                            {proofShareNotice}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {waSentPendingNotice && (
                    <div className="p-3.5 rounded-xl bg-[#E9F0EC] border border-[#193D2B]/30 text-[#193D2B] text-xs font-medium leading-relaxed space-y-2.5">
                      <div>
                        {activeProofPreviewSrc ? (
                          proofImageAutoCopied ? (
                            <>
                              Chat WhatsApp Admin (<strong>{storeConfig.whatsappDisplay}</strong>)
                              langsung terbuka tanpa perlu simpan nomor. Rincian pesanan &amp; bukti
                              pembayaran sudah siap kirim (foto bukti juga otomatis tersalin jika
                              ingin langsung Tempel/Paste di chat WA).
                            </>
                          ) : (
                            <>
                              Chat WhatsApp Admin (<strong>{storeConfig.whatsappDisplay}</strong>)
                              langsung terbuka tanpa perlu simpan nomor. Rincian pesanan &amp; bukti
                              pembayaran sudah terisi otomatis — tinggal tekan Kirim di WhatsApp.
                            </>
                          )
                        ) : (
                          <>
                            Chat WhatsApp Admin (<strong>{storeConfig.whatsappDisplay}</strong>)
                            langsung terbuka tanpa perlu simpan nomor. Silakan tekan Kirim di
                            WhatsApp untuk melanjutkan pesanan Anda.
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#EFE9DC] border border-[#193D2B]/30 text-[#193D2B] text-[11px] font-bold inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka Chat WA Admin</span>
                        </a>
                        {activeProofPreviewSrc && canShareFiles && (
                          <button
                            type="button"
                            onClick={() => void handleOptionalWebShareProof()}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#EFE9DC] border border-[#193D2B]/25 text-[#193D2B] text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Kirim File Foto via Share HP</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            stopPreviewThanksAudio();
                            resetThanksAudioMarker();
                            handleRemovePaymentProof();
                            onClearCart();
                            setWaSentPendingNotice(false);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#193D2B] hover:bg-[#122E20] text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Selesai &amp; Kosongkan Keranjang</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <details className="rounded-xl bg-white border border-[#30251F]/12 p-3 text-xs">
                    <summary className="cursor-pointer font-semibold text-[#6E5D53] hover:text-[#30251F] select-none">
                      Lihat pratinjau teks pesan WhatsApp
                    </summary>
                    <pre className="mt-2.5 p-3 rounded-lg bg-[#F7F3E9] border border-[#30251F]/10 text-[11px] font-sans whitespace-pre-wrap text-[#30251F] leading-relaxed max-h-48 overflow-y-auto">
                      {whatsappMessage}
                    </pre>
                    <button
                      type="button"
                      onClick={() => handleCopy(whatsappMessage, 'wa-preview-copy')}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#193D2B] hover:underline cursor-pointer"
                    >
                      {copiedKey === 'wa-preview-copy' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Teks pesan tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin teks pesan ini</span>
                        </>
                      )}
                    </button>
                  </details>
                  </div>
                </div>
              )}
      </div>

      {/* Sticky Bottom Architectural Settlement Action Bar */}
      {cart.length > 0 && (
        <div className="sticky bottom-0 z-30 bg-[#12291D] text-[#F7F3E9] border-t-2 border-[#D9A52E]/45 shadow-[0_-12px_30px_-8px_rgba(16,38,27,0.35)] pb-[env(safe-area-inset-bottom,0px)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="hidden md:flex items-center gap-4">
              <div>
                <div className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-[#E8C56E]">
                  TOTAL RESERVASI ({totalPortions} PORSI)
                </div>
                <div className="text-lg font-bold font-mono-tabular text-white">
                  {formatRupiah(foodSubtotal)}
                </div>
              </div>
              <span className="h-7 w-px bg-[#F7F3E9]/15" />
              <div className="text-xs text-[#F7F3E9]/75">
                {draft.fulfillment
                  ? getFulfillmentLabel(draft.fulfillment, storeConfig)
                  : 'Pilih metode penerimaan'}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 md:max-w-xl">
            {step === 'form' ? (
              <>
                <button
                  type="button"
                  onClick={handleCloseCheckout}
                  className="px-4 py-3 rounded-xl bg-[#F7F3E9]/10 hover:bg-[#F7F3E9]/20 border border-[#D9A52E]/35 text-[#F7F3E9] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>+ Tambah Menu</span>
                </button>
                <button
                  type="button"
                  onClick={handleProceedToPreview}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-[#D9A52E] hover:bg-[#E8C56E] active:scale-[0.99] text-[#12291D] font-extrabold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Periksa &amp; Pratinjau Pesanan</span>
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      stopPreviewThanksAudio();
                      resetThanksAudioMarker();
                      handleRemovePaymentProof();
                      onClearCart();
                      setWaSentPendingNotice(false);
                      setStep('form');
                      onClose();
                    }}
                    className="px-3.5 py-3 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-400/35 text-red-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="Batalkan seluruh pesanan ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Batalkan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form');
                      setWaSentPendingNotice(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 sm:flex-initial px-4 py-3 rounded-xl bg-[#F7F3E9]/10 hover:bg-[#F7F3E9]/20 border border-[#D9A52E]/35 text-[#F7F3E9] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Ubah Pesanan</span>
                  </button>
                </div>
                <a
                  href={isUploadingProof ? '#' : whatsappUrl}
                  target={isUploadingProof ? undefined : '_blank'}
                  rel={isUploadingProof ? undefined : 'noopener noreferrer'}
                  onClick={handleDirectWhatsAppSend}
                  aria-disabled={isUploadingProof}
                  className={`flex-1 py-3.5 px-6 rounded-xl bg-[#D9A52E] hover:bg-[#E8C56E] active:scale-[0.99] text-[#12291D] font-extrabold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 ${
                    isUploadingProof ? 'opacity-70 cursor-wait' : 'cursor-pointer'
                  }`}
                >
                  {isUploadingProof ? (
                    <>
                      <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                      <span>Menyiapkan Foto Bukti...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 shrink-0" />
                      <span>
                        {activeProofPreviewSrc
                          ? 'Kirim Pesanan & Bukti ke WA'
                          : 'Kirim Pesanan ke WhatsApp'}
                      </span>
                    </>
                  )}
                </a>
              </>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox for Uploaded Payment Proof */}
      {typeof document !== 'undefined' &&
        isProofLightboxOpen &&
        activeProofPreviewSrc &&
        createPortal(
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsProofLightboxOpen(false);
            }}
            className="fixed inset-0 z-[10010] bg-black/92 flex flex-col items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden border border-[#D9A52E]/40 shadow-2xl"
            >
              <div className="px-4 py-3 bg-white border-b border-[#30251F]/12 flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-bold text-[#30251F] truncate">
                  Bukti Pembayaran — {draft.paymentProofName || 'Lampiran WA'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsProofLightboxOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EFE9DC] text-[#30251F] flex items-center justify-center cursor-pointer"
                  aria-label="Tutup Pratinjau Foto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-[#0F1E16] h-[65dvh] w-full overflow-hidden">
                <ZoomableImageViewer
                  src={activeProofPreviewSrc}
                  alt="Bukti Pembayaran Penuh"
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
