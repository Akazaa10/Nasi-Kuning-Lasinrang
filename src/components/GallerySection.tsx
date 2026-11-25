import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from 'lucide-react';
import { ZoomableImageViewer } from './ZoomableImageViewer';

export interface GalleryPhotoItem {
  id: string;
  indexLabel: string;
  src: string;
  title: string;
  caption: string;
  categoryLabel: string;
}

export const GALLERY_PHOTOS: GalleryPhotoItem[] = [
  {
    id: 'galeri-01',
    indexLabel: '01',
    src: '/images/galeri/nasi-kuning-lasinrang-01.webp',
    categoryLabel: 'Antrean Malam',
    title: 'Suasana Antrean Malam di Depan Patung Lasinrang',
    caption:
      'Pelanggan setia ramai singgah di lapak Jl. Jenderal Sudirman setiap malam.',
  },
  {
    id: 'galeri-02',
    indexLabel: '02',
    src: '/images/galeri/nasi-kuning-lasinrang-02.webp',
    categoryLabel: 'Pelayanan Ramah',
    title: 'Senyum Ramah Melayani Pelanggan Setia',
    caption:
      'Pelayanan hangat, akrab, dan sigap bagi pembeli yang singgah maupun pesan antar.',
  },
  {
    id: 'galeri-03',
    indexLabel: '03',
    src: '/images/galeri/nasi-kuning-lasinrang-03.webp',
    categoryLabel: 'Penyajian Hangat',
    title: 'Penyajian Porsi Hangat & Lauk Tertata Rapi',
    caption:
      'Diracik langsung saat dipesan dengan nasi kuning pulen, mie goreng, dan wadah lauk higienis.',
  },
  {
    id: 'galeri-04',
    indexLabel: '04',
    src: '/images/galeri/nasi-kuning-lasinrang-04.webp',
    categoryLabel: 'Tim Lapak',
    title: 'Kehangatan & Kekompakan Tim Nasi Kuning Lasinrang',
    caption:
      '"Lapar Ki? Singgah Ki" — siap menyambut hangat pelanggan mulai pukul 18.30 WITA.',
  },
  {
    id: 'galeri-05',
    indexLabel: '05',
    src: '/images/galeri/nasi-kuning-lasinrang-05.webp',
    categoryLabel: 'Lokasi Strategis',
    title: 'Singgah Praktis dari Sore hingga Malam',
    caption:
      'Tepat di tepi jalan poros utama jantung Kota Pinrang, mudah dijangkau motor dan mobil.',
  },
  {
    id: 'galeri-06',
    indexLabel: '06',
    src: '/images/galeri/nasi-kuning-lasinrang-06.webp',
    categoryLabel: 'Menu Komplit',
    title: 'Lapak Bersih dengan Pilihan Lauk Komplit',
    caption:
      'Pilihan lauk beragam: Bebek Palekko, Ayam Kentucky, Ayam Kecap, hingga Telur Balado.',
  },
  {
    id: 'galeri-07',
    indexLabel: '07',
    src: '/images/galeri/nasi-kuning-lasinrang-07.webp',
    categoryLabel: 'Kuliner Pinrang',
    title: 'Ikon Kuliner Malam Jantung Kota Pinrang',
    caption:
      'Suasana akrab khas kuliner malam Bugis berlatar Taman & Monumen Patung Lasinrang.',
  },
  {
    id: 'galeri-08',
    indexLabel: '08',
    src: '/images/galeri/nasi-kuning-lasinrang-08.webp',
    categoryLabel: 'Cita Rasa Khas',
    title: 'Racikan Hangat Siap Santap "Malunra Tongeng"',
    caption:
      'Porsi melimpah nasi kuning kunyit asli, mie goreng bumbu, tempe manis, dan sambal khas.',
  },
  {
    id: 'galeri-09',
    indexLabel: '09',
    src: '/images/galeri/nasi-kuning-lasinrang-09.webp',
    categoryLabel: 'Bungkus Cepat',
    title: 'Kemasan Rapi Hangat Siap Dibawa Pulang',
    caption:
      'Dikemas rapi dan cepat agar kelezatan rempah tetap nikmat hingga tiba di rumah.',
  },
];

interface GallerySectionProps {
  onLightboxStateChange?: (isOpen: boolean) => void;
}

export const GallerySection: React.FC<GallerySectionProps> = ({
  onLightboxStateChange,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isLightboxZoomed, setIsLightboxZoomed] = useState<boolean>(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    onLightboxStateChange?.(lightboxIndex !== null);
    if (lightboxIndex === null) {
      setIsLightboxZoomed(false);
    }
  }, [lightboxIndex, onLightboxStateChange]);

  const scrollToSlide = useCallback((targetIndex: number) => {
    const track = trackRef.current;
    if (!track) return;
    const bounded = Math.max(0, Math.min(GALLERY_PHOTOS.length - 1, targetIndex));
    const card = track.children[bounded] as HTMLElement | undefined;
    if (card) {
      track.scrollTo({
        left: card.offsetLeft - track.offsetLeft,
        behavior: 'smooth',
      });
    }
    setActiveIndex(bounded);
  }, []);

  const handleTrackScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const scrollLeft = track.scrollLeft;
    let closestIdx = 0;
    let minDiff = Infinity;

    for (let i = 0; i < track.children.length; i++) {
      const child = track.children[i] as HTMLElement;
      const diff = Math.abs(child.offsetLeft - track.offsetLeft - scrollLeft);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    setActiveIndex(closestIdx);
  };

  const handleOpenLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const handleCloseLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const handlePrevLightbox = useCallback(() => {
    setLightboxIndex((prev) =>
      prev === null
        ? null
        : (prev - 1 + GALLERY_PHOTOS.length) % GALLERY_PHOTOS.length
    );
  }, []);

  const handleNextLightbox = useCallback(() => {
    setLightboxIndex((prev) =>
      prev === null ? null : (prev + 1) % GALLERY_PHOTOS.length
    );
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleCloseLightbox();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevLightbox();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextLightbox();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [lightboxIndex, handleCloseLightbox, handlePrevLightbox, handleNextLightbox]);

  const activeLightboxPhoto =
    lightboxIndex !== null ? GALLERY_PHOTOS[lightboxIndex] : null;

  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});

  const renderPhotoImage = (photo: GalleryPhotoItem, className: string) => {
    const isBroken = Boolean(failedImages[photo.id]);
    const retries = retryCounts[photo.id] || 0;
    const resolvedSrc =
      retries > 0 ? `${photo.src}${photo.src.includes('?') ? '&' : '?'}hd_v=${retries}` : photo.src;

    if (isBroken) {
      return (
        <div className="w-full h-full bg-[#083B28] flex flex-col items-center justify-center p-6 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#084C32] border border-[#FFD24C]/60 flex items-center justify-center text-[#FFD24C]">
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold font-serif-display text-white">
            {photo.title}
          </span>
        </div>
      );
    }
    return (
      <img
        src={resolvedSrc}
        alt={`${photo.title} — ${photo.caption}`}
        loading="lazy"
        decoding="sync"
        draggable={false}
        referrerPolicy="no-referrer"
        onError={() => {
          if (retries < 2) {
            setRetryCounts((prev) => ({ ...prev, [photo.id]: retries + 1 }));
          } else {
            setFailedImages((prev) => ({ ...prev, [photo.id]: true }));
          }
        }}
        className={`culinary-photo hd-4k-image ${className}`}
      />
    );
  };

  return (
    <section
      id="galeri-suasana"
      aria-labelledby="galeri-suasana-heading"
      className="relative py-20 sm:py-28 bg-[#FDFBF7] overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-10 sm:space-y-12 relative">
        {/* Clean Modern Gallery Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#B87300] block">
              Dokumentasi Asli · Jl. Jenderal Sudirman, Pinrang
            </span>
            <h2
              id="galeri-suasana-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif-display text-[#064E3B] leading-[1.1] tracking-tight"
            >
              Suasana Hangat di Depan Patung Lasinrang
            </h2>
          </div>

          <p className="text-xs sm:text-sm font-medium text-[#241C17] max-w-sm leading-relaxed">
            Ketuk foto mana saja untuk melihat dokumentasi suasana malam dan penyajian kami dalam layar penuh.
          </p>
        </div>

        {/* =================================================================
            DESKTOP & TABLET MODERN BENTO GALLERY MOSAIC
           ================================================================= */}
        <div className="hidden sm:block space-y-5">
          {/* Row 1: 7-Col Hero Showcase (01) + 5-Col Dual Stack (02 & 03) */}
          <div className="grid grid-cols-12 gap-5 items-stretch">
            {GALLERY_PHOTOS[0] && (
              <button
                type="button"
                onClick={() => handleOpenLightbox(0)}
                className="col-span-12 lg:col-span-7 text-left group relative min-h-[360px] lg:min-h-[440px] rounded-3xl overflow-hidden bg-[#14291E] shadow-[0_20px_50px_-22px_rgba(25,61,43,0.22)] block cursor-pointer"
              >
                {renderPhotoImage(
                  GALLERY_PHOTOS[0],
                  'w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105'
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />
                <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 text-[#193D2B] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                  <Maximize2 className="w-4 h-4" />
                </div>
                <div className="absolute bottom-0 inset-x-0 p-6 sm:p-7 space-y-1.5 text-white">
                  <span className="text-xs font-medium text-[#E8C56E] block">
                    {GALLERY_PHOTOS[0].categoryLabel}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold font-serif-display text-white leading-snug">
                    {GALLERY_PHOTOS[0].title}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/80 line-clamp-2 max-w-xl">
                    {GALLERY_PHOTOS[0].caption}
                  </p>
                </div>
              </button>
            )}

            <div className="col-span-12 lg:col-span-5 grid grid-cols-2 lg:grid-cols-1 gap-5">
              {[1, 2].map((idx) => {
                const photo = GALLERY_PHOTOS[idx];
                if (!photo) return null;
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => handleOpenLightbox(idx)}
                    className="w-full text-left group relative min-h-[205px] rounded-3xl overflow-hidden bg-[#14291E] shadow-md block cursor-pointer"
                  >
                    {renderPhotoImage(
                      photo,
                      'w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105'
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                    <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/90 text-[#193D2B] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 p-5 space-y-0.5 text-white">
                      <span className="text-[11px] font-medium text-[#E8C56E] block">
                        {photo.categoryLabel}
                      </span>
                      <h3 className="text-base font-bold font-serif-display text-white leading-snug">
                        {photo.title}
                      </h3>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2 & 3: 3-Column Clean Rounded Bento Grid (04 - 09) */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
            {GALLERY_PHOTOS.slice(3).map((photo, subIdx) => {
              const actualIdx = subIdx + 3;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handleOpenLightbox(actualIdx)}
                  className="w-full text-left group relative aspect-[4/3] rounded-3xl overflow-hidden bg-[#14291E] shadow-sm hover:shadow-xl transition-all block cursor-pointer"
                >
                  {renderPhotoImage(
                    photo,
                    'w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105'
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                  <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/90 text-[#193D2B] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-5 space-y-1 text-white">
                    <span className="text-[11px] font-medium text-[#E8C56E] block">
                      {photo.categoryLabel}
                    </span>
                    <h3 className="text-base font-bold font-serif-display text-white leading-snug line-clamp-1">
                      {photo.title}
                    </h3>
                    <p className="text-xs text-white/75 line-clamp-1">
                      {photo.caption}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* =================================================================
            MOBILE BENTO GALLERY (Hero Card + 2-Column Rounded Mosaic)
           ================================================================= */}
        <div className="sm:hidden space-y-4">
          {GALLERY_PHOTOS[0] && (
            <button
              type="button"
              onClick={() => handleOpenLightbox(0)}
              className="w-full text-left relative aspect-[4/3] rounded-3xl overflow-hidden bg-[#14291E] shadow-md block"
            >
              {renderPhotoImage(GALLERY_PHOTOS[0], 'w-full h-full object-cover')}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
              <span className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-[#193D2B] flex items-center justify-center">
                <Maximize2 className="w-3.5 h-3.5" />
              </span>
              <div className="absolute bottom-0 inset-x-0 p-4 space-y-0.5 text-white">
                <span className="text-[11px] font-medium text-[#E8C56E] block">
                  {GALLERY_PHOTOS[0].categoryLabel}
                </span>
                <h3 className="text-base font-bold font-serif-display text-white leading-snug">
                  {GALLERY_PHOTOS[0].title}
                </h3>
              </div>
            </button>
          )}

          <div
            ref={trackRef}
            onScroll={handleTrackScroll}
            className="grid grid-cols-2 gap-3.5"
            role="region"
            aria-label="Galeri Foto Nasi Kuning Lasinrang"
          >
            {GALLERY_PHOTOS.slice(1).map((photo, subIdx) => {
              const actualIndex = subIdx + 1;
              const isWideMobile = subIdx === 3 || subIdx === 7;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handleOpenLightbox(actualIndex)}
                  className={`${
                    isWideMobile ? 'col-span-2 aspect-[16/10]' : 'col-span-1 aspect-[4/5]'
                  } text-left group relative rounded-2xl overflow-hidden bg-[#14291E] shadow-xs block`}
                >
                  {renderPhotoImage(photo, 'w-full h-full object-cover')}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 inset-x-0 p-3 space-y-0.5 text-white">
                    <span className="text-[10px] font-medium text-[#E8C56E] block">
                      {photo.categoryLabel}
                    </span>
                    <h4 className="text-xs font-bold font-serif-display text-white line-clamp-2 leading-snug">
                      {photo.title}
                    </h4>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fullscreen Interactive Gallery Lightbox (Portaled to document.body) */}
      {typeof document !== 'undefined' &&
        activeLightboxPhoto &&
        lightboxIndex !== null &&
        createPortal(
          <div
            onClick={handleCloseLightbox}
            onTouchStart={(e) => {
              if (e.touches.length > 1 || isLightboxZoomed) {
                touchStartXRef.current = null;
                return;
              }
              touchStartXRef.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (touchStartXRef.current === null || isLightboxZoomed || e.touches.length > 0) {
                touchStartXRef.current = null;
                return;
              }
              const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
              const deltaX = endX - touchStartXRef.current;
              touchStartXRef.current = null;
              if (deltaX > 56) {
                handlePrevLightbox();
              } else if (deltaX < -56) {
                handleNextLightbox();
              }
            }}
            className="fixed inset-0 z-[10010] w-screen h-[100dvh] bg-[#12241A]/95 flex flex-col justify-between p-3 sm:p-6 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={`Pratinjau foto ${activeLightboxPhoto.title}`}
          >
            {/* Top Bar */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-w-4xl w-full mx-auto flex items-center justify-between gap-3 bg-[#193D2B] border border-[#D9A52E]/25 rounded-2xl px-4 py-2.5 shrink-0"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-mono-tabular font-bold text-[#E8C56E]">
                  Foto {lightboxIndex + 1} dari {GALLERY_PHOTOS.length} ·{' '}
                  {activeLightboxPhoto.categoryLabel}
                </div>
                <h3 className="text-sm sm:text-base font-bold font-serif-display text-[#F7F3E9] truncate">
                  {activeLightboxPhoto.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseLightbox}
                aria-label="Tutup galeri layar penuh"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#A83A2D] text-[#F7F3E9] border border-white/15 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Center Photo + Left/Right Navigation + Smooth Zoom Controls */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative flex-1 min-h-0 max-w-4xl w-full mx-auto my-3 flex items-center justify-center"
            >
              <button
                type="button"
                onClick={handlePrevLightbox}
                aria-label="Foto sebelumnya"
                className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#193D2B] hover:bg-[#A83A2D] border border-white/20 text-[#F7F3E9] flex items-center justify-center shadow-lg cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              <div className="w-full h-full px-12 sm:px-16 flex items-center justify-center">
                <div className="w-full h-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-[#0F1E16]">
                  <ZoomableImageViewer
                    key={activeLightboxPhoto.id}
                    src={activeLightboxPhoto.src}
                    alt={`${activeLightboxPhoto.title} — ${activeLightboxPhoto.caption}`}
                    stageBgClassName="bg-[#0F1E16]"
                    imgClassName="max-h-full max-w-full object-contain"
                    onZoomStateChange={setIsLightboxZoomed}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextLightbox}
                aria-label="Foto berikutnya"
                className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#193D2B] hover:bg-[#A83A2D] border border-white/20 text-[#F7F3E9] flex items-center justify-center shadow-lg cursor-pointer transition-colors"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Bottom Caption & Quick Switch Dots */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-w-3xl w-full mx-auto bg-[#193D2B]/95 border border-[#D9A52E]/25 rounded-2xl px-4 py-3 text-center space-y-2 shrink-0"
            >
              <p className="text-xs sm:text-sm text-[#F7F3E9]/90 leading-relaxed">
                {activeLightboxPhoto.caption}
              </p>
              <div className="flex items-center justify-center gap-1 flex-wrap">
                {GALLERY_PHOTOS.map((photo, idx) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    aria-label={`Pilih foto ${idx + 1}`}
                    className="p-1 cursor-pointer rounded-full"
                  >
                    <span
                      className={`block h-2 rounded-full transition-all ${
                        idx === lightboxIndex
                          ? 'w-6 bg-[#D9A52E]'
                          : 'w-2 bg-[#F7F3E9]/35 hover:bg-[#F7F3E9]/65'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};
