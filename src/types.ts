export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 0; // 1 = Monday, ..., 6 = Saturday, 0 = Sunday

export type BellCategory = 'lesson' | 'break' | 'prayer' | 'assembly' | 'dismissal' | 'custom';

export type BuiltinChimeType = 'westminster' | 'classic_3tone' | 'electric_bell' | 'tube_chime' | 'islamic_duo';

export type ChimeType = BuiltinChimeType | string;

export type AudioType = 'tts' | 'recording' | 'cloned';

export interface CustomChime {
  id: string;
  name: string; // e.g. "Nada Melodi Westminster Asli", "Jingle Bel Sekolah MP3"
  description?: string;
  audioUrl: string; // Base64 data URL or audio file link
  audioName?: string;
  category?: 'classic' | 'islamic' | 'modern' | 'jingle' | 'custom';
  durationSec?: number;
  createdAt: number;
}

export interface ClonedVoiceProfile {
  id: string;
  name: string; // e.g. "Suara Ustadz Ahmad", "Suara Kepala Sekolah"
  description?: string;
  sampleAudioUrl?: string; // Base64 voice recording sample
  sampleAudioName?: string;
  createdAt: number;
  prebuiltVoiceFallback?: 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr' | 'Aoede';
}

export interface SavedAudioRecording {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
  durationSec?: number;
}

export interface ScheduleItem {
  id: string;
  time: string; // HH:MM format (24-hour e.g. "07:20")
  label: string; // e.g. "Jam Pelajaran ke-1 (Tahfidzul Qur'an)"
  category: BellCategory;
  speechText: string; // Text spoken by TTS after chime
  chimeType: ChimeType;
  customChimeUrl?: string; // Direct override custom chime audio
  customChimeName?: string;
  enableOutroChime?: boolean; // Play chime again after VO/Speech completes
  outroChimeType?: ChimeType | 'none' | 'same_as_intro'; // Closing chime type
  customOutroChimeUrl?: string;
  customOutroChimeName?: string;
  days: DayOfWeek[]; // [1,2,3,4] or [5] etc.
  enabled: boolean;
  volume: number; // 0 to 1
  audioType?: AudioType; // 'tts' | 'recording' | 'cloned'
  customAudioUrl?: string; // Base64 data URL for recorded/uploaded audio
  customAudioName?: string; // Filename or label for recording
  clonedVoiceId?: string; // ID of selected ClonedVoiceProfile
}

export interface BellLog {
  id: string;
  timestamp: number;
  timeStr: string;
  dayName: string;
  scheduleLabel: string;
  triggerType: 'auto' | 'manual' | 'test';
  status: 'success' | 'warning' | 'error';
  details?: string;
}

export interface AudioSettings {
  voiceURI: string;
  lang: string;
  rate: number; // 0.5 to 1.5
  pitch: number; // 0.5 to 1.5
  volume: number; // 0 to 1
  globalPrefix: string; // "Perhatian kepada seluruh murid SD QUR'AN UNGGULAN, saatnya "
  chimeVolume: number;
  enableTTS: boolean;
  repeatSpeechCount: number; // 1 or 2 times
  useCustomPrefixAudio?: boolean;
  customPrefixAudioUrl?: string;
  customPrefixAudioName?: string;
  useClonedVoice?: boolean;
  activeClonedVoiceId?: string;
  clonedProfiles?: ClonedVoiceProfile[];
  customChimes?: CustomChime[];
  defaultChimeId?: string;
  useCustomDefaultChime?: boolean;
  enableGlobalOutroChime?: boolean; // Global closing chime after VO/TTS
  globalOutroChimeType?: ChimeType | 'none' | 'same_as_intro';
  globalOutroChimeUrl?: string;
  globalOutroChimeName?: string;
  outroChimeDelayMs?: number; // Delay between voice ending and outro chime
}

export interface TimeSyncInfo {
  status: 'synced' | 'syncing' | 'offline' | 'error';
  lastSynced: number | null;
  offsetMs: number; // difference: serverTime - clientLocalTime
  latencyMs: number;
  source: string;
  nextBellTime: string | null;
  nextBellLabel: string | null;
  countdownSeconds: number | null;
}
