import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TUTORIAL_FULL_AUDIO_URL,
  TUTORIAL_TIMELINE,
  TUTORIAL_TOTAL_DURATION_SEC,
  type TutorialStepChapter,
  type TutorialTimelineEvent,
} from '../data/tutorialTimeline';
import {
  playClickSfx,
  preloadClickSfx,
  resetPlayedClicks,
  unlockClickSfxAudio,
} from '../utils/tutorialSoundEffects';
import {
  deriveStepChaptersFromTimeline,
  evaluateTutorialStageAtTime,
  type TutorialStageSnapshot,
} from '../utils/tutorialStageEvaluator';

export interface UseTutorialMasterPlayerOptions {
  /** Whether the player is active/mounted (set false when modal is closed) */
  enabled?: boolean;
  /** Optional external pause trigger (e.g., when switching to Theater Modal) */
  autoPreload?: boolean;
}

export interface UseTutorialMasterPlayerReturn {
  /** Audio element currentTime in seconds (Single Source of Truth) */
  currentTime: number;
  /** Total duration in seconds from full-tutorial.mp3 */
  duration: number;
  /** Normalized progress [0..1] */
  progress: number;
  /** True while audio is playing */
  isPlaying: boolean;
  /** True while full-tutorial.mp3 is loading or readyState < 3 while attempting playback */
  isBuffering: boolean;
  /** Audio readyState (0..4) */
  audioReadyState: number;
  /** True if muted */
  isMuted: boolean;
  /** Active playback rate */
  playbackRate: 1 | 1.15;
  /** True while user is actively scrubbing (disables transition lerp for instant frame jump) */
  isInstantMotion: boolean;
  /** True ONLY when URL query contains ?sync=1 */
  isSyncCalibrationMode: boolean;
  /** Active timeline events (mutable only in ?sync=1 calibration mode) */
  timelineEvents: TutorialTimelineEvent[];
  /** Dynamic step chapters derived from timelineEvents */
  stepChapters: TutorialStepChapter[];
  /** Deterministic DOM stage props snapshot for currentTime */
  stage: TutorialStageSnapshot;

  // Controls
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  replay: () => void;
  seekTo: (targetSec: number, instant?: boolean) => void;
  setScrubbing: (scrubbing: boolean) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: 1 | 1.15) => void;
  jumpToChapter: (chapterIndex: number) => void;
  prevChapter: () => void;
  nextChapter: () => void;

  // Live Calibration (?sync=1) Helpers
  captureEventStartTime: (eventId: string) => number;
  nudgeEventStartTime: (eventId: string, deltaSec: number) => void;
  resetCalibratedTimeline: () => void;
}

function detectSyncCalibrationMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('sync') === '1';
  } catch {
    return false;
  }
}

function cloneDefaultTimeline(): TutorialTimelineEvent[] {
  return TUTORIAL_TIMELINE.map((ev) => ({
    ...ev,
    meta: ev.meta ? { ...ev.meta } : undefined,
  }));
}

function normalizeContiguousTimeline(
  events: TutorialTimelineEvent[],
  totalDuration: number
): TutorialTimelineEvent[] {
  const maxDur = Math.max(TUTORIAL_TOTAL_DURATION_SEC, totalDuration);
  return events.map((ev, idx) => {
    const next = events[idx + 1];
    const startTime = Math.max(0, Number(ev.startTime.toFixed(1)));
    const endTime = next
      ? Math.max(startTime + 0.1, Number(next.startTime.toFixed(1)))
      : Math.max(startTime + 0.1, Number(maxDur.toFixed(1)));

    let clickTime = ev.clickTime;
    if (ev.clickSfx) {
      if (typeof clickTime !== 'number' || clickTime < startTime || clickTime > endTime) {
        clickTime = Number(Math.min(endTime - 0.05, startTime + 0.1).toFixed(1));
      }
    }

    return {
      ...ev,
      startTime,
      endTime,
      clickTime,
    };
  });
}

function getClickIdsAtOrAfter(
  events: readonly TutorialTimelineEvent[],
  targetSec: number
): string[] {
  const safe = Math.max(0, targetSec);
  return events
    .filter((ev) => {
      if (!ev.clickSfx) return false;
      const triggerAt = typeof ev.clickTime === 'number' ? ev.clickTime : ev.startTime;
      return triggerAt >= safe;
    })
    .map((ev) => ev.id);
}

/**
 * Master Audio-Driven Tutorial Player Hook.
 *
 * ATURAN KETAT:
 * - `audioElement.currentTime` di dalam `requestAnimationFrame` adalah SATU-SATUNYA penentu state.
 * - Tidak ada `setTimeout` maupun `setInterval` yang berjalan terpisah dari audio.
 * - Hanya memutar `public/audio/tutorial/full-tutorial.mp3` dan `public/audio/tutorial/click-sfx.wav`.
 * - Jika `audio.paused` atau `audio.readyState < 3`, animasi dibekukan agar tidak mendahului suara.
 */
export function useTutorialMasterPlayer(
  options: UseTutorialMasterPlayerOptions = {}
): UseTutorialMasterPlayerReturn {
  const { enabled = true, autoPreload = true } = options;

  const isSyncCalibrationMode = useMemo(() => detectSyncCalibrationMode(), []);

  const [timelineEvents, setTimelineEvents] = useState<TutorialTimelineEvent[]>(
    () => cloneDefaultTimeline()
  );
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(TUTORIAL_TOTAL_DURATION_SEC);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [audioReadyState, setAudioReadyState] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRateState] = useState<1 | 1.15>(1);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [instantJumpPending, setInstantJumpPending] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevAudioTimeRef = useRef<number>(0);
  const lastReactSyncMsRef = useRef<number>(0);
  const lastEventIdRef = useRef<string>('');
  const isMutedRef = useRef<boolean>(false);
  const timelineRef = useRef<TutorialTimelineEvent[]>(timelineEvents);
  const durationRef = useRef<number>(duration);

  isMutedRef.current = isMuted;
  timelineRef.current = timelineEvents;
  durationRef.current = duration;

  const stopRafLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /**
   * Fires `playClickSfx(ev.id)` on the exact `rAF` frame where `audio.currentTime`
   * crosses an event's click timestamp (`clickSfx: true`).
   */
  const dispatchDueClickSfx = useCallback(
    (nowSec: number, prevSec: number) => {
      const events = timelineRef.current;
      for (let i = 0; i < events.length; i += 1) {
        const ev = events[i];
        if (!ev.clickSfx) continue;
        const triggerAt = typeof ev.clickTime === 'number' ? ev.clickTime : ev.startTime;
        const crossedThisFrame = prevSec <= triggerAt && nowSec >= triggerAt;
        const withinTightWindow = nowSec >= triggerAt && nowSec - triggerAt <= 0.25;
        if (crossedThisFrame || withinTightWindow) {
          playClickSfx(ev.id, { muted: isMutedRef.current });
        }
      }
    },
    []
  );

  const startMasterRafLoop = useCallback(() => {
    stopRafLoop();

    const tick = () => {
      const audio = audioRef.current;
      if (!audio) {
        rafRef.current = null;
        return;
      }

      const rs = audio.readyState;
      setAudioReadyState(rs);

      // Ended check
      if (audio.ended) {
        const finalDur =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : durationRef.current;
        prevAudioTimeRef.current = finalDur;
        setCurrentTime(finalDur);
        setIsPlaying(false);
        setIsBuffering(false);
        rafRef.current = null;
        return;
      }

      // Freeze animation strictly when paused or buffering (readyState < 3)
      if (audio.paused) {
        setIsBuffering(false);
        setIsPlaying(false);
        rafRef.current = null;
        return;
      }

      if (rs < 3) {
        setIsBuffering(true);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      setIsBuffering(false);

      const nowSec = audio.currentTime;
      const prevSec = prevAudioTimeRef.current;

      // Trigger click-sfx.wav on the exact 60fps audio master frame
      let firedClick = false;
      if (nowSec >= prevSec) {
        const events = timelineRef.current;
        for (let i = 0; i < events.length; i += 1) {
          const ev = events[i];
          if (!ev.clickSfx) continue;
          const triggerAt = typeof ev.clickTime === 'number' ? ev.clickTime : ev.startTime;
          if (prevSec <= triggerAt && nowSec >= triggerAt) {
            firedClick = true;
            break;
          }
        }
        dispatchDueClickSfx(nowSec, prevSec);
      }

      prevAudioTimeRef.current = nowSec;

      // Flush React state immediately on event change or click; otherwise cap DOM re-renders to ~30fps for silky performance
      const nowMs = performance.now();
      const events = timelineRef.current;
      let curEventId = events[events.length - 1]?.id ?? '';
      for (let i = 0; i < events.length; i += 1) {
        if (nowSec >= events[i].startTime && nowSec < events[i].endTime) {
          curEventId = events[i].id;
          break;
        }
      }
      const eventChanged = curEventId !== lastEventIdRef.current;

      if (firedClick || eventChanged || nowMs - lastReactSyncMsRef.current >= 34) {
        lastReactSyncMsRef.current = nowMs;
        lastEventIdRef.current = curEventId;
        setCurrentTime(nowSec);
        setInstantJumpPending(false);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [dispatchDueClickSfx, stopRafLoop]);

  // Initialize & preload official audio element (`public/audio/tutorial/full-tutorial.mp3`)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const audio = new Audio(TUTORIAL_FULL_AUDIO_URL);
    audio.preload = autoPreload ? 'auto' : 'metadata';
    audio.muted = isMutedRef.current;
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    if (autoPreload) {
      void preloadClickSfx();
      audio.load();
    }

    const syncDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      setAudioReadyState(audio.readyState);
    };

    const onWaiting = () => {
      setAudioReadyState(audio.readyState);
      if (!audio.paused) setIsBuffering(true);
    };

    const onCanPlay = () => {
      setAudioReadyState(audio.readyState);
      setIsBuffering(false);
    };

    const onPlay = () => {
      setIsPlaying(true);
      if (audio.readyState < 3) {
        setIsBuffering(true);
      }
      startMasterRafLoop();
    };

    const onPause = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      stopRafLoop();
    };

    const onEnded = () => {
      const finalDur =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : durationRef.current;
      prevAudioTimeRef.current = finalDur;
      setCurrentTime(finalDur);
      setIsPlaying(false);
      setIsBuffering(false);
      stopRafLoop();
    };

    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('canplaythrough', onCanPlay);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onWaiting);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      stopRafLoop();
      audio.pause();
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('canplaythrough', onCanPlay);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onWaiting);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.src = '';
      audioRef.current = null;
      setIsPlaying(false);
      setIsBuffering(false);
    };
  }, [enabled, autoPreload, startMasterRafLoop, stopRafLoop]);

  // Sync mute & playback rate to audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    unlockClickSfxAudio();
    void preloadClickSfx();

    const maxDur =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : durationRef.current;

    // Auto-restart cleanly from 00:00 if already at end
    if (audio.ended || audio.currentTime >= maxDur - 0.15) {
      resetPlayedClicks();
      audio.currentTime = 0;
      prevAudioTimeRef.current = 0;
      setCurrentTime(0);
    }

    if (audio.readyState < 3) {
      setIsBuffering(true);
    }

    try {
      await audio.play();
      setIsPlaying(true);
      startMasterRafLoop();
    } catch {
      setIsPlaying(false);
      setIsBuffering(false);
    }
  }, [startMasterRafLoop]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
    }
    setIsPlaying(false);
    setIsBuffering(false);
    stopRafLoop();
  }, [stopRafLoop]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused && !audio.ended) {
      pause();
    } else {
      void play();
    }
  }, [pause, play]);

  const seekTo = useCallback((targetSec: number, instant = true) => {
    const audio = audioRef.current;
    const maxDur =
      audio && Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : durationRef.current;

    const clamped = Math.max(0, Math.min(maxDur, Number.isFinite(targetSec) ? targetSec : 0));
    const prevSec = prevAudioTimeRef.current;

    // Reset played clicks when seeking backward or to the beginning
    if (clamped <= 0.1) {
      resetPlayedClicks();
    } else if (clamped < prevSec) {
      resetPlayedClicks(getClickIdsAtOrAfter(timelineRef.current, clamped));
    }

    if (audio) {
      try {
        audio.currentTime = clamped;
      } catch {
        // Audio metadata not ready yet; keep UI clamped
      }
    }

    prevAudioTimeRef.current = clamped;
    if (instant) {
      setInstantJumpPending(true);
    }
    setCurrentTime(clamped);
  }, []);

  const replay = useCallback(() => {
    resetPlayedClicks();
    seekTo(0, true);
    void play();
  }, [play, seekTo]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const setPlaybackRate = useCallback((rate: 1 | 1.15) => {
    setPlaybackRateState(rate);
  }, []);

  const stepChapters = useMemo(
    () => deriveStepChaptersFromTimeline(timelineEvents),
    [timelineEvents]
  );

  const stage = useMemo(
    () => evaluateTutorialStageAtTime(currentTime, timelineEvents),
    [currentTime, timelineEvents]
  );

  const jumpToChapter = useCallback(
    (chapterIndex: number) => {
      const clampedIdx = Math.max(0, Math.min(stepChapters.length - 1, chapterIndex));
      const target = stepChapters[clampedIdx];
      if (!target) return;
      seekTo(target.startTime, true);
      if (audioRef.current?.paused) {
        void play();
      }
    },
    [play, seekTo, stepChapters]
  );

  const prevChapter = useCallback(() => {
    const currentCh = stepChapters[stage.activeChapterIndex];
    if (currentCh && currentTime - currentCh.startTime > 2.0) {
      seekTo(currentCh.startTime, true);
      return;
    }
    const targetIdx = Math.max(0, stage.activeChapterIndex - 1);
    jumpToChapter(targetIdx);
  }, [currentTime, jumpToChapter, seekTo, stage.activeChapterIndex, stepChapters]);

  const nextChapter = useCallback(() => {
    const targetIdx =
      stage.activeChapterIndex + 1 < stepChapters.length
        ? stage.activeChapterIndex + 1
        : 0;
    jumpToChapter(targetIdx);
  }, [jumpToChapter, stage.activeChapterIndex, stepChapters.length]);

  // =========================================================================
  // LIVE CALIBRATION HELPERS (?sync=1 ONLY)
  // =========================================================================
  const captureEventStartTime = useCallback((eventId: string): number => {
    const audio = audioRef.current;
    const rawTime = audio ? audio.currentTime : prevAudioTimeRef.current;
    const captured = Number(Math.max(0, rawTime).toFixed(1));

    setTimelineEvents((prev) => {
      const updated = prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const delta = captured - ev.startTime;
        return {
          ...ev,
          startTime: captured,
          clickTime:
            ev.clickSfx && typeof ev.clickTime === 'number'
              ? Number(Math.max(captured, ev.clickTime + delta).toFixed(1))
              : ev.clickSfx
              ? captured
              : undefined,
        };
      });
      return normalizeContiguousTimeline(updated, durationRef.current);
    });

    return captured;
  }, []);

  const nudgeEventStartTime = useCallback((eventId: string, deltaSec: number) => {
    setTimelineEvents((prev) => {
      const updated = prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const nextStart = Number(Math.max(0, ev.startTime + deltaSec).toFixed(1));
        return {
          ...ev,
          startTime: nextStart,
          clickTime:
            ev.clickSfx && typeof ev.clickTime === 'number'
              ? Number(Math.max(nextStart, ev.clickTime + deltaSec).toFixed(1))
              : ev.clickSfx
              ? nextStart
              : undefined,
        };
      });
      return normalizeContiguousTimeline(updated, durationRef.current);
    });
  }, []);

  const resetCalibratedTimeline = useCallback(() => {
    setTimelineEvents(cloneDefaultTimeline());
  }, []);

  const progress =
    duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  return {
    currentTime,
    duration,
    progress,
    isPlaying,
    isBuffering,
    audioReadyState,
    isMuted,
    playbackRate,
    isInstantMotion: isScrubbing || instantJumpPending,
    isSyncCalibrationMode,
    timelineEvents,
    stepChapters,
    stage,
    play,
    pause,
    togglePlay,
    replay,
    seekTo,
    setScrubbing: setIsScrubbing,
    toggleMute,
    setPlaybackRate,
    jumpToChapter,
    prevChapter,
    nextChapter,
    captureEventStartTime,
    nudgeEventStartTime,
    resetCalibratedTimeline,
  };
}
