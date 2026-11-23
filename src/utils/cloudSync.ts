import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AudioSettings, MurottalConfig, ScheduleItem } from '../types';

export const SCHOOL_DOC_ID = 'sd-quran-unggulan';
const SCHOOL_NAME = "SD QUR'AN UNGGULAN";
const MAX_INLINE_AUDIO_LEN = 240000;

function sanitizeId(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .slice(0, 128);
  return cleaned || `sch-${Date.now()}`;
}

function sanitizeOptionalString(val: unknown, maxLen: number): string | undefined {
  if (typeof val !== 'string') return undefined;
  if (val.length > maxLen) return val.slice(0, maxLen);
  return val;
}

function sanitizeAudioUrlForCloud(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url.trim()) return undefined;
  if (url.startsWith('idb-audio://')) {
    return undefined;
  }
  if (url.length > MAX_INLINE_AUDIO_LEN) {
    // Skip oversized local base64 blobs so Firestore 1MB doc limits are never breached
    return undefined;
  }
  return url;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export function sanitizeAudioSettingsForCloud(settings: AudioSettings): AudioSettings {
  const clonedProfiles = (settings.clonedProfiles || []).map((p) =>
    stripUndefinedDeep({
      ...p,
      sampleAudioUrl: sanitizeAudioUrlForCloud(p.sampleAudioUrl),
    })
  );
  const customChimes = (settings.customChimes || []).map((c) =>
    stripUndefinedDeep({
      ...c,
      audioUrl: sanitizeAudioUrlForCloud(c.audioUrl) || '',
    })
  ).filter((c) => c.audioUrl);

  const postBellTracks = (settings.postBellTracks || []).map((t) =>
    stripUndefinedDeep({
      ...t,
      audioUrl: sanitizeAudioUrlForCloud(t.audioUrl) || '',
    })
  ).filter((t) => t.audioUrl);

  const asasSchedules = settings.asasSchedules
    ? settings.asasSchedules.map((item) =>
        stripUndefinedDeep({
          ...item,
          customChimeUrl: sanitizeAudioUrlForCloud(item.customChimeUrl),
          customOutroChimeUrl: sanitizeAudioUrlForCloud(item.customOutroChimeUrl),
          customAudioUrl: sanitizeAudioUrlForCloud(item.customAudioUrl),
        })
      )
    : undefined;

  return stripUndefinedDeep({
    ...settings,
    customPrefixAudioUrl: sanitizeAudioUrlForCloud(settings.customPrefixAudioUrl),
    globalOutroChimeUrl: sanitizeAudioUrlForCloud(settings.globalOutroChimeUrl),
    clonedProfiles,
    customChimes,
    postBellTracks,
    asasSchedules,
  });
}

export function sanitizeScheduleForCloud(
  item: ScheduleItem,
  ownerId: string,
  includeCreateFields: boolean
): Record<string, any> {
  const id = sanitizeId(item.id);
  const validCategories = ['lesson', 'break', 'prayer', 'assembly', 'dismissal', 'custom'];
  const category = validCategories.includes(item.category) ? item.category : 'custom';
  const timeMatch = /^\d{2}:\d{2}$/.test(item.time) ? item.time : '07:00';
  const days = Array.isArray(item.days)
    ? item.days.filter((d) => typeof d === 'number' && d >= 0 && d <= 6).slice(0, 7)
    : [];

  const payload: Record<string, any> = {
    isPublicBroadcast: true,
    time: timeMatch,
    label: (item.label || 'Jadwal Bel').slice(0, 160),
    category,
    speechText: (item.speechText || '').slice(0, 2000),
    chimeType: (item.chimeType || 'westminster').slice(0, 80),
    days,
    enabled: Boolean(item.enabled),
    volume: typeof item.volume === 'number' ? Math.max(0, Math.min(1, item.volume)) : 1,
    updatedAt: serverTimestamp(),
  };

  if (includeCreateFields) {
    payload.id = id;
    payload.schoolId = SCHOOL_DOC_ID;
    payload.ownerId = ownerId;
    payload.createdAt = serverTimestamp();
  }

  if (item.speechLanguage && ['id', 'ar', 'en', 'jv'].includes(item.speechLanguage)) {
    payload.speechLanguage = item.speechLanguage;
  }
  if (item.speechInputMode && ['auto_translate', 'direct_text'].includes(item.speechInputMode)) {
    payload.speechInputMode = item.speechInputMode;
  }
  const translated = sanitizeOptionalString(item.translatedSpeechText, 2500);
  if (translated !== undefined) payload.translatedSpeechText = translated;

  const customChimeUrl = sanitizeAudioUrlForCloud(item.customChimeUrl);
  if (customChimeUrl !== undefined) payload.customChimeUrl = customChimeUrl;
  const customChimeName = sanitizeOptionalString(item.customChimeName, 160);
  if (customChimeName !== undefined) payload.customChimeName = customChimeName;

  if (typeof item.enableOutroChime === 'boolean') {
    payload.enableOutroChime = item.enableOutroChime;
  }
  const outroChimeType = sanitizeOptionalString(item.outroChimeType, 80);
  if (outroChimeType !== undefined) payload.outroChimeType = outroChimeType;
  const customOutroChimeUrl = sanitizeAudioUrlForCloud(item.customOutroChimeUrl);
  if (customOutroChimeUrl !== undefined) payload.customOutroChimeUrl = customOutroChimeUrl;
  const customOutroChimeName = sanitizeOptionalString(item.customOutroChimeName, 160);
  if (customOutroChimeName !== undefined) payload.customOutroChimeName = customOutroChimeName;

  if (item.audioType && ['tts', 'recording', 'cloned'].includes(item.audioType)) {
    payload.audioType = item.audioType;
  }
  const customAudioUrl = sanitizeAudioUrlForCloud(item.customAudioUrl);
  if (customAudioUrl !== undefined) payload.customAudioUrl = customAudioUrl;
  const customAudioName = sanitizeOptionalString(item.customAudioName, 160);
  if (customAudioName !== undefined) payload.customAudioName = customAudioName;
  const clonedVoiceId = sanitizeOptionalString(item.clonedVoiceId, 80);
  if (clonedVoiceId !== undefined) payload.clonedVoiceId = clonedVoiceId;

  return payload;
}

export async function pushSchoolConfigToCloud(
  audioSettings: AudioSettings,
  murottalConfig: MurottalConfig,
  uid: string
): Promise<void> {
  const schoolPath = `schools/${SCHOOL_DOC_ID}`;
  const schoolRef = doc(db, 'schools', SCHOOL_DOC_ID);
  const safeSettings = sanitizeAudioSettingsForCloud(audioSettings);
  const safeMurottal = stripUndefinedDeep(murottalConfig);

  try {
    const snap = await getDoc(schoolRef);
    if (!snap.exists()) {
      await setDoc(schoolRef, {
        schoolId: SCHOOL_DOC_ID,
        schoolName: SCHOOL_NAME,
        ownerId: uid,
        isPublicBroadcast: true,
        audioSettings: safeSettings,
        murottalConfig: safeMurottal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(schoolRef, {
        schoolName: SCHOOL_NAME,
        isPublicBroadcast: true,
        audioSettings: safeSettings,
        murottalConfig: safeMurottal,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, schoolPath);
  }
}

export async function pushAllSchedulesToCloud(
  schedules: ScheduleItem[],
  knownCloudIds: Set<string>,
  uid: string
): Promise<Set<string>> {
  const collectionPath = `schools/${SCHOOL_DOC_ID}/schedules`;
  const nextIds = new Set<string>();
  const ops: Array<{ type: 'set' | 'update' | 'delete'; id: string; data?: Record<string, any> }> = [];

  for (const item of schedules) {
    const id = sanitizeId(item.id);
    nextIds.add(id);
    if (knownCloudIds.has(id)) {
      ops.push({
        type: 'update',
        id,
        data: sanitizeScheduleForCloud(item, uid, false),
      });
    } else {
      ops.push({
        type: 'set',
        id,
        data: sanitizeScheduleForCloud(item, uid, true),
      });
    }
  }

  for (const oldId of knownCloudIds) {
    if (!nextIds.has(oldId)) {
      ops.push({ type: 'delete', id: oldId });
    }
  }

  try {
    // Commit in chunks of 400 operations to respect Firestore batch limits
    for (let i = 0; i < ops.length; i += 400) {
      const chunk = ops.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const op of chunk) {
        const ref = doc(db, 'schools', SCHOOL_DOC_ID, 'schedules', op.id);
        if (op.type === 'set' && op.data) {
          batch.set(ref, op.data);
        } else if (op.type === 'update' && op.data) {
          batch.update(ref, op.data);
        } else if (op.type === 'delete') {
          batch.delete(ref);
        }
      }
      await batch.commit();
    }
    return nextIds;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, collectionPath);
  }
}

export function subscribeToCloudBellData(
  onSchoolConfig: (data: {
    exists: boolean;
    audioSettings?: AudioSettings;
    murottalConfig?: MurottalConfig;
  }) => void,
  onSchedules: (items: ScheduleItem[]) => void,
  onSyncError: (err: unknown) => void
): Unsubscribe {
  const schoolRef = doc(db, 'schools', SCHOOL_DOC_ID);
  const schedulesQuery = query(
    collection(db, 'schools', SCHOOL_DOC_ID, 'schedules'),
    where('schoolId', '==', SCHOOL_DOC_ID),
    where('isPublicBroadcast', '==', true)
  );

  const unsubSchool = onSnapshot(
    schoolRef,
    (snap) => {
      if (!snap.exists()) {
        onSchoolConfig({ exists: false });
        return;
      }
      const data = snap.data();
      onSchoolConfig({
        exists: true,
        audioSettings: data?.audioSettings as AudioSettings | undefined,
        murottalConfig: data?.murottalConfig as MurottalConfig | undefined,
      });
    },
    (error) => {
      onSyncError(error);
      handleFirestoreError(error, OperationType.GET, `schools/${SCHOOL_DOC_ID}`);
    }
  );

  const unsubSchedules = onSnapshot(
    schedulesQuery,
    (snapshot) => {
      const items: ScheduleItem[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: d.id || docSnap.id,
          time: d.time,
          label: d.label,
          category: d.category,
          speechText: d.speechText || '',
          speechLanguage: d.speechLanguage,
          speechInputMode: d.speechInputMode,
          translatedSpeechText: d.translatedSpeechText,
          chimeType: d.chimeType || 'westminster',
          customChimeUrl: d.customChimeUrl,
          customChimeName: d.customChimeName,
          enableOutroChime: d.enableOutroChime,
          outroChimeType: d.outroChimeType,
          customOutroChimeUrl: d.customOutroChimeUrl,
          customOutroChimeName: d.customOutroChimeName,
          days: Array.isArray(d.days) ? d.days : [],
          enabled: Boolean(d.enabled),
          volume: typeof d.volume === 'number' ? d.volume : 1,
          audioType: d.audioType,
          customAudioUrl: d.customAudioUrl,
          customAudioName: d.customAudioName,
          clonedVoiceId: d.clonedVoiceId,
        });
      });
      items.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
      onSchedules(items);
    },
    (error) => {
      onSyncError(error);
      handleFirestoreError(error, OperationType.LIST, `schools/${SCHOOL_DOC_ID}/schedules`);
    }
  );

  return () => {
    unsubSchool();
    unsubSchedules();
  };
}
