import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Smartphone,
  Check,
  X,
  Share,
  PlusSquare,
  MoreVertical,
  Monitor,
  Home,
  Utensils,
  MapPin,
  ShoppingBag,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

interface PWAInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandName: string;
  logoUrl: string;
  isInstallable: boolean;
  isInstalled: boolean;
  defaultTab?: 'android' | 'ios' | 'desktop';
  onTriggerNativeInstall: () => Promise<boolean>;
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({
  isOpen,
  onClose,
  brandName,
  logoUrl,
  isInstallable,
  isInstalled,
  defaultTab = 'android',
  onTriggerNativeInstall,
}) => {
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>(defaultTab);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10020] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Instal Aplikasi Nasi Kuning Lasinrang"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0E261A] border-t-2 sm:border-2 border-[#D9A52E]/60 text-[#FAF6EE] shadow-2xl flex flex-col"
      >
        {/* Mobile Bottom Sheet Grab Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-11 h-1.5 rounded-full bg-[#D9A52E]/45" />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-4 border-b border-[#D9A52E]/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoUrl}
              alt={brandName}
              className="w-12 h-12 rounded-2xl object-contain bg-white p-0.5 ring-2 ring-[#F3C969] shrink-0"
            />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F3C969] block">
                ✦ Aplikasi Resmi (PWA) ✦
              </span>
              <h3 className="text-base sm:text-lg font-bold font-serif-display text-white truncate">
                {brandName}
              </h3>
              <p className="text-xs text-[#FAF6EE]/75 truncate">
                Akses Cepat 1-Ketuk dari Layar Utama HP
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan instal aplikasi"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-[#D9A52E]/35 text-[#F3C969] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {isInstalled ? (
            <div className="p-4 rounded-2xl bg-[#193D2B] border border-[#D9A52E]/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D9A52E] text-[#0E261A] flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="text-xs leading-relaxed">
                <div className="font-bold text-[#F3C969] text-sm">
                  Aplikasi Sudah Terpasang di Perangkat Ini
                </div>
                <p className="text-[#FAF6EE]/85">
                  Anda dapat membuka aplikasi <strong>{brandName}</strong> langsung dari ikon di layar utama HP Anda.
                </p>
              </div>
            </div>
          ) : isInstallable ? (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#193D2B] to-[#0F2419] border border-[#F3C969]/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F3C969]">
                <Sparkles className="w-4 h-4" />
                <span>Perangkat Anda Mendukung Instalasi Langsung 1-Klik!</span>
              </div>
              <p className="text-xs text-[#FAF6EE]/85 leading-relaxed">
                Ketuk tombol di bawah ini untuk langsung memasang aplikasi <strong>{brandName}</strong> ke layar utama tanpa lewat toko aplikasi.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const ok = await onTriggerNativeInstall();
                  if (ok) onClose();
                }}
                className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-gradient-to-r from-[#D9A52E] to-[#F3C969] hover:from-[#C79321] hover:to-[#D9A52E] text-[#0D2117] font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg cursor-pointer transition-all"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Instal Aplikasi Sekarang</span>
              </button>
            </div>
          ) : null}

          {/* Platform Selector Tabs */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#F3C969] uppercase tracking-wider">
              Panduan Pasang di HP &amp; Perangkat Anda:
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#091910] border border-[#D9A52E]/30">
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`min-h-[40px] px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'android'
                    ? 'bg-[#D9A52E] text-[#0D2117] shadow-xs'
                    : 'text-[#FAF6EE]/75 hover:text-white'
                }`}
              >
                HP Android
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`min-h-[40px] px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ios'
                    ? 'bg-[#D9A52E] text-[#0D2117] shadow-xs'
                    : 'text-[#FAF6EE]/75 hover:text-white'
                }`}
              >
                iPhone / iPad
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('desktop')}
                className={`min-h-[40px] px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'desktop'
                    ? 'bg-[#D9A52E] text-[#0D2117] shadow-xs'
                    : 'text-[#FAF6EE]/75 hover:text-white'
                }`}
              >
                Laptop / PC
              </button>
            </div>

            {activeTab === 'android' && (
              <div className="p-4 rounded-2xl bg-[#091910]/90 border border-[#D9A52E]/30 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#D9A52E]/20 border border-[#D9A52E]/50 text-[#F3C969] font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="pt-0.5 leading-relaxed text-[#FAF6EE]/90">
                    Ketuk ikon menu titik tiga{' '}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/10 text-[#F3C969] font-bold">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </span>{' '}
                    di pojok kanan atas browser <strong>Google Chrome</strong>.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#D9A52E]/20 border border-[#D9A52E]/50 text-[#F3C969] font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="pt-0.5 leading-relaxed text-[#FAF6EE]/90">
                    Pilih menu <strong className="text-[#F3C969]">&ldquo;Instal aplikasi&rdquo;</strong> atau{' '}
                    <strong className="text-[#F3C969]">&ldquo;Tambahkan ke layar utama&rdquo;</strong>.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#D9A52E]/20 border border-[#D9A52E]/50 text-[#F3C969] font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="pt-0.5 leading-relaxed text-[#FAF6EE]/90">
                    Ketuk <strong className="text-[#F3C969]">Instal</strong> — ikon resmi{' '}
                    <strong>{brandName}</strong> langsung muncul di menu aplikasi HP Anda.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ios' && (
              <div className="p-4 rounded-2xl bg-[#091910]/90 border border-[#D9A52E]/30 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#D9A52E]/20 border border-[#D9A52E]/50 text-[#F3C969] font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="pt-0.5 leading-relaxed text-[#FAF6EE]/90">
                    Buka website ini menggunakan browser <strong>Safari</strong> di iPhone/iPad, lalu ketuk tombol{' '}
                    <strong className="text-[#F3C969]">Bagikan (Share)</strong>{' '}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/10 text-[#F3C969]">
                      <Share className="w-3.5 h-3.5" />
                    </span>{' '}
                    di bar bawah layar.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#D9A52E]/20 border border-[#D9A52E]/50 text-[#F3C969] font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="pt-0.5 leading-relaxed text-[#FAF6EE]/90">
                    Geser ke bawah dan pilih{' '}
                    <strong className="text-[#F3C969]">&ldquo;Tambah ke Layar Utama&rdquo; (Add to Home Screen)</strong>{' '}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/10 text-[#F3C969]">
                      <PlusSquare className="w-3.5 h-3.5" />
                    </span>
                    .
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#D9A52E]/20 border border-[#D9A52E]/50 text-[#F3C969] font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="pt-0.5 leading-relaxed text-[#FAF6EE]/90">
                    Ketuk <strong className="text-[#F3C969]">Tambah (Add)</strong> di pojok kanan atas untuk menyimpan aplikasi.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'desktop' && (
              <div className="p-4 rounded-2xl bg-[#091910]/90 border border-[#D9A52E]/30 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#D9A52E]/20 border border-[#D9A52E]/50 text-[#F3C969] font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="pt-0.5 leading-relaxed text-[#FAF6EE]/90">
                    Klik ikon <strong className="text-[#F3C969]">Instal Aplikasi</strong>{' '}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/10 text-[#F3C969]">
                      <Monitor className="w-3.5 h-3.5" />
                    </span>{' '}
                    di sisi kanan kolom alamat (address bar) Chrome atau Microsoft Edge.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#D9A52E]/20 border border-[#D9A52E]/50 text-[#F3C969] font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="pt-0.5 leading-relaxed text-[#FAF6EE]/90">
                    Klik <strong className="text-[#F3C969]">Instal</strong> agar aplikasi dapat dibuka dari Desktop atau Taskbar kapan saja.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* App Advantages Strip */}
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="p-2.5 rounded-xl bg-white/5 border border-[#D9A52E]/20">
              <div className="font-bold text-[#F3C969]">Layar Penuh</div>
              <div className="text-[#FAF6EE]/70 text-[10px]">Tanpa Bar Browser</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-[#D9A52E]/20">
              <div className="font-bold text-[#F3C969]">Hemat Kuota</div>
              <div className="text-[#FAF6EE]/70 text-[10px]">Menu Tersimpan</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-[#D9A52E]/20">
              <div className="font-bold text-[#F3C969]">1-Klik Pesan</div>
              <div className="text-[#FAF6EE]/70 text-[10px]">Langsung dari HP</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-[#091910] border-t border-[#D9A52E]/25 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#FAF6EE] text-xs font-bold cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

interface PWAInstallButtonProps {
  brandName: string;
  logoUrl: string;
  variant?: 'header' | 'hero' | 'drawer';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  brandName,
  logoUrl,
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setIsModalOpen(true);
      }
      return;
    }
    setIsModalOpen(true);
  };

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleClick}
          title="Instal Aplikasi Nasi Kuning Lasinrang"
          className="min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-[#193D2B] hover:bg-[#D9A52E] text-[#F3C969] hover:text-[#0D2117] fx-2d-dark-chip text-[11px] sm:text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Instal App</span>
          <span className="md:hidden">App</span>
        </button>
      )}

      {variant === 'hero' && (
        <button
          type="button"
          onClick={handleClick}
          className="w-full min-h-[48px] px-5 py-3.5 rounded-2xl bg-[#193D2B] hover:bg-[#132F20] text-[#F3C969] fx-2d-dark-chip font-bold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-[#F3C969] shrink-0" />
          <span>{isInstalled ? 'Aplikasi Terpasang ✓' : 'Instal Aplikasi di HP'}</span>
        </button>
      )}

      {variant === 'drawer' && (
        <button
          type="button"
          onClick={handleClick}
          className="col-span-2 min-h-[46px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D9A52E] to-[#F3C969] text-[#0D2117] fx-2d-gold font-extrabold text-xs flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#0D2117] shrink-0" />
            <span>
              {isInstalled
                ? 'Aplikasi Sudah Terpasang di HP Anda'
                : 'Instal Aplikasi Nasi Kuning Lasinrang'}
            </span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#0D2117] text-[#F3C969] text-[10px] font-bold">
            {isInstalled ? 'Aktif' : 'Pasang'}
          </span>
        </button>
      )}

      <PWAInstallGuideModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        brandName={brandName}
        logoUrl={logoUrl}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        defaultTab={isIOS ? 'ios' : 'android'}
        onTriggerNativeInstall={install}
      />
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-16 inset-x-3 sm:inset-x-auto sm:right-5 z-50 flex items-center gap-2.5 rounded-2xl bg-[#A83A2D] text-white px-4 py-2.5 text-xs font-bold shadow-xl border border-[#F3C969]/50"
    >
      <WifiOff className="w-4 h-4 text-[#F3C969] shrink-0" />
      <span>Mode Offline — Menampilkan daftar menu tersimpan di aplikasi.</span>
    </div>
  );
};

interface MobileBottomAppBarProps {
  totalCartPortions: number;
  onOpenCart: () => void;
  brandName: string;
  logoUrl: string;
  menuCount: number;
}

export const MobileBottomAppBar: React.FC<MobileBottomAppBarProps> = ({
  totalCartPortions,
  onOpenCart,
  brandName,
  logoUrl,
  menuCount,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  const handleInstallTab = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) setIsInstallModalOpen(true);
      return;
    }
    setIsInstallModalOpen(true);
  };

  return (
    <>
      <nav
        aria-label="Navigasi Aplikasi Mobile"
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0B1E14]/96 backdrop-blur-xl border-t border-[#D9A52E]/45 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-10px_28px_rgba(0,0,0,0.45)]"
      >
        <div className="grid grid-cols-5 items-center h-14 px-1">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[#FAF6EE]/80 hover:text-[#F3C969] active:text-[#F3C969] transition-colors"
          >
            <Home className="w-4 h-4 text-[#F3C969]" />
            <span className="text-[10px] font-semibold leading-none">Beranda</span>
          </a>

          <a
            href="#katalog-menu"
            className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[#FAF6EE]/80 hover:text-[#F3C969] active:text-[#F3C969] transition-colors"
          >
            <Utensils className="w-4 h-4 text-[#F3C969]" />
            <span className="text-[10px] font-semibold leading-none">Menu ({menuCount})</span>
          </a>

          {isInstalled ? (
            <a
              href="#unggulan"
              className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[#FAF6EE]/80 hover:text-[#F3C969] active:text-[#F3C969] transition-colors"
            >
              <Sparkles className="w-4 h-4 text-[#F3C969]" />
              <span className="text-[10px] font-semibold leading-none">Spesial</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={handleInstallTab}
              className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[#F3C969] cursor-pointer"
            >
              <div className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#D9A52E] to-[#F3C969] text-[#0D2117] flex items-center gap-1 shadow-sm">
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="text-[10px] font-extrabold leading-none">
                  Instal
                </span>
              </div>
            </button>
          )}

          <a
            href="#lokasi-kedai"
            className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[#FAF6EE]/80 hover:text-[#F3C969] active:text-[#F3C969] transition-colors"
          >
            <MapPin className="w-4 h-4 text-[#F3C969]" />
            <span className="text-[10px] font-semibold leading-none">Lokasi</span>
          </a>

          <button
            type="button"
            onClick={onOpenCart}
            className="relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[#FAF6EE]/80 hover:text-[#F3C969] cursor-pointer"
          >
            <div className="relative">
              <ShoppingBag className="w-4 h-4 text-[#F3C969]" />
              {totalCartPortions > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#A83A2D] text-white text-[9px] font-bold flex items-center justify-center border border-[#F3C969]/60">
                  {totalCartPortions}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold leading-none">Keranjang</span>
          </button>
        </div>
      </nav>

      <PWAInstallGuideModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        brandName={brandName}
        logoUrl={logoUrl}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        defaultTab={isIOS ? 'ios' : 'android'}
        onTriggerNativeInstall={install}
      />
    </>
  );
};
