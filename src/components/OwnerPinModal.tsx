import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';

const OFFICIAL_LOGO_URL = '/assets/aistudio/file_000000004bd48211a316832fba565d37_46611b00.png';

interface OwnerPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expectedPin?: string;
}

export const OwnerPinModal: React.FC<OwnerPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  expectedPin = '225500',
}) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPin('');
    setError(null);
    setShowPin(false);
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  const verifyPin = (value: string) => {
    if (value === expectedPin) {
      setError(null);
      onSuccess();
    } else {
      setError('PIN salah. Akses ditolak.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(cleaned);
    if (error) setError(null);

    if (cleaned.length === 6) {
      if (cleaned === expectedPin) {
        onSuccess();
      } else {
        setError('PIN rahasia tidak cocok. Silakan coba lagi.');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyPin(pin);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="min-h-screen w-full bg-forest-architectural text-[#F7F3E9] flex flex-col"
      role="main"
      aria-labelledby="owner-pin-title"
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-[#F7F3E9]/95 backdrop-blur-md text-[#30251F] border-b border-[#30251F]/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 min-h-[42px] rounded-xl bg-white hover:bg-[#EFE9DC] text-[#193D2B] text-xs sm:text-sm font-semibold flex items-center gap-1.5 border border-[#30251F]/12 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Kembali ke Beranda</span>
          </button>
          <span className="text-[11px] font-bold text-[#9A7013] uppercase tracking-[0.14em]">
            Akses Owner
          </span>
        </div>
      </header>

      {/* Centered Standalone Verification Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm bg-white border border-[#D9A52E]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Card Header */}
          <div className="px-5 py-4 bg-[#F7F3E9] border-b border-[#30251F]/10 flex items-center gap-3">
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Logo Nasi Kuning Lasinrang"
              loading="eager"
              decoding="async"
              draggable={false}
              className="w-10 h-10 rounded-full object-contain shrink-0 ring-2 ring-[#D9A52E]/70 bg-white"
            />
            <div>
              <h1
                id="owner-pin-title"
                className="text-sm sm:text-base font-bold text-[#193D2B] font-serif-display"
              >
                Verifikasi Akses Owner
              </h1>
              <p className="text-[11px] text-[#6E5D53]">
                Masukkan 6 digit PIN rahasia pengelola
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="owner-pin-input"
                className="block text-xs font-bold text-[#193D2B]"
              >
                PIN Rahasia Owner
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="owner-pin-input"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin}
                  onChange={handleInputChange}
                  placeholder="••••••"
                  className="w-full bg-[#F7F3E9] border border-[#30251F]/18 focus:border-[#193D2B] rounded-xl px-4 py-3 pr-11 text-center text-xl tracking-[0.45em] font-mono-tabular text-[#30251F] placeholder:text-[#6E5D53]/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E5D53] hover:text-[#193D2B] p-1 cursor-pointer"
                  aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-[#A83A2D]/25 text-[#A83A2D] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#E8C56E]" />
              <span>Buka Halaman Setting Owner</span>
            </button>

            <p className="text-[11px] text-center text-[#6E5D53] leading-relaxed">
              Perangkat ini akan diingat secara otomatis setelah PIN terverifikasi.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
