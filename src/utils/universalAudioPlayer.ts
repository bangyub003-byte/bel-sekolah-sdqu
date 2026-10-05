/**
 * Universal Audio Player & Decoder with AudioContext / Web Audio API Fallback
 * 
 * WHY THIS IS CRUCIAL:
 * 1. Raw AAC stream files (`.aac` / ADTS streams) from Android voice recorders often fail in `new Audio(dataUrl)`
 *    because Chromium/Firefox strict HTML5 <audio> element prefers MP4/M4A containers over raw ADTS AAC.
 * 2. Web Audio API's `AudioContext.decodeAudioData` successfully decodes raw AAC (ADTS), M4A, 3GP, AMR, MP3, WAV, etc.
 *    and plays them directly via Web Audio BufferSource without format rejection.
 * 3. Handles browser AudioContext unlocking / user interaction gesture policy.
 */

let sharedAudioCtx: AudioContext | null = null;
let currentSourceNode: AudioBufferSourceNode | null = null;
let currentGainNode: GainNode | null = null;
let currentHtmlAudio: HTMLAudioElement | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Convert a base64 or data URL to an ArrayBuffer
 */
export async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  // If it's a blob URL or http URL
  if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http')) {
    const res = await fetch(dataUrl);
    return await res.arrayBuffer();
  }

  // Base64 Data URL
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index !== -1) {
    const base64 = dataUrl.substring(base64Index + 7);
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Raw fetch fallback
  const res = await fetch(dataUrl);
  return await res.arrayBuffer();
}

/**
 * Stop any active audio playback (both HTMLAudio & Web Audio API)
 */
export function stopAllCustomAudio(): void {
  if (currentHtmlAudio) {
    try {
      currentHtmlAudio.pause();
      currentHtmlAudio.currentTime = 0;
    } catch {}
    currentHtmlAudio = null;
  }

  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
      currentSourceNode.disconnect();
    } catch {}
    currentSourceNode = null;
  }
}

/**
 * Play audio file using HTML5 Audio with automatic fallback to Web Audio API (decodeAudioData).
 * This ensures Android AAC (.acc/.aac), M4A, 3GP, and all mobile voice recordings play reliably without error.
 */
export async function playUniversalAudio(
  dataUrl: string,
  volume = 1.0,
  onEnded?: () => void
): Promise<() => void> {
  stopAllCustomAudio();

  const safeVolume = Math.min(1.0, Math.max(0, volume));

  // Try Method 1: Web Audio API (Direct PCM/AAC Decoding - Most robust for raw AAC & mobile recordings)
  try {
    const ctx = getSharedAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const arrayBuffer = await dataUrlToArrayBuffer(dataUrl);
    // decodeAudioData consumes the buffer, so slice a copy to be safe
    const decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      ctx.decodeAudioData(
        arrayBuffer.slice(0),
        (buf) => resolve(buf),
        (err) => reject(err)
      );
    });

    const source = ctx.createBufferSource();
    source.buffer = decodedBuffer;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(safeVolume, ctx.currentTime);

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    currentSourceNode = source;
    currentGainNode = gainNode;

    let isFinished = false;
    const finishHandler = () => {
      if (isFinished) return;
      isFinished = true;
      if (currentSourceNode === source) {
        currentSourceNode = null;
      }
      onEnded?.();
    };

    source.onended = finishHandler;
    source.start(0);

    return () => {
      if (!isFinished) {
        isFinished = true;
        try {
          source.stop();
          source.disconnect();
        } catch {}
      }
    };
  } catch (webAudioErr) {
    console.warn('Web Audio API decoding fallback to HTML5 Audio element:', webAudioErr);

    // Method 2: Fallback to HTML5 Audio Element
    return new Promise((resolve) => {
      try {
        const audio = new Audio();
        audio.src = dataUrl;
        audio.volume = safeVolume;
        currentHtmlAudio = audio;

        let stopped = false;
        const stopFn = () => {
          if (stopped) return;
          stopped = true;
          audio.pause();
          audio.currentTime = 0;
          currentHtmlAudio = null;
        };

        audio.onended = () => {
          currentHtmlAudio = null;
          onEnded?.();
        };

        audio.onerror = (e) => {
          console.error('HTML5 Audio fallback error:', e);
          currentHtmlAudio = null;
          onEnded?.();
        };

        audio
          .play()
          .then(() => resolve(stopFn))
          .catch((err) => {
            console.error('HTML5 Audio play failed:', err);
            currentHtmlAudio = null;
            onEnded?.();
            resolve(stopFn);
          });
      } catch (err) {
        console.error('All audio playback methods failed:', err);
        onEnded?.();
        resolve(() => {});
      }
    });
  }
}
