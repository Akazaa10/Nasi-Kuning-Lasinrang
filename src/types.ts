export type SambalPreference = 'campur' | 'pisah' | 'tanpa';
export type RiceType = 'nasi_kuning' | 'nasi_putih';

export interface MenuItem {
  id: string;
  name: string;
  category: 'reguler' | 'spesial';
  basePrice: number;
  description: string;
  sidesIncluded: string[];
  imageUrl: string;
  signatureTag?: string;
  isAvailable: boolean;
  spiceLevel: string;
}

export interface ToppingOption {
  id: string;
  name: string;
  price: number;
  unitLabel: string;
  description?: string;
  imageUrl?: string;
  badgeText?: string;
}

export interface SelectedTopping {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface CartItem {
  cartItemId: string;
  menuItem: MenuItem;
  riceType?: RiceType;
  portionType: 'standard' | 'custom';
  portionLabel: string;
  unitPrice: number; // Base/custom portion price + toppingTotal
  quantity: number;
  sambalPreference: SambalPreference;
  toppings?: SelectedTopping[];
  toppingTotal?: number;
  toppingScope?: 'per_portion' | 'total_order';
  wantExtraSideDish: boolean;
  extraSideDishNote: string;
  itemNote?: string;
}

export type PaymentMethodType = 'qris' | 'gopay' | 'dana';
export type FulfillmentType = 'pickup' | 'own_courier' | 'help_courier';

export interface CustomerOrderDraft {
  customerName: string;
  customerPhone: string;
  whatsappActiveConfirmed?: boolean;
  fulfillment: FulfillmentType | '';
  deliveryAddress: string;
  alleyDetail?: string;
  landmark: string;
  googleMapsLink: string;
  customerLat?: number;
  customerLng?: number;
  courierInfo: string;
  customerNotes: string;
  paymentMethod: PaymentMethodType;
  paymentProofUrl?: string;
  paymentProofDataUrl?: string;
  paymentProofName?: string;
}

export interface SavedCustomerLocation {
  id: string;
  label: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryAddress: string;
  alleyDetail?: string;
  landmark?: string;
  lat: number;
  lng: number;
  googleMapsLink: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'Menunggu Konfirmasi' | 'Diproses' | 'Selesai';

export interface OrderRecord {
  id: string;
  userId?: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  fulfillment: FulfillmentType;
  deliveryAddress: string;
  landmark: string;
  googleMapsLink: string;
  customerLat?: number;
  customerLng?: number;
  courierInfo: string;
  customerNotes: string;
  paymentMethod: PaymentMethodType;
  paymentProofUrl?: string;
  itemsSummary: Array<{
    name: string;
    quantity: number;
    riceType?: RiceType;
    portionLabel: string;
    unitPrice: number;
    sambalPreference: SambalPreference;
    toppings?: SelectedTopping[];
    toppingTotal?: number;
    toppingScope?: 'per_portion' | 'total_order';
    wantExtraSideDish: boolean;
    extraSideDishNote: string;
    itemNote?: string;
  }>;
  foodSubtotal: number;
  status: OrderStatus;
}

export interface SambalOptionConfig {
  id: SambalPreference;
  label: string;
  desc: string;
  enabled: boolean;
}

export interface PortionPresetConfig {
  extraPuasLabel: string;
  extraPuasRegulerDelta: number;
  extraPuasSpesialDelta: number;
  jumboLabel: string;
  jumboRegulerDelta: number;
  jumboSpesialDelta: number;
}

export interface StoreConfig {
  brandName: string;
  tagline: string;
  locationAddress: string;
  pickupCoordinatesText: string;
  operatingHours: string;
  isOpenLive: boolean;
  liveStatusText: string;
  whatsappNumber: string; // 6282363953662
  whatsappDisplay: string; // +62 823-6395-3662
  ewalletNumber: string; // 08215089754
  ewalletDisplay: string; // +62 821-5089-754
  qrisMerchantName: string;
  qrisNmid: string;
  qrisTerminalId: string;
  qrisPrintedBy: string;
  qrisVersion: string;
  qrisImageUrl: string;
  gofoodUrl: string;
  maximUrl: string;
  googleMapsQuery: string;
  storeLat?: number;
  storeLng?: number;
  storePlaceId?: string;
  storePlaceName?: string;
  portionPresets?: PortionPresetConfig;
  extraSideOptions?: string[];
  sambalOptions?: SambalOptionConfig[];
}
