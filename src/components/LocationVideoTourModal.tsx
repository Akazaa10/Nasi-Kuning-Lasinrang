import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { StoreConfig } from '../types';
import { GoogleMapsAnimatedVideoPlayer } from './GoogleMapsAnimatedVideoPlayer';

interface LocationVideoTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeConfig: StoreConfig;
}

export const LocationVideoTourModal: React.FC<LocationVideoTourModalProps> = ({
  isOpen,
  onClose,
  storeConfig,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10010] w-screen h-[100dvh] bg-[#12241A]/90 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Video Tur Lokasi 3D Nasi Kuning Lasinrang"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-3xl w-full max-h-[92dvh] flex flex-col overflow-hidden bg-[#F7F3E9] border border-[#30251F]/15 rounded-3xl shadow-2xl"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-[#30251F]/10 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h4 className="text-base sm:text-lg font-bold text-[#193D2B] font-serif-display truncate">
              Video Navigasi 3D — {storeConfig.brandName}
            </h4>
            <p className="text-xs text-[#6E5D53] truncate">
              Jl. Jenderal Sudirman · Depan Patung Lasinrang &amp; Ruko Pink Toko Kosmetik Hanami · Buka 18.30 WITA – Habis
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Layar Penuh"
            className="w-9 h-9 rounded-full bg-[#EFE9DC] hover:bg-[#E5DEC9] text-[#193D2B] flex items-center justify-center border border-[#30251F]/12 cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain bg-[#EFE9DC]/65">
          <GoogleMapsAnimatedVideoPlayer storeConfig={storeConfig} compactHeader />
        </div>
      </div>
    </div>,
    document.body
  );
};
