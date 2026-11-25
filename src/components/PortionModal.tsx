import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Flame,
  Plus,
  Minus,
  Sparkles,
  Check,
  Utensils,
  Info,
  FileText,
} from 'lucide-react';
import {
  MenuItem,
  SambalPreference,
  RiceType,
  CartItem,
  StoreConfig,
  SelectedTopping,
} from '../types';
import {
  DEFAULT_EXTRA_SIDE_OPTIONS,
  DEFAULT_PORTION_PRESETS,
  DEFAULT_SAMBAL_OPTIONS,
  DEFAULT_TOPPING_OPTIONS,
  formatRupiah,
} from '../data/initialData';
import { FoodImage } from './FoodImage';

interface PortionModalProps {
  menuItem: MenuItem | null;
  storeConfig?: StoreConfig;
  initialToppingId?: string | null;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}

export const PortionModal: React.FC<PortionModalProps> = ({
  menuItem,
  storeConfig,
  initialToppingId,
  onClose,
  onAddToCart,
}) => {
  const portionPresets = storeConfig?.portionPresets || DEFAULT_PORTION_PRESETS;
  const extraSideQuickOptions = Array.isArray(storeConfig?.extraSideOptions)
    ? storeConfig.extraSideOptions
    : DEFAULT_EXTRA_SIDE_OPTIONS;
  const activeSambalOptions = (
    storeConfig?.sambalOptions?.length ? storeConfig.sambalOptions : DEFAULT_SAMBAL_OPTIONS
  ).filter((opt) => opt.enabled);

  const [riceType, setRiceType] = useState<RiceType>('nasi_kuning');
  const [portionMode, setPortionMode] = useState<'standard' | 'preset1' | 'preset2' | 'custom'>(
    'standard'
  );
  const [customBudgetInput, setCustomBudgetInput] = useState<string>('');
  const [sambalPref, setSambalPref] = useState<SambalPreference>('campur');
  const [toppingQuantities, setToppingQuantities] = useState<Record<string, number>>({});
  const [toppingScope, setToppingScope] = useState<'total_order' | 'per_portion'>('total_order');
  const [wantExtraSideDish, setWantExtraSideDish] = useState<boolean>(false);
  const [extraSideDishNote, setExtraSideDishNote] = useState<string>('');
  const [itemNote, setItemNote] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    if (menuItem) {
      setRiceType('nasi_kuning');
      setPortionMode('standard');
      setCustomBudgetInput(String(menuItem.basePrice + 3000));
      setSambalPref(activeSambalOptions[0]?.id || 'campur');
      setToppingQuantities(initialToppingId ? { [initialToppingId]: 1 } : {});
      setToppingScope('total_order');
      setWantExtraSideDish(false);
      setExtraSideDishNote('');
      setItemNote('');
      setQuantity(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItem, initialToppingId]);

  const isSpesial = menuItem?.category === 'spesial';
  const basePrice = menuItem?.basePrice ?? 10000;
  const preset1Delta = isSpesial
    ? portionPresets.extraPuasSpesialDelta
    : portionPresets.extraPuasRegulerDelta;
  const preset2Delta = isSpesial
    ? portionPresets.jumboSpesialDelta
    : portionPresets.jumboRegulerDelta;

  const preset1Price = basePrice + Math.max(0, Number(preset1Delta) || 0);
  const preset2Price = basePrice + Math.max(0, Number(preset2Delta) || 0);

  const parsedCustom = parseInt(customBudgetInput.replace(/\D/g, ''), 10) || basePrice;
  const effectiveCustomPrice = Math.max(basePrice, parsedCustom);

  let activeUnitPrice = basePrice;
  let portionLabel = `Porsi Standar (${formatRupiah(basePrice)})`;

  if (portionMode === 'preset1') {
    activeUnitPrice = preset1Price;
    portionLabel = `${portionPresets.extraPuasLabel} (${formatRupiah(preset1Price)})`;
  } else if (portionMode === 'preset2') {
    activeUnitPrice = preset2Price;
    portionLabel = `${portionPresets.jumboLabel} (${formatRupiah(preset2Price)})`;
  } else if (portionMode === 'custom') {
    activeUnitPrice = effectiveCustomPrice;
    portionLabel =
      effectiveCustomPrice === basePrice
        ? `Porsi Standar (${formatRupiah(basePrice)})`
        : `Request Porsi Khusus (${formatRupiah(effectiveCustomPrice)})`;
  }

  const selectedToppings: SelectedTopping[] = DEFAULT_TOPPING_OPTIONS.filter(
    (opt) => (toppingQuantities[opt.id] || 0) > 0
  ).map((opt) => ({
    id: opt.id,
    name: opt.name,
    unitPrice: opt.price,
    quantity: toppingQuantities[opt.id] || 0,
  }));

  const toppingTotal = selectedToppings.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const totalToppingPcs = selectedToppings.reduce((sum, item) => sum + item.quantity, 0);
  const effectiveToppingScope: 'per_portion' | 'total_order' =
    quantity > 1 && toppingScope === 'total_order' ? 'total_order' : 'per_portion';

  const finalUnitPrice =
    effectiveToppingScope === 'total_order'
      ? activeUnitPrice
      : activeUnitPrice + toppingTotal;
  const lineSubtotal =
    effectiveToppingScope === 'total_order'
      ? activeUnitPrice * quantity + toppingTotal
      : finalUnitPrice * quantity;

  const setToppingQty = (toppingId: string, nextQty: number) => {
    setToppingQuantities((prev) => {
      const clamped = Math.max(0, Math.min(20, nextQty));
      if (clamped === 0) {
        const copy = { ...prev };
        delete copy[toppingId];
        return copy;
      }
      return { ...prev, [toppingId]: clamped };
    });
  };

  const toggleQuickExtraSide = (sideName: string) => {
    const current = extraSideDishNote
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = current.some((s) => s.toLowerCase() === sideName.toLowerCase());
    const next = exists
      ? current.filter((s) => s.toLowerCase() !== sideName.toLowerCase())
      : [...current, sideName];
    setExtraSideDishNote(next.join(', '));
  };

  const handleConfirm = () => {
    if (!menuItem) return;
    const toppingKey = selectedToppings.map((t) => `${t.id}:${t.quantity}`).join('|');
    const newItem: CartItem = {
      cartItemId: `${menuItem.id}-${riceType}-${finalUnitPrice}-${sambalPref}-${toppingKey}-${effectiveToppingScope}-${wantExtraSideDish}-${extraSideDishNote.trim()}-${itemNote.trim()}-${Date.now()}`,
      menuItem,
      riceType,
      portionType: activeUnitPrice > menuItem.basePrice ? 'custom' : 'standard',
      portionLabel,
      unitPrice: finalUnitPrice,
      quantity,
      sambalPreference: sambalPref,
      toppings: selectedToppings.length > 0 ? selectedToppings : undefined,
      toppingTotal: toppingTotal > 0 ? toppingTotal : undefined,
      toppingScope: selectedToppings.length > 0 ? effectiveToppingScope : undefined,
      wantExtraSideDish,
      extraSideDishNote: extraSideDishNote.trim(),
      itemNote: itemNote.trim() || undefined,
    };
    onAddToCart(newItem);
    onClose();
  };

  if (!menuItem) {
    return null;
  }

  return (
    <div
      className="min-h-screen w-full bg-[#F7F3E9] text-[#30251F] flex flex-col"
      role="main"
      aria-labelledby="portion-modal-title"
    >
      {/* Dedicated Standalone Page Top Header */}
      <header className="sticky top-0 z-40 bg-[#F7F3E9]/95 backdrop-blur-md border-b border-[#30251F]/10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 min-h-[42px] rounded-xl bg-white hover:bg-[#EFE9DC] text-[#193D2B] text-xs sm:text-sm font-semibold flex items-center gap-1.5 border border-[#30251F]/12 cursor-pointer shrink-0 transition-colors"
            aria-label="Kembali ke Daftar Menu"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Kembali ke Menu</span>
          </button>
          <div className="min-w-0 text-right">
            <div className="text-[11px] font-bold text-[#9A7013] uppercase tracking-[0.14em] truncate">
              Atur Pesanan
            </div>
            <div className="text-xs font-medium text-[#4A3C34] truncate">{menuItem.name}</div>
          </div>
        </div>
      </header>

      {/* Natural Document Scroll Content */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6 pb-10">
        {/* Menu Hero Photo Card — Full Uncropped Portrait Poster + 3D Royal Frame */}
        <div className="rounded-3xl menu-card-3d-dark grid grid-cols-1 sm:grid-cols-12 items-center">
          <div className="sm:col-span-5 aspect-[3/4] w-full max-w-[260px] sm:max-w-none mx-auto menu-poster-3d-frame overflow-hidden border-b sm:border-b-0 sm:border-r border-[#FFD24C]/45">
            <FoodImage src={menuItem.imageUrl} alt={menuItem.name} fit="poster" eager />
          </div>

          <div className="sm:col-span-7 p-5 sm:p-6 space-y-3 text-[#F7F3E9]">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D9A52E]/15 border border-[#D9A52E]/35 text-[11px] font-bold uppercase tracking-[0.14em] text-[#E8C56E]">
              <span>{menuItem.category === 'spesial' ? 'Menu Spesial' : 'Menu Reguler'}</span>
              <span>·</span>
              <span>{menuItem.spiceLevel}</span>
            </div>
            <h1
              id="portion-modal-title"
              className="text-2xl sm:text-3xl font-bold text-white font-serif-display leading-tight"
            >
              {menuItem.name}
            </h1>
            <div className="pt-2 border-t border-[#D9A52E]/20 flex items-baseline justify-between gap-2">
              <span className="text-xs text-[#E8C56E] font-medium">Harga Porsi Komplit</span>
              <span className="text-xl sm:text-2xl font-bold text-[#E8C56E] font-mono-tabular">
                {formatRupiah(menuItem.basePrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Customizer Sections */}
        <div className="space-y-6">
              {/* Complete Sides Included Notice */}
              <div className="p-4 rounded-xl bg-[#E9F0EC] border border-[#193D2B]/15">
                <div className="flex items-center gap-2 text-xs font-bold text-[#193D2B] mb-1">
                  <Utensils className="w-3.5 h-3.5 shrink-0 text-[#9A7013]" />
                  <span>Sudah Termasuk Komplit Dalam 1 Porsi</span>
                </div>
                <p className="text-xs text-[#30251F] leading-relaxed">
                  {menuItem.sidesIncluded
                    .map((s, idx) =>
                      idx === 0 && /nasi/i.test(s)
                        ? riceType === 'nasi_putih'
                          ? 'Nasi Putih Hangat'
                          : 'Nasi Kuning Gurih'
                        : s
                    )
                    .join(' · ')}
                </p>
              </div>

              {/* 1. Rice Type Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-bold text-[#193D2B] flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-[#9A7013] shrink-0" />
                    <span>1. Pilih Jenis Nasi</span>
                  </label>
                  <span className="text-xs text-[#193D2B] font-semibold shrink-0">Sesuai Selera</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRiceType('nasi_kuning')}
                    className={`p-3.5 rounded-xl text-left border transition-colors cursor-pointer ${
                      riceType === 'nasi_kuning'
                        ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 text-[#30251F] shadow-xs'
                        : 'bg-white/80 border-[#30251F]/12 text-[#4A3C34] hover:border-[#193D2B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <span className="text-xs sm:text-sm font-bold text-[#193D2B] truncate">
                        Nasi Kuning Gurih
                      </span>
                      {riceType === 'nasi_kuning' && (
                        <Check className="w-4 h-4 text-[#193D2B] shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-[#6E5D53]">
                      Santan kunyit asli harum hangat
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRiceType('nasi_putih')}
                    className={`p-3.5 rounded-xl text-left border transition-colors cursor-pointer ${
                      riceType === 'nasi_putih'
                        ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 text-[#30251F] shadow-xs'
                        : 'bg-white/80 border-[#30251F]/12 text-[#4A3C34] hover:border-[#193D2B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <span className="text-xs sm:text-sm font-bold text-[#193D2B] truncate">Nasi Putih</span>
                      {riceType === 'nasi_putih' && (
                        <Check className="w-4 h-4 text-[#193D2B] shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-[#6E5D53]">
                      Nasi putih pulen sesuai selera
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Flexible Portion / Budget Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-bold text-[#193D2B] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#9A7013] shrink-0" />
                    <span>2. Pilih Porsi / Sesuaikan Budget</span>
                  </label>
                  <span className="text-xs text-[#9A7013] font-semibold shrink-0">Bebas Request</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPortionMode('standard')}
                    className={`p-3.5 rounded-xl text-left border transition-colors cursor-pointer ${
                      portionMode === 'standard'
                        ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 text-[#30251F] shadow-xs'
                        : 'bg-white/80 border-[#30251F]/12 text-[#4A3C34] hover:border-[#193D2B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <span className="text-xs font-bold text-[#193D2B] truncate">Porsi Standar</span>
                      {portionMode === 'standard' && <Check className="w-4 h-4 text-[#193D2B] shrink-0" />}
                    </div>
                    <div className="text-base font-bold font-mono-tabular text-[#30251F]">
                      {formatRupiah(basePrice)}
                    </div>
                    <div className="text-[11px] text-[#6E5D53] mt-0.5">Komplit Normal</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPortionMode('preset1')}
                    className={`p-3.5 rounded-xl text-left border transition-colors cursor-pointer ${
                      portionMode === 'preset1'
                        ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 text-[#30251F] shadow-xs'
                        : 'bg-white/80 border-[#30251F]/12 text-[#4A3C34] hover:border-[#193D2B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <span className="text-xs font-bold text-[#193D2B] truncate">
                        {portionPresets.extraPuasLabel}
                      </span>
                      {portionMode === 'preset1' && <Check className="w-4 h-4 text-[#193D2B] shrink-0" />}
                    </div>
                    <div className="text-base font-bold font-mono-tabular text-[#30251F]">
                      {formatRupiah(preset1Price)}
                    </div>
                    <div className="text-[11px] text-[#6E5D53] mt-0.5">Ekstra Nasi &amp; Lauk</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPortionMode('preset2')}
                    className={`p-3.5 rounded-xl text-left border transition-colors cursor-pointer ${
                      portionMode === 'preset2'
                        ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 text-[#30251F] shadow-xs'
                        : 'bg-white/80 border-[#30251F]/12 text-[#4A3C34] hover:border-[#193D2B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <span className="text-xs font-bold text-[#193D2B] truncate">
                        {portionPresets.jumboLabel}
                      </span>
                      {portionMode === 'preset2' && <Check className="w-4 h-4 text-[#193D2B] shrink-0" />}
                    </div>
                    <div className="text-base font-bold font-mono-tabular text-[#30251F]">
                      {formatRupiah(preset2Price)}
                    </div>
                    <div className="text-[11px] text-[#6E5D53] mt-0.5">Nasi &amp; Bumbu Lebih</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPortionMode('custom')}
                    className={`p-3.5 rounded-xl text-left border transition-colors cursor-pointer ${
                      portionMode === 'custom'
                        ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 text-[#30251F] shadow-xs'
                        : 'bg-white/80 border-[#30251F]/12 text-[#4A3C34] hover:border-[#193D2B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <span className="text-xs font-bold text-[#193D2B] truncate">Nominal Lainnya</span>
                      {portionMode === 'custom' && <Check className="w-4 h-4 text-[#193D2B] shrink-0" />}
                    </div>
                    <div className="text-sm font-bold text-[#30251F]">Ketik Budget</div>
                    <div className="text-[11px] text-[#6E5D53] mt-0.5">
                      Mulai {formatRupiah(basePrice)}+
                    </div>
                  </button>
                </div>

                {portionMode === 'custom' && (
                  <div className="p-4 rounded-xl bg-white border border-[#D9A52E]/60 space-y-2.5">
                    <label className="block text-xs font-bold text-[#193D2B]">
                      Masukkan Budget Per Porsi (Minimal {formatRupiah(basePrice)}):
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#9A7013]">Rp</span>
                      <input
                        type="number"
                        min={basePrice}
                        step={1000}
                        value={customBudgetInput}
                        onChange={(e) => setCustomBudgetInput(e.target.value)}
                        placeholder={String(basePrice + 2000)}
                        className="w-full bg-[#F7F3E9] border border-[#30251F]/15 rounded-lg px-3 py-2 text-sm font-mono-tabular text-[#30251F] focus:outline-none focus:border-[#193D2B]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        basePrice + 2000,
                        basePrice + 3000,
                        basePrice + 5000,
                        basePrice + 8000,
                        basePrice + 10000,
                      ].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCustomBudgetInput(String(amt))}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-mono-tabular font-semibold bg-[#EFE9DC] hover:bg-[#193D2B] hover:text-[#F7F3E9] text-[#30251F] border border-[#30251F]/10 cursor-pointer transition-colors"
                        >
                          {formatRupiah(amt)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Quantity Stepper (Aligned 1:1 with Tutorial Order) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-bold text-[#193D2B] flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-[#193D2B] shrink-0" />
                    <span>3. Tentukan Jumlah Porsi</span>
                  </label>
                  <span className="text-xs text-[#193D2B] font-semibold shrink-0">
                    {quantity} Porsi Dipilih
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#30251F]/12 flex items-center justify-between gap-3">
                  <div className="text-xs text-[#6E5D53] leading-snug">
                    <span className="font-bold text-[#30251F] block">Banyaknya Porsi</span>
                    <span>Ketuk − / + untuk atur jumlah pesanan ini</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#EFE9DC] border border-[#30251F]/12 rounded-xl p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-9 h-9 rounded-lg bg-white hover:bg-[#F7F3E9] text-[#30251F] flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Kurangi jumlah porsi"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="min-w-[64px] text-center font-bold font-mono-tabular text-sm text-[#30251F]">
                      {quantity} Porsi
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-9 h-9 rounded-lg bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Tambah jumlah porsi"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Mandatory Sambal Preference */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-bold text-[#193D2B] flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#A83A2D] shrink-0" />
                    <span>4. Pilihan Sambal Khas Lasinrang</span>
                  </label>
                  <span className="text-xs text-[#A83A2D] font-bold shrink-0">Wajib Pilih</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {(activeSambalOptions.length > 0
                    ? activeSambalOptions
                    : DEFAULT_SAMBAL_OPTIONS
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSambalPref(option.id)}
                      className={`w-full p-3.5 rounded-xl text-left border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                        sambalPref === option.id
                          ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 text-[#30251F] shadow-xs'
                          : 'bg-white/80 border-[#30251F]/12 text-[#4A3C34] hover:border-[#193D2B]/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#30251F]">{option.label}</div>
                        <div className="text-xs text-[#6E5D53] mt-0.5">{option.desc}</div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          sambalPref === option.id
                            ? 'border-[#193D2B] bg-[#193D2B] text-white'
                            : 'border-[#30251F]/25'
                        }`}
                      >
                        {sambalPref === option.id && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Topping Option (Bakwan Goreng Renyah Rp 1.000) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-bold text-[#193D2B] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#9A7013] shrink-0" />
                    <span>5. Opsi Toping Tambahan</span>
                  </label>
                  <span className="text-xs text-[#6E5D53] font-medium shrink-0">Cuma Seribuan</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {DEFAULT_TOPPING_OPTIONS.map((topping) => {
                    const qty = toppingQuantities[topping.id] || 0;
                    const isActive = qty > 0;
                    return (
                      <div
                        key={topping.id}
                        onClick={() => setToppingQty(topping.id, isActive ? 0 : 1)}
                        className={`p-3.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                          isActive
                            ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 shadow-xs'
                            : 'bg-white/80 border-[#30251F]/12 hover:border-[#193D2B]/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              isActive
                                ? 'bg-[#193D2B] border-[#193D2B] text-white'
                                : 'border-[#30251F]/25 bg-white'
                            }`}
                          >
                            {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          {topping.imageUrl && (
                            <div className="w-16 h-24 rounded-xl overflow-hidden shrink-0 border border-[#D9A52E]/55 menu-poster-3d-frame shadow-sm flex items-center justify-center">
                              <img
                                src={topping.imageUrl}
                                alt={topping.name}
                                decoding="sync"
                                className="w-full h-full object-contain culinary-photo hd-4k-image"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-sm font-bold text-[#30251F]">
                                {topping.name}
                              </span>
                              <span className="text-xs font-bold font-mono-tabular text-[#9A7013]">
                                +{formatRupiah(topping.price)} / 1
                              </span>
                            </div>
                            {isActive && (
                              <p className="text-[11px] font-bold text-[#193D2B] mt-1 font-mono-tabular">
                                {quantity > 1 && effectiveToppingScope === 'total_order'
                                  ? `Dipilih: ${qty} pcs total untuk pesanan ini (+${formatRupiah(
                                      topping.price * qty
                                    )})`
                                  : quantity > 1
                                  ? `Dipilih: ${qty}× per porsi (total ${
                                      qty * quantity
                                    } pcs · +${formatRupiah(topping.price * qty * quantity)})`
                                  : `Dipilih: ${qty}× (+${formatRupiah(topping.price * qty)})`}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isActive ? (
                            <div className="flex items-center gap-1 bg-[#EFE9DC] border border-[#30251F]/12 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => setToppingQty(topping.id, qty - 1)}
                                className="w-8 h-8 rounded-md bg-white hover:bg-[#F7F3E9] text-[#30251F] flex items-center justify-center transition-colors cursor-pointer"
                                aria-label={`Kurangi toping ${topping.name}`}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-xs font-bold font-mono-tabular text-[#30251F]">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => setToppingQty(topping.id, qty + 1)}
                                className="w-8 h-8 rounded-md bg-[#193D2B] hover:bg-[#122E20] text-white flex items-center justify-center transition-colors cursor-pointer"
                                aria-label={`Tambah toping ${topping.name}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setToppingQty(topping.id, 1)}
                              className="px-3 py-2 rounded-lg bg-[#EFE9DC] hover:bg-[#193D2B] hover:text-white text-[#193D2B] border border-[#30251F]/12 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
                            >
                              + Tambah
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {quantity > 1 && (
                  <div className="p-3.5 rounded-xl bg-[#FAF5E8] border border-[#D9A52E]/50 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#193D2B]">
                        Opsi Toping untuk {quantity} Porsi:
                      </span>
                      <span className="text-[11px] font-semibold text-[#9A7013]">
                        {toppingTotal > 0
                          ? `Total Toping: +${formatRupiah(
                              effectiveToppingScope === 'total_order'
                                ? toppingTotal
                                : toppingTotal * quantity
                            )}`
                          : 'Bisa untuk sebagian porsi saja'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setToppingScope('total_order')}
                        className={`p-3 rounded-xl text-left border transition-colors cursor-pointer ${
                          toppingScope === 'total_order'
                            ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/25 shadow-xs'
                            : 'bg-white/75 border-[#30251F]/12 hover:border-[#193D2B]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-[#193D2B]">
                            Hanya Sebagian Porsi (Total Satuan)
                          </span>
                          {toppingScope === 'total_order' && (
                            <Check className="w-4 h-4 text-[#193D2B] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#6E5D53] leading-snug">
                          {toppingTotal > 0
                            ? `Tidak dikali ${quantity} porsi — cuma ${totalToppingPcs} pcs total (+${formatRupiah(
                                toppingTotal
                              )}).`
                            : `Tidak otomatis dikali ${quantity} porsi jika ada porsi yang tidak pakai toping.`}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setToppingScope('per_portion')}
                        className={`p-3 rounded-xl text-left border transition-colors cursor-pointer ${
                          toppingScope === 'per_portion'
                            ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/25 shadow-xs'
                            : 'bg-white/75 border-[#30251F]/12 hover:border-[#193D2B]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-[#193D2B]">
                            Semua {quantity} Porsi Pakai Toping
                          </span>
                          {toppingScope === 'per_portion' && (
                            <Check className="w-4 h-4 text-[#193D2B] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#6E5D53] leading-snug">
                          {toppingTotal > 0
                            ? `Setiap porsi dapat toping (${totalToppingPcs * quantity} pcs · +${formatRupiah(
                                toppingTotal * quantity
                              )}).`
                            : `Otomatis ditambahkan ke semua ${quantity} porsi.`}
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Extra Side Dish Option */}
              <div className="space-y-2.5">
                <div
                  onClick={() => setWantExtraSideDish(!wantExtraSideDish)}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                    wantExtraSideDish
                      ? 'bg-white border-[#193D2B] shadow-xs'
                      : 'bg-white/80 border-[#30251F]/12 hover:border-[#193D2B]/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={wantExtraSideDish}
                      onChange={(e) => setWantExtraSideDish(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-4 h-4 accent-[#193D2B] rounded cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[#193D2B]">
                        Mau Tambah Lauk Ekstra?
                      </div>
                      <p className="text-xs text-[#6E5D53] mt-1 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0 text-[#9A7013]" />
                        <span>Harga lauk tambahan akan dikonfirmasi Admin via WhatsApp.</span>
                      </p>
                    </div>
                  </div>

                  {wantExtraSideDish && (
                    <div
                      className="mt-3 pt-3 border-t border-[#30251F]/10 space-y-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {extraSideQuickOptions.map((chip) => {
                          const isChosen = extraSideDishNote
                            .toLowerCase()
                            .includes(chip.toLowerCase());
                          return (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => toggleQuickExtraSide(chip)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                                isChosen
                                  ? 'bg-[#193D2B] text-[#F7F3E9] border-[#193D2B]'
                                  : 'bg-[#F7F3E9] text-[#30251F] border-[#30251F]/14 hover:border-[#193D2B]/50'
                              }`}
                            >
                              {isChosen ? `✓ ${chip}` : `+ ${chip}`}
                            </button>
                          );
                        })}
                      </div>

                      <label className="block text-xs font-bold text-[#193D2B]">
                        Catatan Lauk Tambahan yang Diinginkan (Opsional):
                      </label>
                      <input
                        type="text"
                        value={extraSideDishNote}
                        onChange={(e) => setExtraSideDishNote(e.target.value)}
                        placeholder="Contoh: Tambah Telur Sambal 1, atau Tambah Ayam Goreng..."
                        className="w-full bg-[#F7F3E9] border border-[#30251F]/16 rounded-lg px-3 py-2 text-xs text-[#30251F] placeholder:text-[#6E5D53]/65 focus:outline-none focus:border-[#193D2B]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 7. Special Notes per Item */}
              <div className="space-y-1.5">
                <label
                  htmlFor="portion-item-note"
                  className="text-xs font-bold text-[#193D2B] flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-[#9A7013]" />
                  <span>Catatan Khusus Pesanan Ini (Opsional)</span>
                </label>
                <input
                  id="portion-item-note"
                  type="text"
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  placeholder="Contoh: Kerupuk dipisah, bakwan hangat, atau tanpa mie..."
                  className="w-full bg-white border border-[#30251F]/14 rounded-xl px-3.5 py-2.5 text-xs text-[#30251F] placeholder:text-[#6E5D53]/65 focus:outline-none focus:border-[#193D2B]"
                />
              </div>
        </div>
      </div>

      {/* Sticky Bottom Checkout Action Bar */}
      <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#30251F]/12 shadow-[0_-8px_24px_-12px_rgba(25,61,43,0.16)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="max-w-2xl mx-auto p-3.5 sm:p-4 flex items-center justify-between gap-3 sm:gap-4">
          <div className="shrink-0">
            <div className="text-[11px] font-medium text-[#6E5D53]">
              Subtotal ({quantity} Porsi)
            </div>
            <div className="text-base sm:text-lg font-bold font-mono-tabular text-[#193D2B]">
              {formatRupiah(lineSubtotal)}
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 min-w-0 min-h-[46px] py-3 px-4 sm:px-5 rounded-xl bg-[#A83A2D] hover:bg-[#8C2D22] active:scale-[0.99] text-[#F7F3E9] font-semibold text-xs sm:text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="truncate">Masukkan Pesanan</span>
            <Check className="w-4 h-4 text-[#E8C56E] shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
