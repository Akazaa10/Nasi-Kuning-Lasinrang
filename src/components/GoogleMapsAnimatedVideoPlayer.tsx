import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Maximize2,
  Navigation,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  LOCATION_OFFICIAL_MAPS_URL,
  LOCATION_OFFICIAL_PLUS_CODE,
} from '../data/locationTourTimeline';
import { useLocationMasterPlayer } from '../hooks/useLocationMasterPlayer';
import { StoreConfig } from '../types';
import { IPhone18ProFrame } from './IPhone18ProFrame';
import { LocationSyncCalibrationPanel } from './LocationSyncCalibrationPanel';
import { Map3DAnimatedStage, Map3DTheme } from './Map3DAnimatedStage';

interface GoogleMapsAnimatedVideoPlayerProps {
  storeConfig: StoreConfig;
  onOpenFullscreenModal?: () => void;
  /** Sembunyikan judul luar saat dirender di dalam modal layar penuh */
  compactHeader?: boolean;
}

export const GoogleMapsAnimatedVideoPlayer: React.FC<
  GoogleMapsAnimatedVideoPlayerProps
> = ({ storeConfig, onOpenFullscreenModal, compactHeader = false }) => {
  const [mapTheme, setMapTheme] = useState<Map3DTheme>('satellite');
  const [copiedFooterCode, setCopiedFooterCode] = useState<boolean>(false);

  const player = useLocationMasterPlayer({
    enabled: true,
    autoPreload: true,
  });

  const officialMapsUrl = useMemo(() => {
    const raw = storeConfig.googleMapsQuery?.trim() || '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return LOCATION_OFFICIAL_MAPS_URL;
  }, [storeConfig.googleMapsQuery]);

  const officialPlusCode = LOCATION_OFFICIAL_PLUS_CODE;

  const handleCopyPlusCodeFooter = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(officialPlusCode);
      } else {
        const ta = document.createElement('textarea');
        ta.value = officialPlusCode;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
    } catch {
      // ignore
    }
    setCopiedFooterCode(true);
    window.setTimeout(() => setCopiedFooterCode(false), 2200);
  };

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    player.pause();
    onOpenFullscreenModal?.();
  };

  const isClosingHighlight = player.activeScene.sceneNumber === 7 || player.isEnded;

  return (
    <div className="flex flex-col items-center justify-center w-full select-none">
      {/* Header Judul Bersih di Atas Layar iPhone */}
      {!compactHeader && (
        <div className="mb-5 sm:mb-6 text-center space-y-2 max-w-2xl mx-auto px-2">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-[#9A7013] flex flex-wrap items-center justify-center gap-2">
            <span>Navigator Satelit 3D Kota Pinrang</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#193D2B]">Buka Setiap Malam 18.30 WITA – Habis</span>
          </div>

          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold font-serif-display text-[#193D2B] leading-tight text-balance">
            Panduan Rute 3D Menuju {storeConfig.brandName}
          </h3>
        </div>
      )}

      {/* Bingkai iPhone 18 Pro berisi Navigator Satelit 3D Real (tanpa bar durasi video) */}
      <div className="relative w-full max-w-[360px] sm:max-w-[420px] md:max-w-[460px] lg:max-w-[490px]">
        <IPhone18ProFrame className="w-full">
          <div
            className="absolute inset-0 w-full h-full bg-[#1C2A35] overflow-hidden"
            onClick={player.togglePlay}
          >
            {/* Stage Peta Satelit 3D Real — 100% sinkron audioElement.currentTime */}
            <Map3DAnimatedStage
              currentTimeSec={player.currentTime}
              getMasterTime={player.getMasterTime}
              isPlaying={player.isPlaying}
              mapTheme={mapTheme}
              onMapThemeChange={setMapTheme}
              interactiveWhenPaused={!player.isPlaying}
              officialMapsUrl={officialMapsUrl}
              officialPlusCode={officialPlusCode}
              timelineScenes={player.timelineScenes}
              showSubtitles={false}
              instantJump={player.isInstantMotion}
              topHudOffsetPx={44}
              bottomControlsClearancePx={22}
            />

            {/* Indikator Buffering Audio (Hanya muncul saat audio.readyState < 3) */}
            {player.isBuffering && (
              <div className="pointer-events-none absolute inset-x-0 top-[118px] z-30 flex justify-center">
                <div className="px-3 py-1 rounded-full bg-[#12241A]/92 border border-[#D9A52E]/50 text-[#E8C56E] text-[11px] font-bold flex items-center gap-1.5 shadow-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyiapkan Panduan Suara...</span>
                </div>
              </div>
            )}

            {/* Floating Right-Side Native Navigator Action Icons — Posisi aman di tengah-kanan (bebas tabrakan dengan CTA bawah & subtitle) */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-3 top-[148px] z-25 flex flex-col gap-2 pointer-events-auto"
            >
              <button
                type="button"
                onClick={player.toggleMute}
                className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-transform active:scale-95 border ${
                  player.isMuted
                    ? 'bg-rose-50 hover:bg-rose-100 text-[#A83A2D] border-[#A83A2D]/30'
                    : 'bg-white/95 hover:bg-white text-[#193D2B] border-[#193D2B]/20'
                }`}
                title={player.isMuted ? 'Nyalakan Suara Pemandu' : 'Bisukan Suara Pemandu'}
                aria-label={player.isMuted ? 'Nyalakan Suara Pemandu' : 'Bisukan Suara Pemandu'}
              >
                {player.isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={player.replay}
                className="w-10 h-10 rounded-full bg-white/95 hover:bg-white text-[#30251F] border border-[#30251F]/15 shadow-lg flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                title="Ulangi Navigasi dari Awal"
                aria-label="Ulangi Navigasi dari Awal"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {onOpenFullscreenModal && (
                <button
                  type="button"
                  onClick={handleFullscreen}
                  className="w-10 h-10 rounded-full bg-white/95 hover:bg-white text-[#193D2B] border border-[#30251F]/15 shadow-lg flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                  title="Perbesar Layar Penuh"
                  aria-label="Perbesar Layar Penuh"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Overlay Tombol Mulai / Ulangi saat Jeda atau Selesai (tidak menutupi Kartu CTA Scene 7) */}
            {!player.isPlaying && (
              <div
                className={`pointer-events-none absolute inset-x-0 z-25 flex justify-center ${
                  isClosingHighlight ? 'top-[28%]' : 'inset-y-0 items-center'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (player.isEnded) {
                      player.replay();
                    } else {
                      void player.play();
                    }
                  }}
                  className="pointer-events-auto flex flex-col items-center gap-2 group cursor-pointer transition-transform active:scale-95"
                  aria-label={player.isEnded ? 'Ulangi Navigasi 3D' : 'Mulai Navigasi 3D'}
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#193D2B]/95 border-2 border-[#D9A52E] text-[#E8C56E] shadow-xl flex items-center justify-center transition-transform group-hover:scale-105 group-hover:border-[#F7F3E9]">
                    {player.isEnded ? (
                      <RotateCcw className="w-7 h-7 sm:w-9 sm:h-9" />
                    ) : (
                      <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-[#E8C56E] translate-x-0.5" />
                    )}
                  </div>
                  <span className="px-3.5 py-1 rounded-full bg-[#193D2B]/95 text-[#F7F3E9] text-[11px] sm:text-xs font-semibold border border-[#D9A52E]/50 shadow-lg">
                    {player.isEnded ? 'Ulangi Navigasi 3D' : 'Mulai Navigasi 3D'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </IPhone18ProFrame>
      </div>

      {/* Tombol Aksi Langsung: Buka Google Maps Resmi & Salin Plus Code (5MR2+PRV) */}
      <div className="mt-4 w-full max-w-[490px] grid grid-cols-1 sm:grid-cols-2 gap-2.5 px-1">
        <a
          href={officialMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap fx-2d-forest ${
            isClosingHighlight
              ? 'bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] ring-2 ring-[#D9A52E]/60'
              : 'bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9]'
          }`}
        >
          <Navigation className="w-4 h-4 shrink-0 text-[#E8C56E]" />
          <span>Buka Google Maps</span>
          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
        </a>

        <button
          type="button"
          onClick={() => void handleCopyPlusCodeFooter()}
          className={`flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap ${
            copiedFooterCode
              ? 'bg-[#193D2B] text-[#F7F3E9] fx-2d-forest'
              : isClosingHighlight
                ? 'bg-[#D9A52E] hover:bg-[#C79424] text-[#12241A] fx-2d-gold'
                : 'bg-white hover:bg-[#EFE9DC] text-[#193D2B] fx-2d-ivory'
          }`}
        >
          {copiedFooterCode ? (
            <>
              <Check className="w-4 h-4 shrink-0 text-[#E8C56E]" />
              <span>Plus Code Tersalin!</span>
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4 shrink-0 text-[#A83A2D]" />
              <span className="font-mono tabular-nums">Salin {officialPlusCode}</span>
              <Copy className="w-3.5 h-3.5 shrink-0 opacity-75" />
            </>
          )}
        </button>
      </div>

      {/* Mode Kalibrasi Live Tersembunyi — HANYA muncul jika URL mengandung ?sync=1 */}
      {player.isSyncCalibrationMode && (
        <LocationSyncCalibrationPanel
          currentTime={player.currentTime}
          duration={player.duration}
          isPlaying={player.isPlaying}
          isBuffering={player.isBuffering}
          activeSceneId={player.activeScene.id}
          scenes={player.timelineScenes}
          onSeekTo={(sec) => player.seekTo(sec, true)}
          onScrubChange={(scrubbing) => player.setScrubbing(scrubbing)}
          onCaptureSceneStartTime={player.captureSceneStartTime}
          onNudgeSceneStartTime={player.nudgeSceneStartTime}
          onResetTimeline={player.resetCalibratedTimeline}
        />
      )}
    </div>
  );
};
