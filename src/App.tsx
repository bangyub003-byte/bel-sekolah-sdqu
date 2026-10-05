import React, { useState, useEffect, useRef } from 'react';
import {
  ScheduleItem,
  BellLog,
  AudioSettings,
  TimeSyncInfo,
  DayOfWeek,
  ChimeType,
} from './types';
import { INITIAL_SCHEDULES, DEFAULT_GLOBAL_PREFIX } from './data/defaultSchedule';
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

export default function App() {
  // Navigation tab state ('schedule' | 'manual' | 'time-sync' | 'voice' | 'logs')
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

  // Today's Day of Week (1 = Monday, ..., 6 = Saturday)
  const todayDayNum = (getDayOfWeekNumber(currentTime) || 1) as DayOfWeek;

  // Selected Day for previewing timetable (defaults to today)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDayNum);

  // Modal Manager States
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isAddExtraPeriodsOpen, setIsAddExtraPeriodsOpen] = useState(false);
  const [editingScheduleItem, setEditingScheduleItem] = useState<ScheduleItem | null>(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

  // Ref to prevent duplicate bell triggers within same minute
  const lastFiredKeyRef = useRef<string>('');

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
      console.error('Error saving bell logs:', err);
    }
  }, [bellLogs]);

  // Perform Time API Sync
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

  // Initial Time Sync
  useEffect(() => {
    performTimeSync();
  }, []);

  // Periodic Auto Time Sync Interval
  useEffect(() => {
    const intervalMs = Math.max(1, syncIntervalMinutes) * 60 * 1000;
    const timer = setInterval(() => {
      performTimeSync();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [syncIntervalMinutes]);

  // Main 1-Second Clock & Automatic Bell Scheduler Loop
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = getSynchronizedDate();
      setCurrentTime(now);

      const currentHHMM = format24HourTime(now, false); // HH:MM
      const currentSeconds = now.getSeconds();
      const dayNum = (getDayOfWeekNumber(now) || 1) as DayOfWeek;

      // Check if any bell is scheduled for current HH:MM and enabled on current day
      if (currentSeconds === 0 || currentSeconds === 1) {
        const matchingBells = schedules.filter(
          (item) =>
            item.enabled &&
            item.time === currentHHMM &&
            item.days.includes(dayNum)
        );

        matchingBells.forEach((bell) => {
          const fireKey = `${dayNum}-${currentHHMM}-${bell.id}`;
          if (lastFiredKeyRef.current !== fireKey) {
            lastFiredKeyRef.current = fireKey;
            triggerAutomaticBell(bell, dayNum);
          }
        });
      }
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [schedules, audioSettings]);

  // Trigger Automatic Bell
  const triggerAutomaticBell = async (item: ScheduleItem, dayNum: DayOfWeek) => {
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
    setBellLogs((prev) => [newLog, ...prev.slice(0, 99)]); // Keep last 100 logs

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
        item.customOutroChimeUrl
      );
    } catch (err) {
      console.error('Error firing automatic bell sequence:', err);
    }
  };

  // Calculate Next Bell Countdown for Today
  let nextScheduleItem: ScheduleItem | null = null;
  let countdownSeconds: number | null = null;

  const currentHHMM = format24HourTime(currentTime, false);
  const currentSecsTotal =
    currentTime.getHours() * 3600 +
    currentTime.getMinutes() * 60 +
    currentTime.getSeconds();

  const todayActiveSchedules = schedules
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
      item.customOutroChimeUrl
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
  const handleSaveScheduleItem = (savedItem: ScheduleItem) => {
    setSchedules((prev) => {
      const exists = prev.some((x) => x.id === savedItem.id);
      if (exists) {
        return prev.map((x) => (x.id === savedItem.id ? savedItem : x));
      } else {
        return [...prev, savedItem];
      }
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
    }
  };

  // Export CSV
  const handleExportLogsCSV = () => {
    if (bellLogs.length === 0) return;
    const headers = ['Waktu', 'Hari', 'Nama Kegiatan', 'Tipe Trigger', 'Status', 'Detail Speech'];
    const rows = bellLogs.map((log) => [
      new Date(log.timestamp).toISOString(),
      log.dayName,
      `"${log.scheduleLabel}"`,
      log.triggerType,
      log.status,
      `"${log.details || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `riwayat-bel-sd-quran-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950 pb-16">
      {/* Top Header Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        timeSyncInfo={timeSyncInfo}
        onQuickTestBell={handleQuickTestBell}
        isAudioUnlocked={isAudioUnlocked}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-6">
        {/* Audio Permission Banner */}
        <AudioPermissionBanner
          settings={audioSettings}
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
        />

        {/* Dynamic Tab Views */}
        {activeTab === 'schedule' && (
          <ScheduleList
            schedules={schedules}
            selectedDay={selectedDay}
            audioSettings={audioSettings}
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
        onTestSound={(chime, text, customUrl, audioType, clonedVoiceId, enableOutro, outroType) => {
          const full = `${audioSettings.globalPrefix}${text}`;
          playBellSequence(
            chime,
            full,
            audioSettings,
            1.0,
            customUrl,
            audioType || 'tts',
            clonedVoiceId,
            undefined,
            enableOutro,
            outroType
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
