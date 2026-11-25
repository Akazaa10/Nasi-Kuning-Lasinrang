import { TUTORIAL_CLICK_SFX_URL } from '../data/tutorialTimeline';

export type TutorialClickVariant = 'click' | 'tab' | 'success';

export interface TutorialClickCue {
  /** Normalized chapter progress [0..1] when the click occurs */
  t: number;
  /** Type of tactile UI sound effect */
  variant: TutorialClickVariant;
}

export interface PlayClickSfxOptions {
  /** Gain volume [0..1], default 0.9 */
  volume?: number;
  /** If true, skips playback without throwing */
  muted?: boolean;
  /** Optional playback speed tweak, default 1.0 */
  playbackRate?: number;
  /** Optional external AudioContext & destination */
  audioContext?: AudioContext;
  destination?: AudioNode;
}

// ============================================================================
// WEB AUDIO API ZERO-LATENCY CLICK SFX ENGINE
// Preloads & decodes `public/audio/tutorial/click-sfx.wav` into an AudioBuffer
// and automatically trims leading silence so the click transient fires at 0.0ms!
// ============================================================================

let sharedAudioCtx: AudioContext | null = null;
let decodedClickBuffer: AudioBuffer | null = null;
let clickAttackOffsetSec = 0;
let rawClickArrayBuffer: ArrayBuffer | null = null;
let preloadPromise: Promise<boolean> | null = null;

/** Pengaman anti-dobel: menyimpan eventId yang sudah berbunyi di sesi putar berjalan */
const playedClickEventIds = new Set<string>();

/** Per-context decoded cache */
const externalContextBufferCache = new WeakMap<AudioContext, AudioBuffer>();

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext || win.webkitAudioContext || null;
}

function getOrCreateSharedAudioContext(): AudioContext | null {
  if (sharedAudioCtx && sharedAudioCtx.state !== 'closed') {
    return sharedAudioCtx;
  }
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  try {
    sharedAudioCtx = new Ctor({ latencyHint: 'interactive' });
    return sharedAudioCtx;
  } catch {
    try {
      sharedAudioCtx = new Ctor();
      return sharedAudioCtx;
    } catch {
      return null;
    }
  }
}

/**
 * Finds the exact sample onset of the click transient so any leading silence
 * in the WAV file is skipped for true 0ms latency on button press.
 */
function computeBufferAttackOffsetSec(buffer: AudioBuffer): number {
  try {
    const channelData = buffer.getChannelData(0);
    const len = channelData.length;
    const threshold = 0.015;
    for (let i = 0; i < len; i += 1) {
      if (Math.abs(channelData[i]) >= threshold) {
        // Keep a tiny 1.5ms pre-roll before the peak transient
        const preRollSamples = Math.floor(buffer.sampleRate * 0.0015);
        const startSample = Math.max(0, i - preRollSamples);
        return startSample / buffer.sampleRate;
      }
    }
  } catch {
    // fallback 0
  }
  return 0;
}

async function fetchClickSfxBytes(): Promise<ArrayBuffer | null> {
  if (rawClickArrayBuffer && rawClickArrayBuffer.byteLength > 0) {
    return rawClickArrayBuffer;
  }
  try {
    const response = await fetch(TUTORIAL_CLICK_SFX_URL, { cache: 'force-cache' });
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 0) {
      rawClickArrayBuffer = bytes;
      return bytes;
    }
  } catch {
    return null;
  }
  return null;
}

async function decodeWavForContext(
  ctx: AudioContext,
  bytes: ArrayBuffer
): Promise<AudioBuffer | null> {
  try {
    // Always slice(0) because decodeAudioData detaches the passed ArrayBuffer in browsers
    return await ctx.decodeAudioData(bytes.slice(0));
  } catch {
    return null;
  }
}

/**
 * Memuat & mendecode `public/audio/tutorial/click-sfx.wav` ke dalam Web Audio `AudioBuffer`
 * agar saat dipicu di tengah video tutorial memiliki jeda 0 ms di semua browser & HP.
 */
export async function preloadClickSfx(customContext?: AudioContext): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const targetCtx = customContext || getOrCreateSharedAudioContext();
  if (!targetCtx) return false;

  if (customContext) {
    if (externalContextBufferCache.has(customContext)) return true;
    const bytes = await fetchClickSfxBytes();
    if (!bytes) return false;
    const buf = await decodeWavForContext(customContext, bytes);
    if (buf) {
      externalContextBufferCache.set(customContext, buf);
      clickAttackOffsetSec = computeBufferAttackOffsetSec(buf);
      return true;
    }
    return false;
  }

  if (decodedClickBuffer) return true;
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      const bytes = await fetchClickSfxBytes();
      if (!bytes) return false;
      const buf = await decodeWavForContext(targetCtx, bytes);
      if (!buf) return false;
      decodedClickBuffer = buf;
      clickAttackOffsetSec = computeBufferAttackOffsetSec(buf);
      return true;
    } finally {
      preloadPromise = null;
    }
  })();

  return preloadPromise;
}

/**
 * Membuka kunci AudioContext pada interaksi tap/klik pertama pengguna (wajib di iOS Safari & Chrome Mobile).
 */
export function unlockClickSfxAudio(): void {
  const ctx = getOrCreateSharedAudioContext();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  if (!decodedClickBuffer) {
    void preloadClickSfx();
  }
}

/**
 * Mengembalikan true jika buffer click-sfx.wav sudah siap diputar dengan 0 ms delay.
 */
export function isClickSfxReady(): boolean {
  return decodedClickBuffer !== null;
}

/**
 * Mengecek apakah eventId klik tertentu sudah pernah diputar pada sesi saat ini.
 */
export function hasClickSfxPlayed(eventId: string): boolean {
  return playedClickEventIds.has(eventId);
}

/**
 * Memutar efek suara klik (`public/audio/tutorial/click-sfx.wav`) dengan Web Audio API (0 ms delay)
 * dilengkapi pengaman `Set<string>` agar TIDAK PERNAH berbunyi dobel pada frame / eventId yang sama.
 */
export function playClickSfx(
  eventId: string,
  options: PlayClickSfxOptions = {}
): boolean {
  const cleanId = eventId.trim();
  if (!cleanId) return false;

  // Pengaman anti-dobel di frame / pass pemutaran yang sama
  if (playedClickEventIds.has(cleanId)) {
    return false;
  }
  playedClickEventIds.add(cleanId);

  if (options.muted) {
    return false;
  }

  const ctx = options.audioContext || getOrCreateSharedAudioContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }

  const destination = options.destination || ctx.destination;
  const volume =
    typeof options.volume === 'number'
      ? Math.max(0, Math.min(1, options.volume))
      : 0.9;
  const playbackRate =
    typeof options.playbackRate === 'number' && options.playbackRate > 0
      ? options.playbackRate
      : 1.0;

  const buffer = options.audioContext
    ? externalContextBufferCache.get(options.audioContext) || decodedClickBuffer
    : decodedClickBuffer;

  if (!buffer) {
    void preloadClickSfx(options.audioContext);
    return false;
  }

  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);

    source.connect(gain);
    gain.connect(destination);
    source.start(ctx.currentTime, clickAttackOffsetSec);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mereset catatan `Set<string>` event klik yang sudah berbunyi.
 * - Tanpa argumen: menghapus seluruh catatan (untuk replay / restart dari 00:00).
 * - Dengan `eventIdsToClear`: hanya menghapus ID tertentu (untuk seek mundur).
 */
export function resetPlayedClicks(eventIdsToClear?: readonly string[]): void {
  if (!eventIdsToClear) {
    playedClickEventIds.clear();
    return;
  }
  for (const id of eventIdsToClear) {
    playedClickEventIds.delete(id);
  }
}

/**
 * Memutar `public/audio/tutorial/click-sfx.wav` secara terjadwal pada AudioContext tertentu.
 */
export function playTutorialClickSfxAt(
  ctx: AudioContext,
  destination: AudioNode,
  variant: TutorialClickVariant = 'click',
  whenSec?: number
): void {
  const t0 = typeof whenSec === 'number' ? whenSec : ctx.currentTime;
  const cachedWav = externalContextBufferCache.get(ctx) || decodedClickBuffer;

  if (!cachedWav) {
    void preloadClickSfx(ctx);
    return;
  }

  try {
    const src = ctx.createBufferSource();
    src.buffer = cachedWav;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(variant === 'tab' ? 0.75 : 0.92, t0);
    src.connect(gain);
    gain.connect(destination);
    src.start(t0, clickAttackOffsetSec);
  } catch {
    // Strictly silent if buffer cannot be played
  }
}
