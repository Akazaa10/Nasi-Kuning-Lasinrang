import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  ShoppingBag,
  Smartphone,
  ArrowDown,
  RotateCcw,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import {
  MenuItem,
  RiceType,
  SambalPreference,
  SelectedTopping,
} from '../types';
import { formatRupiah } from '../data/initialData';
import { getCartItemSubtotal } from '../utils/checkoutOrder';

export const LAST_ORDER_STORAGE_KEY = 'nkl_last_order_v1';
export const LAST_ORDER_UPDATED_EVENT = 'nkl-last-order-updated';

export interface LastOrderSnapshotItem {
  menuId?: string;
  name: string;
  quantity: number;
  riceType?: RiceType;
  portionType?: 'standard' | 'custom';
  portionLabel: string;
  unitPrice: number;
  sambalPreference: SambalPreference;
  toppings?: SelectedTopping[];
  toppingTotal?: number;
  toppingScope?: 'per_portion' | 'total_order';
  wantExtraSideDish?: boolean;
  extraSideDishNote?: string;
  itemNote?: string;
}

export interface LastOrderSnapshot {
  orderId: string;
  savedAt: string;
  customerName?: string;
  totalPrice: number;
  totalPortions: number;
  items: LastOrderSnapshotItem[];
}

interface TopLaukEntry {
  id: string;
  menuId: string;
  name: string;
  fallbackPrice: number;
  percent: number;
  badge: string;
}

const RECOMMENDED_LAUK_ITEMS: TopLaukEntry[] = [
  {
    id: 'rec-bebek-palekko-bugis',
    menuId: 'nasi-kuning-bebek-palekko',
    name: 'Nasi Kuning Bebek Palekko Bugis',
    fallbackPrice: 15000,
    percent: 96,
    badge: 'Rekomendasi Utama',
  },
  {
    id: 'rec-ayam-sambal-hijau',
    menuId: 'nasi-kuning-ayam-sambal-hijau',
    name: 'Nasi Kuning Ayam Sambal Hijau',
    fallbackPrice: 10000,
    percent: 91,
    badge: 'Pedas Segar',
  },
  {
    id: 'rec-ayam-cincang',
    menuId: 'nasi-kuning-ayam-cincang',
    name: 'Nasi Kuning Ayam Cincang',
    fallbackPrice: 10000,
    percent: 88,
    badge: 'Bumbu Meresap',
  },
];

type HubTabId = 'top' | 'ulang';

interface QuickOrderHubProps {
  menuItems: MenuItem[];
  onOrderTopItem: (menuId: string) => void;
  onReorderLastOrder: (snapshot: LastOrderSnapshot) => void;
  onBrowseMenu: () => void;
}

function readLastOrderSnapshot(): LastOrderSnapshot | null {
  try {
    const raw = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastOrderSnapshot>;
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }
    const validItems = parsed.items.filter(
      (it) => it && typeof it.name === 'string' && it.name.trim() && Number(it.quantity) > 0
    );
    if (validItems.length === 0) return null;

    const computedPortions = validItems.reduce(
      (sum, it) => sum + Math.max(1, Number(it.quantity) || 1),
      0
    );
    const computedTotal = validItems.reduce(
      (sum, it) => sum + getCartItemSubtotal(it),
      0
    );

    return {
      orderId: typeof parsed.orderId === 'string' ? parsed.orderId : `ORD-LAST`,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      customerName: typeof parsed.customerName === 'string' ? parsed.customerName : undefined,
      totalPrice: Number(parsed.totalPrice) > 0 ? Number(parsed.totalPrice) : computedTotal,
      totalPortions: Number(parsed.totalPortions) > 0 ? Number(parsed.totalPortions) : computedPortions,
      items: validItems,
    };
  } catch {
    return null;
  }
}

function formatSavedOrderDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Pesanan terakhir';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return 'Pesanan terakhir';
  }
}

const EASE_PREMIUM: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const QuickOrderHub: React.FC<QuickOrderHubProps> = ({
  menuItems,
  onOrderTopItem,
  onReorderLastOrder,
  onBrowseMenu,
}) => {
  const [activeTab, setActiveTab] = useState<HubTabId>('top');
  const [lastOrder, setLastOrder] = useState<LastOrderSnapshot | null>(() =>
    readLastOrderSnapshot()
  );
  const [showHomeScreenGuide, setShowHomeScreenGuide] = useState<boolean>(false);

  useEffect(() => {
    const refresh = () => {
      setLastOrder(readLastOrderSnapshot());
    };
    window.addEventListener('storage', refresh);
    window.addEventListener(LAST_ORDER_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(LAST_ORDER_UPDATED_EVENT, refresh);
    };
  }, []);

  const tabs: Array<{ id: HubTabId; label: string }> = [
    { id: 'top', label: 'Rekomendasi Menu dari Kami' },
    { id: 'ulang', label: 'Pesan Ulang' },
  ];

  return (
    <div className="w-full flex flex-col">
      <div className="relative w-full editorial-plate rounded-3xl flex flex-col justify-between">
        <div className="p-5 sm:p-7 flex-1 flex flex-col gap-5">
          {/* Clean Modern Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-extrabold text-[#B87300] block">
                Pesan Instan 1-Klik
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif-display text-[#064E3B] tracking-tight">
                Rekomendasi Menu dari Kami &amp; Pesan Ulang
              </h2>
            </div>
            <span className="text-xs font-bold text-[#084C32]">
              Siap Saji · Hangat
            </span>
          </div>

          {/* Modern 3D Segmented Control Tab Bar */}
          <div
            role="tablist"
            aria-label="Navigasi Pesan Cepat"
            className="grid grid-cols-2 p-1.5 bg-[#FAF5E8] border border-[#FFC72C]/35 rounded-2xl gap-1.5"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[42px] px-3 py-2 rounded-xl text-[11px] sm:text-xs font-extrabold cursor-pointer flex items-center justify-center text-center leading-tight ${
                    isActive
                      ? 'bg-[#084C32] text-[#FFD24C] fx-2d-forest'
                      : 'bg-white text-[#1F1814] hover:text-[#064E3B] fx-2d-ivory'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Panels */}
          <div className="flex-1 flex flex-col justify-center min-h-[256px]">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === 'top' && (
                <motion.div
                  key="tab-top"
                  role="tabpanel"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: EASE_PREMIUM }}
                  className="space-y-2.5"
                >
                  {RECOMMENDED_LAUK_ITEMS.map((entry) => {
                    const matchedMenu = menuItems.find((m) => m.id === entry.menuId);
                    const displayPrice = matchedMenu?.basePrice ?? entry.fallbackPrice;
                    const isAvailable = matchedMenu ? matchedMenu.isAvailable : true;

                    return (
                      <div
                        key={entry.id}
                        className="p-2.5 sm:p-3 rounded-2xl bg-[#FFFDF8] border border-[#E8B020]/50 shadow-[inset_0_1px_0_#FFFFFF,0_2px_0_#E3C16B,0_8px_16px_-8px_rgba(8,76,50,0.18)] hover:-translate-y-0.5 transition-all flex items-center justify-between gap-2.5 sm:gap-4 group"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                          <div className="relative w-16 h-22 sm:w-20 sm:h-26 rounded-xl menu-poster-3d-frame border border-[#FFC72C]/65 overflow-hidden shrink-0 shadow-[0_4px_12px_-4px_rgba(6,56,37,0.35)] flex items-center justify-center">
                            {matchedMenu?.imageUrl && (
                              <img
                                src={matchedMenu.imageUrl}
                                alt={entry.name}
                                loading="eager"
                                decoding="sync"
                                draggable={false}
                                className="w-full h-full object-contain p-0.5 culinary-photo hd-4k-image group-hover:scale-105 transition-transform duration-300"
                              />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#B87300] font-extrabold">
                              <span>{entry.badge}</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#3D3028]">{entry.percent}% suka</span>
                            </div>
                            <h3 className="text-sm sm:text-base font-bold font-serif-display text-[#064E3B] leading-snug break-words">
                              {entry.name}
                            </h3>
                            <div className="text-xs sm:text-sm font-mono-tabular font-extrabold text-[#D91B24]">
                              {formatRupiah(displayPrice)}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => onOrderTopItem(entry.menuId)}
                          className="min-h-[40px] px-3 sm:px-4 py-2 rounded-xl bg-[#084C32] hover:bg-[#063825] text-white fx-2d-forest font-extrabold text-xs flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#FFD24C] shrink-0" />
                          <span>{isAvailable ? 'Pesan Sekarang' : 'Habis'}</span>
                        </button>
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {activeTab === 'ulang' && (
                <motion.div
                  key="tab-ulang"
                  role="tabpanel"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: EASE_PREMIUM }}
                  className="flex-1 flex flex-col justify-between"
                >
                  {lastOrder ? (
                    <div className="p-4 rounded-2xl bg-[#F7F3E9] border border-[#30251F]/10 space-y-3.5">
                      <div className="flex items-start justify-between gap-2 border-b border-[#30251F]/10 pb-2.5">
                        <div className="min-w-0">
                          <span className="text-[11px] font-medium text-[#9A7013] block">
                            Pesanan Terakhir Anda
                          </span>
                          <h3 className="text-base font-bold text-[#193D2B]">
                            {lastOrder.totalPortions} Porsi Tersimpan
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-mono-tabular text-[#6E5D53] shrink-0">
                          <Clock className="w-3.5 h-3.5 text-[#9A7013] shrink-0" />
                          <span>{formatSavedOrderDate(lastOrder.savedAt)}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 max-h-[116px] overflow-y-auto pr-1 divide-y divide-[#30251F]/8">
                        {lastOrder.items.map((item, idx) => (
                          <div
                            key={`${item.name}-${idx}`}
                            className="pt-1.5 first:pt-0 flex items-baseline justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-[#30251F]">
                                {item.quantity}× {item.name}
                              </span>
                              {item.portionLabel && (
                                <span className="text-[11px] text-[#6E5D53] block truncate">
                                  {item.portionLabel}
                                </span>
                              )}
                            </div>
                            <span className="font-mono-tabular font-bold text-[#193D2B] shrink-0">
                              {formatRupiah(getCartItemSubtotal(item))}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2.5 border-t border-[#30251F]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[11px] text-[#6E5D53] block">
                            Total Pesanan
                          </span>
                          <span className="text-base font-bold font-mono-tabular text-[#193D2B]">
                            {formatRupiah(lastOrder.totalPrice)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onReorderLastOrder(lastOrder)}
                          className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#A83A2D] hover:bg-[#8C2D22] text-white fx-2d-crimson font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                          <span>Pesan Ulang Sekarang</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-[#F7F3E9] border border-[#30251F]/10 text-center space-y-3.5 flex flex-col justify-center">
                      <div className="w-11 h-11 rounded-2xl mx-auto bg-[#193D2B] text-[#E8C56E] fx-2d-icon-box flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-[#193D2B]">
                          Belum Ada Riwayat Pesanan
                        </h3>
                        <p className="text-xs text-[#6E5D53] leading-relaxed max-w-xs mx-auto">
                          Pesanan Anda akan tersimpan otomatis di perangkat ini untuk pesan ulang 1-klik.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={onBrowseMenu}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] fx-2d-forest text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <ArrowDown className="w-3.5 h-3.5 text-[#E8C56E] shrink-0" />
                          <span>Lihat Menu</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowHomeScreenGuide((prev) => !prev)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#EFE9DC] fx-2d-ivory text-xs font-semibold text-[#30251F] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-[#193D2B] shrink-0" />
                          <span>Simpan ke Layar Utama</span>
                          {showHomeScreenGuide ? (
                            <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                          )}
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {showHomeScreenGuide && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.16, ease: EASE_PREMIUM }}
                            className="text-left p-3.5 rounded-xl bg-white border border-[#30251F]/10 text-[11.5px] text-[#4A3C34] space-y-1.5"
                          >
                            <div className="font-bold text-[#193D2B]">
                              Cara Tambah ke Layar Utama (Chrome HP):
                            </div>
                            <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
                              <li>
                                Ketuk ikon titik tiga (<strong className="text-[#30251F]">⋮</strong>) di pojok kanan atas browser Chrome.
                              </li>
                              <li>
                                Pilih menu <strong className="text-[#30251F]">&ldquo;Tambahkan ke layar utama&rdquo;</strong>.
                              </li>
                              <li>
                                Ketuk <strong className="text-[#193D2B]">Tambahkan</strong> agar Nasi Kuning Lasinrang hadir di layar HP Anda.
                              </li>
                            </ol>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Clean Footer Strip */}
        <div className="px-5 sm:px-7 py-3.5 bg-[#FBF9F4] border-t border-[#30251F]/8 flex items-center justify-between gap-3 text-xs text-[#6E5D53]">
          <span className="leading-snug">
            Bebas pilih nasi kuning/putih, porsi, sambal &amp; toping
          </span>
          <button
            type="button"
            onClick={onBrowseMenu}
            className="text-[#193D2B] hover:text-[#A83A2D] font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors inline-flex items-center gap-1"
          >
            <span>Semua Menu</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
