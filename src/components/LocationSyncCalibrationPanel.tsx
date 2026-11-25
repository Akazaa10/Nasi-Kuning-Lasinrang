import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Crosshair,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type { LocationTourScene } from '../data/locationTourTimeline';

interface LocationSyncCalibrationPanelProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
  activeSceneId: string;
  scenes: LocationTourScene[];
  onSeekTo: (sec: number) => void;
  onScrubChange?: (scrubbing: boolean) => void;
  onCaptureSceneStartTime: (sceneId: string) => number;
  onNudgeSceneStartTime: (sceneId: string, deltaSec: number) => void;
  onResetTimeline: () => void;
}

function formatPreciseTime(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  const whole = Math.floor(rem);
  const tenths = Math.floor((rem - whole) * 10);
  return `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${tenths}`;
}

export const LocationSyncCalibrationPanel: React.FC<
  LocationSyncCalibrationPanelProps
> = ({
  currentTime,
  duration,
  isPlaying,
  isBuffering,
  activeSceneId,
  scenes,
  onSeekTo,
  onScrubChange,
  onCaptureSceneStartTime,
  onNudgeSceneStartTime,
  onResetTimeline,
}) => {
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    () => scenes[0]?.id || activeSceneId
  );
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [copiedState, setCopiedState] = useState<boolean>(false);
  const [lastCapturedInfo, setLastCapturedInfo] = useState<string | null>(null);

  const selectedIndex = useMemo(() => {
    const idx = scenes.findIndex((s) => s.id === selectedSceneId);
    return idx >= 0 ? idx : 0;
  }, [scenes, selectedSceneId]);

  const selectedScene = scenes[selectedIndex] || scenes[0];

  const handleCaptureScene = (sceneId: string, sceneIdx: number) => {
    const capturedSec = onCaptureSceneStartTime(sceneId);
    setCopiedState(false);
    setLastCapturedInfo(`Scene ${sceneIdx + 1} (${sceneId}) → ${capturedSec.toFixed(1)}s`);
    if (autoAdvance && sceneIdx + 1 < scenes.length) {
      setSelectedSceneId(scenes[sceneIdx + 1].id);
    }
  };

  const handleCopyJson = async () => {
    const jsonOutput = JSON.stringify(scenes, null, 2);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(jsonOutput);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = jsonOutput;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopiedState(true);
    } catch {
      setCopiedState(false);
    }
  };

  return (
    <div className="mt-4 w-full max-w-2xl rounded-2xl bg-[#111827] border border-amber-400/50 text-slate-100 shadow-2xl overflow-hidden text-left">
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-[#1E293B] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-amber-300" />
          <span className="text-xs font-bold tracking-wide text-amber-300">
            Kalibrasi Live Peta 3D (?sync=1)
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-amber-400/40 text-amber-300 font-bold">
            {formatPreciseTime(currentTime)} ({currentTime.toFixed(1)}s)
          </span>
          <span className="text-slate-400 text-[11px]">/ {duration.toFixed(1)}s</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
              isBuffering
                ? 'bg-amber-800/80 text-amber-200'
                : isPlaying
                  ? 'bg-emerald-900/90 text-emerald-300'
                  : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isBuffering ? 'BUFFER' : isPlaying ? 'PLAY' : 'PAUSE'}
          </span>
        </div>
      </div>

      {/* Quick Action Controls */}
      <div className="p-3.5 space-y-3 border-b border-white/10 bg-[#0F172A]">
        {/* Developer Timeline Scrubber (?sync=1 only) */}
        <div className="flex items-center gap-2.5">
          <span className="text-[10.5px] font-mono tabular-nums text-amber-300 font-bold shrink-0">
            {currentTime.toFixed(1)}s
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.1}
            value={Math.min(currentTime, Math.max(1, duration))}
            onPointerDown={() => onScrubChange?.(true)}
            onPointerUp={() => onScrubChange?.(false)}
            onTouchStart={() => onScrubChange?.(true)}
            onTouchEnd={() => onScrubChange?.(false)}
            onBlur={() => onScrubChange?.(false)}
            onChange={(e) => onSeekTo(Number(e.target.value))}
            aria-label="Geser detik kalibrasi peta 3D"
            className="flex-1 accent-amber-400 cursor-pointer"
          />
          <span className="text-[10.5px] font-mono tabular-nums text-slate-400 shrink-0">
            {duration.toFixed(1)}s
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400 font-medium">
              Scene Terpilih ({selectedIndex + 1}/{scenes.length})
            </div>
            <div className="text-xs font-bold text-amber-300 truncate">
              Scene {selectedScene?.sceneNumber}: {selectedScene?.shortLabel} ·{' '}
              <span className="text-emerald-300 font-mono tabular-nums">
                {selectedScene?.startTime.toFixed(1)}s → {selectedScene?.endTime.toFixed(1)}s
              </span>
            </div>
          </div>

          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="accent-amber-400"
            />
            <span>Auto lanjut ke scene berikutnya</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (selectedScene) handleCaptureScene(selectedScene.id, selectedIndex);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#A81410] hover:bg-[#840E0B] text-white border border-amber-300/60 text-xs font-bold inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer whitespace-nowrap"
          >
            <Crosshair className="w-4 h-4 text-amber-300" />
            <span>Tangkap Detik Ini ({currentTime.toFixed(1)}s)</span>
          </button>

          {selectedScene && (
            <div className="inline-flex items-center gap-1 bg-slate-800/90 border border-white/15 rounded-xl p-1">
              <button
                type="button"
                onClick={() => {
                  onNudgeSceneStartTime(selectedScene.id, -0.2);
                  setCopiedState(false);
                }}
                className="px-2 py-1 rounded-lg hover:bg-slate-700 text-[11px] font-mono font-bold text-amber-300 inline-flex items-center gap-0.5 cursor-pointer"
                title="Mundurkan 0.2 detik"
              >
                <Minus className="w-3 h-3" />
                <span>0.2s</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNudgeSceneStartTime(selectedScene.id, 0.2);
                  setCopiedState(false);
                }}
                className="px-2 py-1 rounded-lg hover:bg-slate-700 text-[11px] font-mono font-bold text-amber-300 inline-flex items-center gap-0.5 cursor-pointer"
                title="Majukan 0.2 detik"
              >
                <Plus className="w-3 h-3" />
                <span>0.2s</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleCopyJson()}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border active:scale-95 transition-transform cursor-pointer whitespace-nowrap ${
              copiedState
                ? 'bg-emerald-700 border-emerald-400 text-white'
                : 'bg-[#F5B700] hover:bg-[#E0A500] border-amber-200 text-[#1E110A]'
            }`}
          >
            {copiedState ? (
              <>
                <Check className="w-4 h-4" />
                <span>JSON Timeline Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin JSON Timeline</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onResetTimeline();
              setCopiedState(false);
              setLastCapturedInfo('Timeline lokasi dikembalikan ke bawaan.');
            }}
            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {lastCapturedInfo && (
          <div className="text-[11px] font-mono text-emerald-300">
            Terakhir diperbarui: {lastCapturedInfo}
          </div>
        )}
      </div>

      {/* Daftar 7 Scene Lokasi */}
      <div className="max-h-64 overflow-y-auto divide-y divide-white/10">
        {scenes.map((scene, idx) => {
          const isSelected = scene.id === selectedScene?.id;
          const isLiveActive = scene.id === activeSceneId;

          return (
            <div
              key={scene.id}
              onClick={() => setSelectedSceneId(scene.id)}
              className={`px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-slate-800/95 ring-1 ring-inset ring-amber-400/50'
                  : isLiveActive
                    ? 'bg-emerald-950/55'
                    : 'hover:bg-slate-800/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-amber-300 tabular-nums shrink-0">
                    S{scene.sceneNumber}
                  </span>
                  <span className="font-semibold text-white truncate">{scene.title}</span>
                </div>
                <p className="text-[10.5px] text-slate-400 truncate mt-0.5">
                  {scene.startTime.toFixed(1)}s – {scene.endTime.toFixed(1)}s · {scene.subtitle}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSceneId(scene.id);
                    handleCaptureScene(scene.id, idx);
                  }}
                  className="px-2 py-1 rounded-lg bg-[#A81410]/90 hover:bg-[#A81410] text-white border border-amber-300/40 text-[10px] font-bold cursor-pointer whitespace-nowrap"
                  title="Tangkap detik audio saat ini untuk scene ini"
                >
                  Tangkap
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSceneId(scene.id);
                    onSeekTo(scene.startTime);
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 border border-white/15 font-mono text-[10.5px] text-emerald-300 font-bold cursor-pointer tabular-nums"
                  title="Lompat audio ke awal scene ini"
                >
                  {scene.startTime.toFixed(1)}s
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
