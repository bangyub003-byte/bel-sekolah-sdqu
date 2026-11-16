import { ChimeType, AudioSettings, CustomChime, SpeechLanguage, SpeechInputMode } from '../types';
import { playUniversalAudio, stopAllCustomAudio } from './universalAudioPlayer';

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
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

      setTimeout(() => {
        resolve();
      }, totalDuration * 1000);
    } catch (err) {
      console.error('Audio synth error:', err);
      resolve();
    }
  });
}

// Helper to identify male voices and strictly filter out female voices
export function isMaleVoice(v: SpeechSynthesisVoice): boolean {
  const nameLower = v.name.toLowerCase();
  const femaleKeywords = [
    'gadis', 'female', 'woman', 'zira', 'jenny', 'aria', 'samantha', 'victoria',
    'kore', 'aoede', 'siti', 'dewi', 'putri', 'linda', 'susan', 'elena', 'helena',
    'hazel', 'catherine', 'karen', 'chiu', 'hui', 'ting', 'wanita', 'perempuan',
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
  const males = all.filter(isMaleVoice);
  return males.length > 0 ? males : all;
}

/**
 * Auto-detect best Indonesian male speech voice (e.g. Microsoft Andika or masculine deep tone)
 */
export function getIndonesianVoice(): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (voices.length === 0) return null;

  // Search for Indonesian male voice first (e.g. Microsoft Andika)
  const andikaVoice = voices.find(
    (v) =>
      (v.lang.toLowerCase().includes('id') || v.name.toLowerCase().includes('indonesia')) &&
      v.name.toLowerCase().includes('andika')
  );
  if (andikaVoice) return andikaVoice;

  // Search for any Indonesian voice identified as male
  const idMaleVoice = voices.find(
    (v) =>
      (v.lang.toLowerCase().includes('id') || v.name.toLowerCase().includes('indonesia')) &&
      isMaleVoice(v)
  );
  if (idMaleVoice) return idMaleVoice;

  // Fallback to Indonesian voice with male pitch
  const idVoice = voices.find(
    (v) => v.lang.toLowerCase().includes('id') || v.name.toLowerCase().includes('indonesia')
  );
  if (idVoice) return idVoice;

  // Fallback to first available male voice
  return voices[0] || null;
}
// Global reference to prevent V8 garbage-collecting speech utterance before playback finishes in Chrome/Edge
let activeSpeechUtterance: SpeechSynthesisUtterance | null = null;

// Client-side cache for synthesized voice audio for instantaneous playback
const clientTtsCache = new Map<string, string>();
// Client-side cache for AI translations
const clientTranslateCache = new Map<string, string>();

// Track if AI TTS quota is exhausted so the client instantly falls back to local speech without latency
let isAiTtsQuotaExceeded = false;

export function getIsAiTtsQuotaExceeded(): boolean {
  return isAiTtsQuotaExceeded;
}

export function resetAiTtsQuotaStatus(): void {
  isAiTtsQuotaExceeded = false;
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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

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
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === 'success' && data.translatedText) {
      clientTranslateCache.set(cacheKey, data.translatedText);
      return data.translatedText;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

/**
 * Find best browser voice for fallback by language
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
      voices.find((v) => v.lang.toLowerCase().startsWith('en') && isMaleVoice(v)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en'));
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

  // If daily Free Tier quota limit was reached, instantly return null to use local engine
  if (isAiTtsQuotaExceeded) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7500);

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
        isAiTtsQuotaExceeded = true;
      }
      return null;
    }

    const data = await res.json();
    if (data.quotaExceeded || data.status === 'quota_exceeded') {
      isAiTtsQuotaExceeded = true;
      return null;
    }

    if (data.status === 'success' && data.audioDataUrl) {
      clientTtsCache.set(cacheKey, data.audioDataUrl);
      return data.audioDataUrl;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

/**
 * Text to Speech (TTS) reader
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
  const isCloningRequested = forceAiSpeech || isMultilingualAi || !!overrideClonedVoiceId || settings.useClonedVoice;

  // Standard TTS is blocked if enableTTS is explicitly turned off and no cloning/multilingual AI is requested
  if (!isCloningRequested && settings.enableTTS === false) {
    return;
  }

  // Check if AI Voice Cloning is active or override voice ID provided
  const targetVoiceId = overrideClonedVoiceId || (settings.useClonedVoice ? settings.activeClonedVoiceId : undefined);
  const activeProfile = settings.clonedProfiles?.find((p) => p.id === targetVoiceId);

  // Only use raw sample playback if NOT forcing AI speech/multilingual and profile is explicitly direct_recording
  if (!forceAiSpeech && !isMultilingualAi && isCloningRequested && activeProfile?.playbackMode === 'direct_recording' && activeProfile.sampleAudioUrl) {
    await playCustomAudio(activeProfile.sampleAudioUrl, settings.volume ?? 1.0);
    return;
  }

  // Attempt AI TTS generation first when cloned/multilingual/AI speech is requested
  if (isCloningRequested) {
    const voiceFallback = activeProfile?.prebuiltVoiceFallback || (targetVoiceId === 'Puck' ? 'Puck' : 'Fenrir');
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

  // Fallback to Web Speech API with tailored pitch, rate, and language
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
      let customPitch = settings.pitch ? Math.min(settings.pitch, 0.88) : 0.84;

      if (isCloningRequested) {
        const nameLower = (activeProfile?.name || targetVoiceId || '').toLowerCase();
        if (nameLower.includes('murid') || nameLower.includes('anak') || nameLower.includes('santri') || activeProfile?.prebuiltVoiceFallback === 'Puck') {
          customPitch = 1.05;
          customRate = 1.0;
        } else {
          customPitch = 0.82;
          customRate = 0.92;
        }
      }

      utterance.rate = customRate;
      utterance.pitch = customPitch;
      utterance.volume = settings.volume ?? 1.0;

      if (language !== 'id') {
        const { voice, bcp47 } = getFallbackVoiceByLanguage(language);
        utterance.lang = bcp47;
        if (voice) utterance.voice = voice;
      } else {
        utterance.lang = 'id-ID';
        const voices = getAvailableVoices();
        if (settings.voiceURI) {
          const chosenVoice = voices.find((v) => v.voiceURI === settings.voiceURI);
          if (chosenVoice) utterance.voice = chosenVoice;
        } else {
          const idVoice = getIndonesianVoice();
          if (idVoice) utterance.voice = idVoice;
        }
      }

      let timeoutTimer: any = null;
      const finishHandler = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        activeSpeechUtterance = null;
        resolve();
      };

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
 * Full sequence:
 * Step 1: Play Intro Bell Chime
 * Step 2: Play Custom Voice Recording (VO) / Cloned Voice / TTS Speech
 * Step 3: Play Outro / Closing Bell Chime (Optional or Configured)
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
  translatedSpeechText?: string
): Promise<void> {
  // Prevent double sound / overlapping: Stop previous custom audio and cancel any running speech
  stopAllCustomAudio();
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  const combinedVolume = (settings.chimeVolume ?? 1.0) * itemVolume;
  const speechVolume = (settings.volume ?? 1.0) * itemVolume;

  const actualChimeType = chimeType || (settings.useCustomDefaultChime && settings.defaultChimeId ? settings.defaultChimeId : 'westminster');

  const targetVoiceId = clonedVoiceId || (settings.useClonedVoice ? settings.activeClonedVoiceId : undefined);
  const activeProfile = settings.clonedProfiles?.find((p) => p.id === targetVoiceId);
  const useMultilingualAi = speechLanguage !== 'id';

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
        // auto_translate mode: use pre-translated text if available, otherwise translate from Indonesian on the fly
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

    if ((audioType === 'cloned' || useMultilingualAi) && textToSpeak.trim().length > 0) {
      const voiceFallback = activeProfile?.prebuiltVoiceFallback || (targetVoiceId === 'Puck' ? 'Puck' : 'Fenrir');
      const audioUrl = await generateClonedTTSAudio(
        textToSpeak,
        undefined,
        voiceFallback,
        activeProfile?.name,
        speechLanguage
      );
      return { spokenText: textToSpeak, aiAudioUrl: audioUrl };
    }

    return { spokenText: textToSpeak, aiAudioUrl: null };
  })();

  // Step 1: Play Intro Chime ONCE
  if (actualChimeType !== 'none') {
    await playChimeTone(actualChimeType, combinedVolume, settings.customChimes, customChimeUrl);
  }

  // Crisp, natural pause between chime and speech (250ms)
  await new Promise((res) => setTimeout(res, 250));

  const prepared = await prepareTextAndAudioPromise;
  resolvedSpokenText = prepared.spokenText;

  // Step 2: Play Voice (Direct Audio Recording, AI Cloned/Multilingual Voice, or TTS)
  if (audioType === 'recording' && customAudioUrl) {
    const repeatCount = Math.max(1, settings.repeatSpeechCount || 1);
    for (let i = 0; i < repeatCount; i++) {
      await playCustomAudio(customAudioUrl, speechVolume);
      if (i < repeatCount - 1) {
        await new Promise((res) => setTimeout(res, 500));
      }
    }
  } else if (audioType === 'cloned' || useMultilingualAi) {
    if (!useMultilingualAi && settings.useCustomPrefixAudio && settings.customPrefixAudioUrl) {
      await playCustomAudio(settings.customPrefixAudioUrl, speechVolume);
      await new Promise((res) => setTimeout(res, 250));
    }

    const aiAudioUrl = prepared.aiAudioUrl;
    let aiPlayed = false;

    if (aiAudioUrl) {
      const repeatCount = Math.max(1, settings.repeatSpeechCount || 1);
      for (let i = 0; i < repeatCount; i++) {
        const ok = await playCustomAudio(aiAudioUrl, speechVolume);
        if (ok) aiPlayed = true;
        if (i < repeatCount - 1) {
          await new Promise((res) => setTimeout(res, 500));
        }
      }
    }
    if (!aiPlayed) {
      await speakTTS(resolvedSpokenText, settings, targetVoiceId, true, speechLanguage);
    }
  } else {
    if (settings.useCustomPrefixAudio && settings.customPrefixAudioUrl) {
      await playCustomAudio(settings.customPrefixAudioUrl, speechVolume);
      await new Promise((res) => setTimeout(res, 250));
    }

    if (settings.enableTTS && resolvedSpokenText.trim().length > 0) {
      const repeatCount = Math.max(1, settings.repeatSpeechCount || 1);
      for (let i = 0; i < repeatCount; i++) {
        await speakTTS(resolvedSpokenText, settings, undefined, false, speechLanguage);
        if (i < repeatCount - 1) {
          await new Promise((res) => setTimeout(res, 500));
        }
      }
    }
  }

  // Step 3: Outro Chime
  const isOutroExplicitlyRequested =
    enableOutroChime === true &&
    outroChimeType !== undefined &&
    outroChimeType !== 'none';

  if (isOutroExplicitlyRequested) {
    const outroDelay = settings.outroChimeDelayMs ?? 400;
    await new Promise((res) => setTimeout(res, Math.max(150, outroDelay)));

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
    }
  }
}
