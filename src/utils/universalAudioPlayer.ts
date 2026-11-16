/**
 * Universal Audio Player & Decoder with AudioContext / Web Audio API Fallback
 *
 * WHY THIS IS CRUCIAL:
 * 1. Raw AAC stream files (`.aac` / ADTS streams) from Android voice recorders often fail in `new Audio(dataUrl)`
 *    because Chromium/Firefox strict HTML5 <audio> element prefers MP4/M4A containers over raw ADTS AAC.
 * 2. Web Audio API's `AudioContext.decodeAudioData` successfully decodes raw AAC (ADTS), M4A, 3GP, AMR, MP3, WAV, etc.
 *    and plays them directly via Web Audio BufferSource without format rejection.
 * 3. Raw PCM (`audio/L16;codec=pcm;rate=24000`) from AI TTS is decoded directly into an AudioBuffer.
 * 4. Handles browser AudioContext unlocking / user interaction gesture policy cleanly.
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
 * Decode a base64 string into a Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/\s+/g, '');
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode headerless 16-bit signed little-endian PCM data URL (e.g. audio/L16;codec=pcm;rate=24000)
 */
function decodeRawPcmDataUrl(ctx: AudioContext, dataUrl: string): AudioBuffer | null {
  if (!dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;

  const header = dataUrl.substring(0, commaIdx).toLowerCase();
  if (!header.includes('audio/l16') && !header.includes('audio/pcm')) {
    return null;
  }

  const base64 = dataUrl.substring(commaIdx + 1);
  const bytes = base64ToUint8Array(base64);
  if (bytes.byteLength < 2) return null;

  const rateMatch = header.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
  const numSamples = Math.floor(bytes.byteLength / 2);

  const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // L16 in HTTP/MIME can sometimes be big-endian, though Gemini PCM is little-endian
  const isBigEndian = header.includes('endianness=big') || (header.includes('audio/l16') && !header.includes('codec=pcm'));

  for (let i = 0; i < numSamples; i++) {
    const sample = dataView.getInt16(i * 2, !isBigEndian);
    channelData[i] = sample / 32768;
  }

  return audioBuffer;
}

class AudioSourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioSourceValidationError';
  }
}

/**
 * Convert a base64, blob, or http(s) URL to an ArrayBuffer
 */
export async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    const isGoogleDrive =
      dataUrl.includes('drive.google.com') || dataUrl.includes('drive.usercontent.google.com');

    // For Google Drive, go straight through our proxy if available because Drive blocks browser CORS and uses redirects/HTML tokens
    if (!isGoogleDrive) {
      try {
        const res = await fetch(dataUrl);
        if (res.ok) {
          const contentType = (res.headers.get('content-type') || '').toLowerCase();
          if (contentType.includes('text/html')) {
            throw new AudioSourceValidationError('Link mengarah ke halaman web/HTML, bukan file audio langsung.');
          }
          return await res.arrayBuffer();
        }
      } catch (err) {
        if (err instanceof AudioSourceValidationError) throw err;
        // CORS or network error -> try server proxy below
      }
    }

    // Try server-side proxy endpoint (/api/audio/proxy)
    try {
      const proxyRes = await fetch(`/api/audio/proxy?url=${encodeURIComponent(dataUrl)}`);
      if (proxyRes.ok) {
        const contentType = (proxyRes.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json') || contentType.includes('text/html')) {
          throw new AudioSourceValidationError('Sumber tautan bukan berkas audio yang valid.');
        }
        return await proxyRes.arrayBuffer();
      }

      if (proxyRes.status === 400 || proxyRes.status === 403 || proxyRes.status === 413 || proxyRes.status === 422 || proxyRes.status === 502) {
        const errJson = await proxyRes.json().catch(() => null);
        throw new AudioSourceValidationError(
          errJson?.error || `Tautan audio tidak dapat dimuat (HTTP ${proxyRes.status}).`
        );
      }
    } catch (proxyErr) {
      if (proxyErr instanceof AudioSourceValidationError) throw proxyErr;
      // Proxy route unavailable (e.g., pure static hosting without server) -> fall through to HTML5 <audio>
    }

    throw new Error('Perlu fallback ke pemutar audio browser.');
  }

  if (dataUrl.startsWith('blob:')) {
    const res = await fetch(dataUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} saat memuat audio`);
    }
    return await res.arrayBuffer();
  }

  // Base64 Data URL
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index !== -1) {
    const base64 = dataUrl.substring(base64Index + 7);
    const bytes = base64ToUint8Array(base64);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  // Raw fetch fallback (e.g. relative /audio/... paths)
  const res = await fetch(dataUrl);
  if (!res.ok) {
    throw new Error(`Gagal memuat sumber audio (${res.status})`);
  }
  return await res.arrayBuffer();
}

/**
 * Stop any active audio playback (both HTMLAudio & Web Audio API)
 */
export function stopAllCustomAudio(): void {
  if (currentHtmlAudio) {
    try {
      currentHtmlAudio.onerror = null;
      currentHtmlAudio.onended = null;
      currentHtmlAudio.pause();
      currentHtmlAudio.removeAttribute('src');
      currentHtmlAudio.load();
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

  if (currentGainNode) {
    try {
      currentGainNode.disconnect();
    } catch {}
    currentGainNode = null;
  }
}

/**
 * Play audio file using Web Audio API with safe HTML5 Audio fallback.
 * Supports raw AAC (.aac/.acc), M4A, 3GP, MP3, WAV, OGG, raw PCM (L16), and cloud URLs.
 */
export async function playUniversalAudio(
  dataUrl: string,
  volume = 1.0,
  onEnded?: () => void
): Promise<() => void> {
  stopAllCustomAudio();

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.trim()) {
    onEnded?.();
    return () => {};
  }

  const trimmedUrl = dataUrl.trim();
  const safeVolume = Math.min(1.0, Math.max(0, volume));

  // Method 1: Web Audio API (Direct PCM or decodeAudioData)
  try {
    const ctx = getSharedAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    let decodedBuffer = decodeRawPcmDataUrl(ctx, trimmedUrl);
    if (!decodedBuffer) {
      const arrayBuffer = await dataUrlToArrayBuffer(trimmedUrl);
      if (arrayBuffer.byteLength === 0) {
        throw new AudioSourceValidationError('Berkas audio kosong (0 byte).');
      }
      decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(
          arrayBuffer.slice(0),
          (buf) => resolve(buf),
          (err) => reject(err || new Error('Format audio tidak dapat didekode oleh Web Audio API'))
        );
      });
    }

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
      if (currentGainNode === gainNode) {
        currentGainNode = null;
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
        try {
          gainNode.disconnect();
        } catch {}
        if (currentSourceNode === source) currentSourceNode = null;
        if (currentGainNode === gainNode) currentGainNode = null;
      }
    };
  } catch (webAudioErr: any) {
    // If validation already proved the URL is invalid/private HTML or 0-byte, do not feed it to HTML5 <audio>
    if (webAudioErr instanceof AudioSourceValidationError) {
      console.warn('Audio validation notice:', webAudioErr.message);
      onEnded?.();
      throw webAudioErr;
    }

    console.warn('Web Audio API decoding fallback to HTML5 Audio element:', webAudioErr?.message || webAudioErr);

    // Method 2: Safe Fallback to HTML5 Audio Element (useful for public MP3/WAV URLs without CORS)
    return new Promise((resolve, reject) => {
      let settled = false;

      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = safeVolume;
        currentHtmlAudio = audio;

        let stopped = false;
        const cleanup = () => {
          audio.onerror = null;
          audio.onended = null;
        };

        const stopFn = () => {
          if (stopped) return;
          stopped = true;
          cleanup();
          try {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
          } catch {}
          if (currentHtmlAudio === audio) {
            currentHtmlAudio = null;
          }
        };

        const failPlayback = (reason: string) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (currentHtmlAudio === audio) {
            currentHtmlAudio = null;
          }
          console.warn('HTML5 Audio playback unavailable:', reason);
          onEnded?.();
          reject(new Error(reason));
        };

        audio.onended = () => {
          cleanup();
          if (currentHtmlAudio === audio) {
            currentHtmlAudio = null;
          }
          onEnded?.();
        };

        audio.onerror = () => {
          const mediaErr = audio.error;
          const reason = mediaErr
            ? `Sumber audio tidak didukung atau gagal dimuat (kode ${mediaErr.code})`
            : 'Sumber audio tidak didukung atau gagal dimuat';
          failPlayback(reason);
        };

        audio.src = trimmedUrl;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (settled) return;
              settled = true;
              resolve(stopFn);
            })
            .catch((err) => {
              failPlayback(err?.message || 'Gagal memutar sumber audio');
            });
        } else {
          settled = true;
          resolve(stopFn);
        }
      } catch (err: any) {
        if (!settled) {
          settled = true;
          console.warn('All audio playback methods failed:', err?.message || err);
          onEnded?.();
          reject(err instanceof Error ? err : new Error('Gagal memutar audio'));
        }
      }
    });
  }
}
