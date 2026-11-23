import { AudioSettings, MurottalConfig, ScheduleItem } from '../types';
import { DEFAULT_JUZ_30_TRACKS } from '../data/defaultMurottal';

export const OFFLINE_AUDIO_CACHE_NAME = 'sd-quran-offline-audio-v1';
const TRANSLATE_CACHE_STORAGE_KEY = 'sd_quran_ai_translate_cache_v1';

function isCacheApiAvailable(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Persistent translation cache in localStorage so multilingual bells keep their AI translation offline
 */
export function getTranslationOffline(lang: string, text: string): string | null {
  try {
    const raw = localStorage.getItem(TRANSLATE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[`${lang}:${text.trim()}`] || null;
  } catch {
    return null;
  }
}

export function saveTranslationOffline(lang: string, text: string, translatedText: string): void {
  try {
    const raw = localStorage.getItem(TRANSLATE_CACHE_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const key = `${lang}:${text.trim()}`;
    map[key] = translatedText;
    // Cap at ~250 entries so localStorage never bloats
    const keys = Object.keys(map);
    if (keys.length > 250) {
      for (let i = 0; i < keys.length - 250; i++) {
        delete map[keys[i]];
      }
    }
    localStorage.setItem(TRANSLATE_CACHE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota issues cleanly
  }
}

/**
 * Normalize an internal cache key URL (supports http(s):// URLs and virtual https://offline-tts.local/... keys)
 */
export function buildTtsCacheKeyUrl(voiceName: string, language: string, text: string): string {
  const hashSeed = `${voiceName}:${language}:${text.trim()}`;
  let hash = 2166136261;
  for (let i = 0; i < hashSeed.length; i++) {
    hash ^= hashSeed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `https://offline-tts.local/${encodeURIComponent(voiceName)}/${encodeURIComponent(language)}/${(hash >>> 0).toString(16)}`;
}

export async function saveDataUrlAudioToOfflineCache(
  keyUrl: string,
  dataUrl: string
): Promise<void> {
  if (!isCacheApiAvailable() || !dataUrl.startsWith('data:')) return;
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return;
    const header = dataUrl.slice(5, commaIdx);
    const mimeType = header.split(';')[0] || 'audio/wav';
    const base64 = dataUrl.slice(commaIdx + 1);
    const binary = atob(base64.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const resp = new Response(bytes.buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'X-Offline-Cached-At': String(Date.now()),
      },
    });
    await cache.put(keyUrl, resp);
  } catch {
    // Ignore cache write error
  }
}

export async function getDataUrlAudioFromOfflineCache(keyUrl: string): Promise<string | null> {
  if (!isCacheApiAvailable()) return null;
  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const match = await cache.match(keyUrl);
    if (!match) return null;
    const contentType = match.headers.get('content-type') || 'audio/wav';
    const buf = await match.arrayBuffer();
    if (!buf || buf.byteLength === 0) return null;
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export async function saveArrayBufferToOfflineCache(
  url: string,
  buffer: ArrayBuffer,
  contentType = 'audio/mpeg'
): Promise<void> {
  if (!isCacheApiAvailable() || !url.startsWith('http')) return;
  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const resp = new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Offline-Cached-At': String(Date.now()),
      },
    });
    await cache.put(url, resp);
  } catch {
    // Ignore quota/cache errors gracefully
  }
}

export async function getArrayBufferFromOfflineCache(url: string): Promise<ArrayBuffer | null> {
  if (!isCacheApiAvailable()) return null;
  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const match = await cache.match(url);
    if (!match) return null;
    const buf = await match.arrayBuffer();
    return buf && buf.byteLength > 0 ? buf : null;
  } catch {
    return null;
  }
}

export async function getBlobUrlFromOfflineCache(url: string): Promise<string | null> {
  if (!isCacheApiAvailable() || !url.startsWith('http')) return null;
  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const match = await cache.match(url);
    if (!match) return null;
    const blob = await match.blob();
    if (!blob || blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function fetchAndCacheExternalAudio(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  if (isCacheApiAvailable()) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      const existing = await cache.match(url);
      if (existing) return true;
    } catch {}
  }

  const isGoogleDrive =
    url.includes('drive.google.com') || url.includes('drive.usercontent.google.com');

  const tryStoreResponse = async (res: Response): Promise<boolean> => {
    if (!res.ok) return false;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      return false;
    }
    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength === 0) return false;
    await saveArrayBufferToOfflineCache(url, buf, contentType || 'audio/mpeg');
    return true;
  };

  if (!isGoogleDrive) {
    try {
      const directRes = await fetch(url);
      if (await tryStoreResponse(directRes)) return true;
    } catch {
      // Try proxy next
    }
  }

  try {
    const proxyRes = await fetch(`/api/audio/proxy?url=${encodeURIComponent(url)}`);
    if (await tryStoreResponse(proxyRes)) return true;
  } catch {
    // Offline or unreachable
  }

  return false;
}

export function collectExternalAudioUrls(
  schedules: ScheduleItem[],
  audioSettings: AudioSettings,
  murottalConfig: MurottalConfig
): { httpUrls: string[]; localCount: number } {
  const httpSet = new Set<string>();
  let localCount = 0;

  const inspectUrl = (u?: string) => {
    if (!u || !u.trim()) return;
    if (u.startsWith('http://') || u.startsWith('https://')) {
      httpSet.add(u);
    } else if (u.startsWith('data:') || u.startsWith('idb-audio://')) {
      localCount++;
    }
  };

  const inspectSchedules = (list?: ScheduleItem[]) => {
    if (!list) return;
    for (const s of list) {
      inspectUrl(s.customAudioUrl);
      inspectUrl(s.customChimeUrl);
      inspectUrl(s.customOutroChimeUrl);
    }
  };

  inspectSchedules(schedules);
  inspectSchedules(audioSettings.asasSchedules);

  audioSettings.customChimes?.forEach((c) => inspectUrl(c.audioUrl));
  audioSettings.postBellTracks?.forEach((t) => inspectUrl(t.audioUrl));
  audioSettings.clonedProfiles?.forEach((p) => inspectUrl(p.sampleAudioUrl));
  inspectUrl(audioSettings.customPrefixAudioUrl);
  inspectUrl(audioSettings.globalOutroChimeUrl);

  // Selected & scheduled Murottal tracks
  const trackMap = new Map(DEFAULT_JUZ_30_TRACKS.map((t) => [t.id, t.audioUrl]));
  if (murottalConfig.selectedTrackId) {
    inspectUrl(trackMap.get(murottalConfig.selectedTrackId));
  }
  murottalConfig.scheduleSlots?.forEach((slot) => {
    if (slot.enabled && slot.trackId) {
      inspectUrl(trackMap.get(slot.trackId));
    }
  });

  return { httpUrls: Array.from(httpSet), localCount };
}

export async function getOfflineCacheStats(
  schedules: ScheduleItem[],
  audioSettings: AudioSettings,
  murottalConfig: MurottalConfig
): Promise<{
  totalHttpUrls: number;
  cachedHttpUrls: number;
  localCount: number;
  cachedTtsCount: number;
}> {
  const { httpUrls, localCount } = collectExternalAudioUrls(
    schedules,
    audioSettings,
    murottalConfig
  );
  let cachedHttpUrls = 0;
  let cachedTtsCount = 0;

  if (isCacheApiAvailable()) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      const keys = await cache.keys();
      const keySet = new Set(keys.map((k) => k.url));
      for (const u of httpUrls) {
        if (keySet.has(u)) cachedHttpUrls++;
      }
      for (const req of keys) {
        if (req.url.startsWith('https://offline-tts.local/')) {
          cachedTtsCount++;
        }
      }
    } catch {
      // Ignore
    }
  }

  return {
    totalHttpUrls: httpUrls.length,
    cachedHttpUrls,
    localCount,
    cachedTtsCount,
  };
}

export async function cacheAllAppAudioForOffline(
  schedules: ScheduleItem[],
  audioSettings: AudioSettings,
  murottalConfig: MurottalConfig,
  onProgress?: (done: number, total: number, currentLabel: string) => void
): Promise<{ successCount: number; totalHttp: number; failedUrls: string[] }> {
  const { httpUrls } = collectExternalAudioUrls(schedules, audioSettings, murottalConfig);
  const failedUrls: string[] = [];
  let successCount = 0;

  for (let i = 0; i < httpUrls.length; i++) {
    const url = httpUrls[i];
    const shortName = decodeURIComponent(url.split('/').pop() || url).slice(0, 36);
    onProgress?.(i, httpUrls.length, shortName);
    const ok = await fetchAndCacheExternalAudio(url);
    if (ok) {
      successCount++;
    } else {
      failedUrls.push(url);
    }
    onProgress?.(i + 1, httpUrls.length, shortName);
  }

  return { successCount, totalHttp: httpUrls.length, failedUrls };
}
