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
} from './utils/audioSynth';

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

const LOCAL_STORAGE_KEY_SCHEDULES = 'sd_quran_schedules_v1';
const LOCAL_STORAGE_KEY_SETTINGS = 'sd_quran_settings_v1';
const LOCAL_STORAGE_KEY_LOGS = 'sd_quran_logs_v1';
const LOCAL_STORAGE_KEY_MUROTTAL = 'sd_quran_murottal_v1';

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

  const murottalAudioRef = useRef<HTMLAudioElement | null>(null);
  const firedMurottalKeysRef = useRef<Set<string>>(new Set());

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
  const handlePlayMurottalTrackRef = useRef<(track: MurottalTrack) => void>(() => {});

  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

  useEffect(() => {
    audioSettingsRef.current = audioSettings;
  }, [audioSettings]);

  useEffect(() => {
    murottalConfigRef.current = murottalConfig;
  }, [murottalConfig]);

  // Persist Schedules
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SCHEDULES, JSON.stringify(schedules));
    } catch (err) {
      console.error('Error saving schedules:', err);
    }
  }, [schedules]);

  // Persist Settings
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(audioSettings));
    } catch (err) {
      console.error('Error saving audio settings:', err);
    }
  }, [audioSettings]);

  // Persist Logs
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(bellLogs));
    } catch (err) {
      console.error('Error saving logs:', err);
    }
  }, [bellLogs]);

  // Persist Murottal Config
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_MUROTTAL, JSON.stringify(murottalConfig));
    } catch (err) {
      console.error('Error saving murottal config:', err);
    }
    if (murottalAudioRef.current) {
      murottalAudioRef.current.volume = murottalConfig.volume;
    }
  }, [murottalConfig]);

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

    // Check if browser already allows audio playback (e.g. site sound permission is Allowed)
    const ctx = getAudioContext();
    if (ctx.state === 'running') {
      setIsAudioUnlocked(true);
    } else {
      ctx.resume().then(() => {
        if (ctx.state === 'running') {
          setIsAudioUnlocked(true);
        }
      }).catch(() => {});
    }

    // Attach global window listeners: any click or key anywhere unlocks audio immediately
    const unlockOnGesture = () => {
      const c = getAudioContext();
      if (c.state === 'suspended') {
        c.resume().then(() => {
          setIsAudioUnlocked(true);
        }).catch(() => {});
      } else {
        setIsAudioUnlocked(true);
      }
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
              const targetTrack =
                (slot.trackId && DEFAULT_JUZ_30_TRACKS.find((t) => t.id === slot.trackId)) ||
                DEFAULT_JUZ_30_TRACKS.find((t) => t.id === currentMurottal.selectedTrackId) ||
                DEFAULT_JUZ_30_TRACKS[1];
              handlePlayMurottalTrackRef.current(targetTrack);

              // Add audit log
              const newLog: BellLog = {
                id: `log-murottal-${Date.now()}`,
                timestamp: Date.now(),
                timeStr: currentHHMM,
                dayName: getIndonesianDayName(dayNum),
                scheduleLabel: slot.label || `Murottal Otomatis: ${targetTrack.title}`,
                triggerType: 'auto',
                status: 'success',
                details: `Pemutaran murottal otomatis jam ${currentHHMM} WIB (${targetTrack.reciter}).`,
              };
              setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]);
            }
          }
        });

        // 2. Check Scheduled Bells for current HH:MM — strictly ONCE per minute (prevents duplicate readings)
        const minuteKey = `${dateKey}-${currentHHMM}`;
        if (!firedMinutesRef.current.has(minuteKey)) {
          const matchingBells = currentSchedules.filter(
            (item) =>
              item.enabled &&
              item.time === currentHHMM &&
              item.days.includes(dayNum)
          );

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

  // Murottal Audio Controls
  const handlePlayMurottalTrack = (track: MurottalTrack) => {
    try {
      setActiveMurottalTrack(track);
      setIsAudioUnlocked(true);

      // Unlock Audio Context if suspended
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (murottalAudioRef.current) {
        murottalAudioRef.current.pause();
        murottalAudioRef.current.removeAttribute('src');
        murottalAudioRef.current.load();
      }

      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = track.audioUrl;
      audio.volume = Math.max(0, Math.min(1.0, murottalConfig.volume));
      murottalAudioRef.current = audio;

      audio.onplay = () => {
        setIsMurottalPlaying(true);
        setIsAudioUnlocked(true);
      };

      audio.onerror = (e) => {
        console.warn('Murottal audio load error:', e, 'URL:', track.audioUrl);
        setIsMurottalPlaying(false);
      };

      audio.onended = () => {
        if (murottalConfig.repeatMode === 'repeat_one') {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          // Play next track in list
          const currentIndex = DEFAULT_JUZ_30_TRACKS.findIndex((t) => t.id === track.id);
          const nextIndex = (currentIndex + 1) % DEFAULT_JUZ_30_TRACKS.length;
          handlePlayMurottalTrack(DEFAULT_JUZ_30_TRACKS[nextIndex]);
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsMurottalPlaying(true);
            setIsAudioUnlocked(true);
          })
          .catch((err) => {
            console.warn('Audio playback waiting for browser permission/unlock:', err);
            // Attempt auto-recovery via AudioContext resume
            const c = getAudioContext();
            c.resume().then(() => {
              audio.play().then(() => {
                setIsMurottalPlaying(true);
                setIsAudioUnlocked(true);
              }).catch(() => {
                setIsMurottalPlaying(false);
              });
            }).catch(() => {
              setIsMurottalPlaying(false);
            });
          });
      }
    } catch (e) {
      console.error('Error starting murottal:', e);
      setIsMurottalPlaying(false);
    }
  };

  const handlePauseMurottal = () => {
    if (murottalAudioRef.current) {
      murottalAudioRef.current.pause();
    }
    setIsMurottalPlaying(false);
  };

  const handleResumeMurottal = () => {
    if (murottalAudioRef.current) {
      murottalAudioRef.current.play().then(() => {
        setIsMurottalPlaying(true);
      }).catch(() => {});
    } else if (activeMurottalTrack) {
      handlePlayMurottalTrack(activeMurottalTrack);
    }
  };

  const handleStopMurottal = () => {
    if (murottalAudioRef.current) {
      murottalAudioRef.current.pause();
      murottalAudioRef.current.currentTime = 0;
    }
    setIsMurottalPlaying(false);
  };

  // Trigger Automatic Bell
  const triggerAutomaticBell = async (item: ScheduleItem, dayNum: DayOfWeek) => {
    // If murottal is currently playing and auto-stop on bell is enabled, pause it smoothly
    if (murottalConfig.autoStopOnBell && isMurottalPlaying) {
      handlePauseMurottal();
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
        item.translatedSpeechText
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
    : schedules
        .filter((item) => item.enabled && item.days.includes(todayDayNum))
        .sort((a, b) => a.time.localeCompare(b.time));

  for (const item of todayActiveSchedules) {
    const [hStr, mStr] = item.time.split(':');
    const targetSecsTotal = parseInt(hStr, 10) * 3600 + parseInt(mStr, 10) * 60;

    if (targetSecsTotal > currentSecsTotal) {
      nextScheduleItem = item;
      countdownSeconds = targetSecsTotal - currentSecsTotal;
      break;
    }
  }

  // Quick Test Bell
  const handleQuickTestBell = async () => {
    if (murottalConfig.autoStopOnBell && isMurottalPlaying) {
      handlePauseMurottal();
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

    await playBellSequence('westminster', testText, audioSettings);
  };

  // Test Row Schedule Item
  const handleTestScheduleItem = async (item: ScheduleItem) => {
    if (murottalConfig.autoStopOnBell && isMurottalPlaying) {
      handlePauseMurottal();
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
      item.translatedSpeechText
    );
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

  // Schedule Item Operations
  const handleSaveScheduleItem = (
    savedItem: ScheduleItem,
    batchOptions?: {
      applyVoiceToAll: boolean;
      excludedIds: string[];
      applyChimeAlso: boolean;
    }
  ) => {
    setSchedules((prev) => {
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
    setSchedules((prev) => prev.filter((x) => x.id !== id));
  };

  const handleToggleScheduleItem = (id: string) => {
    setSchedules((prev) =>
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
    setSchedules((prev) => {
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
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 antialiased font-sans pb-16 selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        timeSyncInfo={timeSyncInfo}
        onQuickTestBell={handleQuickTestBell}
        isAudioUnlocked={isAudioUnlocked}
        isMurottalPlaying={isMurottalPlaying}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 pt-2.5 sm:pt-4 space-y-3 sm:space-y-4">
        {/* Audio Permission Banner */}
        <AudioPermissionBanner
          settings={audioSettings}
          isAudioUnlocked={isAudioUnlocked}
          onActivated={() => setIsAudioUnlocked(true)}
        />

        {/* Live Giant Clock & Day Selector */}
        <LiveClockCard
          currentTime={currentTime}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          todayDayNumber={todayDayNum}
          timeSyncInfo={timeSyncInfo}
          onManualSync={performTimeSync}
          nextScheduleItem={nextScheduleItem}
          countdownSeconds={countdownSeconds}
          disabledDays={disabledDays}
          onToggleDisabledDay={handleToggleDisabledDay}
        />

        {/* Dynamic Tab Views */}
        {activeTab === 'schedule' && (
          <ScheduleList
            schedules={schedules}
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
          />
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
        allSchedules={schedules}
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
          translatedSpeechText
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
            translatedSpeechText
          );
        }}
      />

      {/* Batch / Extra Periods Modal */}
      <AddExtraPeriodsModal
        isOpen={isAddExtraPeriodsOpen}
        onClose={() => setIsAddExtraPeriodsOpen(false)}
        selectedDay={selectedDay}
        existingSchedules={schedules}
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
        schedules={schedules}
        onImportSchedules={(newSchedules) => setSchedules(newSchedules)}
      />
    </div>
  );
}
