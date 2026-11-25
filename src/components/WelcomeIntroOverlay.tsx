import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { NasiKuningEmblem, NusantaraSectionDivider } from './CulinaryOrnaments';

interface WelcomeIntroOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
  logoUrl: string;
  brandName: string;
}

const INTRO_DURATION_MS = 5000;

export const WelcomeIntroOverlay: React.FC<WelcomeIntroOverlayProps> = ({
  isOpen,
  onComplete,
  logoUrl,
  brandName,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(5);
  const [logoLoaded, setLogoLoaded] = useState<boolean>(false);
  const [logoError, setLogoError] = useState<boolean>(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const dismissedRef = useRef<boolean>(false);

  const triggerDismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onCompleteRef.current();
  };

  useEffect(() => {
    if (!isOpen) return;
    dismissedRef.current = false;
    setSecondsLeft(5);

    const startedAt = performance.now();

    const finishTimer = window.setTimeout(() => {
      triggerDismiss();
    }, INTRO_DURATION_MS);

    const countdownInterval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(1, Math.ceil((INTRO_DURATION_MS - elapsed) / 1000));
      setSecondsLeft((prev) => (prev === remaining ? prev : remaining));
    }, 250);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(finishTimer);
      window.clearInterval(countdownInterval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const cleanBrand =
    (brandName || 'Nasi Kuning Lasinrang')
      .replace(/^Kedai\s+/i, '')
      .replace(/\s+Pinrang$/i, '')
      .trim() || 'Nasi Kuning Lasinrang';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="welcome-intro-overlay"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[10050] h-[100dvh] w-screen bg-intro-culinary-stage text-[#F7F3E9] flex flex-col justify-between overflow-hidden select-none"
          role="dialog"
          aria-modal="true"
          aria-label={`Selamat Datang di ${cleanBrand}`}
        >
          {/* Top Delicate Heritage Trim */}
          <div className="bg-bugis-woven-band shrink-0" aria-hidden="true" />

          {/* Top Editorial Bar */}
          <div className="w-full max-w-4xl mx-auto px-5 pt-4 sm:pt-6 flex items-center justify-between gap-4 shrink-0 intro-fade-up-1">
            <span className="text-[11px] sm:text-xs font-medium tracking-[0.16em] uppercase text-[#F7F3E9]/75 truncate">
              Depan Patung Lasinrang · Pinrang
            </span>
            <span className="text-[11px] sm:text-xs font-mono-tabular text-[#E8C56E] shrink-0">
              18.30 – Habis
            </span>
          </div>

          {/* Center Hero Seal & Welcome Stage */}
          <div className="relative flex-1 flex flex-col items-center justify-center px-5 py-3 text-center">
            {/* Soft Radial Halo */}
            <svg
              viewBox="0 0 400 400"
              className="pointer-events-none absolute w-[320px] h-[320px] sm:w-[440px] sm:h-[440px] opacity-80 intro-halo-pulse"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="introForestGoldGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#D9A52E" stopOpacity="0.22" />
                  <stop offset="55%" stopColor="#193D2B" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#132F21" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="200" cy="200" r="200" fill="url(#introForestGoldGlow)" />
            </svg>

            {/* Refined Emblem Seal */}
            <div className="relative flex items-center justify-center w-44 h-44 xs:w-48 xs:h-48 sm:w-56 sm:h-56 mb-4 sm:mb-6 intro-emblem-enter">
              <svg
                viewBox="0 0 240 240"
                className="pointer-events-none absolute inset-0 w-full h-full intro-crest-spin"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="crestGoldGrad" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#E8C56E" />
                    <stop offset="50%" stopColor="#D9A52E" />
                    <stop offset="100%" stopColor="#9A7013" />
                  </linearGradient>
                </defs>
                <circle
                  cx="120"
                  cy="120"
                  r="112"
                  stroke="url(#crestGoldGrad)"
                  strokeOpacity="0.45"
                  strokeWidth="1.2"
                  strokeDasharray="4 6"
                />
                <circle
                  cx="120"
                  cy="120"
                  r="102"
                  stroke="url(#crestGoldGrad)"
                  strokeOpacity="0.78"
                  strokeWidth="1.4"
                />
                <path d="M120 4L124.5 9.5L120 15L115.5 9.5Z" fill="#E8C56E" />
                <path d="M120 225L124.5 230.5L120 236L115.5 230.5Z" fill="#E8C56E" />
                <path d="M4 120L9.5 115.5L15 120L9.5 124.5Z" fill="#E8C56E" />
                <path d="M225 120L230.5 115.5L236 120L230.5 124.5Z" fill="#E8C56E" />
                <circle cx="43" cy="43" r="2.2" fill="#D9A52E" fillOpacity="0.85" />
                <circle cx="197" cy="43" r="2.2" fill="#D9A52E" fillOpacity="0.85" />
                <circle cx="43" cy="197" r="2.2" fill="#D9A52E" fillOpacity="0.85" />
                <circle cx="197" cy="197" r="2.2" fill="#D9A52E" fillOpacity="0.85" />
              </svg>

              {/* Official Brand Logo Medallion */}
              <div className="relative w-32 h-32 xs:w-36 xs:h-36 sm:w-40 sm:h-40 rounded-full bg-white p-1.5 ring-2 ring-[#D9A52E]/80 shadow-[0_16px_38px_-10px_rgba(0,0,0,0.65)] flex items-center justify-center overflow-hidden">
                {!logoError ? (
                  <img
                    src={logoUrl}
                    alt={`Logo Resmi ${cleanBrand}`}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    onLoad={() => setLogoLoaded(true)}
                    onError={() => setLogoError(true)}
                    className={`w-full h-full rounded-full object-contain transition-opacity duration-300 ${
                      logoLoaded ? 'opacity-100' : 'opacity-95'
                    }`}
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#F7F3E9] flex items-center justify-center p-4">
                    <NasiKuningEmblem className="w-20 h-20" />
                  </div>
                )}

                <span className="intro-logo-sheen pointer-events-none" aria-hidden="true" />
              </div>
            </div>

            {/* Editorial Greeting Typography */}
            <div className="max-w-xl mx-auto space-y-2.5 sm:space-y-3 intro-fade-up-2">
              <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-[#E8C56E]">
                Selamat Datang di
              </p>

              <h1 className="text-3xl xs:text-4xl sm:text-5xl font-bold tracking-tight leading-[1.12] font-serif-display text-[#F7F3E9]">
                {cleanBrand}
              </h1>

              <NusantaraSectionDivider className="max-w-[240px] sm:max-w-xs mx-auto pt-1 opacity-75" />

              <p className="text-sm sm:text-lg font-medium text-[#E8C56E] tracking-wide font-serif-display italic">
                Malunra Tongeng, Marasa Na Masempo
              </p>

              <p className="text-xs sm:text-sm text-[#F7F3E9]/80 max-w-md mx-auto leading-relaxed">
                Cita rasa rempah Bugis asli Pinrang · Pilih menu, atur porsi &amp; sambal, atau pesan antar langsung dari HP Anda.
              </p>
            </div>
          </div>

          {/* Bottom Smooth Progress Dock + Skip Action */}
          <div className="w-full max-w-md mx-auto px-5 pb-5 sm:pb-7 space-y-3 shrink-0 intro-fade-up-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#F7F3E9]/75">
                <span>Menyiapkan daftar menu</span>
                <span className="font-mono-tabular text-[#E8C56E] font-semibold">
                  {secondsLeft} dtk
                </span>
              </div>
              <div
                className="h-1.5 w-full rounded-full bg-[#0F261A] overflow-hidden border border-[#D9A52E]/25"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={5}
                aria-valuenow={6 - secondsLeft}
              >
                <div className="h-full w-full origin-left bg-gradient-to-r from-[#D9A52E] via-[#E8C56E] to-[#F7F3E9] intro-progress-bar-5s" />
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={triggerDismiss}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#D9A52E] hover:bg-[#C79321] active:scale-[0.98] text-[#193D2B] text-xs sm:text-sm font-bold tracking-wide flex items-center gap-2 shadow-md transition-all duration-150 cursor-pointer"
              >
                <span>Masuk ke Menu Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Delicate Heritage Trim */}
          <div className="bg-bugis-woven-band shrink-0" aria-hidden="true" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
