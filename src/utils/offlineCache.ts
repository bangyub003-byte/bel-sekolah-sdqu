import { AudioSettings, MurottalConfig, ScheduleItem, SpeechLanguage } from '../types';
import { DEFAULT_JUZ_30_TRACKS } from '../data/defaultMurottal';
import { DEFAULT_ASAS_SCHEDULES } from '../data/asasSchedule';
import { buildFridayEarlyDismissalSchedule } from './fridaySchedule';

export const OFFLINE_AUDIO_CACHE_NAME = 'sd-quran-offline-audio-v1';
const TRANSLATE_CACHE_STORAGE_KEY = 'sd_quran_ai_translate_cache_v1';

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
): Promise<{ text: string | null; calledApi: boolean }> {
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
      if (attempt > 0) await sleep(1200);
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

      if (!res.ok) continue;
      const data = await res.json();
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
      const timeoutId = setTimeout(() => controller.abort(), 16000);

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
        if (attempt === 0) continue;
        return 'quota_exceeded';
      }

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      if (data.quotaExceeded || data.status === 'quota_exceeded') {
        if (attempt === 0) continue;
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
  const { httpUrls, localCount } = collectExternalAudioUrls(
    schedules,
    audioSettings,
    murottalConfig
  );
  const ttsTargets = collectScheduleTtsTargets(schedules, audioSettings);

  let cachedHttpUrls = 0;
  let cachedTtsCount = 0;
  let cachedScheduleTtsCount = 0;

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
    totalHttpUrls: httpUrls.length,
    cachedHttpUrls,
    localCount,
    cachedTtsCount,
    totalTtsTargets: ttsTargets.length,
    cachedScheduleTtsCount,
  };
}

export interface OfflinePreCacheProgress {
  phase: 'http' | 'tts';
  done: number;
  total: number;
  label: string;
  statusText: string;
}

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
  downloadedTts: number;
  alreadyCachedTts: number;
  failedTts: number;
  totalTts: number;
  quotaReached: boolean;
}> {
  // Phase 1: External HTTP audio (Cloudinary, Drive, Murottal)
  const { httpUrls } = collectExternalAudioUrls(schedules, audioSettings, murottalConfig);
  const failedUrls: string[] = [];
  let successCount = 0;

  for (let i = 0; i < httpUrls.length; i++) {
    const url = httpUrls[i];
    const shortName = decodeURIComponent(url.split('/').pop() || url).slice(0, 32);
    onProgress?.({
      phase: 'http',
      done: i,
      total: httpUrls.length,
      label: shortName,
      statusText: `Mengunduh Audio Cloud & Murottal: ${i}/${httpUrls.length} selesai... (${shortName})`,
    });
    const ok = await fetchAndCacheExternalAudio(url);
    if (ok) {
      successCount++;
      await onStatsUpdate?.();
    } else {
      failedUrls.push(url);
    }
    onProgress?.({
      phase: 'http',
      done: i + 1,
      total: httpUrls.length,
      label: shortName,
      statusText: `Mengunduh Audio Cloud & Murottal: ${i + 1}/${httpUrls.length} selesai...`,
    });
  }

  // Phase 2: Sequential pre-cache for all schedule AI TTS texts & translations (Reguler, ASAS, Jumat Ekstra)
  const ttsTargets = collectScheduleTtsTargets(schedules, audioSettings);
  let downloadedTts = 0;
  let alreadyCachedTts = 0;
  let failedTts = 0;
  let quotaReached = false;
  const processedKeysInBatch = new Set<string>();

  for (let i = 0; i < ttsTargets.length; i++) {
    const target = ttsTargets[i];
    onProgress?.({
      phase: 'tts',
      done: i,
      total: ttsTargets.length,
      label: target.label,
      statusText: `Mengunduh Suara AI TTS: ${i}/${ttsTargets.length} jadwal selesai... (${target.label})`,
    });

    if (quotaReached) {
      failedTts++;
      continue;
    }

    let textToSpeak = target.resolvedText;
    if (!textToSpeak && target.needsTranslation) {
      const transRes = await resolveTranslationForOfflineCache(target.sourceText, target.language);
      textToSpeak = transRes.text;
      if (transRes.calledApi) {
        await sleep(350);
      }
    }

    if (!textToSpeak || !textToSpeak.trim()) {
      failedTts++;
      continue;
    }

    const resolvedCacheKey = buildTtsCacheKeyUrl(target.voiceName, target.language, textToSpeak);
    if (processedKeysInBatch.has(resolvedCacheKey)) {
      alreadyCachedTts++;
      onProgress?.({
        phase: 'tts',
        done: i + 1,
        total: ttsTargets.length,
        label: target.label,
        statusText: `Mengunduh Suara AI TTS: ${i + 1}/${ttsTargets.length} jadwal selesai...`,
      });
      continue;
    }
    processedKeysInBatch.add(resolvedCacheKey);

    const ttsRes = await fetchAndCacheSingleTts(textToSpeak, target.voiceName, target.language);
    if (ttsRes === 'already_cached') {
      alreadyCachedTts++;
    } else if (ttsRes === 'downloaded') {
      downloadedTts++;
      await onStatsUpdate?.();
      // Safe sequential pacing delay to respect Gemini API rate limits
      if (i < ttsTargets.length - 1) {
        await sleep(1100);
      }
    } else if (ttsRes === 'quota_exceeded') {
      quotaReached = true;
      failedTts++;
    } else {
      failedTts++;
      if (i < ttsTargets.length - 1) {
        await sleep(700);
      }
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
    totalHttp: httpUrls.length,
    failedUrls,
    downloadedTts,
    alreadyCachedTts,
    failedTts,
    totalTts: ttsTargets.length,
    quotaReached,
  };
}
