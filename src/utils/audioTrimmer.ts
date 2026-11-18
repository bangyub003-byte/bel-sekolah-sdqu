import { getAudioContext } from './audioSynth';

/**
 * Fetch and decode any audio source (Base64 data URL, Blob URL, Cloudinary URL, or Drive proxy link)
 * into a Web Audio API AudioBuffer for sample-accurate trimming.
 */
export async function decodeAudioBufferFromUrl(audioUrl: string): Promise<AudioBuffer> {
  if (!audioUrl || !audioUrl.trim()) {
    throw new Error('Sumber audio kosong.');
  }

  let arrayBuffer: ArrayBuffer;

  if (audioUrl.startsWith('data:') || audioUrl.startsWith('blob:')) {
    const res = await fetch(audioUrl);
    if (!res.ok) {
      throw new Error('Gagal membaca data audio lokal.');
    }
    arrayBuffer = await res.arrayBuffer();
  } else {
    const isGoogleDrive =
      audioUrl.includes('drive.google.com') || audioUrl.includes('googleusercontent.com');
    const tryFetch = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.arrayBuffer();
    };

    if (isGoogleDrive) {
      arrayBuffer = await tryFetch(`/api/audio/proxy?url=${encodeURIComponent(audioUrl)}`);
    } else {
      try {
        arrayBuffer = await tryFetch(audioUrl);
      } catch {
        arrayBuffer = await tryFetch(`/api/audio/proxy?url=${encodeURIComponent(audioUrl)}`);
      }
    }
  }

  const ctx = getAudioContext();
  // Clone buffer because some browsers detach the underlying ArrayBuffer during decodeAudioData
  return ctx.decodeAudioData(arrayBuffer.slice(0));
}

/**
 * Compute normalized peak waveform bars (0..1) from channel data for UI visualization
 */
export function extractWaveformPeaks(buffer: AudioBuffer, barCount = 120): number[] {
  const channelData = buffer.getChannelData(0);
  const totalSamples = channelData.length;
  const blockSize = Math.max(1, Math.floor(totalSamples / barCount));
  const peaks: number[] = [];
  let maxPeak = 0.001;

  for (let i = 0; i < barCount; i++) {
    const start = i * blockSize;
    const end = Math.min(totalSamples, start + blockSize);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > peak) peak = abs;
    }
    if (peak > maxPeak) maxPeak = peak;
    peaks.push(peak);
  }

  return peaks.map((p) => Math.max(0.06, Math.min(1, p / maxPeak)));
}

/**
 * Encode a mono/stereo AudioBuffer to a standard 16-bit PCM WAV Blob
 */
function encodeAudioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Trim an AudioBuffer between startSec and endSec with optional smooth fade-in and fade-out,
 * outputting a compact 24kHz mono WAV Blob ready for playback & storage.
 */
export async function trimAudioBufferToWavBlob(
  sourceBuffer: AudioBuffer,
  startSec: number,
  endSec: number,
  fadeOutSec = 0.5,
  fadeInSec = 0.04
): Promise<Blob> {
  const safeStart = Math.max(0, Math.min(startSec, sourceBuffer.duration - 0.1));
  const safeEnd = Math.max(safeStart + 0.1, Math.min(endSec, sourceBuffer.duration));
  const duration = safeEnd - safeStart;

  const targetSampleRate = Math.min(24000, sourceBuffer.sampleRate);
  const frameCount = Math.max(1, Math.ceil(duration * targetSampleRate));

  const offlineCtx = new OfflineAudioContext(1, frameCount, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;

  const gainNode = offlineCtx.createGain();
  const actualFadeIn = Math.min(fadeInSec, duration * 0.25);
  const actualFadeOut = Math.min(fadeOutSec, duration * 0.45);

  if (actualFadeIn > 0.005) {
    gainNode.gain.setValueAtTime(0.001, 0);
    gainNode.gain.linearRampToValueAtTime(1.0, actualFadeIn);
  } else {
    gainNode.gain.setValueAtTime(1.0, 0);
  }

  if (actualFadeOut > 0.01 && duration > actualFadeOut) {
    const fadeStart = duration - actualFadeOut;
    gainNode.gain.setValueAtTime(1.0, fadeStart);
    gainNode.gain.linearRampToValueAtTime(0.0001, duration);
  }

  source.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  source.start(0, safeStart, duration);

  const renderedBuffer = await offlineCtx.startRendering();
  return encodeAudioBufferToWavBlob(renderedBuffer);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal mengonversi audio potongan.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca hasil potongan audio.'));
    reader.readAsDataURL(blob);
  });
}
