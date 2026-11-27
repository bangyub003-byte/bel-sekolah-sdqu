import { ChimeType, AudioSettings, CustomChime, SpeechLanguage, SpeechInputMode, PostBellTrack } from '../types';
import {
  playUniversalAudio,
  stopAllCustomAudio,
  pauseCustomAudio,
  resumeCustomAudio,
} from './universalAudioPlayer';
import {
  buildTtsCacheKeyUrl,
  getDataUrlAudioFromOfflineCache,
  getTranslationOffline,
  saveDataUrlAudioToOfflineCache,
  saveTranslationOffline,
} from './offlineCache';
import {
  formatSpokenIndonesianTime,
  resolveTimeAnnouncementConfig,
} from './timeSpeech';
import { evaluateDateHolidayStatus } from './holidayUtils';
import { getSynchronizedDate, format24HourTime } from './timeSync';

export interface BellPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  label: string | null;
  scheduleId?: string | null;
  postBellTrackId?: string | null;
  phase: 'idle' | 'chime' | 'speech' | 'outro' | 'post_bell';
}

let audioCtx: AudioContext | null = null;
let activeBellSequenceId = 0;
let activeChimeGain: GainNode | null = null;
let activeChimeTimeout: ReturnType<typeof setInterval> | null = null;
let activeChimeResolve: (() => void) | null = null;
let activeSpeechAbort: (() => void) | null = null;
let activeDelayAbort: (() => void) | null = null;

let playbackState: BellPlaybackState = {
  isPlaying: false,
  isPaused: false,
  label: null,
  scheduleId: null,
  postBellTrackId: null,
  phase: 'idle',
};

const playbackListeners = new Set<(state: BellPlaybackState) => void>();

function setBellPlaybackState(partial: Partial<BellPlaybackState>): void {
  playbackState = { ...playbackState, ...partial };
  playbackListeners.forEach((cb) => {
    try {
      cb(playbackState);
    } catch {}
  });
}

export function getBellPlaybackState(): BellPlaybackState {
  return playbackState;
}

export function subscribeBellPlaybackState(listener: (state: BellPlaybackState) => void): () => void {
  playbackListeners.add(listener);
  listener(playbackState);
  return () => {
    playbackListeners.delete(listener);
  };
}

export function stopAllChimes(): void {
  if (activeChimeTimeout) {
    clearInterval(activeChimeTimeout);
    activeChimeTimeout = null;
  }
  if (activeChimeGain && audioCtx) {
    try {
      activeChimeGain.gain.cancelScheduledValues(audioCtx.currentTime);
      activeChimeGain.gain.setValueAtTime(0, audioCtx.currentTime);
      activeChimeGain.disconnect();
    } catch {}
    activeChimeGain = null;
  }
  if (activeChimeResolve) {
    const res = activeChimeResolve;
    activeChimeResolve = null;
    res();
  }
}

export function stopAllBellAudio(): void {
  activeBellSequenceId++;
  stopAllChimes();
  stopAllCustomAudio();

  if (activeDelayAbort) {
    const fn = activeDelayAbort;
    activeDelayAbort = null;
    fn();
  }

  if (activeSpeechAbort) {
    const fn = activeSpeechAbort;
    activeSpeechAbort = null;
    fn();
  }

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  setBellPlaybackState({
    isPlaying: false,
    isPaused: false,
    label: null,
    scheduleId: null,
    postBellTrackId: null,
    phase: 'idle',
  });
}

export function pauseBellPlayback(): void {
  if (!playbackState.isPlaying || playbackState.isPaused) return;
  pauseCustomAudio();
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => {});
  }
  if ('speechSynthesis' in window && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.pause();
    } catch {}
  }
  setBellPlaybackState({ isPaused: true });
}

export function resumeBellPlayback(): void {
  if (!playbackState.isPlaying || !playbackState.isPaused) return;
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  resumeCustomAudio();
  if ('speechSynthesis' in window && window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.resume();
    } catch {}
  }
  setBellPlaybackState({ isPaused: false });
}

export function togglePauseBellPlayback(): void {
  if (!playbackState.isPlaying) return;
  if (playbackState.isPaused) {
    resumeBellPlayback();
  } else {
    pauseBellPlayback();
  }
}

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended' && !playbackState.isPaused) {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Synthesize bell chime tones using Web Audio API oscillators or play custom uploaded chime audio.
 * Guaranteed to work offline with zero external audio assets or 404 broken links.
 */
export async function playChimeTone(
  type: ChimeType,
  masterVolume = 1.0,
  customChimes?: CustomChime[],
  directCustomChimeUrl?: string
): Promise<void> {
  stopAllChimes();

  // If direct custom chime URL is passed, play it
  if (directCustomChimeUrl) {
    await playCustomAudio(directCustomChimeUrl, masterVolume);
    return;
  }

  // If type matches a custom chime in the library
  if (customChimes && customChimes.length > 0) {
    const customMatch = customChimes.find((c) => c.id === type);
    if (customMatch && customMatch.audioUrl) {
      await playCustomAudio(customMatch.audioUrl, masterVolume);
      return;
    }
  }

  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const volNode = ctx.createGain();
      volNode.gain.setValueAtTime(Math.min(1.0, Math.max(0, masterVolume)), now);
      volNode.connect(ctx.destination);
      activeChimeGain = volNode;
      activeChimeResolve = resolve;

      let totalDuration = 6.0;

      // Master low-pass filter for natural acoustic warmth and anti-harshness
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4500, now);
      filter.Q.setValueAtTime(0.7, now);
      filter.connect(volNode);

      /**
       * Play a rich acoustic tubular or orchestral bell with natural bell strike harmonics
       */
      const playBellNote = (
        freq: number,
        startTime: number,
        duration: number,
        strikeVol = 0.45,
        typeStyle: 'bell' | 'tube' | 'islamic' | 'joy' = 'bell'
      ) => {
        // Partial 1: Strike Fundamental
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();

        // Partial 2: Hum / Octave Resonance (slightly chorused)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        // Partial 3: Tierce / Metallic Bell Harmonic (2.76x)
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();

        // Partial 4: High Ping Strike transient (4.07x)
        const osc4 = ctx.createOscillator();
        const gain4 = ctx.createGain();

        if (typeStyle === 'tube') {
          osc1.type = 'sine';
          osc2.type = 'triangle';
          osc3.type = 'sine';
          osc4.type = 'sine';
        } else if (typeStyle === 'islamic') {
          osc1.type = 'sine';
          osc2.type = 'sine';
          osc3.type = 'triangle';
          osc4.type = 'sine';
        } else {
          osc1.type = 'sine';
          osc2.type = 'sine';
          osc3.type = 'triangle';
          osc4.type = 'sine';
        }

        osc1.frequency.setValueAtTime(freq, startTime);
        osc2.frequency.setValueAtTime(freq * 2.005, startTime);
        osc3.frequency.setValueAtTime(freq * 2.76, startTime);
        osc4.frequency.setValueAtTime(freq * 4.07, startTime);

        // Strike envelopes
        // Fundamental
        gain1.gain.setValueAtTime(0, startTime);
        gain1.gain.linearRampToValueAtTime(strikeVol, startTime + 0.015);
        gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        // Hum / Octave (longer sustain)
        gain2.gain.setValueAtTime(0, startTime);
        gain2.gain.linearRampToValueAtTime(strikeVol * 0.45, startTime + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.85);

        // Metallic harmonic
        gain3.gain.setValueAtTime(0, startTime);
        gain3.gain.linearRampToValueAtTime(strikeVol * 0.25, startTime + 0.015);
        gain3.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.6);

        // Transient ping
        gain4.gain.setValueAtTime(0, startTime);
        gain4.gain.linearRampToValueAtTime(strikeVol * 0.18, startTime + 0.008);
        gain4.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

        osc1.connect(gain1);
        osc2.connect(gain2);
        osc3.connect(gain3);
        osc4.connect(gain4);

        gain1.connect(filter);
        gain2.connect(filter);
        gain3.connect(filter);
        gain4.connect(filter);

        osc1.start(startTime);
        osc2.start(startTime);
        osc3.start(startTime);
        osc4.start(startTime);

        const stopAt = startTime + duration + 0.1;
        osc1.stop(stopAt);
        osc2.stop(stopAt);
        osc3.stop(stopAt);
        osc4.stop(stopAt);
      };

      /**
       * Play realistic loud mechanical electric gong bell with rapid hammer clapper
       */
      const playElectricBellStrike = (
        startTime: number,
        pulseDuration: number,
        gongFreq1 = 760,
        gongFreq2 = 880,
        intensity = 0.55
      ) => {
        const oscA = ctx.createOscillator();
        const oscB = ctx.createOscillator();
        const oscMetal = ctx.createOscillator();
        const g = ctx.createGain();

        oscA.type = 'sawtooth';
        oscB.type = 'square';
        oscMetal.type = 'triangle';

        oscA.frequency.setValueAtTime(gongFreq1, startTime);
        oscB.frequency.setValueAtTime(gongFreq2, startTime);
        oscMetal.frequency.setValueAtTime(gongFreq1 * 2.3, startTime);

        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(intensity, startTime + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, startTime + pulseDuration);

        oscA.connect(g);
        oscB.connect(g);
        oscMetal.connect(g);
        g.connect(filter);

        oscA.start(startTime);
        oscB.start(startTime);
        oscMetal.start(startTime);

        const stopTime = startTime + pulseDuration + 0.02;
        oscA.stop(stopTime);
        oscB.stop(stopTime);
        oscMetal.stop(stopTime);
      };

      if (type === 'electric_bell') {
        // High-energy School Electric Ringing Bell (10 Detik - Terulang 3x Dering Kencang)
        // Burst 1: 0.0s - 2.8s (2.8s ringing)
        // Pause 1: 0.5s gap
        // Burst 2: 3.3s - 6.1s (2.8s ringing)
        // Pause 2: 0.5s gap
        // Burst 3: 6.6s - 9.4s (2.8s ringing) + 0.6s ringdown = 10.0s Total
        totalDuration = 10.0;
        const strikeRate = 0.046; // ~22 strikes per second
        const bursts = [
          { start: 0.0, dur: 2.8 },
          { start: 3.3, dur: 2.8 },
          { start: 6.6, dur: 2.8 },
        ];

        bursts.forEach((burst) => {
          const numStrikes = Math.floor(burst.dur / strikeRate);
          for (let i = 0; i < numStrikes; i++) {
            const strikeTime = now + burst.start + i * strikeRate;
            playElectricBellStrike(strikeTime, 0.085, 750, 890, 0.5);
          }
        });
      } else if (type === 'fire_bell') {
        // Bel Alarm Pemadam / Bel Pulang Heboh (10 Detik - Dentang Gong Keras 3x Siklus)
        totalDuration = 10.0;
        const strikeRate = 0.055; // ~18 heavy gong clangs per second
        const bursts = [
          { start: 0.0, dur: 2.8 },
          { start: 3.3, dur: 2.8 },
          { start: 6.6, dur: 2.8 },
        ];

        bursts.forEach((burst) => {
          const numStrikes = Math.floor(burst.dur / strikeRate);
          for (let i = 0; i < numStrikes; i++) {
            const strikeTime = now + burst.start + i * strikeRate;
            playElectricBellStrike(strikeTime, 0.11, 840, 1050, 0.55);
          }
        });
      } else if (type === 'westminster') {
        // Authentic Full 8-Note Westminster School Chime (Bel Masuk Sekolah Standar 6.8 Detik)
        // Phrase 1: G#4, E4, F#4, B3
        // Phrase 2: E4, F#4, G#4, E4
        const melody = [
          { freq: 415.30, dur: 0.62 }, // G#4
          { freq: 329.63, dur: 0.62 }, // E4
          { freq: 369.99, dur: 0.62 }, // F#4
          { freq: 246.94, dur: 0.88 }, // B3 (cadence)
          // Brief breath pause
          { freq: 329.63, dur: 0.62 }, // E4
          { freq: 369.99, dur: 0.62 }, // F#4
          { freq: 415.30, dur: 0.62 }, // G#4
          { freq: 329.63, dur: 2.20 }, // E4 (final tubular bell resolve)
        ];

        let cursor = 0;
        melody.forEach((note, idx) => {
          const startTime = now + cursor;
          playBellNote(note.freq, startTime, 2.4, 0.48, 'bell');
          cursor += note.dur;
          if (idx === 3) cursor += 0.35; // Interlude pause between phrases
        });

        totalDuration = 6.8;
      } else if (type === 'classic_3tone') {
        // 6-Tone Melodic Ascending School Chime (5.8 Detik)
        // Melody: Do - Mi - Sol - Do' - Sol - Do' (Harmoni ceria bergema)
        const notes = [
          { freq: 261.63, dur: 0.65 }, // C4
          { freq: 329.63, dur: 0.65 }, // E4
          { freq: 392.00, dur: 0.65 }, // G4
          { freq: 523.25, dur: 0.70 }, // C5
          { freq: 392.00, dur: 0.65 }, // G4
          { freq: 523.25, dur: 2.20 }, // C5
        ];

        let cursor = 0;
        notes.forEach((note) => {
          playBellNote(note.freq, now + cursor, 2.5, 0.46, 'joy');
          cursor += note.dur;
        });

        totalDuration = 5.8;
      } else if (type === 'tube_chime') {
        // Orchestral Tubular Bell Chime (Tabung Resonansi Hangat, 5.8 Detik)
        // 4 Warm tones: E4 -> G#4 -> B4 -> E5
        const notes = [
          { freq: 329.63, dur: 0.85 }, // E4
          { freq: 415.30, dur: 0.85 }, // G#4
          { freq: 493.88, dur: 0.85 }, // B4
          { freq: 659.25, dur: 2.60 }, // E5
        ];

        let cursor = 0;
        notes.forEach((note) => {
          playBellNote(note.freq, now + cursor, 2.8, 0.5, 'tube');
          cursor += note.dur;
        });

        totalDuration = 5.8;
      } else if (type === 'islamic_duo') {
        // Melodi Islami Syahdu Maqam (5 Nada Berwibawa, 6.2 Detik)
        // Notes: D4 -> F4 -> A4 -> G4 -> D5
        const notes = [
          { freq: 293.66, dur: 0.75 }, // D4
          { freq: 349.23, dur: 0.75 }, // F4
          { freq: 440.00, dur: 0.75 }, // A4
          { freq: 392.00, dur: 0.75 }, // G4
          { freq: 587.33, dur: 2.40 }, // D5
        ];

        let cursor = 0;
        notes.forEach((note) => {
          playBellNote(note.freq, now + cursor, 2.6, 0.45, 'islamic');
          cursor += note.dur;
        });

        totalDuration = 6.2;
      } else if (type === 'school_dismissal') {
        // Melodi Riang Pulang Sekolah (Siswa Senang, 6.2 Detik)
        // Joyful dismissal jingle fanfare
        const notes = [
          { freq: 392.00, dur: 0.48 }, // G4
          { freq: 523.25, dur: 0.48 }, // C5
          { freq: 659.25, dur: 0.48 }, // E5
          { freq: 783.99, dur: 0.75 }, // G5
          { freq: 698.46, dur: 0.48 }, // F5
          { freq: 659.25, dur: 0.48 }, // E5
          { freq: 587.33, dur: 0.48 }, // D5
          { freq: 523.25, dur: 2.30 }, // C5
        ];

        let cursor = 0;
        notes.forEach((note) => {
          playBellNote(note.freq, now + cursor, 2.5, 0.48, 'joy');
          cursor += note.dur;
        });

        totalDuration = 6.2;
      } else {
        // Fallback tone: 5-tone bell
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, idx) => {
          playBellNote(freq, now + idx * 0.7, 2.5, 0.45, 'bell');
        });
        totalDuration = 5.5;
      }

      const targetEndCtxTime = now + totalDuration;
      activeChimeTimeout = setInterval(() => {
        if (playbackState.isPaused) return;
        const currentCtxTime = ctx.currentTime;
        if (currentCtxTime >= targetEndCtxTime) {
          if (activeChimeTimeout) {
            clearInterval(activeChimeTimeout);
            activeChimeTimeout = null;
          }
          if (activeChimeGain === volNode) {
            try {
              volNode.disconnect();
            } catch {}
            activeChimeGain = null;
          }
          if (activeChimeResolve === resolve) {
            activeChimeResolve = null;
          }
          resolve();
        }
      }, 120);
    } catch (err) {
      console.error('Audio synth error:', err);
      activeChimeResolve = null;
      resolve();
    }
  });
}

// Helper to strictly filter out female browser/OS voices so male announcements never play a woman's voice
export function isMaleVoice(v: SpeechSynthesisVoice): boolean {
  const nameLower = v.name.toLowerCase();

  // Chrome/Google built-in Indonesian & US English voices are female unless explicitly labeled "male"
  if (nameLower.includes('google ') && !nameLower.includes(' male')) {
    return false;
  }

  const femaleKeywords = [
    'gadis', 'female', 'woman', 'wanita', 'perempuan', 'ustadzah',
    'damayanti', 'kalpana', 'heera', 'hoda', 'laila', 'mariam', 'sara',
    'libby', 'sonia', 'michelle', 'natasha', 'clara', 'moira', 'tessa',
    'cortana', 'zira', 'jenny', 'aria', 'samantha', 'victoria', 'kore',
    'aoede', 'zephyr', 'siti', 'dewi', 'putri', 'linda', 'susan', 'elena',
    'helena', 'hazel', 'catherine', 'karen', 'chiu', 'hui', 'ting', 'eva',
    'amy', 'emma', 'kate', 'joanna', 'kendra', 'kimberly', 'salli', 'ivy',
    'maya', 'nadia', 'salma', 'fatima', 'amira', 'noor', 'fiona', 'kyoko',
    'laura', 'lekha', 'luciana', 'melina', 'milena', 'monica', 'nora',
    'paulina', 'veena', 'yuna', 'zosia', 'zuzana',
  ];
  if (femaleKeywords.some((kw) => nameLower.includes(kw))) {
    return false;
  }
  return true;
}

/**
 * Get available speech synthesis voices from browser filtered exclusively to male/pria voices
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  const all = window.speechSynthesis.getVoices();
  return all.filter(isMaleVoice);
}

/**
 * Auto-detect best Indonesian male speech voice (e.g. Microsoft Ardi / Andika)
 */
export function getIndonesianVoice(): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (voices.length === 0) return null;

  // Search for Indonesian male voices first (Microsoft Ardi / Andika)
  const preferredMale = voices.find(
    (v) =>
      (v.lang.toLowerCase().includes('id') || v.name.toLowerCase().includes('indonesia')) &&
      (v.name.toLowerCase().includes('ardi') ||
        v.name.toLowerCase().includes('andika') ||
        v.name.toLowerCase().includes('male') ||
        v.name.toLowerCase().includes('pria'))
  );
  if (preferredMale) return preferredMale;

  // Any Indonesian or Malay non-female voice
  const idMaleVoice = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith('id') ||
      v.name.toLowerCase().includes('indonesia') ||
      v.lang.toLowerCase().startsWith('ms')
  );
  if (idMaleVoice) return idMaleVoice;

  return null;
}
// Global reference to prevent V8 garbage-collecting speech utterance before playback finishes in Chrome/Edge
let activeSpeechUtterance: SpeechSynthesisUtterance | null = null;

// Client-side cache for synthesized voice audio for instantaneous playback
const clientTtsCache = new Map<string, string>();
// Client-side cache for AI translations
const clientTranslateCache = new Map<string, string>();

// Track temporary AI TTS quota cooldown (60s) so transient 429 doesn't lock out AI TTS permanently
let aiTtsQuotaCooldownUntil = 0;

export function getIsAiTtsQuotaExceeded(): boolean {
  return Date.now() < aiTtsQuotaCooldownUntil;
}

export function resetAiTtsQuotaStatus(): void {
  aiTtsQuotaCooldownUntil = 0;
}

/**
 * Translate Indonesian announcement text into Arabic / English / Javanese using server-side Gemini AI
 */
export async function translateSpeechWithAI(
  text: string,
  targetLanguage: SpeechLanguage
): Promise<string | null> {
  if (!text || !text.trim()) return null;
  if (targetLanguage === 'id') return text.trim();

  const cacheKey = `${targetLanguage}:${text.trim()}`;
  if (clientTranslateCache.has(cacheKey)) {
    return clientTranslateCache.get(cacheKey)!;
  }

  // Check persistent offline localStorage translation cache
  const offlineTranslated = getTranslationOffline(targetLanguage, text);
  if (offlineTranslated) {
    clientTranslateCache.set(cacheKey, offlineTranslated);
    return offlineTranslated;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch('/api/voice/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          targetLanguage,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!res.ok) continue;

      const data = await res.json();
      if (data.status === 'success' && data.translatedText) {
        clientTranslateCache.set(cacheKey, data.translatedText);
        saveTranslationOffline(targetLanguage, text, data.translatedText);
        return data.translatedText;
      }
    } catch (_err) {
      // Retry once on transient timeout/network blip
    }
  }
  return null;
}

/**
 * Find best male browser voice for fallback by language
 */
function getFallbackVoiceByLanguage(language: SpeechLanguage = 'id'): {
  voice: SpeechSynthesisVoice | null;
  bcp47: string;
} {
  const voices = getAvailableVoices();
  if (language === 'ar') {
    const arVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ar'));
    return { voice: arVoice || null, bcp47: 'ar-SA' };
  }
  if (language === 'en') {
    const enVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('en') &&
          (v.name.toLowerCase().includes('male') ||
            v.name.toLowerCase().includes('david') ||
            v.name.toLowerCase().includes('mark') ||
            v.name.toLowerCase().includes('guy') ||
            v.name.toLowerCase().includes('ryan') ||
            v.name.toLowerCase().includes('george') ||
            v.name.toLowerCase().includes('daniel'))
      ) || voices.find((v) => v.lang.toLowerCase().startsWith('en'));
    return { voice: enVoice || null, bcp47: 'en-US' };
  }
  if (language === 'jv') {
    const jvVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('jv')) ||
      getIndonesianVoice();
    return { voice: jvVoice || null, bcp47: jvVoice?.lang || 'id-ID' };
  }
  const idVoice = getIndonesianVoice();
  return { voice: idVoice, bcp47: 'id-ID' };
}

/**
 * Text to Speech (TTS) reader with support for AI Cloned Voices & Multilingual AI (ID, AR, EN, JV)
 */
const VALID_GEMINI_VOICES = ['Fenrir', 'Charon', 'Puck', 'Kore', 'Zephyr'] as const;

export async function generateClonedTTSAudio(
  text: string,
  sampleAudioDataUrl?: string,
  voiceName = 'Fenrir', // Default authoritative male AI voice
  voiceDescription?: string,
  language: SpeechLanguage = 'id'
): Promise<string | null> {
  if (!text || !text.trim()) return null;

  const cacheKey = `${voiceName}:${language}:${text.trim()}`;
  if (clientTtsCache.has(cacheKey)) {
    return clientTtsCache.get(cacheKey)!;
  }

  // Check persistent CacheStorage offline audio cache so previously synthesized AI voices still work offline
  const persistentCacheUrl = buildTtsCacheKeyUrl(voiceName, language, text);
  const offlineCachedAudio = await getDataUrlAudioFromOfflineCache(persistentCacheUrl);
  if (offlineCachedAudio) {
    clientTtsCache.set(cacheKey, offlineCachedAudio);
    return offlineCachedAudio;
  }

  // When offline or in temporary 429 cooldown, skip slow network wait and use offline SpeechSynthesis immediately
  if ((typeof navigator !== 'undefined' && navigator.onLine === false) || getIsAiTtsQuotaExceeded()) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch('/api/voice/clone-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        sampleAudioDataUrl,
        voiceName,
        voiceDescription,
        language,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 429) {
        aiTtsQuotaCooldownUntil = Date.now() + 60000;
      }
      return null;
    }

    const data = await res.json();
    if (data.quotaExceeded || data.status === 'quota_exceeded') {
      aiTtsQuotaCooldownUntil = Date.now() + 60000;
      return null;
    }

    if (data.status === 'success' && data.audioDataUrl) {
      clientTtsCache.set(cacheKey, data.audioDataUrl);
      // Persist asynchronously in CacheStorage for offline use
      saveDataUrlAudioToOfflineCache(persistentCacheUrl, data.audioDataUrl);
      return data.audioDataUrl;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

/**
 * Text to Speech (TTS) reader — prioritizes natural human Male Gemini AI ('Fenrir')
 */
export async function speakTTS(
  text: string,
  settings: AudioSettings,
  overrideClonedVoiceId?: string,
  forceAiSpeech = false,
  language: SpeechLanguage = 'id'
): Promise<void> {
  if (!text || !text.trim()) {
    return;
  }

  const isMultilingualAi = language !== 'id';
  const useAutomaticAiVoice = !settings.voiceURI || forceAiSpeech || isMultilingualAi || !!overrideClonedVoiceId || settings.useClonedVoice;

  if (!forceAiSpeech && !isMultilingualAi && !overrideClonedVoiceId && settings.enableTTS === false) {
    return;
  }

  const targetVoiceId = overrideClonedVoiceId || (settings.useClonedVoice ? settings.activeClonedVoiceId : undefined);
  const activeProfile = settings.clonedProfiles?.find((p) => p.id === targetVoiceId);

  // Only use raw sample playback if NOT forcing AI speech/multilingual and profile is explicitly direct_recording
  if (!forceAiSpeech && !isMultilingualAi && targetVoiceId && activeProfile?.playbackMode === 'direct_recording' && activeProfile.sampleAudioUrl) {
    await playCustomAudio(activeProfile.sampleAudioUrl, settings.volume ?? 1.0);
    return;
  }

  // Attempt Gemini Human AI TTS generation first (defaults to Male 'Fenrir')
  if (useAutomaticAiVoice) {
    const directVoice = targetVoiceId && (VALID_GEMINI_VOICES as readonly string[]).includes(targetVoiceId)
      ? targetVoiceId
      : undefined;
    const voiceFallback = directVoice || activeProfile?.prebuiltVoiceFallback || 'Fenrir';
    const profileName = activeProfile?.name || targetVoiceId || "SD Qur'an Unggulan";

    try {
      const aiAudioUrl = await generateClonedTTSAudio(
        text,
        activeProfile?.sampleAudioUrl,
        voiceFallback,
        activeProfile?.description || profileName,
        language
      );

      if (aiAudioUrl) {
        const played = await playCustomAudio(aiAudioUrl, settings.volume ?? 1.0);
        if (played) return;
      }
    } catch (_err) {
      // Fallback smoothly to browser speech engine
    }
  }

  // Even if a fallback browser voiceURI is configured, prioritize pre-cached AI TTS audio from offline CacheStorage first
  if (!useAutomaticAiVoice && settings.enableTTS !== false) {
    try {
      const cachedAiUrl = await getDataUrlAudioFromOfflineCache(
        buildTtsCacheKeyUrl('Fenrir', language, text)
      );
      if (cachedAiUrl) {
        const played = await playCustomAudio(cachedAiUrl, settings.volume ?? 1.0);
        if (played) return;
      }
    } catch {
      // Fallback smoothly to browser speech engine below
    }
  }

  // Fallback to Web Speech API strictly favoring verified male voices
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      activeSpeechUtterance = utterance;

      let customRate = settings.rate || 0.95;
      let customPitch = settings.pitch ? Math.min(settings.pitch, 0.85) : 0.82;

      if (targetVoiceId && (activeProfile?.prebuiltVoiceFallback === 'Puck' || targetVoiceId === 'Puck')) {
        customPitch = 1.0;
        customRate = 1.0;
      }

      utterance.rate = customRate;
      utterance.pitch = customPitch;
      utterance.volume = settings.volume ?? 1.0;

      const maleVoices = getAvailableVoices();
      if (language !== 'id') {
        const { voice, bcp47 } = getFallbackVoiceByLanguage(language);
        utterance.lang = bcp47;
        if (voice) {
          utterance.voice = voice;
        } else {
          // No verified male voice for target lang on this OS: lower pitch
          utterance.pitch = 0.72;
        }
      } else {
        utterance.lang = 'id-ID';
        if (settings.voiceURI) {
          const chosenVoice = maleVoices.find((v) => v.voiceURI === settings.voiceURI);
          if (chosenVoice) {
            utterance.voice = chosenVoice;
          } else {
            const idVoice = getIndonesianVoice();
            if (idVoice) {
              utterance.voice = idVoice;
            } else {
              utterance.pitch = 0.65;
            }
          }
        } else {
          const idVoice = getIndonesianVoice();
          if (idVoice) {
            utterance.voice = idVoice;
          } else {
            utterance.pitch = 0.65;
          }
        }
      }

      let timeoutTimer: any = null;
      let finished = false;
      const finishHandler = () => {
        if (finished) return;
        finished = true;
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (activeSpeechAbort === finishHandler) activeSpeechAbort = null;
        activeSpeechUtterance = null;
        resolve();
      };

      activeSpeechAbort = finishHandler;
      utterance.onend = finishHandler;
      utterance.onerror = (err) => {
        console.warn('SpeechSynthesis error:', err);
        finishHandler();
      };

      const maxMs = Math.max(4000, text.length * 140);
      timeoutTimer = setTimeout(finishHandler, maxMs);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('TTS execution error:', err);
      resolve();
    }
  });
}

/**
 * Play custom recorded audio or uploaded audio file (AAC, M4A, 3GP, AMR, MP3, WAV, OGG)
 * Uses Web Audio API & Universal Audio Engine to guarantee playback across all browsers
 */
export async function playCustomAudio(dataUrl: string, volume = 1.0): Promise<boolean> {
  if (!dataUrl || !dataUrl.trim()) return false;

  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (success: boolean) => {
      if (done) return;
      done = true;
      resolve(success);
    };

    playUniversalAudio(dataUrl, volume, () => {
      finish(true);
    })
      .then(() => {
        // Playback initiated successfully
      })
      .catch((err) => {
        console.warn('Playback error caught in playCustomAudio:', err?.message || err);
        finish(false);
      });
  });
}

/**
 * Abortable & pause-aware sleep helper for sequence transitions
 */
function delaySequence(ms: number, seqId: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = ms;
    let lastTick = Date.now();
    const interval = setInterval(() => {
      if (seqId !== activeBellSequenceId) {
        clearInterval(interval);
        if (activeDelayAbort === abortFn) activeDelayAbort = null;
        resolve();
        return;
      }
      const now = Date.now();
      const dt = now - lastTick;
      lastTick = now;
      if (!playbackState.isPaused) {
        remaining -= dt;
      }
      if (remaining <= 0) {
        clearInterval(interval);
        if (activeDelayAbort === abortFn) activeDelayAbort = null;
        resolve();
      }
    }, 60);

    const abortFn = () => {
      clearInterval(interval);
      resolve();
    };
    activeDelayAbort = abortFn;
  });
}

/**
 * Pause-aware helper: if user hits Pause right at the boundary of finishing speech/chime,
 * wait until resumed or stopped before moving on.
 */
async function waitIfPaused(seqId: number): Promise<void> {
  while (playbackState.isPaused && seqId === activeBellSequenceId) {
    await new Promise((res) => setTimeout(res, 100));
  }
}

export interface PlayBellSequenceOptions {
  label?: string;
  scheduleId?: string;
  scheduleTime?: string;
  spokenTime?: string;
  skipTimeAnnouncement?: boolean;
  skipPostBellTracks?: boolean;
  fallbackMatchScheduleIds?: string[];
  fallbackMatchTimes?: string[];
}

/**
 * Standalone preview/playback for a Post-Bell Track with full global Pause/Resume/Stop support
 */
export async function playPostBellTrack(
  track: PostBellTrack,
  masterVolume = 1.0
): Promise<void> {
  stopAllBellAudio();
  const seqId = activeBellSequenceId;
  setBellPlaybackState({
    isPlaying: true,
    isPaused: false,
    label: track.name || 'Rekaman Tambahan Bel',
    scheduleId: null,
    postBellTrackId: track.id,
    phase: 'post_bell',
  });

  try {
    const vol = Math.max(0, Math.min(1, (track.volume ?? 1.0) * masterVolume));
    await playCustomAudio(track.audioUrl, vol);
  } finally {
    if (seqId === activeBellSequenceId) {
      setBellPlaybackState({
        isPlaying: false,
        isPaused: false,
        label: null,
        scheduleId: null,
        postBellTrackId: null,
        phase: 'idle',
      });
    }
  }
}

/**
 * Full sequence:
 * Step 1: Play Intro Bell Chime
 * Step 2: Play Custom Voice Recording (VO) / Cloned Voice / TTS Speech
 * Step 3: Play Outro / Closing Bell Chime (Optional or Configured)
 * Step 4: Play Matching Scheduled Post-Bell Recording (Optional, from Menu Nada Dering)
 */
export async function playBellSequence(
  chimeType: ChimeType,
  fullText: string,
  settings: AudioSettings,
  itemVolume = 1.0,
  customAudioUrl?: string,
  audioType: 'tts' | 'recording' | 'cloned' = 'tts',
  clonedVoiceId?: string,
  customChimeUrl?: string,
  enableOutroChime?: boolean,
  outroChimeType?: ChimeType | 'none' | 'same_as_intro',
  customOutroChimeUrl?: string,
  speechLanguage: SpeechLanguage = 'id',
  speechInputMode: SpeechInputMode = 'auto_translate',
  translatedSpeechText?: string,
  options?: PlayBellSequenceOptions
): Promise<void> {
  // Prevent double sound / overlapping: increment sequence token and stop ALL chimes, custom audio, and speech
  stopAllBellAudio();
  const seqId = ++activeBellSequenceId;

  const sequenceLabel = options?.label || 'Bel Sekolah';
  setBellPlaybackState({
    isPlaying: true,
    isPaused: false,
    label: sequenceLabel,
    scheduleId: options?.scheduleId || null,
    postBellTrackId: null,
    phase: 'chime',
  });

  try {
    const combinedVolume = (settings.chimeVolume ?? 1.0) * itemVolume;
    const speechVolume = (settings.volume ?? 1.0) * itemVolume;

    const actualChimeType =
      chimeType ||
      (settings.useCustomDefaultChime && settings.defaultChimeId ? settings.defaultChimeId : 'westminster');

    const targetVoiceId =
      clonedVoiceId || (settings.useClonedVoice ? settings.activeClonedVoiceId : undefined);
    const activeProfile = settings.clonedProfiles?.find((p) => p.id === targetVoiceId);
    const useMultilingualAi = speechLanguage !== 'id';
    const useStandardMaleAi = audioType === 'tts' && settings.enableTTS !== false;
    const shouldGenerateAiAudio = audioType === 'cloned' || useMultilingualAi || useStandardMaleAi;

    const realTimeHHMM =
      options?.spokenTime || format24HourTime(getSynchronizedDate(), false);
    const shouldAnnounceCurrentTime =
      !options?.skipTimeAnnouncement &&
      Boolean(options?.spokenTime || options?.scheduleTime);
    const timeAnnouncementText = shouldAnnounceCurrentTime
      ? formatSpokenIndonesianTime(realTimeHHMM)
      : '';
    const timeAnnouncementConfig = resolveTimeAnnouncementConfig(
      audioType,
      speechLanguage,
      settings,
      clonedVoiceId
    );

    // Resolve final spoken text and prefetch AI audio CONCURRENTLY while the intro chime rings
    let resolvedSpokenText = fullText;
    const prepareTextAndAudioPromise = (async (): Promise<{
      spokenText: string;
      aiAudioUrl: string | null;
    }> => {
      let textToSpeak = fullText;

      if (useMultilingualAi) {
        if (speechInputMode === 'direct_text') {
          textToSpeak = translatedSpeechText?.trim() || fullText;
        } else {
          if (translatedSpeechText && translatedSpeechText.trim()) {
            textToSpeak = translatedSpeechText.trim();
          } else if (fullText.trim()) {
            const translated = await translateSpeechWithAI(fullText, speechLanguage);
            if (translated) {
              textToSpeak = translated;
            }
          }
        }
      }

      resolvedSpokenText = textToSpeak;

      if (
        shouldGenerateAiAudio &&
        textToSpeak.trim().length > 0 &&
        !(
          audioType === 'cloned' &&
          !useMultilingualAi &&
          activeProfile?.playbackMode === 'direct_recording' &&
          activeProfile.sampleAudioUrl
        )
      ) {
        const voiceFallback =
          audioType === 'tts'
            ? 'Fenrir'
            : activeProfile?.prebuiltVoiceFallback || (targetVoiceId === 'Puck' ? 'Puck' : 'Fenrir');

        const audioUrl = await generateClonedTTSAudio(
          textToSpeak,
          undefined,
          voiceFallback,
          audioType === 'tts' ? 'Suara Pria AI' : activeProfile?.name,
          speechLanguage
        );
        return { spokenText: textToSpeak, aiAudioUrl: audioUrl };
      }

      return { spokenText: textToSpeak, aiAudioUrl: null };
    })();

    const prepareTimeAudioPromise = (async (): Promise<string | null> => {
      if (!timeAnnouncementText || !timeAnnouncementConfig.shouldAnnounceTime) {
        return null;
      }
      try {
        return await generateClonedTTSAudio(
          timeAnnouncementText,
          undefined,
          timeAnnouncementConfig.voiceName,
          timeAnnouncementConfig.voiceDescription,
          'id'
        );
      } catch {
        return null;
      }
    })();

    // Step 1: Play Intro Chime ONCE
    if (actualChimeType !== 'none') {
      await playChimeTone(actualChimeType, combinedVolume, settings.customChimes, customChimeUrl);
      await waitIfPaused(seqId);
      if (seqId !== activeBellSequenceId) return;
    }

    // Crisp, natural pause between chime and speech (250ms)
    await delaySequence(250, seqId);
    if (seqId !== activeBellSequenceId) return;

    const [prepared, preparedTimeAudioUrl] = await Promise.all([
      prepareTextAndAudioPromise,
      prepareTimeAudioPromise,
    ]);
    await waitIfPaused(seqId);
    if (seqId !== activeBellSequenceId) return;
    resolvedSpokenText = prepared.spokenText;

    setBellPlaybackState({ phase: 'speech' });

    // Announce current schedule time first ("Sekarang pukul ...") before reading the main announcement text
    if (timeAnnouncementText && timeAnnouncementConfig.shouldAnnounceTime) {
      let timePlayed = false;
      if (preparedTimeAudioUrl) {
        timePlayed = await playCustomAudio(preparedTimeAudioUrl, speechVolume);
        await waitIfPaused(seqId);
        if (seqId !== activeBellSequenceId) return;
      }
      if (!timePlayed && seqId === activeBellSequenceId) {
        await speakTTS(
          timeAnnouncementText,
          settings,
          timeAnnouncementConfig.voiceName,
          true,
          'id'
        );
        await waitIfPaused(seqId);
        if (seqId !== activeBellSequenceId) return;
      }

      await delaySequence(250, seqId);
      if (seqId !== activeBellSequenceId) return;
    }

    // Step 2: Play Voice (Direct Audio Recording, AI Cloned/Multilingual Voice, or Male AI TTS)
    if (audioType === 'recording' && customAudioUrl) {
      const repeatCount = Math.max(1, settings.repeatSpeechCount || 1);
      for (let i = 0; i < repeatCount; i++) {
        if (seqId !== activeBellSequenceId) return;
        await playCustomAudio(customAudioUrl, speechVolume);
        await waitIfPaused(seqId);
        if (seqId !== activeBellSequenceId) return;
        if (i < repeatCount - 1) {
          await delaySequence(500, seqId);
        }
      }
    } else if (
      audioType === 'cloned' &&
      !useMultilingualAi &&
      activeProfile?.playbackMode === 'direct_recording' &&
      activeProfile.sampleAudioUrl
    ) {
      const repeatCount = Math.max(1, settings.repeatSpeechCount || 1);
      for (let i = 0; i < repeatCount; i++) {
        if (seqId !== activeBellSequenceId) return;
        await playCustomAudio(activeProfile.sampleAudioUrl, speechVolume);
        await waitIfPaused(seqId);
        if (seqId !== activeBellSequenceId) return;
        if (i < repeatCount - 1) {
          await delaySequence(500, seqId);
        }
      }
    } else if (shouldGenerateAiAudio) {
      if (!useMultilingualAi && settings.useCustomPrefixAudio && settings.customPrefixAudioUrl) {
        await playCustomAudio(settings.customPrefixAudioUrl, speechVolume);
        await waitIfPaused(seqId);
        if (seqId !== activeBellSequenceId) return;
        await delaySequence(250, seqId);
        if (seqId !== activeBellSequenceId) return;
      }

      const aiAudioUrl = prepared.aiAudioUrl;
      let aiPlayed = false;

      if (aiAudioUrl) {
        const repeatCount = Math.max(1, settings.repeatSpeechCount || 1);
        for (let i = 0; i < repeatCount; i++) {
          if (seqId !== activeBellSequenceId) return;
          const ok = await playCustomAudio(aiAudioUrl, speechVolume);
          await waitIfPaused(seqId);
          if (seqId !== activeBellSequenceId) return;
          if (ok) aiPlayed = true;
          if (i < repeatCount - 1) {
            await delaySequence(500, seqId);
          }
        }
      }
      if (!aiPlayed && resolvedSpokenText.trim().length > 0 && seqId === activeBellSequenceId) {
        const fallbackVoiceId = audioType === 'tts' ? 'Fenrir' : targetVoiceId;
        await speakTTS(resolvedSpokenText, settings, fallbackVoiceId, true, speechLanguage);
        await waitIfPaused(seqId);
      }
    } else {
      if (settings.useCustomPrefixAudio && settings.customPrefixAudioUrl) {
        await playCustomAudio(settings.customPrefixAudioUrl, speechVolume);
        await waitIfPaused(seqId);
        if (seqId !== activeBellSequenceId) return;
        await delaySequence(250, seqId);
        if (seqId !== activeBellSequenceId) return;
      }

      if (settings.enableTTS && resolvedSpokenText.trim().length > 0) {
        const repeatCount = Math.max(1, settings.repeatSpeechCount || 1);
        for (let i = 0; i < repeatCount; i++) {
          if (seqId !== activeBellSequenceId) return;
          await speakTTS(resolvedSpokenText, settings, 'Fenrir', false, speechLanguage);
          await waitIfPaused(seqId);
          if (seqId !== activeBellSequenceId) return;
          if (i < repeatCount - 1) {
            await delaySequence(500, seqId);
          }
        }
      }
    }

    if (seqId !== activeBellSequenceId) return;

    // Step 3: Outro Chime
    const isOutroExplicitlyRequested =
      enableOutroChime === true && outroChimeType !== undefined && outroChimeType !== 'none';

    if (isOutroExplicitlyRequested) {
      setBellPlaybackState({ phase: 'outro' });
      const outroDelay = settings.outroChimeDelayMs ?? 400;
      await delaySequence(Math.max(150, outroDelay), seqId);
      if (seqId !== activeBellSequenceId) return;

      let targetOutroType: ChimeType = 'classic_3tone';
      let targetOutroCustomUrl = customOutroChimeUrl;

      if (customOutroChimeUrl) {
        targetOutroType = 'custom';
        targetOutroCustomUrl = customOutroChimeUrl;
      } else if (outroChimeType === 'same_as_intro') {
        targetOutroType = actualChimeType;
        targetOutroCustomUrl = customChimeUrl;
      } else if (outroChimeType && outroChimeType !== 'none') {
        targetOutroType = outroChimeType;
      }

      if (targetOutroType && targetOutroType !== 'none') {
        await playChimeTone(
          targetOutroType,
          combinedVolume,
          settings.customChimes,
          targetOutroCustomUrl
        );
        await waitIfPaused(seqId);
      }
    }

    if (seqId !== activeBellSequenceId) return;

    // Step 4: Scheduled Post-Bell Recording (Rekaman Tambahan Otomatis Setelah Bel)
    const isHolidaySilencedToday =
      Boolean(options?.scheduleId || options?.scheduleTime) &&
      evaluateDateHolidayStatus(getSynchronizedDate(), settings).isOff;

    if (
      !options?.skipPostBellTracks &&
      !isHolidaySilencedToday &&
      settings.postBellTracks &&
      settings.postBellTracks.length > 0
    ) {
      const matchingTracks = settings.postBellTracks.filter((track) => {
        if (!track.enabled || !track.audioUrl) return false;
        if (track.scheduleId === 'all') return true;
        if (options?.scheduleId && track.scheduleId === options.scheduleId) return true;
        if (options?.scheduleTime && track.scheduleTime === options.scheduleTime) return true;
        if (
          options?.fallbackMatchScheduleIds &&
          track.scheduleId &&
          options.fallbackMatchScheduleIds.includes(track.scheduleId)
        ) {
          return true;
        }
        if (
          options?.fallbackMatchTimes &&
          track.scheduleTime &&
          options.fallbackMatchTimes.includes(track.scheduleTime)
        ) {
          return true;
        }
        return false;
      });

      for (const track of matchingTracks) {
        if (seqId !== activeBellSequenceId) return;
        setBellPlaybackState({
          phase: 'post_bell',
          postBellTrackId: track.id,
          label: `${sequenceLabel} • ${track.name}`,
        });
        await delaySequence(450, seqId);
        if (seqId !== activeBellSequenceId) return;

        const trackVol = Math.max(0, Math.min(1, (track.volume ?? 1.0) * itemVolume));
        await playCustomAudio(track.audioUrl, trackVol);
        await waitIfPaused(seqId);
      }
    }
  } finally {
    if (seqId === activeBellSequenceId) {
      setBellPlaybackState({
        isPlaying: false,
        isPaused: false,
        label: null,
        scheduleId: null,
        postBellTrackId: null,
        phase: 'idle',
      });
    }
  }
}
