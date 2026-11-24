import React, { useState, useEffect, useRef } from 'react';
import {
  ScheduleItem,
  BellLog,
  AudioSettings,
  TimeSyncInfo,
  DayOfWeek,
  ChimeType,
  MurottalConfig,
  MurottalTrack,
} from './types';
import { INITIAL_SCHEDULES, DEFAULT_GLOBAL_PREFIX } from './data/defaultSchedule';
import { DEFAULT_ASAS_SCHEDULES } from './data/asasSchedule';
import { DEFAULT_MUROTTAL_CONFIG, DEFAULT_JUZ_30_TRACKS } from './data/defaultMurottal';
import {
  syncTimeWithAPI,
  getSynchronizedDate,
  getDayOfWeekNumber,
  getIndonesianDayName,
  format24HourTime,
} from './utils/timeSync';
import {
  playChimeTone,
  speakTTS,
  playBellSequence,
  getAudioContext,
  BellPlaybackState,
  getBellPlaybackState,
  subscribeBellPlaybackState,
  togglePauseBellPlayback,
  stopAllBellAudio,
} from './utils/audioSynth';

import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { AlertCircle, Check, Copy, ExternalLink, X } from 'lucide-react';
import {
  pushAllSchedulesToCloud,
  pushSchoolConfigToCloud,
  subscribeToCloudBellData,
} from './utils/cloudSync';
import {
  FRIDAY_EARLY_DISMISSAL_ID,
  buildFridayEarlyDismissalSchedule,
  getDismissalPostBellMatchTargets,
  getEffectiveDaySchedules,
  getFridayEarlyDismissalTime,
} from './utils/fridaySchedule';
import { Navbar } from './components/Navbar';
import { AudioPermissionBanner } from './components/AudioPermissionBanner';
import { LiveClockCard } from './components/LiveClockCard';
import { ScheduleList } from './components/ScheduleList';
import { MurottalPlayer } from './components/MurottalPlayer';
import { ScheduleEditorModal } from './components/ScheduleEditorModal';
import { AddExtraPeriodsModal } from './components/AddExtraPeriodsModal';
import { TimeSyncConfig } from './components/TimeSyncConfig';
import { VoiceSettings } from './components/VoiceSettings';
import { ManualBellPad } from './components/ManualBellPad';
import { BellLogs } from './components/BellLogs';
import { ImportExportModal } from './components/ImportExportModal';
import { ChimeManager } from './components/ChimeManager';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  fetchAndCacheExternalAudio,
  getBlobUrlFromOfflineCache,
  isExternalAudioCachedAndValid,
  isGoogleDriveUrl,
} from './utils/offlineCache';
import { getCustomMurottalTracks } from './utils/murottalStorage';
import { getAudioBlobFromIDB, IDB_AUDIO_PREFIX } from './utils/audioBlobStore';

const LOCAL_STORAGE_KEY_SCHEDULES = 'sd_quran_schedules_v1';
const LOCAL_STORAGE_KEY_SETTINGS = 'sd_quran_settings_v1';
const LOCAL_STORAGE_KEY_LOGS = 'sd_quran_logs_v1';
const LOCAL_STORAGE_KEY_MUROTTAL = 'sd_quran_murottal_v1';
const LOCAL_STORAGE_KEY_MUROTTAL_PROGRESS = 'sd_quran_murottal_progress_v1';

interface MurottalProgressStorage {
  lastPlayedTrackId?: string;
  nextTrackId?: string;
  slotProgress?: Record<
    string,
    {
      configuredStartTrackId: string;
      resumeTrackId: string;
      updatedAt: number;
    }
  >;
}

function readMurottalProgressStorage(): MurottalProgressStorage {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MUROTTAL_PROGRESS);
    if (raw) return JSON.parse(raw) as MurottalProgressStorage;
  } catch {}
  return {};
}

function writeMurottalProgressStorage(data: MurottalProgressStorage): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_MUROTTAL_PROGRESS, JSON.stringify(data));
  } catch {}
}

interface MurottalPlaybackOptions {
  preserveScheduleSession?: boolean;
  scheduledSlotContext?: {
    slotId: string;
    configuredStartTrackId: string;
    endAtMs: number | null;
  };
}

export default function App() {
  // Navigation tab state ('schedule' | 'murottal' | 'chimes' | 'manual' | 'time-sync' | 'voice' | 'logs')
  const [activeTab, setActiveTab] = useState<string>('schedule');

  // Audio permission unlock state
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(false);

  // Time & Synchronization State
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [timeSyncInfo, setTimeSyncInfo] = useState<TimeSyncInfo>({
    status: 'syncing',
    lastSynced: null,
    offsetMs: 0,
    latencyMs: 0,
    source: 'Memuat API...',
    nextBellTime: null,
    nextBellLabel: null,
    countdownSeconds: null,
  });

  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState<number>(5);

  // Schedules state with localStorage persistence
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SCHEDULES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved schedules:', e);
    }
    return INITIAL_SCHEDULES;
  });

  // Audio & TTS Settings
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved audio settings:', e);
    }
    return {
      voiceURI: '',
      lang: 'id-ID',
      rate: 0.95,
      pitch: 1.0,
      volume: 1.0,
      globalPrefix: DEFAULT_GLOBAL_PREFIX,
      chimeVolume: 1.0,
      enableTTS: true,
      repeatSpeechCount: 1,
      disabledDays: [0],
    };
  });

  // Bell Audit Logs
  const [bellLogs, setBellLogs] = useState<BellLog[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_LOGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved bell logs:', e);
    }
    return [];
  });

  // Murottal Config & Player State
  const [murottalConfig, setMurottalConfig] = useState<MurottalConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_MUROTTAL);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.scheduleSlots || parsed.scheduleSlots.length === 0) {
          parsed.scheduleSlots = [
            {
              id: 'slot-pagi',
              time: parsed.autoStartTime || '06:00',
              label: 'Murottal Pagi Sebelum Bel Masuk',
              enabled: parsed.enabledAutoPlay ?? true,
              trackId: parsed.selectedTrackId || 'thaha-078',
              days: parsed.activeDays || [1, 2, 3, 4, 5, 6],
              stopAfterMinutes: 45,
            },
          ];
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved murottal config:', e);
    }
    return DEFAULT_MUROTTAL_CONFIG;
  });

  const [isMurottalPlaying, setIsMurottalPlaying] = useState<boolean>(false);
  const [activeMurottalTrack, setActiveMurottalTrack] = useState<MurottalTrack | null>(
    DEFAULT_JUZ_30_TRACKS[1] // Default An-Naba
  );
  const [bellPlayback, setBellPlayback] = useState<BellPlaybackState>(() => getBellPlaybackState());

  useEffect(() => {
    return subscribeBellPlaybackState(setBellPlayback);
  }, []);

  const murottalAudioRef = useRef<HTMLAudioElement | null>(null);
  const persistentMurottalAudioRef = useRef<HTMLAudioElement | null>(null);
  const isMurottalStartingRef = useRef<boolean>(false);
  const customMurottalTracksRef = useRef<MurottalTrack[]>([]);
  const pendingMurottalRetryCleanupRef = useRef<(() => void) | null>(null);
  const murottalObjectUrlRef = useRef<string | null>(null);
  const firedMurottalKeysRef = useRef<Set<string>>(new Set());
  const activeMurottalEndAtRef = useRef<number | null>(null);
  const activeMurottalSlotRef = useRef<{ slotId: string; configuredStartTrackId: string } | null>(null);
  const consecutiveMurottalErrorsRef = useRef<number>(0);
  const isFadingMurottalRef = useRef<boolean>(false);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTargetBellKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const syncCustomMurottalTracks = () => {
      getCustomMurottalTracks()
        .then((tracks) => {
          customMurottalTracksRef.current = tracks;
        })
        .catch(() => {});
    };
    syncCustomMurottalTracks();
    window.addEventListener('murottal-tracks-updated', syncCustomMurottalTracks);
    return () => {
      window.removeEventListener('murottal-tracks-updated', syncCustomMurottalTracks);
    };
  }, []);

  // Today's Day of Week (0 = Minggu, 1 = Senin, ..., 6 = Sabtu)
  const todayDayNum = getDayOfWeekNumber(currentTime) as DayOfWeek;

  // Selected Day for previewing timetable (defaults to today)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDayNum);

  // Modal Manager States
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isAddExtraPeriodsOpen, setIsAddExtraPeriodsOpen] = useState(false);
  const [editingScheduleItem, setEditingScheduleItem] = useState<ScheduleItem | null>(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

  // Refs to guarantee scheduled bells NEVER fire twice in the same minute (even across duplicate schedules or multiple tabs)
  const firedMinutesRef = useRef<Set<string>>(new Set());
  const schedulesRef = useRef<ScheduleItem[]>(schedules);
  const audioSettingsRef = useRef<AudioSettings>(audioSettings);
  const murottalConfigRef = useRef<MurottalConfig>(murottalConfig);
  const triggerAutomaticBellRef = useRef<(item: ScheduleItem, dayNum: DayOfWeek) => Promise<void>>(async () => {});
  const handlePlayMurottalTrackRef = useRef<(track: MurottalTrack, options?: MurottalPlaybackOptions) => void>(() => {});
  const fadeOutAndStopMurottalRef = useRef<(durationMs?: number) => Promise<void>>(async () => {});

  const isInitialSchedulesMountRef = useRef<boolean>(true);
  const isInitialSettingsMountRef = useRef<boolean>(true);
  const isInitialLogsMountRef = useRef<boolean>(true);
  const isInitialMurottalMountRef = useRef<boolean>(true);
  const tabSyncIdRef = useRef<string>(`tab-${Math.random().toString(36).slice(2)}-${Date.now()}`);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const lastSerializedRef = useRef<{
    schedules: string;
    settings: string;
    logs: string;
    murottal: string;
  }>({
    schedules: '',
    settings: '',
    logs: '',
    murottal: '',
  });

  // Firebase Cloud Real-Time Sync State & Refs
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'connecting' | 'synced' | 'syncing' | 'error'>('connecting');
  const [cloudLoginError, setCloudLoginError] = useState<{
    code: string;
    domain: string;
    message: string;
  } | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const cloudSchoolExistsRef = useRef<boolean | null>(null);
  const cloudHadSchedulesRef = useRef<boolean>(false);
  const knownCloudScheduleIdsRef = useRef<Set<string>>(new Set());
  const skipNextCloudPushRef = useRef<{
    schedules: boolean;
    settings: boolean;
    murottal: boolean;
  }>({
    schedules: false,
    settings: false,
    murottal: false,
  });
  const cloudWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

  useEffect(() => {
    audioSettingsRef.current = audioSettings;
  }, [audioSettings]);

  useEffect(() => {
    murottalConfigRef.current = murottalConfig;
  }, [murottalConfig]);

  // Real-time Multi-Tab Sync (BroadcastChannel + localStorage storage event)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('sd_quran_bell_sync_v1');
        syncChannelRef.current = channel;
        channel.onmessage = (event) => {
          const msg = event?.data;
          if (!msg || msg.senderId === tabSyncIdRef.current) return;
          if (msg.type === 'schedules' && Array.isArray(msg.payload)) {
            const raw = JSON.stringify(msg.payload);
            if (raw !== lastSerializedRef.current.schedules) {
              lastSerializedRef.current.schedules = raw;
              setSchedules(msg.payload);
            }
          } else if (msg.type === 'settings' && msg.payload) {
            const raw = JSON.stringify(msg.payload);
            if (raw !== lastSerializedRef.current.settings) {
              lastSerializedRef.current.settings = raw;
              setAudioSettings(msg.payload);
            }
          } else if (msg.type === 'murottal' && msg.payload) {
            const raw = JSON.stringify(msg.payload);
            if (raw !== lastSerializedRef.current.murottal) {
              lastSerializedRef.current.murottal = raw;
              setMurottalConfig(msg.payload);
            }
          } else if (msg.type === 'logs' && Array.isArray(msg.payload)) {
            const raw = JSON.stringify(msg.payload);
            if (raw !== lastSerializedRef.current.logs) {
              lastSerializedRef.current.logs = raw;
              setBellLogs(msg.payload);
            }
          }
        };
      } catch {}
    }

    const handleStorageSync = (e: StorageEvent) => {
      if (!e.newValue) return;
      try {
        if (e.key === LOCAL_STORAGE_KEY_SCHEDULES && e.newValue !== lastSerializedRef.current.schedules) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            lastSerializedRef.current.schedules = e.newValue;
            setSchedules(parsed);
          }
        } else if (e.key === LOCAL_STORAGE_KEY_SETTINGS && e.newValue !== lastSerializedRef.current.settings) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            lastSerializedRef.current.settings = e.newValue;
            setAudioSettings(parsed);
          }
        } else if (e.key === LOCAL_STORAGE_KEY_MUROTTAL && e.newValue !== lastSerializedRef.current.murottal) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            lastSerializedRef.current.murottal = e.newValue;
            setMurottalConfig(parsed);
          }
        } else if (e.key === LOCAL_STORAGE_KEY_LOGS && e.newValue !== lastSerializedRef.current.logs) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            lastSerializedRef.current.logs = e.newValue;
            setBellLogs(parsed);
          }
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorageSync);
    return () => {
      window.removeEventListener('storage', handleStorageSync);
      if (channel) {
        try {
          channel.close();
        } catch {}
      }
      syncChannelRef.current = null;
    };
  }, []);

  // Persist Schedules & Broadcast to Other Open Tabs
  useEffect(() => {
    try {
      const serialized = JSON.stringify(schedules);
      if (isInitialSchedulesMountRef.current) {
        isInitialSchedulesMountRef.current = false;
        lastSerializedRef.current.schedules = serialized;
      } else if (serialized === lastSerializedRef.current.schedules) {
        return;
      }
      lastSerializedRef.current.schedules = serialized;
      localStorage.setItem(LOCAL_STORAGE_KEY_SCHEDULES, serialized);
      syncChannelRef.current?.postMessage({
        senderId: tabSyncIdRef.current,
        type: 'schedules',
        payload: schedules,
      });
    } catch (err) {
      console.error('Error saving schedules:', err);
    }
  }, [schedules]);

  // Persist Settings & Broadcast to Other Open Tabs
  useEffect(() => {
    try {
      const serialized = JSON.stringify(audioSettings);
      if (isInitialSettingsMountRef.current) {
        isInitialSettingsMountRef.current = false;
        lastSerializedRef.current.settings = serialized;
      } else if (serialized === lastSerializedRef.current.settings) {
        return;
      }
      lastSerializedRef.current.settings = serialized;
      localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, serialized);
      syncChannelRef.current?.postMessage({
        senderId: tabSyncIdRef.current,
        type: 'settings',
        payload: audioSettings,
      });
    } catch (err) {
      console.error('Error saving audio settings:', err);
    }
  }, [audioSettings]);

  // Persist Logs & Broadcast to Other Open Tabs
  useEffect(() => {
    try {
      const serialized = JSON.stringify(bellLogs);
      if (isInitialLogsMountRef.current) {
        isInitialLogsMountRef.current = false;
        lastSerializedRef.current.logs = serialized;
      } else if (serialized === lastSerializedRef.current.logs) {
        return;
      }
      lastSerializedRef.current.logs = serialized;
      localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, serialized);
      syncChannelRef.current?.postMessage({
        senderId: tabSyncIdRef.current,
        type: 'logs',
        payload: bellLogs,
      });
    } catch (err) {
      console.error('Error saving logs:', err);
    }
  }, [bellLogs]);

  // Persist Murottal Config & Broadcast to Other Open Tabs
  useEffect(() => {
    try {
      const serialized = JSON.stringify(murottalConfig);
      if (isInitialMurottalMountRef.current) {
        isInitialMurottalMountRef.current = false;
        lastSerializedRef.current.murottal = serialized;
      } else if (serialized !== lastSerializedRef.current.murottal) {
        lastSerializedRef.current.murottal = serialized;
        localStorage.setItem(LOCAL_STORAGE_KEY_MUROTTAL, serialized);
        syncChannelRef.current?.postMessage({
          senderId: tabSyncIdRef.current,
          type: 'murottal',
          payload: murottalConfig,
        });
      }
    } catch (err) {
      console.error('Error saving murottal config:', err);
    }
    if (murottalAudioRef.current && !isFadingMurottalRef.current) {
      murottalAudioRef.current.volume = murottalConfig.volume;
    }
  }, [murottalConfig]);

  // Firebase Auth & Real-Time Firestore Cross-Device Synchronization
  const pushAllLocalStateToCloud = async (uid: string) => {
    try {
      setCloudStatus('syncing');
      await pushSchoolConfigToCloud(
        audioSettingsRef.current,
        murottalConfigRef.current,
        uid
      );
      cloudSchoolExistsRef.current = true;
      const nextIds = await pushAllSchedulesToCloud(
        schedulesRef.current,
        knownCloudScheduleIdsRef.current,
        uid
      );
      knownCloudScheduleIdsRef.current = nextIds;
      setCloudStatus('synced');
    } catch (err) {
      console.error('Failed to push state to cloud:', err);
      setCloudStatus('error');
    }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCloudUser(user);
      if (user && user.emailVerified && cloudSchoolExistsRef.current === false) {
        pushAllLocalStateToCloud(user.uid);
      }
    });

    const unsubCloud = subscribeToCloudBellData(
      (schoolData) => {
        cloudSchoolExistsRef.current = schoolData.exists;
        if (!schoolData.exists) {
          if (auth.currentUser && auth.currentUser.emailVerified) {
            pushAllLocalStateToCloud(auth.currentUser.uid);
          } else {
            setCloudStatus('synced');
          }
          return;
        }

        if (schoolData.audioSettings) {
          const currentLocal = audioSettingsRef.current;
          const cloudPostBell = schoolData.audioSettings.postBellTracks || [];
          const cloudPostIds = new Set(cloudPostBell.map((t) => t.id));
          const localOnlyPostBell = (currentLocal.postBellTracks || []).filter(
            (t) => !cloudPostIds.has(t.id) && (t.audioUrl.startsWith('idb-audio://') || t.audioUrl.length > 240000)
          );

          const cloudChimes = schoolData.audioSettings.customChimes || [];
          const cloudChimeIds = new Set(cloudChimes.map((c) => c.id));
          const localOnlyChimes = (currentLocal.customChimes || []).filter(
            (c) => !cloudChimeIds.has(c.id) && (c.audioUrl.startsWith('idb-audio://') || c.audioUrl.length > 240000)
          );

          const localProfileMap = new Map<
            string,
            NonNullable<AudioSettings['clonedProfiles']>[number]
          >((currentLocal.clonedProfiles || []).map((p) => [p.id, p]));
          const mergedProfiles = (schoolData.audioSettings.clonedProfiles || []).map((cp) => {
            const lp = localProfileMap.get(cp.id);
            return {
              ...cp,
              sampleAudioUrl: cp.sampleAudioUrl || lp?.sampleAudioUrl,
            };
          });

          const localAsasMap = new Map<string, ScheduleItem>(
            (currentLocal.asasSchedules || []).map((s) => [s.id, s])
          );
          const mergedAsasSchedules = schoolData.audioSettings.asasSchedules
            ? schoolData.audioSettings.asasSchedules.map((cs) => {
                const lp = localAsasMap.get(cs.id);
                if (!lp) return cs;
                return {
                  ...cs,
                  customAudioUrl: cs.customAudioUrl || lp.customAudioUrl,
                  customChimeUrl: cs.customChimeUrl || lp.customChimeUrl,
                  customOutroChimeUrl: cs.customOutroChimeUrl || lp.customOutroChimeUrl,
                };
              })
            : currentLocal.asasSchedules;

          const mergedSettings: AudioSettings = {
            ...currentLocal,
            ...schoolData.audioSettings,
            customPrefixAudioUrl:
              schoolData.audioSettings.customPrefixAudioUrl || currentLocal.customPrefixAudioUrl,
            globalOutroChimeUrl:
              schoolData.audioSettings.globalOutroChimeUrl || currentLocal.globalOutroChimeUrl,
            clonedProfiles:
              mergedProfiles.length > 0 ? mergedProfiles : currentLocal.clonedProfiles,
            customChimes: [...cloudChimes, ...localOnlyChimes],
            postBellTracks: [...cloudPostBell, ...localOnlyPostBell],
            asasSchedules: mergedAsasSchedules,
          };
          const serialized = JSON.stringify(mergedSettings);
          if (serialized !== JSON.stringify(currentLocal)) {
            skipNextCloudPushRef.current.settings = true;
            setAudioSettings(mergedSettings);
          }
        }

        if (schoolData.murottalConfig) {
          const serialized = JSON.stringify(schoolData.murottalConfig);
          if (serialized !== JSON.stringify(murottalConfigRef.current)) {
            skipNextCloudPushRef.current.murottal = true;
            setMurottalConfig(schoolData.murottalConfig);
          }
        }

        setCloudStatus('synced');
      },
      (cloudSchedules) => {
        knownCloudScheduleIdsRef.current = new Set(cloudSchedules.map((s) => s.id));
        if (cloudSchedules.length > 0) {
          cloudHadSchedulesRef.current = true;
        }
        if (cloudSchedules.length > 0 || cloudHadSchedulesRef.current) {
          const localMap = new Map<string, ScheduleItem>(
            schedulesRef.current.map((s) => [s.id, s])
          );
          const mergedSchedules = cloudSchedules.map((cs) => {
            const localItem = localMap.get(cs.id);
            if (!localItem) return cs;
            return {
              ...cs,
              customAudioUrl: cs.customAudioUrl || localItem.customAudioUrl,
              customChimeUrl: cs.customChimeUrl || localItem.customChimeUrl,
              customOutroChimeUrl: cs.customOutroChimeUrl || localItem.customOutroChimeUrl,
            };
          });
          const serialized = JSON.stringify(mergedSchedules);
          if (serialized !== JSON.stringify(schedulesRef.current)) {
            skipNextCloudPushRef.current.schedules = true;
            setSchedules(mergedSchedules);
          }
        }
        setCloudStatus('synced');
      },
      () => {
        setCloudStatus('error');
      }
    );

    return () => {
      unsubAuth();
      unsubCloud();
      if (cloudWriteTimerRef.current) {
        clearTimeout(cloudWriteTimerRef.current);
      }
    };
  }, []);

  // Automatically sync local edits to Cloud Firestore (debounced) when signed in as verified Admin
  useEffect(() => {
    if (!cloudUser || !cloudUser.emailVerified) return;
    const anyLocalEdit =
      !skipNextCloudPushRef.current.schedules ||
      !skipNextCloudPushRef.current.settings ||
      !skipNextCloudPushRef.current.murottal;

    const pushSchedulesNow = !skipNextCloudPushRef.current.schedules;
    const pushConfigNow =
      !skipNextCloudPushRef.current.settings || !skipNextCloudPushRef.current.murottal;

    skipNextCloudPushRef.current = {
      schedules: false,
      settings: false,
      murottal: false,
    };

    if (!anyLocalEdit || cloudSchoolExistsRef.current === null) return;

    if (cloudWriteTimerRef.current) {
      clearTimeout(cloudWriteTimerRef.current);
    }

    cloudWriteTimerRef.current = setTimeout(async () => {
      try {
        setCloudStatus('syncing');
        if (pushConfigNow || !cloudSchoolExistsRef.current) {
          await pushSchoolConfigToCloud(
            audioSettingsRef.current,
            murottalConfigRef.current,
            cloudUser.uid
          );
          cloudSchoolExistsRef.current = true;
        }
        if (pushSchedulesNow) {
          const nextIds = await pushAllSchedulesToCloud(
            schedulesRef.current,
            knownCloudScheduleIdsRef.current,
            cloudUser.uid
          );
          knownCloudScheduleIdsRef.current = nextIds;
        }
        setCloudStatus('synced');
      } catch (err) {
        console.error('Cloud auto-sync error:', err);
        setCloudStatus('error');
      }
    }, 450);
  }, [schedules, audioSettings, murottalConfig, cloudUser]);

  const isSigningInRef = useRef<boolean>(false);

  const handleCloudLogin = async () => {
    if (isSigningInRef.current) return;
    isSigningInRef.current = true;
    setCloudLoginError(null);
    setCopiedDomain(false);
    try {
      await signInWithPopup(auth, googleProvider);
      setCloudLoginError(null);
    } catch (err: any) {
      const code = err?.code || 'unknown';
      const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        console.warn('Google Sign-In popup ditutup atau dibatalkan oleh pengguna.');
      } else if (code === 'auth/unauthorized-domain') {
        console.error('Google Sign-In unauthorized domain:', currentDomain, err);
        setCloudLoginError({
          code,
          domain: currentDomain,
          message:
            `Domain "${currentDomain}" belum didaftarkan di Firebase Authorized Domains. Tambahkan domain ini di Firebase Console → Authentication → Settings → Authorized domains agar Login Sync bisa digunakan di Vercel.`,
        });
      } else if (code === 'auth/popup-blocked') {
        console.error('Google Sign-In popup blocked:', err);
        setCloudLoginError({
          code,
          domain: currentDomain,
          message:
            'Pop-up login Google diblokir oleh browser Anda. Mohon izinkan Pop-up pada ikon di sebelah kanan kolom alamat browser, lalu klik Login Sync lagi.',
        });
      } else {
        console.error('Google Sign-In error:', err);
        setCloudLoginError({
          code,
          domain: currentDomain,
          message: err?.message || 'Gagal melakukan Login Sync Google. Silakan coba lagi.',
        });
      }
    } finally {
      isSigningInRef.current = false;
    }
  };

  const handleCloudLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Google Sign-Out error:', err);
    }
  };

  const handleForcePushCloud = async () => {
    if (!cloudUser || !cloudUser.emailVerified) {
      await handleCloudLogin();
      return;
    }
    await pushAllLocalStateToCloud(cloudUser.uid);
  };

  // Perform Time Synchronization
  const performTimeSync = async () => {
    setTimeSyncInfo((prev) => ({ ...prev, status: 'syncing' }));
    const result = await syncTimeWithAPI();
    setTimeSyncInfo((prev) => ({
      ...prev,
      status: 'synced',
      lastSynced: Date.now(),
      offsetMs: result.offsetMs,
      latencyMs: result.latencyMs,
      source: result.source,
    }));
  };

  // Initial Time Sync & Automatic Audio Unlock on Mount
  useEffect(() => {
    performTimeSync();

    // Prime one persistent <audio> element once so Chromium allows future scheduled Murottal auto-play
    const SILENT_WAV_DATA_URL =
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    const primePersistentMurottalElement = () => {
      try {
        if (isMurottalStartingRef.current) return;
        if (!persistentMurottalAudioRef.current) {
          const el = new Audio();
          el.preload = 'auto';
          persistentMurottalAudioRef.current = el;
        }
        const el = persistentMurottalAudioRef.current;
        if (el.paused && !el.getAttribute('src')) {
          el.muted = true;
          el.src = SILENT_WAV_DATA_URL;
          el.play()
            .then(() => {
              if (!isMurottalStartingRef.current && el.src === SILENT_WAV_DATA_URL) {
                el.pause();
                el.muted = false;
                el.removeAttribute('src');
                el.load();
              }
            })
            .catch(() => {
              if (!isMurottalStartingRef.current && el.src === SILENT_WAV_DATA_URL) {
                el.muted = false;
                el.removeAttribute('src');
              }
            });
        }
      } catch {}
    };

    // Check if browser already allows audio playback (e.g. site sound permission is Allowed or --autoplay-policy flag)
    const ctx = getAudioContext();
    if (ctx.state === 'running') {
      setIsAudioUnlocked(true);
      primePersistentMurottalElement();
    } else {
      ctx.resume().then(() => {
        if (ctx.state === 'running') {
          setIsAudioUnlocked(true);
          primePersistentMurottalElement();
        }
      }).catch(() => {});
    }

    // Attach global window listeners: any click or key anywhere unlocks BOTH AudioContext and Murottal <audio>
    const unlockOnGesture = () => {
      const c = getAudioContext();
      if (c.state === 'suspended') {
        c.resume().then(() => {
          setIsAudioUnlocked(true);
        }).catch(() => {});
      } else {
        setIsAudioUnlocked(true);
      }
      primePersistentMurottalElement();
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
      window.removeEventListener('click', unlockOnGesture);
    };

    window.addEventListener('pointerdown', unlockOnGesture, { passive: true });
    window.addEventListener('keydown', unlockOnGesture, { passive: true });
    window.addEventListener('click', unlockOnGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
      window.removeEventListener('click', unlockOnGesture);
    };
  }, []);

  // Keep-alive heartbeat & Screen WakeLock so browser doesn't sleep audio or background thread overnight
  useEffect(() => {
    let wakeLockSentinel: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        // Tab not focused or WakeLock unsupported - ignore gracefully
      }
    };
    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Subtle audio heartbeat every 20 seconds to prevent AudioContext suspension
    const heartbeatInterval = setInterval(() => {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }, 20000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(heartbeatInterval);
      if (wakeLockSentinel && wakeLockSentinel.release) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  // Periodic Background Time Sync
  useEffect(() => {
    const intervalMs = Math.max(1, syncIntervalMinutes) * 60 * 1000;
    const interval = setInterval(() => {
      performTimeSync();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [syncIntervalMinutes]);

  // Master 1-Second Clock & Bell Evaluator Loop
  useEffect(() => {
    const LOCAL_AUTO_BELL_LOCK_KEY = 'sd_quran_auto_bell_minute_lock_v1';

    const clockInterval = setInterval(() => {
      const now = getSynchronizedDate();
      setCurrentTime(now);

      const currentSchedules = schedulesRef.current;
      const currentSettings = audioSettingsRef.current;
      const currentMurottal = murottalConfigRef.current;

      const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentHHMM = format24HourTime(now, false); // HH:MM
      const dayNum = getDayOfWeekNumber(now) as DayOfWeek;
      const disabledDays = currentSettings.disabledDays ?? [0];
      const isTodayDisabled = disabledDays.includes(dayNum);

      // If today (e.g. Sabtu or Minggu) is disabled, DO NOT trigger Murottal or Bells even if PC stays on
      if (!isTodayDisabled) {
        // 1. Check Automatic Murottal Trigger (Set-based per-date-minute deduplication)
        const slotsToEvaluate =
          currentMurottal.scheduleSlots && currentMurottal.scheduleSlots.length > 0
            ? currentMurottal.scheduleSlots
            : [
                {
                  id: 'slot-pagi',
                  time: currentMurottal.autoStartTime || '06:00',
                  label: 'Murottal Pagi Otomatis',
                  enabled: currentMurottal.enabledAutoPlay,
                  trackId: currentMurottal.selectedTrackId,
                  days: currentMurottal.activeDays,
                },
              ];

        slotsToEvaluate.forEach((slot) => {
          if (
            slot.enabled &&
            currentHHMM === slot.time &&
            slot.days.includes(dayNum)
          ) {
            const mKey = `${dateKey}-${currentHHMM}-murottal-${slot.id}`;
            if (!firedMurottalKeysRef.current.has(mKey)) {
              firedMurottalKeysRef.current.add(mKey);
              if (firedMurottalKeysRef.current.size > 50) {
                firedMurottalKeysRef.current.clear();
                firedMurottalKeysRef.current.add(mKey);
              }
              const allKnownTracks = [
                ...DEFAULT_JUZ_30_TRACKS,
                ...customMurottalTracksRef.current,
              ];
              const configuredStartTrackId =
                (slot.trackId && allKnownTracks.some((t) => t.id === slot.trackId)
                  ? slot.trackId
                  : null) ||
                (currentMurottal.selectedTrackId &&
                allKnownTracks.some((t) => t.id === currentMurottal.selectedTrackId)
                  ? currentMurottal.selectedTrackId
                  : null) ||
                DEFAULT_JUZ_30_TRACKS[1].id;

              // Check saved sequential position in localStorage: continue sequentially next day unless user picked a different starting track
              const savedProgress = readMurottalProgressStorage();
              const slotSaved = savedProgress.slotProgress?.[slot.id];
              const resumeId =
                slotSaved &&
                slotSaved.configuredStartTrackId === configuredStartTrackId &&
                allKnownTracks.some((t) => t.id === slotSaved.resumeTrackId)
                  ? slotSaved.resumeTrackId
                  : configuredStartTrackId;

              const targetTrack =
                allKnownTracks.find((t) => t.id === resumeId) ||
                allKnownTracks.find((t) => t.id === configuredStartTrackId) ||
                DEFAULT_JUZ_30_TRACKS[1];

              const endAtMs =
                slot.stopAfterMinutes && slot.stopAfterMinutes > 0
                  ? now.getTime() + slot.stopAfterMinutes * 60 * 1000
                  : null;

              handlePlayMurottalTrackRef.current(targetTrack, {
                scheduledSlotContext: {
                  slotId: slot.id,
                  configuredStartTrackId,
                  endAtMs,
                },
              });

              // Add audit log
              const newLog: BellLog = {
                id: `log-murottal-${Date.now()}`,
                timestamp: Date.now(),
                timeStr: currentHHMM,
                dayName: getIndonesianDayName(dayNum),
                scheduleLabel: slot.label || `Murottal Otomatis: ${targetTrack.title}`,
                triggerType: 'auto',
                status: 'success',
                details: `Pemutaran murottal otomatis jam ${currentHHMM} WIB (${targetTrack.title} - ${targetTrack.reciter}).`,
              };
              setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);
            }
          }
        });

        // 1a. End-of-Slot Smooth Fade-Out (when scheduled stopAfterMinutes expires)
        if (
          activeMurottalEndAtRef.current !== null &&
          murottalAudioRef.current &&
          !murottalAudioRef.current.paused &&
          !isFadingMurottalRef.current
        ) {
          const msRemaining = activeMurottalEndAtRef.current - now.getTime();
          if (msRemaining <= 5000) {
            activeMurottalEndAtRef.current = null;
            const fadeMs = Math.max(1500, Math.min(5000, msRemaining > 0 ? msRemaining : 2500));
            fadeOutAndStopMurottalRef.current(fadeMs);
          }
        }

        // 1b. Pre-Bell Smooth Murottal Fade-Out (~9s before any scheduled bell such as 07:00)
        // Ensures Qur'an recitation fades out gently & stops completely BEFORE the bell strikes
        if (
          currentMurottal.autoStopOnBell !== false &&
          murottalAudioRef.current &&
          !murottalAudioRef.current.paused &&
          !isFadingMurottalRef.current
        ) {
          const nowTotalSecs =
            now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
          const enabledTodayBells = getEffectiveDaySchedules(
            currentSchedules,
            dayNum,
            currentSettings
          );

          for (const bell of enabledTodayBells) {
            const [bhStr, bmStr] = bell.time.split(':');
            const bellSecs = parseInt(bhStr, 10) * 3600 + parseInt(bmStr, 10) * 60;
            const diffSecs = bellSecs - nowTotalSecs;
            const upcomingBellKey = `${dateKey}-${bell.time}`;

            if (
              diffSecs > 0 &&
              diffSecs <= 10 &&
              !firedMinutesRef.current.has(upcomingBellKey) &&
              fadeTargetBellKeyRef.current !== upcomingBellKey
            ) {
              activeMurottalEndAtRef.current = null;
              fadeTargetBellKeyRef.current = upcomingBellKey;
              const fadeDurationMs = Math.max(1500, Math.round((diffSecs - 0.8) * 1000));
              fadeOutAndStopMurottalRef.current(fadeDurationMs);
              break;
            }
          }
        }

        // 2. Check Scheduled Bells for current HH:MM — strictly ONCE per minute (prevents duplicate readings)
        const minuteKey = `${dateKey}-${currentHHMM}`;
        if (!firedMinutesRef.current.has(minuteKey)) {
          const matchingBells = getEffectiveDaySchedules(
            currentSchedules,
            dayNum,
            currentSettings
          ).filter((item) => item.time === currentHHMM);

          if (matchingBells.length > 0) {
            // Mark minute immediately before any async call
            firedMinutesRef.current.add(minuteKey);
            if (firedMinutesRef.current.size > 60) {
              firedMinutesRef.current.clear();
              firedMinutesRef.current.add(minuteKey);
            }

            // Cross-tab lock so two open browser tabs never read the same scheduled bell twice
            let lockedByOtherTab = false;
            try {
              const prevLock = localStorage.getItem(LOCAL_AUTO_BELL_LOCK_KEY);
              if (prevLock === minuteKey) {
                lockedByOtherTab = true;
              } else {
                localStorage.setItem(LOCAL_AUTO_BELL_LOCK_KEY, minuteKey);
              }
            } catch {}

            if (!lockedByOtherTab) {
              // If multiple schedules overlap at exact same HH:MM, pick the most recently customized one so it never plays twice
              const chosenBell =
                matchingBells.length === 1
                  ? matchingBells[0]
                  : [...matchingBells].reverse().find((b) => b.id.startsWith('sch-') || (b.audioType && b.audioType !== 'tts')) ||
                    matchingBells[matchingBells.length - 1];

              triggerAutomaticBellRef.current(chosenBell, dayNum);
            }
          }
        }
      }
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  const clearMurottalFade = () => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    isFadingMurottalRef.current = false;
  };

  // Gently fade murottal volume down to 0 and pause cleanly so verses never cut off abruptly
  const fadeOutAndStopMurottal = (durationMs = 8000): Promise<void> => {
    return new Promise((resolve) => {
      const audio = murottalAudioRef.current;
      if (!audio || audio.paused) {
        clearMurottalFade();
        setIsMurottalPlaying(false);
        resolve();
        return;
      }

      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }

      isFadingMurottalRef.current = true;
      const startVolume = Math.max(0, Math.min(1, audio.volume || murottalConfigRef.current.volume || 0.7));
      if (startVolume <= 0.005) {
        audio.volume = 0;
        audio.pause();
        clearMurottalFade();
        setIsMurottalPlaying(false);
        resolve();
        return;
      }

      const startTime = Date.now();
      const stepMs = 60;

      fadeIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / Math.max(300, durationMs));

        if (!murottalAudioRef.current || murottalAudioRef.current !== audio || audio.paused) {
          clearMurottalFade();
          setIsMurottalPlaying(false);
          resolve();
          return;
        }

        // Smooth natural acoustic fade curve so volume drops progressively and softly to silence
        const easedGain = Math.pow(1 - progress, 1.5);
        audio.volume = Math.max(0, Math.min(1, startVolume * easedGain));

        if (progress >= 1) {
          audio.volume = 0;
          audio.pause();
          clearMurottalFade();
          setIsMurottalPlaying(false);
          resolve();
        }
      }, stepMs);
    });
  };

  fadeOutAndStopMurottalRef.current = fadeOutAndStopMurottal;

  // Murottal Audio Controls (Offline-first: CacheStorage -> IndexedDB -> Online Stream, with sequential Juz 30 progression)
  const handlePlayMurottalTrack = async (
    track: MurottalTrack,
    options?: MurottalPlaybackOptions
  ) => {
    isMurottalStartingRef.current = true;
    try {
      clearMurottalFade();
      fadeTargetBellKeyRef.current = null;
      if (options?.scheduledSlotContext) {
        activeMurottalSlotRef.current = {
          slotId: options.scheduledSlotContext.slotId,
          configuredStartTrackId: options.scheduledSlotContext.configuredStartTrackId,
        };
        activeMurottalEndAtRef.current = options.scheduledSlotContext.endAtMs;
      } else if (!options?.preserveScheduleSession) {
        activeMurottalSlotRef.current = null;
        activeMurottalEndAtRef.current = null;
      }

      if (pendingMurottalRetryCleanupRef.current) {
        pendingMurottalRetryCleanupRef.current();
        pendingMurottalRetryCleanupRef.current = null;
      }
      setActiveMurottalTrack(track);

      // Unlock Audio Context gracefully
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (!persistentMurottalAudioRef.current) {
        const el = new Audio();
        el.preload = 'auto';
        persistentMurottalAudioRef.current = el;
      }
      const audio = persistentMurottalAudioRef.current;

      // Reset previous handlers cleanly before changing src
      audio.onplay = null;
      audio.onerror = null;
      audio.onended = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();

      if (murottalObjectUrlRef.current) {
        URL.revokeObjectURL(murottalObjectUrlRef.current);
        murottalObjectUrlRef.current = null;
      }

      const exactAudioUrl = (track.audioUrl || '').trim();
      let resolvedSrc = exactAudioUrl;
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

      const getOrderedPlaylist = (): MurottalTrack[] => [
        ...DEFAULT_JUZ_30_TRACKS,
        ...customMurottalTracksRef.current,
      ];

      const persistProgressForTrack = (playedTrack: MurottalTrack) => {
        const playlist = getOrderedPlaylist();
        const idx = playlist.findIndex((t) => t.id === playedTrack.id);
        const nextIdx = idx >= 0 ? (idx + 1) % playlist.length : 1;
        const nextTrackId =
          murottalConfigRef.current.repeatMode === 'repeat_one'
            ? playedTrack.id
            : playlist[nextIdx]?.id || DEFAULT_JUZ_30_TRACKS[1].id;
        const prevProgress = readMurottalProgressStorage();
        const nextProgress: MurottalProgressStorage = {
          ...prevProgress,
          lastPlayedTrackId: playedTrack.id,
          nextTrackId,
        };
        if (activeMurottalSlotRef.current) {
          nextProgress.slotProgress = {
            ...(prevProgress.slotProgress || {}),
            [activeMurottalSlotRef.current.slotId]: {
              configuredStartTrackId: activeMurottalSlotRef.current.configuredStartTrackId,
              resumeTrackId: nextTrackId,
              updatedAt: Date.now(),
            },
          };
        }
        writeMurottalProgressStorage(nextProgress);
      };

      const advanceToNextTrack = async () => {
        if (activeMurottalEndAtRef.current !== null && Date.now() >= activeMurottalEndAtRef.current) {
          activeMurottalEndAtRef.current = null;
          activeMurottalSlotRef.current = null;
          setIsMurottalPlaying(false);
          return;
        }

        const playlist = getOrderedPlaylist();
        const currentIndex = playlist.findIndex((t) => t.id === track.id);
        const startIdx = currentIndex >= 0 ? currentIndex : 0;

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          // While offline, advance sequentially to the next cached track in order (e.g. 001 -> 078 -> 079 -> ... -> 114)
          for (let offset = 1; offset <= playlist.length; offset++) {
            const candidate = playlist[(startIdx + offset) % playlist.length];
            const cUrl = (candidate.audioUrl || '').trim();
            const isLocal = cUrl.startsWith('data:') || cUrl.startsWith(IDB_AUDIO_PREFIX);
            const isCached = isLocal || (await isExternalAudioCachedAndValid(cUrl));
            if (isCached) {
              if (candidate.id === track.id) {
                audio.currentTime = 0;
                audio.play().catch(() => {});
              } else {
                handlePlayMurottalTrack(candidate, { preserveScheduleSession: true });
              }
              return;
            }
          }
          setIsMurottalPlaying(false);
          return;
        }

        const nextIndex = (startIdx + 1) % playlist.length;
        handlePlayMurottalTrack(playlist[nextIndex], { preserveScheduleSession: true });
      };

      if (exactAudioUrl.startsWith('http://') || exactAudioUrl.startsWith('https://')) {
        // Priority 1: Search Cache Storage & IndexedDB offline store using the EXACT URL key
        const cachedBlobUrl = await getBlobUrlFromOfflineCache(exactAudioUrl);
        if (cachedBlobUrl) {
          murottalObjectUrlRef.current = cachedBlobUrl;
          resolvedSrc = cachedBlobUrl;
        } else if (isOffline) {
          console.warn('Murottal belum tersimpan di cache offline:', exactAudioUrl);
          if (
            (options?.scheduledSlotContext || options?.preserveScheduleSession) &&
            consecutiveMurottalErrorsRef.current < 38
          ) {
            consecutiveMurottalErrorsRef.current++;
            await advanceToNextTrack();
            return;
          }
          setIsMurottalPlaying(false);
          return;
        } else {
          // Online and not yet cached: route Google Drive through proxy, and cache in background
          if (isGoogleDriveUrl(exactAudioUrl)) {
            resolvedSrc = `/api/audio/proxy?url=${encodeURIComponent(exactAudioUrl)}`;
          }
          fetchAndCacheExternalAudio(exactAudioUrl).catch(() => {});
        }
      } else if (exactAudioUrl.startsWith(IDB_AUDIO_PREFIX)) {
        const idbBlob = await getAudioBlobFromIDB(exactAudioUrl);
        if (idbBlob) {
          const blobUrl = URL.createObjectURL(idbBlob);
          murottalObjectUrlRef.current = blobUrl;
          resolvedSrc = blobUrl;
        }
      }

      audio.preload = 'auto';
      audio.muted = false;
      audio.volume = Math.max(0, Math.min(1.0, murottalConfigRef.current.volume));
      audio.src = resolvedSrc;
      murottalAudioRef.current = audio;

      audio.onplay = () => {
        consecutiveMurottalErrorsRef.current = 0;
        setIsMurottalPlaying(true);
        setIsAudioUnlocked(true);
        persistProgressForTrack(track);
      };

      audio.onerror = (e) => {
        console.warn('Murottal audio load error:', e, 'URL:', exactAudioUrl);
        if (
          !isFadingMurottalRef.current &&
          (activeMurottalSlotRef.current || options?.preserveScheduleSession) &&
          consecutiveMurottalErrorsRef.current < 5
        ) {
          consecutiveMurottalErrorsRef.current++;
          setTimeout(() => {
            advanceToNextTrack().catch(() => setIsMurottalPlaying(false));
          }, 300);
          return;
        }
        setIsMurottalPlaying(false);
      };

      audio.onended = async () => {
        if (isFadingMurottalRef.current) {
          clearMurottalFade();
          setIsMurottalPlaying(false);
          return;
        }
        if (murottalConfigRef.current.repeatMode === 'repeat_one') {
          if (activeMurottalEndAtRef.current !== null && Date.now() >= activeMurottalEndAtRef.current) {
            activeMurottalEndAtRef.current = null;
            activeMurottalSlotRef.current = null;
            setIsMurottalPlaying(false);
            return;
          }
          audio.currentTime = 0;
          audio.play().catch(() => {});
          return;
        }

        await advanceToNextTrack();
      };

      const startPlayback = () => {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsMurottalPlaying(true);
              setIsAudioUnlocked(true);
            })
            .catch((err) => {
              console.warn('Murottal autoplay recovery triggered:', err);
              const c = getAudioContext();
              c.resume()
                .then(() => audio.play())
                .then(() => {
                  setIsMurottalPlaying(true);
                  setIsAudioUnlocked(true);
                })
                .catch(() => {
                  setIsMurottalPlaying(false);
                  // Register one-time gesture resume if browser requires initial click
                  const resumeOnGesture = () => {
                    cleanupRetry();
                    audio
                      .play()
                      .then(() => {
                        setIsMurottalPlaying(true);
                        setIsAudioUnlocked(true);
                      })
                      .catch(() => {});
                  };
                  const cleanupRetry = () => {
                    window.removeEventListener('pointerdown', resumeOnGesture);
                    window.removeEventListener('keydown', resumeOnGesture);
                    window.removeEventListener('click', resumeOnGesture);
                  };
                  pendingMurottalRetryCleanupRef.current = cleanupRetry;
                  window.addEventListener('pointerdown', resumeOnGesture, { once: true, passive: true });
                  window.addEventListener('keydown', resumeOnGesture, { once: true, passive: true });
                  window.addEventListener('click', resumeOnGesture, { once: true, passive: true });
                });
            });
        }
      };

      startPlayback();
    } catch (e) {
      console.error('Error starting murottal:', e);
      setIsMurottalPlaying(false);
    } finally {
      isMurottalStartingRef.current = false;
    }
  };

  const handlePauseMurottal = () => {
    clearMurottalFade();
    if (murottalAudioRef.current) {
      murottalAudioRef.current.pause();
    }
    setIsMurottalPlaying(false);
  };

  const handleResumeMurottal = () => {
    clearMurottalFade();
    fadeTargetBellKeyRef.current = null;
    if (murottalAudioRef.current) {
      murottalAudioRef.current.volume = Math.max(0, Math.min(1.0, murottalConfigRef.current.volume));
      murottalAudioRef.current.play().then(() => {
        setIsMurottalPlaying(true);
      }).catch(() => {});
    } else if (activeMurottalTrack) {
      handlePlayMurottalTrack(activeMurottalTrack);
    }
  };

  const handleStopMurottal = () => {
    clearMurottalFade();
    fadeTargetBellKeyRef.current = null;
    activeMurottalEndAtRef.current = null;
    activeMurottalSlotRef.current = null;
    if (murottalAudioRef.current) {
      murottalAudioRef.current.pause();
      murottalAudioRef.current.currentTime = 0;
      murottalAudioRef.current.volume = Math.max(0, Math.min(1.0, murottalConfigRef.current.volume));
    }
    setIsMurottalPlaying(false);
  };

  // Trigger Automatic Bell
  const triggerAutomaticBell = async (item: ScheduleItem, dayNum: DayOfWeek) => {
    // If murottal is still fading or playing when the bell triggers, let it fade smoothly to silence first
    if (murottalConfigRef.current.autoStopOnBell !== false) {
      if (isFadingMurottalRef.current) {
        await new Promise((res) => setTimeout(res, 900));
      }
      if (murottalAudioRef.current && !murottalAudioRef.current.paused) {
        await fadeOutAndStopMurottal(1800);
      }
    }

    const fullText = `${audioSettings.globalPrefix}${item.speechText}`;

    // Add log entry
    const newLog: BellLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: item.time,
      dayName: getIndonesianDayName(dayNum),
      scheduleLabel: item.label,
      triggerType: 'auto',
      status: 'success',
      details: item.audioType === 'recording' ? `[Suara Rekaman] ${item.customAudioName || 'Audio Sendiri'}` : fullText,
    };
    setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);

    try {
      const dismissalTargets =
        item.id === FRIDAY_EARLY_DISMISSAL_ID ||
        (audioSettingsRef.current.asasModeEnabled && item.category === 'dismissal')
          ? getDismissalPostBellMatchTargets(schedulesRef.current)
          : null;

      await playBellSequence(
        item.chimeType,
        fullText,
        audioSettings,
        item.volume,
        item.customAudioUrl,
        item.audioType || 'tts',
        item.clonedVoiceId,
        item.customChimeUrl,
        item.enableOutroChime,
        item.outroChimeType,
        item.customOutroChimeUrl,
        item.speechLanguage || 'id',
        item.speechInputMode || 'auto_translate',
        item.translatedSpeechText,
        {
          label: `${item.time} - ${item.label}`,
          scheduleId: item.id,
          scheduleTime: item.time,
          ...(dismissalTargets
            ? {
                fallbackMatchScheduleIds: dismissalTargets.matchIds,
                fallbackMatchTimes: dismissalTargets.matchTimes,
              }
            : {}),
        }
      );
    } catch (err) {
      console.error('Error firing automatic bell sequence:', err);
    }
  };

  triggerAutomaticBellRef.current = triggerAutomaticBell;
  handlePlayMurottalTrackRef.current = handlePlayMurottalTrack;

  // Global Day Mute/Off Toggle (specifically for disabling Saturday / Sunday Bells + Murottal)
  const disabledDays = audioSettings.disabledDays ?? [0];
  const handleToggleDisabledDay = (day: DayOfWeek) => {
    setAudioSettings((prev) => {
      const current = prev.disabledDays ?? [0];
      const exists = current.includes(day);
      const next = exists ? current.filter((d) => d !== day) : [...current, day];
      return {
        ...prev,
        disabledDays: next,
      };
    });
  };

  const fridayEarlyTime = getFridayEarlyDismissalTime(audioSettings);
  const handleToggleFridayExtraOff = () => {
    const nextOff = !audioSettings.fridayExtraOff;
    const earlyTime = getFridayEarlyDismissalTime(audioSettings);
    setAudioSettings((prev) => ({
      ...prev,
      fridayExtraOff: nextOff,
      fridayEarlyDismissalTime: prev.fridayEarlyDismissalTime || '12:30',
    }));

    const newLog: BellLog = {
      id: `log-friday-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: format24HourTime(currentTime, false),
      dayName: 'Jumat',
      scheduleLabel: nextOff
        ? `Ekstra Jumat Diliburkan (Pulang ${earlyTime} WIB)`
        : 'Ekstra Jumat Diaktifkan (Jadwal Normal)',
      triggerType: 'manual',
      status: 'success',
      details: nextOff
        ? `Bel pulang otomatis dijadwalkan pukul ${earlyTime} WIB beserta rekaman tambahan otomatis.`
        : 'Jadwal bel hari Jumat kembali mengikuti pengaturan normal.',
    };
    setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);
  };

  const handleUpdateFridayEarlyTime = (time: string) => {
    setAudioSettings((prev) => ({
      ...prev,
      fridayEarlyDismissalTime: time,
    }));
  };

  const asasModeEnabled = Boolean(audioSettings.asasModeEnabled);
  const activeModeSchedules = asasModeEnabled
    ? audioSettings.asasSchedules && audioSettings.asasSchedules.length > 0
      ? audioSettings.asasSchedules
      : DEFAULT_ASAS_SCHEDULES
    : schedules;

  const handleToggleAsasMode = () => {
    const nextAsas = !audioSettings.asasModeEnabled;
    setAudioSettings((prev) => ({
      ...prev,
      asasModeEnabled: nextAsas,
      asasSchedules:
        prev.asasSchedules && prev.asasSchedules.length > 0
          ? prev.asasSchedules
          : DEFAULT_ASAS_SCHEDULES,
    }));

    const newLog: BellLog = {
      id: `log-asas-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: format24HourTime(currentTime, false),
      dayName: getIndonesianDayName(todayDayNum),
      scheduleLabel: nextAsas
        ? 'Mode ASAS Diaktifkan (Jadwal Asesmen Akhir Semester)'
        : 'Mode ASAS Dinonaktifkan (Kembali ke Jadwal Normal)',
      triggerType: 'manual',
      status: 'success',
      details: nextAsas
        ? 'Jadwal bel beralih ke jadwal khusus ASAS (07:00 - 12:30 WIB).'
        : 'Jadwal bel kembali menggunakan jadwal harian reguler sekolah.',
    };
    setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);
  };

  // Calculate Next Bell Countdown for Today
  let nextScheduleItem: ScheduleItem | null = null;
  let countdownSeconds: number | null = null;

  const currentSecsTotal =
    currentTime.getHours() * 3600 +
    currentTime.getMinutes() * 60 +
    currentTime.getSeconds();

  const isTodayGloballyDisabled = disabledDays.includes(todayDayNum);
  const todayActiveSchedules = isTodayGloballyDisabled
    ? []
    : getEffectiveDaySchedules(schedules, todayDayNum, audioSettings);

  for (const item of todayActiveSchedules) {
    const [hStr, mStr] = item.time.split(':');
    const targetSecsTotal = parseInt(hStr, 10) * 3600 + parseInt(mStr, 10) * 60;

    if (targetSecsTotal > currentSecsTotal) {
      nextScheduleItem = item;
      countdownSeconds = targetSecsTotal - currentSecsTotal;
      break;
    }
  }

  // Current or most recent scheduled bell earlier today (for quick manual replay button near clock/date)
  let latestScheduleItem: ScheduleItem | null = null;
  const todayScheduledSorted = getEffectiveDaySchedules(
    schedules,
    todayDayNum,
    audioSettings
  );

  for (const item of todayScheduledSorted) {
    const [hStr, mStr] = item.time.split(':');
    const targetSecsTotal = parseInt(hStr, 10) * 3600 + parseInt(mStr, 10) * 60;
    if (targetSecsTotal <= currentSecsTotal) {
      latestScheduleItem = item;
    }
  }

  // Quick Test Bell
  const handleQuickTestBell = async () => {
    if (murottalConfigRef.current.autoStopOnBell !== false && murottalAudioRef.current && !murottalAudioRef.current.paused) {
      await fadeOutAndStopMurottal(1800);
    }

    const testText = `${audioSettings.globalPrefix}saatnya jam pelajaran ke-1, Tahfidzul Qur'an. Ini adalah tes uji coba bell otomatis.`;
    
    // Log test
    const newLog: BellLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: format24HourTime(currentTime, false),
      dayName: getIndonesianDayName(todayDayNum),
      scheduleLabel: "Tes Bell Seketika (Header Test)",
      triggerType: 'test',
      status: 'success',
      details: testText,
    };
    setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);

    await playBellSequence('westminster', testText, audioSettings, 1.0, undefined, 'tts', undefined, undefined, undefined, undefined, undefined, 'id', 'auto_translate', undefined, {
      label: 'Tes Bell Seketika',
      scheduleTime: format24HourTime(currentTime, false),
      skipPostBellTracks: true,
    });
  };

  // Test Row Schedule Item
  const handleTestScheduleItem = async (item: ScheduleItem) => {
    if (murottalConfigRef.current.autoStopOnBell !== false && murottalAudioRef.current && !murottalAudioRef.current.paused) {
      await fadeOutAndStopMurottal(1800);
    }

    const fullText = `${audioSettings.globalPrefix}${item.speechText}`;

    // Log test
    const newLog: BellLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: item.time,
      dayName: getIndonesianDayName(selectedDay),
      scheduleLabel: `Tes Bunyi: ${item.label}`,
      triggerType: 'test',
      status: 'success',
      details: item.audioType === 'recording' ? `[Suara Rekaman] ${item.customAudioName || 'Audio Sendiri'}` : fullText,
    };
    setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);

    const dismissalTargets =
      item.id === FRIDAY_EARLY_DISMISSAL_ID ||
      (audioSettingsRef.current.asasModeEnabled && item.category === 'dismissal')
        ? getDismissalPostBellMatchTargets(schedulesRef.current)
        : null;

    await playBellSequence(
      item.chimeType,
      fullText,
      audioSettings,
      item.volume,
      item.customAudioUrl,
      item.audioType || 'tts',
      item.clonedVoiceId,
      item.customChimeUrl,
      item.enableOutroChime,
      item.outroChimeType,
      item.customOutroChimeUrl,
      item.speechLanguage || 'id',
      item.speechInputMode || 'auto_translate',
      item.translatedSpeechText,
      {
        label: `${item.time} - ${item.label}`,
        scheduleId: item.id,
        scheduleTime: item.time,
        ...(dismissalTargets
          ? {
              fallbackMatchScheduleIds: dismissalTargets.matchIds,
              fallbackMatchTimes: dismissalTargets.matchTimes,
            }
          : {}),
      }
    );
  };

  const handleTriggerFridayEarlyDismissalNow = () => {
    const earlyItem = buildFridayEarlyDismissalSchedule(schedules, audioSettings);
    void handleTestScheduleItem(earlyItem);
  };

  // Manual Bell Logging
  const handleLogManualBell = (label: string, speechText: string) => {
    const newLog: BellLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: format24HourTime(currentTime, false),
      dayName: getIndonesianDayName(todayDayNum),
      scheduleLabel: label,
      triggerType: 'manual',
      status: 'success',
      details: speechText,
    };
    setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);
  };

  // Schedule Item Operations (automatically routes to ASAS schedules when Mode ASAS is active)
  const updateActiveScheduleList = (updater: (prev: ScheduleItem[]) => ScheduleItem[]) => {
    if (audioSettingsRef.current.asasModeEnabled) {
      setAudioSettings((prev) => {
        const currentAsas =
          prev.asasSchedules && prev.asasSchedules.length > 0
            ? prev.asasSchedules
            : DEFAULT_ASAS_SCHEDULES;
        return {
          ...prev,
          asasSchedules: updater(currentAsas),
        };
      });
    } else {
      setSchedules((prev) => updater(prev));
    }
  };

  const handleSaveScheduleItem = (
    savedItem: ScheduleItem,
    batchOptions?: {
      applyVoiceToAll: boolean;
      excludedIds: string[];
      applyChimeAlso: boolean;
    }
  ) => {
    updateActiveScheduleList((prev) => {
      let updated = prev.some((x) => x.id === savedItem.id)
        ? prev.map((x) => (x.id === savedItem.id ? savedItem : x))
        : [...prev, savedItem];

      if (batchOptions?.applyVoiceToAll) {
        const excludedSet = new Set(batchOptions.excludedIds || []);
        updated = updated.map((item) => {
          if (item.id === savedItem.id || excludedSet.has(item.id)) {
            return item;
          }
          const languageChanged = (item.speechLanguage || 'id') !== (savedItem.speechLanguage || 'id');
          return {
            ...item,
            audioType: savedItem.audioType,
            customAudioUrl: savedItem.customAudioUrl,
            customAudioName: savedItem.customAudioName,
            clonedVoiceId: savedItem.clonedVoiceId,
            speechLanguage: savedItem.speechLanguage || 'id',
            speechInputMode: languageChanged ? 'auto_translate' : (item.speechInputMode || 'auto_translate'),
            ...(languageChanged ? { translatedSpeechText: undefined } : {}),
            ...(batchOptions.applyChimeAlso ? { chimeType: savedItem.chimeType } : {}),
          };
        });
      }

      return updated;
    });
  };

  const handleDeleteScheduleItem = (id: string) => {
    updateActiveScheduleList((prev) => prev.filter((x) => x.id !== id));
  };

  const handleToggleScheduleItem = (id: string) => {
    updateActiveScheduleList((prev) =>
      prev.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x))
    );
  };

  const handleBatchAddSchedules = (
    newItems: ScheduleItem[],
    options?: {
      removeDismissalDays?: DayOfWeek[];
      removedItemIds?: string[];
    }
  ) => {
    updateActiveScheduleList((prev) => {
      let filtered = [...prev];
      if (options?.removedItemIds && options.removedItemIds.length > 0) {
        filtered = filtered.filter((item) => !options.removedItemIds?.includes(item.id));
      }
      if (options?.removeDismissalDays && options.removeDismissalDays.length > 0) {
        filtered = filtered
          .map((item) => {
            if (item.category === 'dismissal') {
              const updatedDays = item.days.filter(
                (d) => !options.removeDismissalDays?.includes(d)
              );
              return { ...item, days: updatedDays };
            }
            return item;
          })
          .filter((item) => item.days.length > 0);
      }
      return [...filtered, ...newItems];
    });

    // Add log
    const newLog: BellLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: format24HourTime(currentTime, false),
      dayName: getIndonesianDayName(selectedDay),
      scheduleLabel: `Batch Tambah: ${newItems.length} Jam Pelajaran`,
      triggerType: 'manual',
      status: 'success',
      details: `Menambahkan ${newItems.length} jam pelajaran tambahan baru secara otomatis.`,
    };
    setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);
  };

  const handleResetToDefault = () => {
    if (asasModeEnabled) {
      if (window.confirm('Apakah Anda yakin ingin mengembalikan seluruh jadwal ASAS ke pengaturan awal (07:00 - 12:30)?')) {
        setAudioSettings((prev) => ({
          ...prev,
          asasSchedules: DEFAULT_ASAS_SCHEDULES,
        }));
        const newLog: BellLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          timeStr: format24HourTime(currentTime, false),
          dayName: getIndonesianDayName(todayDayNum),
          scheduleLabel: 'Reset Jadwal Standar ASAS',
          triggerType: 'manual',
          status: 'warning',
          details: 'Memulihkan jadwal bel ASAS bawaan (07:00 - 12:30 WIB).',
        };
        setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);
      }
      return;
    }

    if (window.confirm("Apakah Anda yakin ingin mengembalikan seluruh jadwal bel ke standar awal SD QUR'AN UNGGULAN?")) {
      setSchedules(INITIAL_SCHEDULES);
      const newLog: BellLog = {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        timeStr: format24HourTime(currentTime, false),
        dayName: getIndonesianDayName(todayDayNum),
        scheduleLabel: 'Reset Jadwal Standar Pabrik',
        triggerType: 'manual',
        status: 'warning',
        details: 'Memulihkan 49 jadwal bel bawaan SD QURAN UNGGULAN.',
      };
      setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);
    }
  };

  const handleExportLogsCSV = () => {
    if (bellLogs.length === 0) return;
    const headers = ['Waktu', 'Hari', 'Label Bel', 'Tipe Trigger', 'Status', 'Keterangan'];
    const rows = bellLogs.map((l) => [
      new Date(l.timestamp).toISOString(),
      l.dayName,
      `"${l.scheduleLabel.replace(/"/g, '""')}"`,
      l.triggerType,
      l.status,
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `riwayat-bel-sd-quran-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 antialiased font-sans pb-6 selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        timeSyncInfo={timeSyncInfo}
        onQuickTestBell={handleQuickTestBell}
        isAudioUnlocked={isAudioUnlocked}
        isMurottalPlaying={isMurottalPlaying}
        cloudAuthEmail={cloudUser?.email || null}
        cloudStatus={cloudStatus}
        onCloudLogin={handleCloudLogin}
        onCloudLogout={handleCloudLogout}
        onForcePushCloud={handleForcePushCloud}
        pwaInstallNode={
          <PWAInstallButton
            schedules={schedules}
            audioSettings={audioSettings}
            murottalConfig={murottalConfig}
          />
        }
      />

      {/* Main Container */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-3.5 sm:pt-4 space-y-3.5 sm:space-y-4">
        {/* Audio Permission Banner (only shown when gesture unlock is still needed) */}
        <AudioPermissionBanner
          settings={audioSettings}
          isAudioUnlocked={isAudioUnlocked}
          onActivated={() => setIsAudioUnlocked(true)}
        />

        {/* Primary View: Hero Clock, Next Bell, Prayer Times, and Expandable Schedule Table */}
        {activeTab === 'schedule' && (
          <LiveClockCard
            currentTime={currentTime}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            todayDayNumber={todayDayNum}
            timeSyncInfo={timeSyncInfo}
            onManualSync={performTimeSync}
            nextScheduleItem={nextScheduleItem}
            countdownSeconds={countdownSeconds}
            latestScheduleItem={latestScheduleItem}
            onTriggerScheduleBell={handleTestScheduleItem}
            disabledDays={disabledDays}
            onToggleDisabledDay={handleToggleDisabledDay}
            fridayExtraOff={Boolean(audioSettings.fridayExtraOff)}
            fridayEarlyDismissalTime={fridayEarlyTime}
            onToggleFridayExtraOff={handleToggleFridayExtraOff}
            onUpdateFridayEarlyTime={handleUpdateFridayEarlyTime}
            onTriggerFridayEarlyDismissalNow={handleTriggerFridayEarlyDismissalNow}
            asasModeEnabled={asasModeEnabled}
            onToggleAsasMode={handleToggleAsasMode}
            bellPlayback={bellPlayback}
            onTogglePauseBell={togglePauseBellPlayback}
            onStopBell={stopAllBellAudio}
            totalTodayBells={todayActiveSchedules.length}
            scheduleListNode={
              <ScheduleList
                schedules={activeModeSchedules}
                selectedDay={selectedDay}
                audioSettings={audioSettings}
                disabledDays={disabledDays}
                onToggleDisabledDay={handleToggleDisabledDay}
                onTestScheduleItem={handleTestScheduleItem}
                onEditScheduleItem={(item) => {
                  setEditingScheduleItem(item);
                  setIsEditorModalOpen(true);
                }}
                onDeleteScheduleItem={handleDeleteScheduleItem}
                onToggleScheduleItem={handleToggleScheduleItem}
                onAddScheduleItem={() => {
                  setEditingScheduleItem(null);
                  setIsEditorModalOpen(true);
                }}
                onOpenAddExtraPeriods={() => setIsAddExtraPeriodsOpen(true)}
                onResetToDefault={handleResetToDefault}
                onImportExport={() => setIsImportExportOpen(true)}
                bellPlayback={bellPlayback}
                onTogglePauseBell={togglePauseBellPlayback}
                onStopBell={stopAllBellAudio}
                asasModeEnabled={asasModeEnabled}
              />
            }
          />
        )}

        {/* Settings Sub-Navigation Strip (Voice / Time Sync / Logs) */}
        {(activeTab === 'voice' || activeTab === 'time-sync' || activeTab === 'logs') && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 inline-flex flex-wrap items-center gap-1 shadow-2xs">
            {[
              { id: 'voice', label: 'Pengaturan Suara & TTS' },
              { id: 'time-sync', label: 'Integrasi API Waktu' },
              { id: 'logs', label: 'Riwayat Bel' },
            ].map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveTab(sub.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === sub.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'murottal' && (
          <MurottalPlayer
            config={murottalConfig}
            onUpdateConfig={setMurottalConfig}
            isPlaying={isMurottalPlaying}
            activeTrack={activeMurottalTrack}
            onPlayTrack={handlePlayMurottalTrack}
            onPause={handlePauseMurottal}
            onResume={handleResumeMurottal}
            onStop={handleStopMurottal}
            currentTimeFormatted={format24HourTime(currentTime, true)}
            isAudioUnlocked={isAudioUnlocked}
            onUnlockAudio={() => setIsAudioUnlocked(true)}
            disabledDays={disabledDays}
          />
        )}

        {activeTab === 'chimes' && (
          <ChimeManager
            settings={audioSettings}
            onUpdateSettings={setAudioSettings}
            schedules={schedules}
          />
        )}

        {activeTab === 'manual' && (
          <ManualBellPad
            audioSettings={audioSettings}
            onLogManualBell={handleLogManualBell}
          />
        )}

        {activeTab === 'time-sync' && (
          <TimeSyncConfig
            timeSyncInfo={timeSyncInfo}
            onManualSync={performTimeSync}
            syncIntervalMinutes={syncIntervalMinutes}
            setSyncIntervalMinutes={setSyncIntervalMinutes}
            serverTimeFormatted={format24HourTime(currentTime, true)}
            localTimeFormatted={new Date().toLocaleTimeString('id-ID')}
          />
        )}

        {activeTab === 'voice' && (
          <VoiceSettings
            settings={audioSettings}
            onUpdateSettings={setAudioSettings}
            onResetSettings={() =>
              setAudioSettings({
                voiceURI: '',
                lang: 'id-ID',
                rate: 0.95,
                pitch: 1.0,
                volume: 1.0,
                globalPrefix: DEFAULT_GLOBAL_PREFIX,
                chimeVolume: 1.0,
                enableTTS: true,
                repeatSpeechCount: 1,
                disabledDays: [0],
              })
            }
          />
        )}

        {activeTab === 'logs' && (
          <BellLogs
            logs={bellLogs}
            onClearLogs={() => setBellLogs([])}
            onExportLogsCSV={handleExportLogsCSV}
          />
        )}
      </main>

      {/* Editor Modal */}
      <ScheduleEditorModal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        onSave={handleSaveScheduleItem}
        editingItem={editingScheduleItem}
        audioSettings={audioSettings}
        allSchedules={activeModeSchedules}
        onTestSound={(
          chime,
          text,
          customUrl,
          audioType,
          clonedVoiceId,
          enableOutro,
          outroType,
          speechLanguage,
          speechInputMode,
          translatedSpeechText,
          scheduleTime
        ) => {
          const full = `${audioSettings.globalPrefix}${text}`;
          return playBellSequence(
            chime,
            full,
            audioSettings,
            1.0,
            customUrl,
            audioType || 'tts',
            clonedVoiceId,
            undefined,
            enableOutro,
            outroType,
            undefined,
            speechLanguage || 'id',
            speechInputMode || 'auto_translate',
            translatedSpeechText,
            scheduleTime ? { scheduleTime } : undefined
          );
        }}
      />

      {/* Batch / Extra Periods Modal */}
      <AddExtraPeriodsModal
        isOpen={isAddExtraPeriodsOpen}
        onClose={() => setIsAddExtraPeriodsOpen(false)}
        selectedDay={selectedDay}
        existingSchedules={activeModeSchedules}
        audioSettings={audioSettings}
        onAddBatchSchedules={handleBatchAddSchedules}
        onTestSound={(chime, text, enableOutro, outroType) => {
          playBellSequence(
            chime,
            text,
            audioSettings,
            1.0,
            undefined,
            'tts',
            undefined,
            undefined,
            enableOutro,
            outroType
          );
        }}
      />

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        schedules={activeModeSchedules}
        onImportSchedules={(newSchedules) => {
          if (asasModeEnabled) {
            setAudioSettings((prev) => ({ ...prev, asasSchedules: newSchedules }));
          } else {
            setSchedules(newSchedules);
          }
        }}
      />

      {/* Non-intrusive Cloud Login Diagnostic Toast (only visible when login fails, e.g. unauthorized Vercel domain) */}
      {cloudLoginError && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md w-[calc(100vw-2rem)] bg-white border border-rose-300 shadow-2xl rounded-2xl p-4 space-y-2.5 animate-fadeIn">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <h4 className="text-xs sm:text-sm font-extrabold">
                Login Cloud Sync Belum Bisa di Domain Ini
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setCloudLoginError(null)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            {cloudLoginError.message}
          </p>

          {cloudLoginError.code === 'auth/unauthorized-domain' && cloudLoginError.domain && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono font-bold text-blue-700 truncate">
                  {cloudLoginError.domain}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(cloudLoginError.domain);
                    setCopiedDomain(true);
                    setTimeout(() => setCopiedDomain(false), 2000);
                  }}
                  className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  {copiedDomain ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDomain ? 'Tersalin' : 'Salin Domain'}</span>
                </button>
              </div>
              <a
                href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 underline"
              >
                <span>Buka Pengaturan Authorized Domains Firebase</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}
