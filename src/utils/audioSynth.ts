import { ChimeType, AudioSettings, CustomChime } from '../types';
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

      let totalDuration = 2.5;

      const playTone = (freq: number, startTime: number, duration: number, style: 'bell' | 'tube' | 'electric' = 'bell') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Harmonics for bell resonance
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        if (style === 'electric') {
          osc.type = 'sawtooth';
          osc2.type = 'square';
        } else if (style === 'tube') {
          osc.type = 'sine';
          osc2.type = 'triangle';
        } else {
          osc.type = 'sine';
          osc2.type = 'sine';
        }

        osc.frequency.setValueAtTime(freq, startTime);
        osc2.frequency.setValueAtTime(freq * 2.01, startTime); // Slight detune for bell shimmer

        // Envelope
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.35, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        gain2.gain.setValueAtTime(0, startTime);
        gain2.gain.linearRampToValueAtTime(0.12, startTime + 0.03);
        gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.7));

        osc.connect(gain);
        osc2.connect(gain2);
        gain.connect(volNode);
        gain2.connect(volNode);

        osc.start(startTime);
        osc2.start(startTime);
        osc.stop(startTime + duration + 0.1);
        osc2.stop(startTime + duration + 0.1);
      };

      if (type === 'westminster') {
        // Westminster chime 4 notes: E4 (329.63Hz), C4 (261.63Hz), D4 (293.66Hz), G3 (196.00Hz)
        const notes = [329.63, 261.63, 293.66, 196.00];
        const noteDuration = 0.55;
        notes.forEach((freq, idx) => {
          playTone(freq, now + idx * noteDuration, 1.8, 'bell');
        });
        totalDuration = notes.length * noteDuration + 0.8;
      } else if (type === 'classic_3tone') {
        // 3-tone ascending chime (Do-Mi-Sol: C4 261.63, E4 329.63, G4 392.00)
        const notes = [261.63, 329.63, 392.00];
        const noteDuration = 0.5;
        notes.forEach((freq, idx) => {
          playTone(freq, now + idx * noteDuration, 2.0, 'bell');
        });
        totalDuration = notes.length * noteDuration + 0.8;
      } else if (type === 'electric_bell') {
        // Ringing electric bell pulse
        const freq = 650;
        const ringCount = 12;
        for (let i = 0; i < ringCount; i++) {
          playTone(freq, now + i * 0.12, 0.25, 'electric');
        }
        totalDuration = ringCount * 0.12 + 0.5;
      } else if (type === 'tube_chime') {
        // Warm 2-tone tube chime (E4 -> B4)
        playTone(329.63, now, 2.2, 'tube');
        playTone(493.88, now + 0.6, 2.8, 'tube');
        totalDuration = 3.2;
      } else if (type === 'islamic_duo') {
        // Peaceful duo tone (A3 220Hz -> C#4 277.18Hz -> E4 329.63Hz)
        const notes = [220.00, 277.18, 329.63];
        notes.forEach((freq, idx) => {
          playTone(freq, now + idx * 0.6, 2.5, 'tube');
        });
        totalDuration = notes.length * 0.6 + 1.2;
      } else {
        // Fallback tone for unknown
        const notes = [261.63, 329.63, 392.00];
        notes.forEach((freq, idx) => {
          playTone(freq, now + idx * 0.5, 2.0, 'bell');
        });
        totalDuration = 2.5;
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

/**
 * Get available speech synthesis voices from browser
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Auto-detect best Indonesian speech voice
 */
export function getIndonesianVoice(): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (voices.length === 0) return null;

  // Search for id-ID or Indonesian name
  const idVoice = voices.find(
    (v) => v.lang.toLowerCase().includes('id') || v.name.toLowerCase().includes('indonesia')
  );
  if (idVoice) return idVoice;

  // Fallback to default
  return voices[0] || null;
}

/**
 * Text to Speech (TTS) reader with support for AI Cloned Voices
 */
export async function generateClonedTTSAudio(
  text: string,
  sampleAudioDataUrl?: string,
  voiceName?: string,
  voiceDescription?: string
): Promise<string | null> {
  try {
    const res = await fetch('/api/voice/clone-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        sampleAudioDataUrl,
        voiceName,
        voiceDescription,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.warn('AI Voice clone server response not OK:', errJson);
      return null;
    }

    const data = await res.json();
    if (data.status === 'success' && data.audioDataUrl) {
      return data.audioDataUrl;
    }
    return null;
  } catch (err) {
    console.warn('Failed to call AI voice clone API endpoint:', err);
    return null;
  }
}

/**
 * Text to Speech (TTS) reader
 */
export async function speakTTS(
  text: string,
  settings: AudioSettings,
  overrideClonedVoiceId?: string
): Promise<void> {
  if (!settings.enableTTS || !text.trim()) {
    return;
  }

  // Check if AI Voice Cloning is active or override voice ID provided
  const targetVoiceId = overrideClonedVoiceId || (settings.useClonedVoice ? settings.activeClonedVoiceId : undefined);
  const activeProfile = settings.clonedProfiles?.find((p) => p.id === targetVoiceId);

  if (targetVoiceId && activeProfile) {
    try {
      const aiAudioUrl = await generateClonedTTSAudio(
        text,
        activeProfile.sampleAudioUrl,
        activeProfile.prebuiltVoiceFallback || 'Kore',
        activeProfile.description || activeProfile.name
      );

      if (aiAudioUrl) {
        await playCustomAudio(aiAudioUrl, settings.volume || 1.0);
        return;
      }
    } catch (err) {
      console.warn('AI Cloned voice playback failed, falling back to Web Speech API:', err);
    }
  }

  // Fallback to Web Speech API
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any current speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.rate || 0.95;
      utterance.pitch = settings.pitch || 1.0;
      utterance.volume = settings.volume || 1.0;

      const voices = getAvailableVoices();
      if (settings.voiceURI) {
        const chosenVoice = voices.find((v) => v.voiceURI === settings.voiceURI);
        if (chosenVoice) utterance.voice = chosenVoice;
      } else {
        const idVoice = getIndonesianVoice();
        if (idVoice) utterance.voice = idVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (err) => {
        console.warn('SpeechSynthesis error:', err);
        resolve();
      };

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
export async function playCustomAudio(dataUrl: string, volume = 1.0): Promise<void> {
  if (!dataUrl) return;

  return new Promise<void>((resolve) => {
    playUniversalAudio(dataUrl, volume, () => {
      resolve();
    })
      .then(() => {
        // Playback initiated successfully
      })
      .catch((err) => {
        console.warn('Playback error caught in playCustomAudio:', err);
        resolve();
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
  customOutroChimeUrl?: string
): Promise<void> {
  const combinedVolume = (settings.chimeVolume ?? 1.0) * itemVolume;

  // Resolve actual intro chime type to use:
  let actualChimeType = chimeType;
  if (!customChimeUrl && settings.useCustomDefaultChime && settings.defaultChimeId && (chimeType === 'westminster' || !chimeType)) {
    actualChimeType = settings.defaultChimeId;
  }

  // Step 1: Play Intro Chime
  if (actualChimeType !== 'none') {
    await playChimeTone(actualChimeType, combinedVolume, settings.customChimes, customChimeUrl);
  }

  // Small delay before speech or recorded audio
  await new Promise((res) => setTimeout(res, 350));

  // Step 2: Play Custom Voice Recording (VO), Cloned Voice, or Speak TTS Text
  const speechVolume = (settings.volume ?? 1.0) * itemVolume;

  if (audioType === 'recording' && customAudioUrl) {
    // Play custom VO recording
    const repeatCount = Math.max(1, settings.repeatSpeechCount || 1);
    for (let i = 0; i < repeatCount; i++) {
      await playCustomAudio(customAudioUrl, speechVolume);
      if (i < repeatCount - 1) {
        await new Promise((res) => setTimeout(res, 600));
      }
    }
  } else if (audioType === 'cloned') {
    // Play optional custom prefix audio first if enabled
    if (settings.useCustomPrefixAudio && settings.customPrefixAudioUrl) {
      await playCustomAudio(settings.customPrefixAudioUrl, speechVolume);
      await new Promise((res) => setTimeout(res, 300));
    }

    const repeatCount = Math.max(1, settings.repeatSpeechCount || 1);
    for (let i = 0; i < repeatCount; i++) {
      await speakTTS(fullText, settings, clonedVoiceId || settings.activeClonedVoiceId);
      if (i < repeatCount - 1) {
        await new Promise((res) => setTimeout(res, 600));
      }
    }
  } else {
    // Play optional custom prefix audio first if enabled
    if (settings.useCustomPrefixAudio && settings.customPrefixAudioUrl) {
      await playCustomAudio(settings.customPrefixAudioUrl, speechVolume);
      await new Promise((res) => setTimeout(res, 300));
    }

    // Speak TTS
    if (settings.enableTTS && fullText.trim().length > 0) {
      const repeatCount = Math.max(1, settings.repeatSpeechCount || 1);
      for (let i = 0; i < repeatCount; i++) {
        await speakTTS(fullText, settings);
        if (i < repeatCount - 1) {
          await new Promise((res) => setTimeout(res, 600));
        }
      }
    }
  }

  // Step 3: Play Outro / Closing Chime after Voice Recording / VO is finished
  const shouldPlayOutro =
    enableOutroChime === true ||
    (enableOutroChime !== false &&
      (outroChimeType !== undefined && outroChimeType !== 'none') ||
      (enableOutroChime === undefined && settings.enableGlobalOutroChime === true));

  if (shouldPlayOutro) {
    // Wait brief pause before outro chime
    const outroDelay = settings.outroChimeDelayMs ?? 500;
    await new Promise((res) => setTimeout(res, Math.max(150, outroDelay)));

    // Resolve which chime to play as outro
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
    } else if (settings.enableGlobalOutroChime) {
      if (settings.globalOutroChimeUrl) {
        targetOutroType = 'custom';
        targetOutroCustomUrl = settings.globalOutroChimeUrl;
      } else if (settings.globalOutroChimeType === 'same_as_intro') {
        targetOutroType = actualChimeType;
        targetOutroCustomUrl = customChimeUrl;
      } else if (settings.globalOutroChimeType && settings.globalOutroChimeType !== 'none') {
        targetOutroType = settings.globalOutroChimeType;
      }
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
