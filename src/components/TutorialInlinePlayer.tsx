import React from 'react';
import {
  Loader2,
  Maximize2,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MenuItem, StoreConfig } from '../types';
import { useTutorialMasterPlayer } from '../hooks/useTutorialMasterPlayer';
import { IPhone18ProFrame } from './IPhone18ProFrame';
import { TutorialDomStage } from './TutorialDomStage';
import { TutorialSyncCalibrationPanel } from './TutorialSyncCalibrationPanel';

interface TutorialInlinePlayerProps {
  storeConfig: StoreConfig;
  menuItems: MenuItem[];
  onOpenTheaterModal?: () => void;
}

export const TutorialInlinePlayer: React.FC<TutorialInlinePlayerProps> = ({
  storeConfig,
  menuItems,
  onOpenTheaterModal,
}) => {
  const player = useTutorialMasterPlayer({
    enabled: true,
    autoPreload: true,
  });

  const { stage } = player;

  return (
    <section
      id="video-tutorial-section"
      className="relative py-14 sm:py-20 bg-forest-architectural border-y border-[#FFD24C]/35 overflow-hidden"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2.5 mb-8 sm:mb-10">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#FFD24C] flex flex-wrap items-center justify-center gap-2">
            <span>Panduan Resmi Pemesanan</span>
            <span aria-hidden="true">·</span>
            <span className="text-white">Layar iPhone 18 Pro</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-white tracking-tight leading-tight text-balance">
            Video Tutorial Cara Pesan &amp; Bayar Langsung
          </h2>

          <p className="text-xs sm:text-sm font-medium text-white leading-relaxed max-w-xl mx-auto">
            Tonton panduan langsung di layar iPhone 1:1 identik dengan website asli, tersinkronisasi penuh dengan audio narasi resmi dan efek sentuhan.
          </p>
        </div>

        {/* Centered Large iPhone 18 Pro Stage */}
        <div className="flex justify-center items-center w-full">
          <div className="w-full max-w-[min(94vw,375px,calc((82dvh-48px)*9/19.5))] sm:max-w-[min(100%,420px,calc((84dvh-60px)*9/19.5))] md:max-w-[450px] lg:max-w-[480px] mx-auto">
            <IPhone18ProFrame className="w-full">
              {/* 1:1 Real Website DOM Mirror driven strictly by audioElement.currentTime */}
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

              {/* Top-left: Buffering indicator or Active Step Badge */}
              <div className="absolute top-10 sm:top-12 left-2.5 sm:left-3 z-20 flex items-center gap-1.5 pointer-events-none">
                {player.isBuffering ? (
                  <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-[#193D2B]/92 border border-[#D9A52E]/40 text-[#F7F3E9] text-[9.5px] sm:text-[10.5px] font-bold flex items-center gap-1.5 shadow-md">
                    <Loader2 className="w-3 h-3 animate-spin text-[#D9A52E]" />
                    <span>Menyiapkan Audio...</span>
                  </div>
                ) : (
                  <div className="max-w-[145px] sm:max-w-[205px] truncate px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-[#193D2B]/90 border border-[#D9A52E]/35 text-[#F7F3E9] text-[9.5px] sm:text-[10.5px] font-bold shadow-md">
                    {stage.activeChapter.stepNumber === '00'
                      ? 'Intro · Pembuka'
                      : stage.activeChapter.stepNumber === '✓'
                      ? 'Penutup'
                      : `Langkah ${stage.activeChapter.stepNumber} · ${stage.activeChapter.shortTitle}`}
                  </div>
                )}
              </div>

              {/* Top-right: Mute, Replay & Theater Buttons */}
              <div className="absolute top-10 sm:top-12 right-2.5 sm:right-3 z-20 flex items-center gap-1 sm:gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    player.toggleMute();
                  }}
                  className="p-1 sm:p-1.5 rounded-full bg-[#193D2B]/90 hover:bg-[#122E20] text-[#F7F3E9] border border-[#D9A52E]/35 shadow-md transition-transform active:scale-95 cursor-pointer"
                  title={player.isMuted ? 'Bunyikan Suara' : 'Bisukan Suara'}
                  aria-label={player.isMuted ? 'Bunyikan Suara' : 'Bisukan Suara'}
                >
                  {player.isMuted ? (
                    <VolumeX className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[#F2A79E]" />
                  ) : (
                    <Volume2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[#D9A52E]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    player.replay();
                  }}
                  className="p-1 sm:p-1.5 rounded-full bg-[#193D2B]/90 hover:bg-[#122E20] text-[#F7F3E9] border border-[#D9A52E]/35 shadow-md transition-transform active:scale-95 cursor-pointer"
                  title="Ulangi dari Awal"
                  aria-label="Ulangi dari Awal"
                >
                  <RotateCcw className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                </button>

                {onOpenTheaterModal && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      player.pause();
                      onOpenTheaterModal();
                    }}
                    className="p-1 sm:p-1.5 rounded-full bg-[#193D2B]/90 hover:bg-[#122E20] text-[#F7F3E9] border border-[#D9A52E]/35 shadow-md transition-transform active:scale-95 cursor-pointer"
                    title="Buka Mode Teater"
                    aria-label="Buka Mode Teater"
                  >
                    <Maximize2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  </button>
                )}
              </div>

              {/* Center Play Overlay when paused */}
              {!player.isPlaying && (
                <div
                  onClick={player.togglePlay}
                  className="absolute inset-0 z-10 bg-[#051F14]/20 hover:bg-[#051F14]/10 flex items-center justify-center p-4 cursor-pointer transition-colors"
                  aria-label="Putar Video Tutorial di Layar iPhone 18 Pro"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FFC72C] text-[#051F14] fx-2d-gold flex items-center justify-center hover:scale-105 transition-transform duration-200">
                    <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-current translate-x-0.5" />
                  </div>
                </div>
              )}
            </IPhone18ProFrame>
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
    </section>
  );
};
