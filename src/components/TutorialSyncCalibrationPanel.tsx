import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Crosshair,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import type { TutorialTimelineEvent } from '../data/tutorialTimeline';

interface TutorialSyncCalibrationPanelProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
  activeEventId: string;
  events: TutorialTimelineEvent[];
  onSeekTo: (sec: number) => void;
  onScrubChange?: (scrubbing: boolean) => void;
  onCaptureStartTime: (eventId: string) => number;
  onNudgeStartTime: (eventId: string, deltaSec: number) => void;
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

export const TutorialSyncCalibrationPanel: React.FC<
  TutorialSyncCalibrationPanelProps
> = ({
  currentTime,
  duration,
  isPlaying,
  isBuffering,
  activeEventId,
  events,
  onSeekTo,
  onScrubChange,
  onCaptureStartTime,
  onNudgeStartTime,
  onResetTimeline,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(
    () => events[0]?.id || activeEventId
  );
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [copiedState, setCopiedState] = useState<boolean>(false);
  const [lastCapturedInfo, setLastCapturedInfo] = useState<string | null>(null);

  const selectedIndex = useMemo(() => {
    const idx = events.findIndex((ev) => ev.id === selectedEventId);
    return idx >= 0 ? idx : 0;
  }, [events, selectedEventId]);

  const selectedEvent = events[selectedIndex] || events[0];

  const handleCaptureNow = () => {
    if (!selectedEvent) return;
    const capturedSec = onCaptureStartTime(selectedEvent.id);
    setCopiedState(false);
    setLastCapturedInfo(
      `${selectedEvent.id} → ${capturedSec.toFixed(1)} dtk`
    );
    if (autoAdvance && selectedIndex + 1 < events.length) {
      setSelectedEventId(events[selectedIndex + 1].id);
    }
  };

  const handleCopyJson = async () => {
    const jsonOutput = JSON.stringify(events, null, 2);
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
    <div className="mt-4 rounded-2xl bg-[#1A100A] border-2 border-[#F5B700]/60 text-[#FBF4E4] shadow-2xl overflow-hidden">
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-[#26160D] border-b border-[#F5B700]/25 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#FFE066]" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#FFE066]">
            Mode Kalibrasi Live (?sync=1)
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
          <span className="px-2 py-0.5 rounded-md bg-[#342015] border border-[#F5B700]/40 text-[#FFE066] font-extrabold">
            {formatPreciseTime(currentTime)} ({currentTime.toFixed(1)}s)
          </span>
          <span className="text-[#C8B8A2] text-[11px]">
            / {duration.toFixed(1)}s
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
              isBuffering
                ? 'bg-[#8F5200] text-[#FFE066]'
                : isPlaying
                ? 'bg-[#1B5E20] text-[#7CE089]'
                : 'bg-[#342015] text-[#C8B8A2]'
            }`}
          >
            {isBuffering ? 'BUFFER' : isPlaying ? 'PLAY' : 'PAUSE'}
          </span>
        </div>
      </div>

      {/* Active Action Controls */}
      <div className="p-3.5 space-y-3 border-b border-[#F5B700]/20 bg-[#20130C]">
        {/* Developer Timeline Scrubber (?sync=1 only) */}
        <div className="flex items-center gap-2.5">
          <span className="text-[10.5px] font-mono tabular-nums text-[#FFE066] font-bold shrink-0">
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
            aria-label="Geser detik kalibrasi tutorial"
            className="flex-1 accent-[#F5B700] cursor-pointer"
          />
          <span className="text-[10.5px] font-mono tabular-nums text-[#C8B8A2] shrink-0">
            {duration.toFixed(1)}s
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-wider text-[#C8B8A2] font-bold">
              Event Terpilih untuk Dikalibrasi ({selectedIndex + 1}/{events.length})
            </div>
            <div className="text-xs font-bold text-[#FFE066] truncate">
              {selectedEvent?.id} ·{' '}
              <span className="text-[#7CE089] font-mono">
                {selectedEvent?.startTime.toFixed(1)}s → {selectedEvent?.endTime.toFixed(1)}s
              </span>
            </div>
          </div>

          <label className="inline-flex items-center gap-1.5 text-[11px] text-[#E2D4C0] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="accent-[#F5B700]"
            />
            <span>Auto lanjut ke event berikutnya</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCaptureNow}
            className="px-3.5 py-2 rounded-xl bg-[#A81410] hover:bg-[#840E0B] text-[#FFFDF9] border border-[#FFE066]/60 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer"
          >
            <Crosshair className="w-4 h-4 text-[#FFE066]" />
            <span>Tangkap Detik Ini ({currentTime.toFixed(1)}s)</span>
          </button>

          {selectedEvent && (
            <div className="inline-flex items-center gap-1 bg-[#2C1A10] border border-[#F5B700]/25 rounded-xl p-1">
              <button
                type="button"
                onClick={() => {
                  onNudgeStartTime(selectedEvent.id, -0.2);
                  setCopiedState(false);
                }}
                className="px-2 py-1 rounded-lg hover:bg-[#3A2316] text-[11px] font-mono font-bold text-[#FFE066] inline-flex items-center gap-0.5 cursor-pointer"
                title="Mundurkan 0.2 detik"
              >
                <Minus className="w-3 h-3" />
                <span>0.2s</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNudgeStartTime(selectedEvent.id, 0.2);
                  setCopiedState(false);
                }}
                className="px-2 py-1 rounded-lg hover:bg-[#3A2316] text-[11px] font-mono font-bold text-[#FFE066] inline-flex items-center gap-0.5 cursor-pointer"
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
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 border active:scale-95 transition-transform cursor-pointer ${
              copiedState
                ? 'bg-[#1B5E20] border-[#7CE089] text-[#FFFDF9]'
                : 'bg-[#F5B700] hover:bg-[#E0A500] border-[#FFE066] text-[#1E110A]'
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
              setLastCapturedInfo('Timeline dikembalikan ke bawaan.');
            }}
            className="px-2.5 py-2 rounded-xl bg-[#2C1A10] hover:bg-[#3A2316] border border-[#F5B700]/25 text-[#E2D4C0] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {lastCapturedInfo && (
          <div className="text-[11px] font-mono text-[#7CE089]">
            Terakhir diperbarui: {lastCapturedInfo}
          </div>
        )}
      </div>

      {/* Scrollable Event List */}
      <div className="max-h-56 overflow-y-auto divide-y divide-[#F5B700]/12">
        {events.map((ev, idx) => {
          const isSelected = ev.id === selectedEvent?.id;
          const isLiveActive = ev.id === activeEventId;
          return (
            <div
              key={ev.id}
              onClick={() => setSelectedEventId(ev.id)}
              className={`px-3.5 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-[#3C2214] border-l-4 border-[#FFE066]'
                  : isLiveActive
                  ? 'bg-[#1B3A1E]/55 border-l-4 border-[#7CE089]'
                  : 'hover:bg-[#2A1910]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[10px] text-[#C8B8A2]">
                    #{String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-bold text-[#FFFDF9] truncate">
                    {ev.id}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#23150D] text-[#FFE066] font-mono">
                    {ev.screen}
                  </span>
                  {ev.clickSfx && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#A81410]/80 text-[#FFFDF9] inline-flex items-center gap-0.5 font-bold">
                      <Volume2 className="w-2.5 h-2.5" />
                      <span>KLIK</span>
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-[#C8B8A2] truncate mt-0.5">
                  {ev.caption}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEventId(ev.id);
                    onSeekTo(ev.startTime);
                  }}
                  className="px-2 py-1 rounded-lg bg-[#23150D] hover:bg-[#3A2316] border border-[#F5B700]/30 font-mono text-[10.5px] text-[#7CE089] font-bold cursor-pointer tabular-nums"
                  title="Lompat audio ke detik event ini"
                >
                  {ev.startTime.toFixed(1)}s
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
