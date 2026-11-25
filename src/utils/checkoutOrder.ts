import {
  CartItem,
  CustomerOrderDraft,
  FulfillmentType,
  PaymentMethodType,
  RiceType,
  StoreConfig,
} from '../types';

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getCartItemSubtotal(item: {
  unitPrice: number;
  quantity: number;
  toppingTotal?: number;
  toppingScope?: 'per_portion' | 'total_order';
}): number {
  const qty = Math.max(1, Number(item.quantity) || 1);
  const base = Math.max(0, Number(item.unitPrice) || 0);
  if (item.toppingScope === 'total_order') {
    const extraTopping = Math.max(0, Number(item.toppingTotal) || 0);
    return base * qty + extraTopping;
  }
  return base * qty;
}

export interface CheckoutValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors: Partial<
    Record<
      'cart' | 'customerName' | 'customerPhone' | 'fulfillment' | 'deliveryAddress' | 'courierInfo' | 'googleMapsLink',
      string
    >
  >;
}

export function getSambalPlainText(
  pref: 'campur' | 'pisah' | 'tanpa',
  storeConfig?: StoreConfig
): string {
  const custom = storeConfig?.sambalOptions?.find((o) => o.id === pref)?.label?.trim();
  if (custom) {
    return custom.replace(/^[\p{Emoji}\p{Extended_Pictographic}\s]+/u, '').trim() || custom;
  }
  switch (pref) {
    case 'campur':
      return 'Pakai Sambal (Campur di Nasi)';
    case 'pisah':
      return 'Sambal Dipisah';
    case 'tanpa':
      return 'Tidak Pakai Sambal';
  }
}

export function getRiceTypeLabel(riceType?: RiceType): string {
  return riceType === 'nasi_putih' ? 'Nasi Putih' : 'Nasi Kuning Gurih';
}

export function getFulfillmentLabel(
  fulfillment: FulfillmentType | '',
  storeConfig?: StoreConfig
): string {
  switch (fulfillment) {
    case 'pickup':
      return 'Ambil Sendiri di Tempat';
    case 'own_courier':
      return 'Pakai Jasa GoFood atau Maxim';
    case 'help_courier':
      return `Pakai Kurir Area Kota Pinrang (${storeConfig?.brandName || 'Nasi Kuning Lasinrang'})`;
    default:
      return '-';
  }
}

export function getPaymentMethodLabel(
  method: PaymentMethodType,
  storeConfig: StoreConfig
): string {
  switch (method) {
    case 'gopay':
      return `GoPay (${storeConfig.ewalletNumber})`;
    case 'dana':
      return `DANA (${storeConfig.ewalletNumber})`;
    case 'qris':
    default:
      return `QRIS Resmi (${storeConfig.qrisMerchantName})`;
  }
}

export function formatRpCompact(amount: number): string {
  return `Rp${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(amount)))}`;
}

export function normalizeWhatsAppDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function toIndonesianWaDigits(raw: string): string {
  const digits = normalizeWhatsAppDigits(raw);
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function formatIndonesianPhoneDisplay(raw: string): string {
  const wa = toIndonesianWaDigits(raw);
  if (!wa) return raw.trim();
  if (wa.startsWith('62') && wa.length >= 10) {
    const local = wa.slice(2);
    const p1 = local.slice(0, 3);
    const p2 = local.slice(3, 7);
    const p3 = local.slice(7);
    return `+62 ${p1}-${p2}${p3 ? `-${p3}` : ''}`;
  }
  return raw.trim();
}

export function buildCustomerWaMeUrl(raw: string): string | null {
  const wa = toIndonesianWaDigits(raw);
  if (wa.length < 10 || wa.length > 15) return null;
  return `https://wa.me/${wa}`;
}

export function isValidIndonesianMobilePhone(raw: string): boolean {
  const digits = normalizeWhatsAppDigits(raw);
  if (digits.length < 9 || digits.length > 15) return false;
  return (
    digits.startsWith('08') ||
    digits.startsWith('628') ||
    digits.startsWith('8')
  );
}

export function isValidGoogleMapsLink(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true; // optional
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'maps.app.goo.gl' ||
      host.startsWith('maps.google.') ||
      ((host === 'goo.gl' || host.endsWith('.google.com') || host === 'google.com' || host.endsWith('.google.co.id') || host === 'google.co.id') &&
        parsed.pathname.toLowerCase().startsWith('/maps'))
    );
  } catch {
    return false;
  }
}

export function buildValidGoogleMapsCoordUrl(lat: number, lng: number): string | null {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return null;
  }
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function parseCoordsFromGoogleMapsUrl(
  url: string
): { lat: number; lng: number } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(?:[?&]q=|@|ll=)(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

export function computeDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceId(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return '-';
  if (distanceKm < 1) {
    return `${Math.max(10, Math.round(distanceKm * 1000))} meter`;
  }
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

export function validateCheckoutOrder(
  cart: CartItem[],
  draft: CustomerOrderDraft
): CheckoutValidationResult {
  const errors: string[] = [];
  const fieldErrors: CheckoutValidationResult['fieldErrors'] = {};

  if (!cart || cart.length === 0) {
    const msg = 'Keranjang pesanan masih kosong. Silakan pilih menu terlebih dahulu.';
    errors.push(msg);
    fieldErrors.cart = msg;
  } else {
    const invalidItem = cart.find(
      (item) =>
        !item.menuItem?.name ||
        item.quantity < 1 ||
        !item.portionLabel ||
        !item.sambalPreference ||
        item.unitPrice <= 0
    );
    if (invalidItem) {
      const msg = 'Terdapat data menu atau porsi yang belum lengkap di keranjang.';
      errors.push(msg);
      fieldErrors.cart = msg;
    }
  }

  const totalAmount = cart.reduce((acc, item) => acc + getCartItemSubtotal(item), 0);
  if (cart.length > 0 && totalAmount <= 0) {
    const msg = 'Total pembayaran tidak valid.';
    errors.push(msg);
    fieldErrors.cart = msg;
  }

  if (!draft.customerName.trim()) {
    const msg = 'Nama lengkap penerima belum diisi.';
    errors.push(msg);
    fieldErrors.customerName = msg;
  }

  const phoneDigits = normalizeWhatsAppDigits(draft.customerPhone);
  if (!draft.customerPhone.trim()) {
    const msg = 'Nomor WhatsApp aktif belum diisi.';
    errors.push(msg);
    fieldErrors.customerPhone = msg;
  } else if (phoneDigits.length < 9 || phoneDigits.length > 15) {
    const msg = 'Nomor WhatsApp aktif harus berisi 9–15 digit angka yang valid.';
    errors.push(msg);
    fieldErrors.customerPhone = msg;
  } else if (!isValidIndonesianMobilePhone(draft.customerPhone)) {
    const msg = 'Gunakan nomor HP/WhatsApp aktif yang valid (contoh: 0823xxxxxxxx atau +62823xxxxxxxx).';
    errors.push(msg);
    fieldErrors.customerPhone = msg;
  }

  if (!draft.fulfillment) {
    const msg = 'Silakan pilih metode penerimaan pesanan.';
    errors.push(msg);
    fieldErrors.fulfillment = msg;
  }

  if (draft.fulfillment === 'help_courier' && !draft.deliveryAddress.trim()) {
    const msg = 'Alamat jalan pengantaran masih kosong. Ketuk "AMBIL LOKASI SAYA" di peta atau ketik nama jalan Anda.';
    errors.push(msg);
    fieldErrors.deliveryAddress = msg;
  }

  if (draft.fulfillment === 'own_courier' && !draft.courierInfo.trim()) {
    const msg = 'Silakan isi nama layanan ojol (contoh: GoFood, GoSend, atau Maxim).';
    errors.push(msg);
    fieldErrors.courierInfo = msg;
  }

  if (draft.googleMapsLink.trim() && !isValidGoogleMapsLink(draft.googleMapsLink)) {
    const msg = 'Link Google Maps tidak valid. Pastikan diawali https://maps... atau kosongkan jika tidak ada.';
    errors.push(msg);
    fieldErrors.googleMapsLink = msg;
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function buildStructuredWhatsAppMessage(
  cart: CartItem[],
  draft: CustomerOrderDraft,
  storeConfig: StoreConfig
): string {
  const foodSubtotal = cart.reduce((acc, item) => acc + getCartItemSubtotal(item), 0);
  const hasExtraSideDishRequest = cart.some((item) => Boolean(item.wantExtraSideDish));
  const hasCourierHelp = draft.fulfillment === 'help_courier';
  const hasOwnCourier = draft.fulfillment === 'own_courier';
  const isDelivery = hasCourierHelp || hasOwnCourier;

  const customerWaDisplay = formatIndonesianPhoneDisplay(draft.customerPhone);
  const customerWaLink = buildCustomerWaMeUrl(draft.customerPhone);

  const lines: string[] = [
    `PESANAN ${(storeConfig.brandName || 'NASI KUNING LASINRANG').toUpperCase()}`,
    '',
    'Halo Admin, saya ingin memesan:',
    '',
    'DATA PELANGGAN',
    `Nama: ${draft.customerName.trim()}`,
    `WhatsApp: ${customerWaDisplay}`,
    ...(isDelivery && customerWaLink ? [`Chat Pelanggan: ${customerWaLink}`] : []),
    '',
    'RINCIAN PESANAN',
  ];

  cart.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.menuItem.name} (${item.quantity} porsi)`);
    lines.push(`   Jenis Nasi: ${getRiceTypeLabel(item.riceType)}`);
    lines.push(`   Porsi: ${item.portionLabel}`);
    lines.push(`   Sambal: ${getSambalPlainText(item.sambalPreference, storeConfig)}`);
    if (item.toppings && item.toppings.length > 0) {
      const isTotalOrder = item.toppingScope === 'total_order';
      const toppingText = item.toppings
        .map((t) => {
          if (isTotalOrder) {
            return `${t.name} x${t.quantity} total untuk pesanan ini (+${formatRpCompact(
              t.unitPrice * t.quantity
            )})`;
          }
          if (item.quantity > 1) {
            return `${t.name} x${t.quantity}/porsi (total ${
              t.quantity * item.quantity
            } pcs, +${formatRpCompact(t.unitPrice * t.quantity * item.quantity)})`;
          }
          return `${t.name} x${t.quantity} (+${formatRpCompact(t.unitPrice * t.quantity)})`;
        })
        .join(', ');
      lines.push(`   Toping: ${toppingText}`);
    }
    if (item.wantExtraSideDish) {
      const extraText = item.extraSideDishNote?.trim()
        ? item.extraSideDishNote.trim()
        : 'Ya (Konfirmasi jenis & harga)';
      lines.push(`   Tambahan Lauk: ${extraText}`);
    }
    if (item.itemNote && item.itemNote.trim()) {
      lines.push(`   Catatan Menu: ${item.itemNote.trim()}`);
    }
    lines.push(`   Subtotal: ${formatRupiah(getCartItemSubtotal(item))}`);
    if (idx < cart.length - 1) {
      lines.push('');
    }
  });

  lines.push('');

  // Pembayaran (ringkas, hanya tampilkan konfirmasi bila memang ada tambahan lauk atau kurir)
  const pendingConfirmations: string[] = [];
  if (hasExtraSideDishRequest) pendingConfirmations.push('Tambahan lauk');
  if (hasCourierHelp) pendingConfirmations.push('Ongkos kirim kurir');

  lines.push('PEMBAYARAN');
  if (pendingConfirmations.length > 0) {
    lines.push(`Subtotal Menu: ${formatRpCompact(foodSubtotal)}`);
    lines.push(`Konfirmasi Admin: ${pendingConfirmations.join(' & ')} (menyusul via WhatsApp)`);
  } else {
    lines.push(`Total Pesanan: ${formatRpCompact(foodSubtotal)}`);
  }
  lines.push(`Metode: ${getPaymentMethodLabel(draft.paymentMethod, storeConfig)}`);
  const proofUrl = draft.paymentProofUrl?.trim();
  const hasLocalProof = Boolean(
    draft.paymentProofDataUrl && draft.paymentProofDataUrl.trim()
  );
  if (proofUrl) {
    lines.push(`Bukti Pembayaran: ${proofUrl}`);
  } else if (hasLocalProof) {
    lines.push('Bukti Pembayaran: Foto bukti pembayaran dilampirkan di chat ini');
  }
  lines.push('');

  // Penerimaan / Kurir (sesuaikan persis dengan pilihan pelanggan)
  lines.push(isDelivery ? 'PENGANTARAN & KURIR' : 'PENERIMAAN');
  lines.push(`Metode: ${getFulfillmentLabel(draft.fulfillment, storeConfig)}`);

  if (isDelivery) {
    if (hasOwnCourier && draft.courierInfo.trim()) {
      lines.push(`Kurir: ${draft.courierInfo.trim()}`);
      lines.push(`Titik Jemput Kedai: ${storeConfig.pickupCoordinatesText}`);
    }

    if (draft.deliveryAddress.trim()) {
      lines.push(`Alamat Jalan: ${draft.deliveryAddress.trim()}`);
    }
    if (draft.alleyDetail && draft.alleyDetail.trim()) {
      lines.push(`Lorong / No. Rumah: ${draft.alleyDetail.trim()}`);
    }
    if (draft.landmark.trim()) {
      lines.push(`Patokan: ${draft.landmark.trim()}`);
    }

    const resolvedMapsLink =
      draft.googleMapsLink.trim() ||
      (typeof draft.customerLat === 'number' && typeof draft.customerLng === 'number'
        ? buildValidGoogleMapsCoordUrl(draft.customerLat, draft.customerLng) || ''
        : '');
    if (resolvedMapsLink) {
      lines.push(`Google Maps: ${resolvedMapsLink}`);
    }

    if (
      typeof draft.customerLat === 'number' &&
      typeof draft.customerLng === 'number' &&
      typeof storeConfig.storeLat === 'number' &&
      typeof storeConfig.storeLng === 'number'
    ) {
      const dist = computeDistanceKm(
        storeConfig.storeLat,
        storeConfig.storeLng,
        draft.customerLat,
        draft.customerLng
      );
      lines.push(`Jarak dari Kedai: ~${formatDistanceId(dist)}`);
    }

    if (hasCourierHelp) {
      if (draft.courierInfo.trim()) {
        lines.push(`Catatan Kurir: ${draft.courierInfo.trim()}`);
      }
      lines.push('Mohon konfirmasi ongkos kirim & pengantaran kurir area Kota Pinrang.');
    }
  }

  if (draft.customerNotes.trim()) {
    lines.push('');
    lines.push('CATATAN PELANGGAN');
    lines.push(draft.customerNotes.trim());
  }

  lines.push('');
  lines.push('Mohon konfirmasi pesanannya. Terima kasih.');

  return lines.join('\n');
}

export function buildWhatsAppOrderUrl(
  cart: CartItem[],
  draft: CustomerOrderDraft,
  storeConfig: StoreConfig
): string {
  const cleanNumber =
    toIndonesianWaDigits(storeConfig.whatsappNumber) ||
    normalizeWhatsAppDigits(storeConfig.whatsappNumber);
  const text = buildStructuredWhatsAppMessage(cart, draft, storeConfig);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
}
