import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShoppingBag,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MenuItem, StoreConfig } from '../types';
import { useTutorialMasterPlayer } from '../hooks/useTutorialMasterPlayer';
import { IPhone18ProFrame } from './IPhone18ProFrame';
import { TutorialDomStage } from './TutorialDomStage';
import { TutorialSyncCalibrationPanel } from './TutorialSyncCalibrationPanel';

function getDisplayBrandName(storeConfig: StoreConfig): string {
  const raw = (storeConfig.brandName || 'Nasi Kuning Lasinrang').trim();
  return raw.toUpperCase() === 'NASI KUNING LASINRANG' ? 'Nasi Kuning Lasinrang' : raw;
}

const OFFICIAL_LOGO_URL =
  '/assets/aistudio/file_000000004bd48211a316832fba565d37_46611b00.png';

interface TutorialVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeConfig: StoreConfig;
  menuItems: MenuItem[];
  onStartOrdering: () => void;
}

export const TutorialVideoModal: React.FC<TutorialVideoModalProps> = ({
  isOpen,
  onClose,
  storeConfig,
  menuItems,
  onStartOrdering,
}) => {
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const [isStageFullscreen, setIsStageFullscreen] = useState<boolean>(false);

  const displayBrand = useMemo(
    () => getDisplayBrandName(storeConfig),
    [storeConfig]
  );

  const player = useTutorialMasterPlayer({
    enabled: isOpen,
    autoPreload: isOpen,
  });

  const { stage } = player;

  // Escape key & fullscreen sync
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (isStageFullscreen) {
          setIsStageFullscreen(false);
          if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
          }
        } else {
          player.pause();
          onClose();
        }
      }
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsStageFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [isOpen, isStageFullscreen, onClose, player]);

  useEffect(() => {
    if (!isOpen) {
      setIsStageFullscreen(false);
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    }
  }, [isOpen]);

  const handleToggleFullscreen = useCallback(async () => {
    const nextState = !isStageFullscreen;
    setIsStageFullscreen(nextState);
    try {
      if (nextState && stageContainerRef.current?.requestFullscreen) {
        await stageContainerRef.current.requestFullscreen();
      } else if (!nextState && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback CSS fixed fullscreen overlay remains active
    }
  }, [isStageFullscreen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      onClick={() => {
        player.pause();
        onClose();
      }}
      className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-[#062418]/94 flex items-end sm:items-center justify-center p-0 sm:p-2 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-video-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[98vw] 2xl:max-w-[1440px] max-h-[98dvh] sm:max-h-[96dvh] flex flex-col overflow-hidden bg-[#F7F3E9] border border-[#D9A52E]/30 rounded-t-2xl sm:rounded-2xl shadow-2xl"
      >
        {/* Compact Modal Header */}
        <div className="px-4 sm:px-5 py-3 bg-white border-b border-[#30251F]/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={OFFICIAL_LOGO_URL}
              alt={`Logo ${displayBrand}`}
              loading="eager"
              decoding="sync"
              draggable={false}
              className="w-9 h-9 rounded-full object-contain shrink-0 ring-2 ring-[#D9A52E]/70 bg-white"
            />
            <div className="min-w-0">
              <h3
                id="tutorial-video-title"
                className="text-sm sm:text-lg font-bold text-[#193D2B] font-serif-display truncate"
              >
                Video Tutorial iPhone 18 Pro — {displayBrand}
              </h3>
              <p className="text-[11px] sm:text-xs text-[#6E5D53] truncate">
                Simulasi 1:1 Website Asli · Sinkron 100% Audio Narasi Resmi &amp; Efek Sentuhan ({player.stepChapters.length} Bagian)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              player.pause();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-[#EFE9DC] hover:bg-[#E5DEC9] text-[#193D2B] flex items-center justify-center border border-[#30251F]/12 cursor-pointer shrink-0 transition-colors"
            aria-label="Tutup Video Tutorial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-2.5 sm:p-4 overflow-y-auto flex-1 overscroll-contain space-y-3.5">
          {/* Upright iPhone 18 Pro Theater Stage */}
          <div
            ref={stageContainerRef}
            className={
              isStageFullscreen
                ? 'fixed inset-0 z-[10000] bg-forest-architectural flex items-center justify-center p-2 sm:p-4'
                : 'relative w-full rounded-xl sm:rounded-2xl overflow-hidden bg-forest-architectural border border-[#193D2B]/30 shadow-xl flex items-center justify-center py-4 sm:py-6 px-3'
            }
          >
            {/* Quick Fullscreen / Theater Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleToggleFullscreen();
              }}
              className="absolute top-3 right-3 z-30 px-2.5 py-1.5 rounded-lg bg-[#12241A]/90 hover:bg-[#193D2B] text-[#E8C56E] hover:text-white border border-[#D9A52E]/40 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              title={isStageFullscreen ? 'Perkecil Layar' : 'Perbesar Layar Penuh'}
            >
              {isStageFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Perkecil</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Layar Penuh</span>
                </>
              )}
            </button>

            <div
              className="relative w-full mx-auto"
              style={{
                maxWidth: isStageFullscreen
                  ? 'min(92vw, calc(88dvh * 390 / 844), 460px)'
                  : 'min(88vw, calc(66dvh * 390 / 844), 400px)',
              }}
            >
              <IPhone18ProFrame>
                <div
                  className="relative w-full h-full cursor-pointer"
                  onClick={player.togglePlay}
                >
                  <TutorialDomStage
                    activeScreen={stage.activeScreen}
                    scrollY={stage.scrollY}
                    isAppInstalled={stage.isAppInstalled}
                    quickHubTab={stage.quickHubTab}
                    activeCategory={stage.activeCategory}
                    highlightedMenuId={stage.highlightedMenuId}
                    highlightedMenuBadge={stage.highlightedMenuBadge}
                    zoomedMenuId={stage.zoomedMenuId}
                    portionState={stage.portionState}
                    checkoutState={stage.checkoutState}
                    mapPinPos={stage.mapPinPos}
                    mapState={stage.mapState}
                    toastMessage={stage.toastMessage}
                    cursorPos={stage.cursorPos}
                    isClicking={stage.isClicking}
                    activeTargetSelector={stage.activeTargetSelector}
                    instantMotion={player.isInstantMotion}
                    caption={null}
                    showCaption={false}
                    storeConfig={storeConfig}
                    menuItems={menuItems}
                  />
                </div>

                {!player.isPlaying && (
                  <button
                    type="button"
                    onClick={player.togglePlay}
                    className="absolute inset-0 z-10 bg-[#051F14]/20 hover:bg-[#051F14]/10 transition-colors flex flex-col items-center justify-center gap-3 cursor-pointer"
                    aria-label="Putar Video Tutorial"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FFC72C] text-[#051F14] fx-2d-gold flex items-center justify-center transition-transform hover:scale-105">
                      <Play className="w-7 h-7 sm:w-9 sm:h-9 ml-1 fill-current" />
                    </div>
                  </button>
                )}

                {player.isBuffering && (
                  <div className="pointer-events-none absolute top-12 left-3 right-3 px-3 py-1.5 rounded-xl bg-[#12241A]/92 border border-[#D9A52E]/45 text-[#E8C56E] text-xs font-semibold flex items-center justify-center gap-2 z-20">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyiapkan audio narasi...</span>
                  </div>
                )}
              </IPhone18ProFrame>
            </div>
          </div>

          {/* Interactive Walkthrough Controls (No Video Duration / Scrubber) */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-[#30251F]/12 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={player.togglePlay}
                  className="px-4 py-2 rounded-xl bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                >
                  {player.isPlaying ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Jeda</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 text-[#E8C56E]" />
                      <span>Putar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={stage.activeChapterIndex === 0 && player.currentTime < 1}
                  onClick={player.prevChapter}
                  className="w-9 h-9 rounded-xl bg-[#EFE9DC] hover:bg-[#E5DEC9] disabled:opacity-40 text-[#193D2B] flex items-center justify-center border border-[#30251F]/10 cursor-pointer transition-colors"
                  aria-label="Langkah Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={player.nextChapter}
                  className="w-9 h-9 rounded-xl bg-[#EFE9DC] hover:bg-[#E5DEC9] text-[#193D2B] flex items-center justify-center border border-[#30251F]/10 cursor-pointer transition-colors"
                  aria-label="Langkah Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={player.replay}
                  className="px-3 py-2 rounded-xl bg-[#EFE9DC] hover:bg-[#E5DEC9] text-[#30251F] text-xs font-semibold inline-flex items-center gap-1.5 border border-[#30251F]/10 cursor-pointer whitespace-nowrap transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ulangi</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={player.toggleMute}
                  className="px-3 py-2 rounded-xl bg-[#EFE9DC] hover:bg-[#E5DEC9] text-[#30251F] text-xs font-semibold inline-flex items-center gap-1.5 border border-[#30251F]/10 cursor-pointer whitespace-nowrap transition-colors"
                >
                  {player.isMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-[#A83A2D]" />
                      <span>Bisukan</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-[#193D2B]" />
                      <span>Suara &amp; Klik Aktif</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    player.setPlaybackRate(player.playbackRate === 1 ? 1.15 : 1)
                  }
                  className="px-3 py-2 rounded-xl bg-[#EFE9DC] hover:bg-[#E5DEC9] text-[#30251F] text-xs font-mono tabular-nums font-bold border border-[#30251F]/10 cursor-pointer whitespace-nowrap transition-colors"
                >
                  {player.playbackRate}x
                </button>

                <button
                  type="button"
                  onClick={() => void handleToggleFullscreen()}
                  className="px-3 py-2 rounded-xl bg-[#EFE9DC] hover:bg-[#E5DEC9] text-[#30251F] text-xs font-semibold inline-flex items-center gap-1.5 border border-[#30251F]/10 cursor-pointer whitespace-nowrap transition-colors"
                >
                  {isStageFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Perkecil</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Perbesar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E5D53] pt-1.5 border-t border-[#30251F]/10">
              <span className="truncate">
                <strong className="text-[#193D2B]">{stage.activeChapter.title}</strong>
              </span>
              <span className="font-semibold text-[#193D2B] shrink-0">
                Audio Narasi Resmi &amp; Efek Klik
              </span>
            </div>
          </div>

          {/* Clickable Step Timeline Strip (Intro, Langkah 1..6, Penutup) */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9A7013]">
              Daftar Langkah Tutorial (Geser &amp; Ketuk untuk Melompat)
            </div>
            <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory">
              {player.stepChapters.map((ch, idx) => {
                const isActive = idx === stage.activeChapterIndex;
                return (
                  <button
                    key={ch.stepId}
                    type="button"
                    onClick={() => player.jumpToChapter(idx)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer min-w-[180px] sm:min-w-[205px] max-w-[225px] shrink-0 snap-start ${
                      isActive
                        ? 'bg-white border-[#193D2B] ring-1 ring-[#193D2B]/20 shadow-xs'
                        : 'bg-white/80 border-[#30251F]/12 hover:border-[#193D2B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                      <span
                        className={
                          isActive ? 'text-[#193D2B]' : 'text-[#9A7013]'
                        }
                      >
                        {ch.stepNumber === '00'
                          ? 'Intro'
                          : ch.stepNumber === '✓'
                          ? 'Penutup'
                          : `Langkah ${ch.stepNumber}`}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#30251F] mt-0.5 truncate">
                      {ch.shortTitle}
                    </div>
                    <p className="text-[11px] text-[#6E5D53] mt-0.5 line-clamp-2 leading-snug">
                      {ch.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Kalibrasi Live (?sync=1 ONLY — Tersembunyi untuk pelanggan biasa) */}
          {player.isSyncCalibrationMode && (
            <TutorialSyncCalibrationPanel
              currentTime={player.currentTime}
              duration={player.duration}
              isPlaying={player.isPlaying}
              isBuffering={player.isBuffering}
              activeEventId={stage.activeEvent.id}
              events={player.timelineEvents}
              onSeekTo={(sec) => player.seekTo(sec, true)}
              onScrubChange={player.setScrubbing}
              onCaptureStartTime={player.captureEventStartTime}
              onNudgeStartTime={player.nudgeEventStartTime}
              onResetTimeline={player.resetCalibratedTimeline}
            />
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-4 sm:px-6 py-3.5 pb-4 sm:pb-3.5 bg-white border-t border-[#30251F]/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <p className="text-xs text-[#6E5D53]">
            Sudah paham langkahnya? Langsung pilih menu favorit Kakak sekarang.
          </p>
          <button
            type="button"
            onClick={() => {
              player.pause();
              onClose();
              onStartOrdering();
            }}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#A83A2D] hover:bg-[#8C2D22] text-[#F7F3E9] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <ShoppingBag className="w-4 h-4 text-[#E8C56E]" />
            <span>Mulai Pesan Sekarang →</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
