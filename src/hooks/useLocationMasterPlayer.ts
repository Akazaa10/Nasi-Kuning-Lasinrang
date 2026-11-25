import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LOCATION_TOUR_AUDIO_URL,
  LOCATION_TOUR_TIMELINE,
  LOCATION_TOUR_TOTAL_DURATION_SEC,
  type LocationTourScene,
  getActiveLocationScene,
  getActiveLocationSubCue,
} from '../data/locationTourTimeline';

export interface UseLocationMasterPlayerOptions {
  /** Aktifkan hook (false saat modal tertutup agar audio langsung dibersihkan) */
  enabled?: boolean;
  /** Preload audio `full-location-tour.mp3` otomatis saat komponen dimuat */
  autoPreload?: boolean;
}

export interface UseLocationMasterPlayerReturn {
  /** `audioElement.currentTime` dalam detik — SATU-SATUNYA penentu state 3D */
  currentTime: number;
  /** Pembaca waktu audio langsung 60fps–120fps tanpa memicu re-render React */
  getMasterTime: () => number;
  /** Durasi total audio narasi lokasi dalam detik */
  duration: number;
  /** Progres ternormalisasi [0..1] */
  progress: number;
  /** True saat audio sedang berputar */
  isPlaying: boolean;
  /** True saat audio telah mencapai detik akhir */
  isEnded: boolean;
  /** True saat audio sedang buffering (`readyState < 3`) */
  isBuffering: boolean;
  /** Status mute audio */
  isMuted: boolean;
  /** True saat user sedang menggeser scrubber (memaksa `jumpTo` instan 1:1) */
  isInstantMotion: boolean;
  /** True HANYA jika URL mengandung `?sync=1` */
  isSyncCalibrationMode: boolean;
  /** Daftar 7 scene aktif (bisa dikalibrasi secara live saat `?sync=1`) */
  timelineScenes: LocationTourScene[];
  /** Scene aktif saat ini sesuai `currentTime` */
  activeScene: LocationTourScene;
  /** Indeks scene aktif (0..6) */
  activeSceneIndex: number;

  // Kontrol Pemutar
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  replay: () => void;
  seekTo: (targetSec: number, instant?: boolean) => void;
  setScrubbing: (scrubbing: boolean) => void;
  toggleMute: () => void;
  jumpToScene: (sceneIndex: number) => void;
  prevScene: () => void;
  nextScene: () => void;

  // Helper Kalibrasi Live (?sync=1)
  captureSceneStartTime: (sceneId: string) => number;
  nudgeSceneStartTime: (sceneId: string, deltaSec: number) => void;
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

function cloneDefaultLocationTimeline(): LocationTourScene[] {
  return LOCATION_TOUR_TIMELINE.map((scene) => ({
    ...scene,
    startCamera: { ...scene.startCamera, center: { ...scene.startCamera.center } },
    endCamera: { ...scene.endCamera, center: { ...scene.endCamera.center } },
    highlightedLandmarks: [...scene.highlightedLandmarks],
    highlightBadge: scene.highlightBadge ? { ...scene.highlightBadge } : undefined,
    route: scene.route
      ? {
          ...scene.route,
          waypoints: scene.route.waypoints.map((wp) => ({ ...wp })),
        }
      : undefined,
    ctaOverlay: scene.ctaOverlay ? { ...scene.ctaOverlay } : undefined,
    subCues: scene.subCues.map((cue) => ({ ...cue })),
  }));
}

/**
 * Menjaga seluruh `startTime` & `endTime` scene tetap kontinu tanpa celah,
 * serta menggeser sub-cue, badge, rute, dan CTA scene yang berubah agar tetap sinkron 1:1.
 */
function normalizeContiguousLocationScenes(
  scenes: LocationTourScene[],
  totalDuration: number
): LocationTourScene[] {
  const maxDur = Math.max(LOCATION_TOUR_TOTAL_DURATION_SEC, totalDuration);

  return scenes.map((scene, idx) => {
    const next = scenes[idx + 1];
    const startTime = Math.max(0, Number(scene.startTime.toFixed(1)));
    const endTime = next
      ? Math.max(startTime + 0.5, Number(next.startTime.toFixed(1)))
      : Math.max(startTime + 0.5, Number(maxDur.toFixed(1)));

    const oldSpan = Math.max(0.1, scene.endTime - scene.startTime);
    const newSpan = Math.max(0.5, endTime - startTime);
    const remapTime = (t: number) => {
      const ratio = Math.max(0, Math.min(1, (t - scene.startTime) / oldSpan));
      return Number((startTime + ratio * newSpan).toFixed(1));
    };

    return {
      ...scene,
      startTime,
      endTime,
      highlightBadge: scene.highlightBadge
        ? {
            ...scene.highlightBadge,
            showFromSec: remapTime(scene.highlightBadge.showFromSec),
          }
        : undefined,
      route: scene.route
        ? {
            ...scene.route,
            drawStartTime: remapTime(scene.route.drawStartTime),
            drawEndTime: remapTime(scene.route.drawEndTime),
          }
        : undefined,
      ctaOverlay: scene.ctaOverlay
        ? {
            ...scene.ctaOverlay,
            showFromSec: remapTime(scene.ctaOverlay.showFromSec),
            mapsButtonHighlightStartSec: remapTime(
              scene.ctaOverlay.mapsButtonHighlightStartSec
            ),
            plusCodeHighlightStartSec: remapTime(
              scene.ctaOverlay.plusCodeHighlightStartSec
            ),
          }
        : undefined,
      subCues: scene.subCues.map((cue) => ({
        ...cue,
        startTime: remapTime(cue.startTime),
        endTime: remapTime(cue.endTime),
      })),
    };
  });
}

/**
 * Master Audio-Driven Location 3D Tour Hook.
 *
 * ATURAN KETAT:
 * - `audioElement.currentTime` di dalam `requestAnimationFrame` adalah SATU-SATUNYA penentu state.
 * - Zero `setTimeout` / `setInterval` yang menggerakkan kamera 3D atau rute secara terpisah.
 * - HANYA memutar satu file master: `public/audio/location/full-location-tour.mp3`.
 * - Jika `audio.paused` atau `audio.readyState < 3`, progres visual dibekukan 100% sinkron.
 */
export function useLocationMasterPlayer(
  options: UseLocationMasterPlayerOptions = {}
): UseLocationMasterPlayerReturn {
  const { enabled = true, autoPreload = true } = options;

  const isSyncCalibrationMode = useMemo(() => detectSyncCalibrationMode(), []);

  const [timelineScenes, setTimelineScenes] = useState<LocationTourScene[]>(() =>
    cloneDefaultLocationTimeline()
  );
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(LOCATION_TOUR_TOTAL_DURATION_SEC);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isEnded, setIsEnded] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [instantJumpPending, setInstantJumpPending] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const isMutedRef = useRef<boolean>(false);
  const durationRef = useRef<number>(duration);
  const lastAudioTimeRef = useRef<number>(0);
  const lastReactSyncMsRef = useRef<number>(0);
  const lastSceneIdRef = useRef<string>('');
  const lastSubCueIdRef = useRef<string>('');
  const timelineScenesRef = useRef<LocationTourScene[]>(timelineScenes);
  const isSyncModeRef = useRef<boolean>(isSyncCalibrationMode);

  isMutedRef.current = isMuted;
  durationRef.current = duration;
  timelineScenesRef.current = timelineScenes;
  isSyncModeRef.current = isSyncCalibrationMode;

  const getMasterTime = useCallback((): number => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.currentTime)) {
      return audio.currentTime;
    }
    return lastAudioTimeRef.current;
  }, []);

  const stopRafLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startMasterRafLoop = useCallback(() => {
    stopRafLoop();

    const tick = () => {
      const audio = audioRef.current;
      if (!audio) {
        rafRef.current = null;
        return;
      }

      if (audio.ended) {
        const finalDur =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : durationRef.current;
        lastAudioTimeRef.current = finalDur;
        setCurrentTime(finalDur);
        setIsPlaying(false);
        setIsEnded(true);
        setIsBuffering(false);
        rafRef.current = null;
        return;
      }

      if (audio.paused) {
        setIsPlaying(false);
        setIsBuffering(false);
        rafRef.current = null;
        return;
      }

      // Bekukan frame visual jika audio sedang buffering (readyState < 3)
      if (audio.readyState < 3) {
        setIsBuffering(true);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      setIsBuffering(false);
      const nowSec = audio.currentTime;
      lastAudioTimeRef.current = nowSec;

      // Perbarui state React hanya ~10Hz (atau langsung saat ganti scene/caption)
      // sementara kanvas WebGL 3D membaca getMasterTime() langsung di 60fps tanpa re-render React!
      const nowMs = performance.now();
      const scenes = timelineScenesRef.current;
      const curScene = getActiveLocationScene(nowSec, scenes);
      const curSubCue = getActiveLocationSubCue(nowSec, scenes);
      const sceneChanged = curScene.id !== lastSceneIdRef.current;
      const cueChanged = (curSubCue?.id ?? '') !== lastSubCueIdRef.current;
      const throttleMs = isSyncModeRef.current ? 50 : 110;

      if (sceneChanged || cueChanged || nowMs - lastReactSyncMsRef.current >= throttleMs) {
        lastReactSyncMsRef.current = nowMs;
        lastSceneIdRef.current = curScene.id;
        lastSubCueIdRef.current = curSubCue?.id ?? '';
        setCurrentTime(nowSec);
        setInstantJumpPending(false);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopRafLoop]);

  // Inisialisasi & preload file audio tunggal `public/audio/location/full-location-tour.mp3`
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const audio = new Audio(LOCATION_TOUR_AUDIO_URL);
    audio.preload = autoPreload ? 'auto' : 'metadata';
    audio.muted = isMutedRef.current;
    audioRef.current = audio;

    if (autoPreload) {
      audio.load();
    }

    const syncDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onWaiting = () => {
      if (!audio.paused) setIsBuffering(true);
    };

    const onCanPlay = () => {
      setIsBuffering(false);
    };

    const onPlay = () => {
      setIsPlaying(true);
      setIsEnded(false);
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
      lastAudioTimeRef.current = finalDur;
      setCurrentTime(finalDur);
      setIsPlaying(false);
      setIsEnded(true);
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

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = isMuted;
    }
  }, [isMuted]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const maxDur =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : durationRef.current;

    if (audio.ended || audio.currentTime >= maxDur - 0.15) {
      audio.currentTime = 0;
      lastAudioTimeRef.current = 0;
      setCurrentTime(0);
      setIsEnded(false);
    }

    if (audio.readyState < 3) {
      setIsBuffering(true);
    }

    try {
      await audio.play();
      setIsPlaying(true);
      setIsEnded(false);
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

    if (audio) {
      try {
        audio.currentTime = clamped;
      } catch {
        // Metadata belum selesai dimuat; state tetap diperbarui secara deterministik
      }
    }

    lastAudioTimeRef.current = clamped;
    setIsEnded(clamped >= maxDur - 0.1);
    if (instant) {
      setInstantJumpPending(true);
    }
    setCurrentTime(clamped);
  }, []);

  const replay = useCallback(() => {
    seekTo(0, true);
    void play();
  }, [play, seekTo]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const activeScene = useMemo(
    () => getActiveLocationScene(currentTime, timelineScenes),
    [currentTime, timelineScenes]
  );

  const activeSceneIndex = useMemo(() => {
    const idx = timelineScenes.findIndex((s) => s.id === activeScene.id);
    return idx >= 0 ? idx : 0;
  }, [timelineScenes, activeScene.id]);

  const jumpToScene = useCallback(
    (sceneIndex: number) => {
      const clampedIdx = Math.max(0, Math.min(timelineScenes.length - 1, sceneIndex));
      const target = timelineScenes[clampedIdx];
      if (!target) return;
      seekTo(target.startTime, true);
    },
    [seekTo, timelineScenes]
  );

  const prevScene = useCallback(() => {
    if (currentTime - activeScene.startTime > 2.0) {
      seekTo(activeScene.startTime, true);
      return;
    }
    jumpToScene(Math.max(0, activeSceneIndex - 1));
  }, [activeScene.startTime, activeSceneIndex, currentTime, jumpToScene, seekTo]);

  const nextScene = useCallback(() => {
    const nextIdx = activeSceneIndex + 1 < timelineScenes.length ? activeSceneIndex + 1 : 0;
    jumpToScene(nextIdx);
  }, [activeSceneIndex, jumpToScene, timelineScenes.length]);

  // =========================================================================
  // LIVE CALIBRATION HELPERS (?sync=1 ONLY)
  // =========================================================================
  const captureSceneStartTime = useCallback((sceneId: string): number => {
    const audio = audioRef.current;
    const rawTime = audio ? audio.currentTime : lastAudioTimeRef.current;
    const captured = Number(Math.max(0, rawTime).toFixed(1));

    setTimelineScenes((prev) => {
      const updated = prev.map((scene) =>
        scene.id === sceneId ? { ...scene, startTime: captured } : scene
      );
      return normalizeContiguousLocationScenes(updated, durationRef.current);
    });

    return captured;
  }, []);

  const nudgeSceneStartTime = useCallback((sceneId: string, deltaSec: number) => {
    setTimelineScenes((prev) => {
      const updated = prev.map((scene) =>
        scene.id === sceneId
          ? { ...scene, startTime: Number(Math.max(0, scene.startTime + deltaSec).toFixed(1)) }
          : scene
      );
      return normalizeContiguousLocationScenes(updated, durationRef.current);
    });
  }, []);

  const resetCalibratedTimeline = useCallback(() => {
    setTimelineScenes(cloneDefaultLocationTimeline());
  }, []);

  const progress =
    duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  return {
    currentTime,
    getMasterTime,
    duration,
    progress,
    isPlaying,
    isEnded,
    isBuffering,
    isMuted,
    isInstantMotion: isScrubbing || instantJumpPending,
    isSyncCalibrationMode,
    timelineScenes,
    activeScene,
    activeSceneIndex,
    play,
    pause,
    togglePlay,
    replay,
    seekTo,
    setScrubbing: setIsScrubbing,
    toggleMute,
    jumpToScene,
    prevScene,
    nextScene,
    captureSceneStartTime,
    nudgeSceneStartTime,
    resetCalibratedTimeline,
  };
}
