export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 0; // 1 = Monday, ..., 6 = Saturday, 0 = Sunday

export type BellCategory = 'lesson' | 'break' | 'prayer' | 'assembly' | 'dismissal' | 'custom';

export type BuiltinChimeType =
  | 'westminster'
  | 'classic_3tone'
  | 'electric_bell'
  | 'tube_chime'
  | 'islamic_duo'
  | 'fire_bell'
  | 'school_dismissal';

export type ChimeType = BuiltinChimeType | string;

export type AudioType = 'tts' | 'recording' | 'cloned';

export type SpeechLanguage = 'id' | 'ar' | 'en' | 'jv';

export type SpeechInputMode = 'auto_translate' | 'direct_text';

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
  prebuiltVoiceFallback?: 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr' | 'Charon';
  playbackMode?: 'direct_recording' | 'ai_synthesis'; // 'direct_recording' for 100% exact voice playback, 'ai_synthesis' for AI text generation
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
  speechText: string; // Text spoken by TTS after chime (or Indonesian source text)
  speechLanguage?: SpeechLanguage; // 'id' (default), 'ar' (Arab), 'en' (Inggris), 'jv' (Jawa)
  speechInputMode?: SpeechInputMode; // 'auto_translate' (AI translates from ID) | 'direct_text' (User provides target language text)
  translatedSpeechText?: string; // Cached AI translation or user-provided Arabic/English/Javanese text
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

export interface PostBellTrack {
  id: string;
  name: string;
  audioUrl: string; // Base64, idb-audio:// ref, or cloud link
  audioName?: string;
  scheduleId?: string; // Target ScheduleItem.id or 'all'
  scheduleTime?: string; // Target HH:MM (e.g. '13:45') for cross-day matching
  volume: number; // 0 to 1
  enabled: boolean;
  durationSec?: number;
  createdAt: number;
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
  disabledDays?: DayOfWeek[]; // Days silenced globally for BOTH Bells & Murottal (default: [0] = Minggu)
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
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  globalOutroChimeType?: ChimeType | 'none' | 'same_as_intro';
  globalOutroChimeUrl?: string;
  globalOutroChimeName?: string;
  outroChimeDelayMs?: number; // Delay between voice ending and outro chime
  postBellTracks?: PostBellTrack[]; // Scheduled post-bell recordings/music played automatically after bell
  fridayExtraOff?: boolean; // true = Ekstrakurikuler Hari Jumat diliburkan (pulang lebih awal)
  fridayEarlyDismissalTime?: string; // Jam pulang awal hari Jumat saat ekstra libur (default '12:30')
  asasModeEnabled?: boolean; // true = Mode Jadwal Khusus ASAS (Asesmen Akhir Semester)
  asasSchedules?: ScheduleItem[]; // Daftar jadwal bel khusus ASAS (dapat diedit seperti jadwal biasa)
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

export interface MurottalTrack {
  id: string;
  title: string;
  reciter: string;
  surahNumber?: number;
  audioUrl: string;
  durationStr?: string;
  isCustomUpload?: boolean;
  fileSizeMb?: number;
  uploadedAt?: number;
}

export interface MurottalScheduleSlot {
  id: string;
  time: string; // HH:MM format e.g. "06:00", "06:30", "09:45"
  label: string; // e.g. "Murottal Pagi", "Pertengahan Pelajaran / Istirahat"
  enabled: boolean;
  trackId?: string; // Specific surah or uses default
  days: DayOfWeek[];
  stopAfterMinutes?: number; // Optional auto-stop duration in minutes
}

export interface MurottalConfig {
  enabledAutoPlay: boolean; // Auto-play enabled
  autoStartTime: string; // "06:00", "06:30", etc.
  autoStopOnBell: boolean; // Auto pause when bell rings
  selectedTrackId: string;
  volume: number; // 0 to 1
  activeDays: DayOfWeek[]; // [1, 2, 3, 4, 5, 6]
  repeatMode: 'repeat_one' | 'repeat_all' | 'shuffle';
  scheduleSlots?: MurottalScheduleSlot[]; // Multiple customizable auto-play schedules
}


