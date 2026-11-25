import {
  DEFAULT_EXTRA_SIDE_OPTIONS,
  DEFAULT_PORTION_PRESETS,
  DEFAULT_SAMBAL_OPTIONS,
  DEFAULT_TOPPING_OPTIONS,
  formatRupiah,
  NEW_OFFICIAL_MENU_IDS,
} from '../data/initialData';
import { MenuItem, StoreConfig } from '../types';

function isNewMenuBadge(item: MenuItem): boolean {
  return (
    (NEW_OFFICIAL_MENU_IDS as readonly string[]).includes(item.id) ||
    item.id.startsWith('menu-') ||
    /menu baru/i.test(item.signatureTag || '')
  );
}

export function buildCopyableMenuListText(
  storeConfig: StoreConfig,
  menuItems: MenuItem[]
): string {
  const brand = (storeConfig.brandName || 'NASI KUNING LASINRANG').trim();
  const spesial = menuItems.filter((m) => m.category === 'spesial');
  const reguler = menuItems.filter((m) => m.category !== 'spesial');
  const presets = storeConfig.portionPresets || DEFAULT_PORTION_PRESETS;
  const extraSides =
    Array.isArray(storeConfig.extraSideOptions) &&
    storeConfig.extraSideOptions.length > 0
      ? storeConfig.extraSideOptions
      : DEFAULT_EXTRA_SIDE_OPTIONS;
  const activeSambals = (storeConfig.sambalOptions || DEFAULT_SAMBAL_OPTIONS)
    .filter((s) => s.enabled !== false)
    .map((s) => s.label.replace(/^[^\p{L}\p{N}]+/u, '').trim());

  const lines: string[] = [
    `🍛 *DAFTAR MENU RESMI ${brand.toUpperCase()}*`,
    `_${storeConfig.tagline}_`,
    `🕒 ${storeConfig.operatingHours}`,
    `📍 ${storeConfig.locationAddress}`,
    `📌 Titik Jemput GoFood/Maxim: ${storeConfig.pickupCoordinatesText}`,
    ``,
    `Total tersedia *${Math.max(14, menuItems.length)} Menu Komplit* (Pilih Nasi Kuning Gurih / Nasi Putih + Lauk Utama + Tempe Manis Gurih + Mie Goreng Kecap + Kerupuk Renyah):`,
    ``,
  ];

  if (spesial.length > 0) {
    lines.push(`🔥 *MENU SPESIAL (${spesial.length} Pilihan):*`);
    spesial.forEach((item, idx) => {
      const badge = isNewMenuBadge(item) ? ' [MENU BARU]' : '';
      const stock = item.isAvailable ? '' : ' (STOK HABIS)';
      lines.push(
        `${idx + 1}. *${item.name}* — ${formatRupiah(item.basePrice)}${badge}${stock}`
      );
    });
    lines.push(``);
  }

  if (reguler.length > 0) {
    lines.push(`🍽️ *MENU REGULER (${reguler.length} Pilihan):*`);
    reguler.forEach((item, idx) => {
      const badge = isNewMenuBadge(item) ? ' [MENU BARU]' : '';
      const stock = item.isAvailable ? '' : ' (STOK HABIS)';
      lines.push(
        `${idx + 1}. *${item.name}* — ${formatRupiah(item.basePrice)}${badge}${stock}`
      );
    });
    lines.push(``);
  }

  lines.push(`✨ *TOPING TAMBAHAN & LAUK EKSTRA:*`);
  DEFAULT_TOPPING_OPTIONS.forEach((top) => {
    lines.push(`• ${top.name} — +${formatRupiah(top.price)} (${top.unitLabel})`);
  });
  lines.push(`• Pilihan Lauk Ekstra: ${extraSides.join(', ')}`);
  lines.push(``);

  lines.push(`🍚 *PILIHAN PORSI & SAMBAL:*`);
  lines.push(
    `• Porsi: Standar, ${presets.extraPuasLabel} (+${formatRupiah(presets.extraPuasRegulerDelta)}/+${formatRupiah(presets.extraPuasSpesialDelta)}), ${presets.jumboLabel} (+${formatRupiah(presets.jumboRegulerDelta)}/+${formatRupiah(presets.jumboSpesialDelta)}), atau Nominal Budget Khusus`
  );
  if (activeSambals.length > 0) {
    lines.push(`• Sambal: ${activeSambals.join(' / ')}`);
  }
  lines.push(``);

  lines.push(`💳 *PEMBAYARAN LANGSUNG (NON-COD):*`);
  lines.push(`• QRIS Resmi: ${storeConfig.qrisMerchantName}`);
  lines.push(`• GoPay / DANA: ${storeConfig.ewalletNumber}`);
  lines.push(`• WhatsApp Admin: ${storeConfig.whatsappDisplay}`);
  lines.push(``);
  lines.push(`_Malunra Tongeng, Marasa na Masempo!_`);

  return lines.join('\n');
}
