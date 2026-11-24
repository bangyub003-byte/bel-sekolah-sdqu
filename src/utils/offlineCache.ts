import { AudioSettings, MurottalConfig, MurottalTrack, ScheduleItem, SpeechLanguage } from '../types';
import { DEFAULT_JUZ_30_TRACKS } from '../data/defaultMurottal';
import { DEFAULT_ASAS_SCHEDULES } from '../data/asasSchedule';
import { buildFridayEarlyDismissalSchedule } from './fridaySchedule';
import { getCustomMurottalTracks } from './murottalStorage';

export const OFFLINE_AUDIO_CACHE_NAME = 'sd-quran-offline-audio-v1';
const TRANSLATE_CACHE_STORAGE_KEY = 'sd_quran_ai_translate_cache_v1';
const OFFLINE_URL_IDB_NAME = 'sd_quran_offline_url_audio_store';
const OFFLINE_URL_IDB_STORE = 'url_audio_blobs';
const OFFLINE_URL_IDB_VERSION = 1;
const MIN_VALID_AUDIO_BYTES = 1024;

function isCacheApiAvailable(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    // Cap at ~350 entries so localStorage never bloats
    const keys = Object.keys(map);
    if (keys.length > 350) {
      for (let i = 0; i < keys.length - 350; i++) {
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

export async function hasOfflineAudioCacheKey(keyUrl: string): Promise<boolean> {
  if (!isCacheApiAvailable()) return false;
  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const match = await cache.match(keyUrl);
    return Boolean(match);
  } catch {
    return false;
  }
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

function normalizeUrlKey(url: string): string {
  return (url || '').trim();
}

export function isGoogleDriveUrl(url: string): boolean {
  const u = normalizeUrlKey(url).toLowerCase();
  return (
    u.includes('drive.google.com') ||
    u.includes('drive.usercontent.google.com') ||
    u.includes('docs.google.com')
  );
}

export function extractGoogleDriveFileId(url: string): string | null {
  const trimmed = normalizeUrlKey(url);
  const match =
    trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match && match[1] ? match[1] : null;
}

export function buildGoogleDriveDirectDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

function isTextOrHtmlContentType(contentType: string): boolean {
  const ct = (contentType || '').toLowerCase();
  return (
    ct.includes('text/html') ||
    ct.includes('application/json') ||
    ct.includes('application/xml') ||
    ct.includes('text/xml') ||
    ct.includes('text/plain') ||
    ct.includes('application/javascript')
  );
}

function isValidAudioBuffer(buf: ArrayBuffer | null | undefined, contentType = ''): boolean {
  if (!buf || buf.byteLength < MIN_VALID_AUDIO_BYTES) return false;
  if (isTextOrHtmlContentType(contentType)) return false;

  try {
    const headBytes = new Uint8Array(buf, 0, Math.min(96, buf.byteLength));
    const headStr = new TextDecoder('utf-8', { fatal: false })
      .decode(headBytes)
      .trim()
      .toLowerCase();
    if (
      headStr.startsWith('<!doctype') ||
      headStr.startsWith('<html') ||
      headStr.startsWith('<head') ||
      headStr.startsWith('<body') ||
      headStr.startsWith('<?xml') ||
      headStr.startsWith('{"error"') ||
      headStr.startsWith('{"message"')
    ) {
      return false;
    }
  } catch {
    // Binary audio decode check ok
  }
  return true;
}

function inferAudioMimeType(contentType: string, url: string, buf?: ArrayBuffer): string {
  const ct = (contentType || '').split(';')[0].trim().toLowerCase();
  if (buf && buf.byteLength >= 12) {
    const b = new Uint8Array(buf, 0, 12);
    // ID3 or MP3 frame sync
    if (
      (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) ||
      (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
    ) {
      return 'audio/mpeg';
    }
    // RIFF WAVE
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
      return 'audio/wav';
    }
    // OggS
    if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) {
      return 'audio/ogg';
    }
    // fLaC
    if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) {
      return 'audio/flac';
    }
    // ISO Base Media / M4A ('ftyp' at offset 4)
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
      return 'audio/mp4';
    }
  }

  if (ct && ct.startsWith('audio/') && ct !== 'audio/octet-stream') {
    return ct;
  }

  const lowerUrl = (url || '').toLowerCase();
  if (lowerUrl.includes('.wav')) return 'audio/wav';
  if (lowerUrl.includes('.ogg')) return 'audio/ogg';
  if (lowerUrl.includes('.m4a') || lowerUrl.includes('.mp4')) return 'audio/mp4';
  if (lowerUrl.includes('.aac')) return 'audio/aac';
  return 'audio/mpeg';
}

function openOfflineUrlAudioIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(OFFLINE_URL_IDB_NAME, OFFLINE_URL_IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_URL_IDB_STORE)) {
        db.createObjectStore(OFFLINE_URL_IDB_STORE, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
  });
}

async function saveBlobToOfflineUrlIDB(
  rawUrl: string,
  blob: Blob,
  mimeType: string
): Promise<void> {
  const url = normalizeUrlKey(rawUrl);
  if (!url || !blob || blob.size < MIN_VALID_AUDIO_BYTES) return;
  try {
    const db = await openOfflineUrlAudioIDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(OFFLINE_URL_IDB_STORE, 'readwrite');
      tx.objectStore(OFFLINE_URL_IDB_STORE).put({
        url,
        blob,
        mimeType,
        size: blob.size,
        cachedAt: Date.now(),
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore IDB quota/availability errors gracefully
  }
}

async function getBlobFromOfflineUrlIDB(
  rawUrl: string
): Promise<{ blob: Blob; mimeType: string } | null> {
  const url = normalizeUrlKey(rawUrl);
  if (!url) return null;
  try {
    const db = await openOfflineUrlAudioIDB();
    return await new Promise<{ blob: Blob; mimeType: string } | null>((resolve) => {
      const tx = db.transaction(OFFLINE_URL_IDB_STORE, 'readonly');
      const req = tx.objectStore(OFFLINE_URL_IDB_STORE).get(url);
      req.onsuccess = () => {
        db.close();
        const rec = req.result as { blob?: Blob; mimeType?: string } | undefined;
        if (rec?.blob && rec.blob.size >= MIN_VALID_AUDIO_BYTES) {
          resolve({
            blob: rec.blob,
            mimeType: rec.mimeType || rec.blob.type || 'audio/mpeg',
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function saveArrayBufferToOfflineCache(
  rawUrl: string,
  buffer: ArrayBuffer,
  contentType = 'audio/mpeg'
): Promise<void> {
  const url = normalizeUrlKey(rawUrl);
  if (!url.startsWith('http') || !isValidAudioBuffer(buffer, contentType)) return;
  const normalizedMime = inferAudioMimeType(contentType, url, buffer);

  if (isCacheApiAvailable()) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      const resp = new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': normalizedMime,
          'Content-Length': String(buffer.byteLength),
          'X-Offline-Cached-At': String(Date.now()),
        },
      });
      await cache.put(url, resp);
    } catch {
      // Ignore quota/cache errors gracefully
    }
  }

  // Mirror into IndexedDB under exact same URL key for redundant offline persistence
  try {
    const blob = new Blob([buffer], { type: normalizedMime });
    await saveBlobToOfflineUrlIDB(url, blob, normalizedMime);
  } catch {
    // Ignore IDB mirror failure
  }
}

export async function getArrayBufferFromOfflineCache(rawUrl: string): Promise<ArrayBuffer | null> {
  const url = normalizeUrlKey(rawUrl);
  if (!url) return null;

  if (isCacheApiAvailable()) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      const match = await cache.match(url);
      if (match) {
        const ct = (match.headers.get('content-type') || '').toLowerCase();
        if (match.type !== 'opaque' && match.status === 200 && !isTextOrHtmlContentType(ct)) {
          const buf = await match.arrayBuffer();
          if (isValidAudioBuffer(buf, ct)) {
            return buf;
          }
        }
        // Remove invalid/opaque SW artifact so it can be re-cached cleanly when online
        await cache.delete(url).catch(() => {});
      }
    } catch {
      // Ignore
    }
  }

  // Fallback to IndexedDB offline store using the exact same URL key
  const idbRec = await getBlobFromOfflineUrlIDB(url);
  if (idbRec) {
    try {
      const buf = await idbRec.blob.arrayBuffer();
      if (isValidAudioBuffer(buf, idbRec.mimeType)) {
        return buf;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function getBlobUrlFromOfflineCache(rawUrl: string): Promise<string | null> {
  const url = normalizeUrlKey(rawUrl);
  if (!url.startsWith('http')) return null;

  if (isCacheApiAvailable()) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      const match = await cache.match(url);
      if (match) {
        const ct = (match.headers.get('content-type') || '').toLowerCase();
        if (match.type !== 'opaque' && match.status === 200 && !isTextOrHtmlContentType(ct)) {
          const buf = await match.arrayBuffer();
          if (isValidAudioBuffer(buf, ct)) {
            const mimeType = inferAudioMimeType(ct, url, buf);
            const blob = new Blob([buf], { type: mimeType });
            return URL.createObjectURL(blob);
          }
        }
        // Purge broken/opaque SW cache entry so next online cycle refreshes cleanly
        await cache.delete(url).catch(() => {});
      }
    } catch {
      // Continue to IndexedDB fallback
    }
  }

  // IndexedDB backup lookup using exact same URL key
  const idbRec = await getBlobFromOfflineUrlIDB(url);
  if (idbRec) {
    try {
      const buf = await idbRec.blob.arrayBuffer();
      if (isValidAudioBuffer(buf, idbRec.mimeType)) {
        const mimeType = inferAudioMimeType(idbRec.mimeType, url, buf);
        const playableBlob =
          idbRec.blob.type === mimeType ? idbRec.blob : new Blob([buf], { type: mimeType });
        // Backfill CacheStorage asynchronously
        if (isCacheApiAvailable()) {
          caches
            .open(OFFLINE_AUDIO_CACHE_NAME)
            .then((c) =>
              c.put(
                url,
                new Response(buf, {
                  status: 200,
                  headers: { 'Content-Type': mimeType, 'Content-Length': String(buf.byteLength) },
                })
              )
            )
            .catch(() => {});
        }
        return URL.createObjectURL(playableBlob);
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function isExternalAudioCachedAndValid(rawUrl: string): Promise<boolean> {
  const url = normalizeUrlKey(rawUrl);
  if (!url.startsWith('http')) return false;

  if (isCacheApiAvailable()) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      const existing = await cache.match(url);
      if (existing) {
        const ct = (existing.headers.get('content-type') || '').toLowerCase();
        if (existing.type !== 'opaque' && existing.status === 200 && !isTextOrHtmlContentType(ct)) {
          const buf = await existing.arrayBuffer();
          if (isValidAudioBuffer(buf, ct)) {
            return true;
          }
        }
        // Delete opaque or corrupted entry so it is cleanly re-downloaded
        await cache.delete(url).catch(() => {});
      }
    } catch {
      // Check IDB fallback
    }
  }

  const idbRec = await getBlobFromOfflineUrlIDB(url);
  if (idbRec) {
    try {
      const buf = await idbRec.blob.arrayBuffer();
      if (isValidAudioBuffer(buf, idbRec.mimeType)) {
        // Restore into CacheStorage if CacheStorage lacked it
        await saveArrayBufferToOfflineCache(url, buf, idbRec.mimeType);
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

const DEPRECATED_MUROTTAL_URL_PATTERNS = [
  'mishaari_raashid_al_3afaasee',
  'archive.org/download/TahaAlJunaid/',
];

function isDeprecatedMurottalUrl(url: string): boolean {
  const lower = (url || '').toLowerCase();
  return DEPRECATED_MUROTTAL_URL_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Clean up old Mishary Rashid / deprecated Murottal cache entries from both CacheStorage and IndexedDB
 * so the 38 Muhammad Thaha Al-Junayd (child version) files are stored cleanly without exceeding cache limits.
 */
export async function purgeDeprecatedMurottalOfflineCache(): Promise<number> {
  let removedCount = 0;

  if (isCacheApiAvailable()) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      const keys = await cache.keys();
      for (const req of keys) {
        if (isDeprecatedMurottalUrl(req.url)) {
          const deleted = await cache.delete(req);
          if (deleted) removedCount++;
        }
      }
    } catch {
      // Ignore cache cleanup errors cleanly
    }
  }

  try {
    const db = await openOfflineUrlAudioIDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(OFFLINE_URL_IDB_STORE, 'readwrite');
      const store = tx.objectStore(OFFLINE_URL_IDB_STORE);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const allKeys = (req.result || []) as string[];
        for (const key of allKeys) {
          if (typeof key === 'string' && isDeprecatedMurottalUrl(key)) {
            store.delete(key);
            removedCount++;
          }
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore IDB cleanup errors cleanly
  }

  return removedCount;
}

export async function fetchAndCacheExternalAudio(rawUrl: string): Promise<boolean> {
  const url = normalizeUrlKey(rawUrl);
  if (!url || !url.startsWith('http')) return false;

  if (await isExternalAudioCachedAndValid(url)) {
    return true;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const isDrive = isGoogleDriveUrl(url);

  const tryFetchAndVerify = async (fetchTargetUrl: string, timeoutMs = 45000): Promise<boolean> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(fetchTargetUrl, {
        signal: controller.signal,
        redirect: 'follow',
        mode: 'cors',
        cache: 'no-store',
      });
      if (!res.ok || res.type === 'opaque') return false;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (isTextOrHtmlContentType(contentType)) {
        return false;
      }
      const buf = await res.arrayBuffer();
      if (!isValidAudioBuffer(buf, contentType)) {
        return false;
      }
      await saveArrayBufferToOfflineCache(url, buf, contentType || 'audio/mpeg');
      return await isExternalAudioCachedAndValid(url);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  if (isDrive) {
    // Step 1 for Google Drive: Server proxy handles redirect, cookies, and confirmation tokens
    if (await tryFetchAndVerify(`/api/audio/proxy?url=${encodeURIComponent(url)}`, 45000)) {
      return true;
    }
    // Step 2 fallback for large Google Drive files (>4.5MB serverless response cap): direct usercontent URL
    const driveId = extractGoogleDriveFileId(url);
    if (driveId) {
      const directDriveUrl = buildGoogleDriveDirectDownloadUrl(driveId);
      if (await tryFetchAndVerify(directDriveUrl, 45000)) {
        return true;
      }
    }
    return false;
  }

  // For standard external URLs (Archive.org, Cloudinary, CDN MP3/WAV):
  // Try direct CORS fetch first (supports full-size downloads & follows redirects without opaque SW cache)
  if (await tryFetchAndVerify(url, 45000)) {
    return true;
  }

  // Fallback to server proxy when origin restricts browser CORS
  if (await tryFetchAndVerify(`/api/audio/proxy?url=${encodeURIComponent(url)}`, 45000)) {
    return true;
  }

  return false;
}

export interface MurottalDownloadTarget {
  url: string;
  label: string;
}

export async function collectMurottalAudioResources(
  murottalConfig: MurottalConfig
): Promise<{ murottalTargets: MurottalDownloadTarget[]; murottalLocalCount: number }> {
  const customTracks = await getCustomMurottalTracks().catch(() => [] as MurottalTrack[]);
  const allTracks: MurottalTrack[] = [...DEFAULT_JUZ_30_TRACKS, ...customTracks];
  const trackMap = new Map<string, MurottalTrack>(allTracks.map((t) => [t.id, t]));

  const targetHttpMap = new Map<string, string>(); // exact trimmed url -> label
  const localTrackedIds = new Set<string>();

  const registerTrack = (track: MurottalTrack | undefined) => {
    if (!track || !track.audioUrl) return;
    const trimmed = normalizeUrlKey(track.audioUrl);
    if (!trimmed) return;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (!targetHttpMap.has(trimmed)) {
        targetHttpMap.set(trimmed, track.title || 'Murottal');
      }
    } else if (trimmed.startsWith('data:') || trimmed.startsWith('idb-audio://')) {
      localTrackedIds.add(track.id || trimmed);
    }
  };

  // 1. ALL 38 tracks in Juz 30 playlist (Al-Fatihah + Surah 78 An-Naba' s/d 114 An-Nas)
  DEFAULT_JUZ_30_TRACKS.forEach((track) => registerTrack(track));

  // 2. Primary selected track & ALL configured Murottal schedule slots
  if (murottalConfig.selectedTrackId) {
    registerTrack(trackMap.get(murottalConfig.selectedTrackId));
  }
  murottalConfig.scheduleSlots?.forEach((slot) => {
    if (slot.trackId) {
      registerTrack(trackMap.get(slot.trackId));
    }
  });

  // 3. ALL custom uploaded / custom cloud-link Murottal tracks
  customTracks.forEach((track) => registerTrack(track));

  return {
    murottalTargets: Array.from(targetHttpMap.entries()).map(([url, label]) => ({ url, label })),
    murottalLocalCount: localTrackedIds.size,
  };
}

export async function collectAllOfflineAudioResources(
  schedules: ScheduleItem[],
  audioSettings: AudioSettings,
  murottalConfig: MurottalConfig
): Promise<{
  murottalTargets: MurottalDownloadTarget[];
  otherHttpUrls: string[];
  allHttpUrls: string[];
  localCount: number;
}> {
  const { murottalTargets, murottalLocalCount } = await collectMurottalAudioResources(
    murottalConfig
  );
  const murottalUrlSet = new Set(murottalTargets.map((t) => t.url));
  const otherHttpSet = new Set<string>();
  let localCount = murottalLocalCount;

  const inspectUrl = (u?: string) => {
    if (!u || !u.trim()) return;
    const trimmed = normalizeUrlKey(u);
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (!murottalUrlSet.has(trimmed)) {
        otherHttpSet.add(trimmed);
      }
    } else if (trimmed.startsWith('data:') || trimmed.startsWith('idb-audio://')) {
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

  const otherHttpUrls = Array.from(otherHttpSet);
  const allHttpUrls = [...murottalTargets.map((t) => t.url), ...otherHttpUrls];

  return {
    murottalTargets,
    otherHttpUrls,
    allHttpUrls,
    localCount,
  };
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
    const trimmed = normalizeUrlKey(u);
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      httpSet.add(trimmed);
    } else if (trimmed.startsWith('data:') || trimmed.startsWith('idb-audio://')) {
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

  // Selected & scheduled Murottal tracks (synchronous fallback)
  const trackMap = new Map(DEFAULT_JUZ_30_TRACKS.map((t) => [t.id, t.audioUrl]));
  const primaryUrl = trackMap.get(murottalConfig.selectedTrackId) || DEFAULT_JUZ_30_TRACKS[1]?.audioUrl;
  inspectUrl(primaryUrl);
  murottalConfig.scheduleSlots?.forEach((slot) => {
    inspectUrl((slot.trackId && trackMap.get(slot.trackId)) || primaryUrl);
  });

  return { httpUrls: Array.from(httpSet), localCount };
}

export interface ScheduleTtsTarget {
  label: string;
  voiceName: string;
  language: SpeechLanguage;
  sourceText: string;
  resolvedText: string | null; // null only when multilingual auto_translate has not been translated yet
  needsTranslation: boolean;
  cacheKeyUrl: string | null;
}

/**
 * Collect all unique AI TTS announcement targets across Regular, ASAS, and Friday Early Dismissal schedules.
 * Uses the exact same voice/language/prefix resolution logic as playBellSequence() so cache keys match 100%.
 */
export function collectScheduleTtsTargets(
  schedules: ScheduleItem[],
  audioSettings: AudioSettings
): ScheduleTtsTarget[] {
  const asasList =
    audioSettings.asasSchedules && audioSettings.asasSchedules.length > 0
      ? audioSettings.asasSchedules
      : DEFAULT_ASAS_SCHEDULES;

  const fridayEarlyItem = buildFridayEarlyDismissalSchedule(schedules, audioSettings);

  const allItems: ScheduleItem[] = [...schedules, ...asasList, fridayEarlyItem];
  const prefix = audioSettings.globalPrefix || '';
  const dedupeMap = new Map<string, ScheduleTtsTarget>();

  for (const item of allItems) {
    const audioType = item.audioType || 'tts';
    if (audioType === 'recording') continue;

    const speechLanguage: SpeechLanguage = item.speechLanguage || 'id';
    const useMultilingualAi = speechLanguage !== 'id';
    const useStandardMaleAi = audioType === 'tts' && audioSettings.enableTTS !== false;
    const shouldGenerateAiAudio = audioType === 'cloned' || useMultilingualAi || useStandardMaleAi;
    if (!shouldGenerateAiAudio) continue;

    const targetVoiceId =
      item.clonedVoiceId ||
      (audioSettings.useClonedVoice ? audioSettings.activeClonedVoiceId : undefined);
    const activeProfile = audioSettings.clonedProfiles?.find((p) => p.id === targetVoiceId);

    if (
      audioType === 'cloned' &&
      !useMultilingualAi &&
      activeProfile?.playbackMode === 'direct_recording' &&
      activeProfile.sampleAudioUrl
    ) {
      continue;
    }

    const voiceName =
      audioType === 'tts'
        ? 'Fenrir'
        : activeProfile?.prebuiltVoiceFallback || (targetVoiceId === 'Puck' ? 'Puck' : 'Fenrir');

    const sourceText = `${prefix}${item.speechText || ''}`.trim();
    const directOrInlineTranslated = item.translatedSpeechText?.trim() || '';

    if (!sourceText && !directOrInlineTranslated) continue;

    let resolvedText: string | null = null;
    let needsTranslation = false;

    if (!useMultilingualAi) {
      resolvedText = sourceText;
    } else if (item.speechInputMode === 'direct_text') {
      resolvedText = directOrInlineTranslated || sourceText;
    } else if (directOrInlineTranslated) {
      resolvedText = directOrInlineTranslated;
    } else {
      const cachedTrans = getTranslationOffline(speechLanguage, sourceText);
      if (cachedTrans) {
        resolvedText = cachedTrans;
      } else {
        needsTranslation = true;
      }
    }

    const cacheKeyUrl = resolvedText
      ? buildTtsCacheKeyUrl(voiceName, speechLanguage, resolvedText)
      : null;

    const dedupeKey = cacheKeyUrl
      ? cacheKeyUrl
      : `pending:${voiceName}:${speechLanguage}:${sourceText}`;

    if (!dedupeMap.has(dedupeKey)) {
      dedupeMap.set(dedupeKey, {
        label: `${item.time} - ${item.label}`,
        voiceName,
        language: speechLanguage,
        sourceText,
        resolvedText,
        needsTranslation,
        cacheKeyUrl,
      });
    }
  }

  return Array.from(dedupeMap.values());
}

async function resolveTranslationForOfflineCache(
  sourceText: string,
  targetLanguage: SpeechLanguage
): Promise<{ text: string | null; calledApi: boolean; quotaExceeded?: boolean }> {
  if (!sourceText.trim()) return { text: null, calledApi: false };
  if (targetLanguage === 'id') return { text: sourceText.trim(), calledApi: false };

  const existing = getTranslationOffline(targetLanguage, sourceText);
  if (existing) {
    return { text: existing, calledApi: false };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { text: null, calledApi: false };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await sleep(1500);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('/api/voice/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText.trim(),
          targetLanguage,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        return { text: null, calledApi: true, quotaExceeded: true };
      }
      if (!res.ok) continue;
      const data = await res.json();
      if (data.quotaExceeded || data.status === 'quota_exceeded') {
        return { text: null, calledApi: true, quotaExceeded: true };
      }
      if (data.status === 'success' && data.translatedText) {
        saveTranslationOffline(targetLanguage, sourceText, data.translatedText);
        return { text: data.translatedText, calledApi: true };
      }
    } catch {
      // Retry once on transient error
    }
  }

  return { text: null, calledApi: true };
}

async function fetchAndCacheSingleTts(
  textToSpeak: string,
  voiceName: string,
  language: SpeechLanguage
): Promise<'already_cached' | 'downloaded' | 'quota_exceeded' | 'failed'> {
  const cacheKeyUrl = buildTtsCacheKeyUrl(voiceName, language, textToSpeak);
  if (await hasOfflineAudioCacheKey(cacheKeyUrl)) {
    return 'already_cached';
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'failed';
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await sleep(2200);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const res = await fetch('/api/voice/clone-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSpeak.trim(),
          voiceName,
          language,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        return 'quota_exceeded';
      }

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      if (data.quotaExceeded || data.status === 'quota_exceeded') {
        return 'quota_exceeded';
      }

      if (data.status === 'success' && data.audioDataUrl) {
        await saveDataUrlAudioToOfflineCache(cacheKeyUrl, data.audioDataUrl);
        return 'downloaded';
      }
    } catch {
      // Retry once on timeout/transient network blip
    }
  }

  return 'failed';
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
  totalTtsTargets: number;
  cachedScheduleTtsCount: number;
}> {
  await purgeDeprecatedMurottalOfflineCache();
  const { allHttpUrls, localCount } = await collectAllOfflineAudioResources(
    schedules,
    audioSettings,
    murottalConfig
  );
  const ttsTargets = collectScheduleTtsTargets(schedules, audioSettings);

  let cachedHttpUrls = 0;
  let cachedTtsCount = 0;
  let cachedScheduleTtsCount = 0;

  for (const u of allHttpUrls) {
    if (await isExternalAudioCachedAndValid(u)) {
      cachedHttpUrls++;
    }
  }

  if (isCacheApiAvailable()) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      const keys = await cache.keys();
      const keySet = new Set(keys.map((k) => k.url));

      for (const req of keys) {
        if (req.url.startsWith('https://offline-tts.local/')) {
          cachedTtsCount++;
        }
      }
      for (const t of ttsTargets) {
        if (t.cacheKeyUrl && keySet.has(t.cacheKeyUrl)) {
          cachedScheduleTtsCount++;
        }
      }
    } catch {
      // Ignore
    }
  }

  return {
    totalHttpUrls: allHttpUrls.length,
    cachedHttpUrls,
    localCount,
    cachedTtsCount,
    totalTtsTargets: ttsTargets.length,
    cachedScheduleTtsCount,
  };
}

export interface OfflinePreCacheProgress {
  phase: 'murottal' | 'http' | 'tts' | 'cooldown';
  done: number;
  total: number;
  label: string;
  statusText: string;
  cooldownSeconds?: number;
}

const AI_TTS_INTER_REQUEST_DELAY_MS = 4500;
const AI_TTS_COOLDOWN_SECONDS = 65;

export async function cacheAllAppAudioForOffline(
  schedules: ScheduleItem[],
  audioSettings: AudioSettings,
  murottalConfig: MurottalConfig,
  onProgress?: (progress: OfflinePreCacheProgress) => void,
  onStatsUpdate?: () => void | Promise<void>
): Promise<{
  successCount: number;
  totalHttp: number;
  failedUrls: string[];
  murottalSuccessCount: number;
  totalMurottal: number;
  failedMurottalUrls: string[];
  downloadedTts: number;
  alreadyCachedTts: number;
  failedTts: number;
  totalTts: number;
  quotaReached: boolean;
}> {
  onProgress?.({
    phase: 'murottal',
    done: 0,
    total: 38,
    label: 'Membersihkan cache lama...',
    statusText: 'Membersihkan cache murottal lama & menyiapkan 38 surat Muhammad Thaha...',
  });
  await purgeDeprecatedMurottalOfflineCache();
  await onStatsUpdate?.();

  const { murottalTargets, otherHttpUrls } = await collectAllOfflineAudioResources(
    schedules,
    audioSettings,
    murottalConfig
  );

  // Phase 1: Download & verify ALL 38 Juz 30 surahs + custom/scheduled Murottal tracks sequentially
  const failedMurottalUrls: string[] = [];
  let murottalSuccessCount = 0;

  for (let i = 0; i < murottalTargets.length; i++) {
    const target = murottalTargets[i];
    onProgress?.({
      phase: 'murottal',
      done: i,
      total: murottalTargets.length,
      label: target.label,
      statusText: `Mengunduh Murottal Juz 30: ${i}/${murottalTargets.length} surat selesai... (${target.label})`,
    });

    const alreadyCached = await isExternalAudioCachedAndValid(target.url);
    let ok = alreadyCached;
    if (!ok) {
      ok = await fetchAndCacheExternalAudio(target.url);
      if (!ok) {
        await sleep(800);
        ok = await fetchAndCacheExternalAudio(target.url);
      }
      if (i < murottalTargets.length - 1) {
        await sleep(250);
      }
    }

    if (ok) {
      murottalSuccessCount++;
      if (!alreadyCached) {
        await onStatsUpdate?.();
      }
    } else {
      failedMurottalUrls.push(target.url);
    }
    onProgress?.({
      phase: 'murottal',
      done: i + 1,
      total: murottalTargets.length,
      label: target.label,
      statusText: `Mengunduh Murottal Juz 30: ${i + 1}/${murottalTargets.length} surat selesai...`,
    });
  }

  // Phase 2: External HTTP audio for Bells, Chimes, & Post-Bell Recordings (Cloudinary, Drive, etc.)
  const failedOtherUrls: string[] = [];
  let otherSuccessCount = 0;

  for (let i = 0; i < otherHttpUrls.length; i++) {
    const url = otherHttpUrls[i];
    const shortName = decodeURIComponent(url.split('/').pop() || url).slice(0, 32);
    onProgress?.({
      phase: 'http',
      done: i,
      total: otherHttpUrls.length,
      label: shortName,
      statusText: `Mengunduh Audio Bel & Cloud: ${i}/${otherHttpUrls.length} selesai... (${shortName})`,
    });
    const ok = await fetchAndCacheExternalAudio(url);
    if (ok) {
      otherSuccessCount++;
      await onStatsUpdate?.();
    } else {
      failedOtherUrls.push(url);
    }
    onProgress?.({
      phase: 'http',
      done: i + 1,
      total: otherHttpUrls.length,
      label: shortName,
      statusText: `Mengunduh Audio Bel & Cloud: ${i + 1}/${otherHttpUrls.length} selesai...`,
    });
  }

  const successCount = murottalSuccessCount + otherSuccessCount;
  const totalHttp = murottalTargets.length + otherHttpUrls.length;
  const failedUrls = [...failedMurottalUrls, ...failedOtherUrls];

  // Phase 2: Sequential pre-cache for all schedule AI TTS texts & translations (Reguler, ASAS, Jumat Ekstra)
  const ttsTargets = collectScheduleTtsTargets(schedules, audioSettings);
  let downloadedTts = 0;
  let alreadyCachedTts = 0;
  let failedTts = 0;
  let quotaReached = false;
  const processedKeysInBatch = new Set<string>();
  let lastTtsApiFinishedAt = 0;
  let consecutiveQuotaRetries = 0;

  const runCooldownCountdown = async (
    completedCount: number,
    totalCount: number,
    label: string
  ) => {
    for (let sec = AI_TTS_COOLDOWN_SECONDS; sec > 0; sec--) {
      onProgress?.({
        phase: 'cooldown',
        done: completedCount,
        total: totalCount,
        label,
        cooldownSeconds: sec,
        statusText: `Menunggu kuota server reset dalam ${sec} detik... (${completedCount}/${totalCount} jadwal)`,
      });
      await sleep(1000);
    }
    lastTtsApiFinishedAt = 0;
  };

  for (let i = 0; i < ttsTargets.length; i++) {
    const target = ttsTargets[i];
    onProgress?.({
      phase: 'tts',
      done: i,
      total: ttsTargets.length,
      label: target.label,
      statusText: `Mengunduh Suara AI TTS: ${i}/${ttsTargets.length} jadwal selesai... (${target.label})`,
    });

    let textToSpeak = target.resolvedText;
    if (!textToSpeak && target.needsTranslation) {
      const transRes = await resolveTranslationForOfflineCache(target.sourceText, target.language);
      if (transRes.quotaExceeded && consecutiveQuotaRetries < 5) {
        consecutiveQuotaRetries++;
        await runCooldownCountdown(i, ttsTargets.length, target.label);
        i--;
        continue;
      }
      textToSpeak = transRes.text;
      if (transRes.calledApi) {
        await sleep(800);
      }
    }

    if (!textToSpeak || !textToSpeak.trim()) {
      consecutiveQuotaRetries = 0;
      failedTts++;
      continue;
    }

    const resolvedCacheKey = buildTtsCacheKeyUrl(target.voiceName, target.language, textToSpeak);
    if (processedKeysInBatch.has(resolvedCacheKey) || (await hasOfflineAudioCacheKey(resolvedCacheKey))) {
      processedKeysInBatch.add(resolvedCacheKey);
      alreadyCachedTts++;
      consecutiveQuotaRetries = 0;
      onProgress?.({
        phase: 'tts',
        done: i + 1,
        total: ttsTargets.length,
        label: target.label,
        statusText: `Mengunduh Suara AI TTS: ${i + 1}/${ttsTargets.length} jadwal selesai...`,
      });
      continue;
    }

    // Pace requests to 4.5s intervals (~12-13 RPM) so free/regular AI TTS quotas are respected
    if (lastTtsApiFinishedAt > 0) {
      const elapsed = Date.now() - lastTtsApiFinishedAt;
      if (elapsed < AI_TTS_INTER_REQUEST_DELAY_MS) {
        await sleep(AI_TTS_INTER_REQUEST_DELAY_MS - elapsed);
      }
    }

    const ttsRes = await fetchAndCacheSingleTts(textToSpeak, target.voiceName, target.language);
    lastTtsApiFinishedAt = Date.now();

    if (ttsRes === 'quota_exceeded') {
      if (consecutiveQuotaRetries < 5 && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        consecutiveQuotaRetries++;
        await runCooldownCountdown(i, ttsTargets.length, target.label);
        i--;
        continue;
      }
      quotaReached = true;
      failedTts++;
      continue;
    }

    consecutiveQuotaRetries = 0;

    if (ttsRes === 'already_cached') {
      processedKeysInBatch.add(resolvedCacheKey);
      alreadyCachedTts++;
    } else if (ttsRes === 'downloaded') {
      processedKeysInBatch.add(resolvedCacheKey);
      downloadedTts++;
      await onStatsUpdate?.();
    } else {
      failedTts++;
    }

    onProgress?.({
      phase: 'tts',
      done: i + 1,
      total: ttsTargets.length,
      label: target.label,
      statusText: `Mengunduh Suara AI TTS: ${i + 1}/${ttsTargets.length} jadwal selesai...`,
    });
  }

  return {
    successCount,
    totalHttp,
    failedUrls,
    murottalSuccessCount,
    totalMurottal: murottalTargets.length,
    failedMurottalUrls,
    downloadedTts,
    alreadyCachedTts,
    failedTts,
    totalTts: ttsTargets.length,
    quotaReached,
  };
}
