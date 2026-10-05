import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Clock,
  Sparkles,
  Calendar,
  Layers,
  Check,
  Play,
  RotateCcw,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Coffee,
  DoorOpen,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { ScheduleItem, DayOfWeek, ChimeType, AudioSettings, BellCategory } from '../types';
import { getIndonesianDayName } from '../utils/timeSync';

interface AddExtraPeriodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDay: DayOfWeek;
  existingSchedules: ScheduleItem[];
  audioSettings: AudioSettings;
  onAddBatchSchedules: (
    newItems: ScheduleItem[],
    options?: {
      removeDismissalDays?: DayOfWeek[];
      removedItemIds?: string[];
    }
  ) => void;
  onTestSound?: (
    chime: ChimeType,
    text: string,
    enableOutro?: boolean,
    outroType?: ChimeType | 'none' | 'same_as_intro'
  ) => void;
}

// Helper to add minutes to HH:MM format
function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const [hStr, mStr] = timeStr.split(':');
  let totalMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + minutesToAdd;
  // clamp to 24h
  totalMinutes = (totalMinutes % (24 * 60) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export const AddExtraPeriodsModal: React.FC<AddExtraPeriodsModalProps> = ({
  isOpen,
  onClose,
  selectedDay,
  existingSchedules,
  audioSettings,
  onAddBatchSchedules,
  onTestSound,
}) => {
  // Target Days
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([selectedDay]);

  // Starting Period Number (e.g. 7 for Jam ke-7)
  const [startPeriodNumber, setStartPeriodNumber] = useState<number>(7);

  // Number of Extra Periods to Add (e.g. 2, 3, 4)
  const [periodCount, setPeriodCount] = useState<number>(3);

  // Start Time for first extra period (e.g. "11:10" or "13:00")
  const [startTime, setStartTime] = useState<string>('11:10');

  // Duration in minutes per period
  const [durationMinutes, setDurationMinutes] = useState<number>(35);

  // Optional Break
  const [includeBreak, setIncludeBreak] = useState<boolean>(false);
  const [breakAfterPeriod, setBreakAfterPeriod] = useState<number>(7);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState<number>(20);
  const [breakLabel, setBreakLabel] = useState<string>('Istirahat');

  // Optional Automatic Dismissal at the end
  const [includeDismissal, setIncludeDismissal] = useState<boolean>(true);
  const [dismissalLabel, setDismissalLabel] = useState<string>('Jam Pulang Sekolah');

  // Replace existing dismissal on target days (e.g. replace 11:10 Friday dismissal)
  const [replaceExistingDismissal, setReplaceExistingDismissal] = useState<boolean>(true);

  // Chime configurations
  const [chimeType, setChimeType] = useState<ChimeType>('westminster');
  const [enableOutroChime, setEnableOutroChime] = useState<boolean>(
    audioSettings.enableGlobalOutroChime ?? false
  );
  const [outroChimeType, setOutroChimeType] = useState<ChimeType | 'none' | 'same_as_intro'>('same_as_intro');

  // Custom speech template
  const [speechTemplate, setSpeechTemplate] = useState<string>('memasuki jam pelajaran ke-{nomor}.');

  // Calculate existing highest period number & last time for selected days
  useEffect(() => {
    if (!isOpen) return;

    // Reset target days to selected day initially
    setSelectedDays([selectedDay]);

    // Find highest lesson number on this day
    const dayItems = existingSchedules.filter((s) => s.days.includes(selectedDay));
    let maxPeriod = 6;
    let latestLessonTime = '11:10';

    for (const item of dayItems) {
      if (item.category === 'lesson') {
        const match = item.label.match(/ke-(\d+)/i) || item.label.match(/jam (\d+)/i);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num > maxPeriod) maxPeriod = num;
        }
        if (item.time > latestLessonTime) {
          latestLessonTime = item.time;
        }
      }
    }

    // Default start period to maxPeriod + 1
    const nextStart = maxPeriod + 1;
    setStartPeriodNumber(nextStart);

    // If day is Friday (5)
    if (selectedDay === 5) {
      setStartTime('11:10');
      setPeriodCount(2); // e.g. Jam 7 & 8
    } else {
      // Calculate start time based on latest lesson time + 35m
      const calculatedStart = addMinutesToTime(latestLessonTime, 35);
      setStartTime(calculatedStart);
      setPeriodCount(2);
    }
  }, [isOpen, selectedDay, existingSchedules]);

  // Find if there are existing dismissal bells on the selected days
  const existingDismissals = useMemo(() => {
    return existingSchedules.filter(
      (s) => s.category === 'dismissal' && s.days.some((d) => selectedDays.includes(d))
    );
  }, [existingSchedules, selectedDays]);

  // Toggle Day
  const handleToggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  // Generate Items Preview
  const generatedItems = useMemo(() => {
    const items: Array<{
      time: string;
      label: string;
      category: BellCategory;
      speechText: string;
      chimeType: ChimeType;
      enableOutroChime: boolean;
      outroChimeType: ChimeType | 'none' | 'same_as_intro';
      periodNum?: number;
    }> = [];

    let currentTimeCursor = startTime;

    for (let i = 0; i < periodCount; i++) {
      const currentPeriod = startPeriodNumber + i;
      const lessonTime = currentTimeCursor;
      const lessonSpeech = speechTemplate.replace('{nomor}', currentPeriod.toString());

      items.push({
        time: lessonTime,
        label: `Jam Pelajaran ke-${currentPeriod}`,
        category: 'lesson',
        speechText: lessonSpeech,
        chimeType: chimeType,
        enableOutroChime: enableOutroChime,
        outroChimeType: outroChimeType,
        periodNum: currentPeriod,
      });

      // Advance time by duration of lesson
      currentTimeCursor = addMinutesToTime(currentTimeCursor, durationMinutes);

      // Check if break should occur after this period
      if (includeBreak && currentPeriod === breakAfterPeriod && i < periodCount - 1) {
        items.push({
          time: currentTimeCursor,
          label: `${breakLabel} (Setelah Jam ke-${currentPeriod})`,
          category: 'break',
          speechText: `memasuki waktu ${breakLabel.toLowerCase()}. Selamat beristirahat.`,
          chimeType: 'tube_chime',
          enableOutroChime: enableOutroChime,
          outroChimeType: outroChimeType,
        });
        // Advance time by break duration
        currentTimeCursor = addMinutesToTime(currentTimeCursor, breakDurationMinutes);
      }
    }

    // Include Dismissal at the end
    if (includeDismissal) {
      const isFriday = selectedDays.includes(5) && selectedDays.length === 1;
      const dismissalTitle = isFriday ? 'Jam Pulang Hari Jumat' : dismissalLabel;
      const dismissalSpeech = isFriday
        ? 'jam pelajaran hari Jumat telah selesai. Selamat pulang dan berhati-hati di jalan.'
        : 'seluruh kegiatan belajar mengajar hari ini telah selesai. Selamat pulang dan hati-hati di jalan.';

      items.push({
        time: currentTimeCursor,
        label: dismissalTitle,
        category: 'dismissal',
        speechText: dismissalSpeech,
        chimeType: 'tube_chime',
        enableOutroChime: enableOutroChime,
        outroChimeType: outroChimeType,
      });
    }

    return items;
  }, [
    startTime,
    periodCount,
    startPeriodNumber,
    durationMinutes,
    includeBreak,
    breakAfterPeriod,
    breakDurationMinutes,
    breakLabel,
    includeDismissal,
    dismissalLabel,
    speechTemplate,
    chimeType,
    enableOutroChime,
    outroChimeType,
    selectedDays,
  ]);

  if (!isOpen) return null;

  // Handle Submit Batch
  const handleSave = () => {
    const newScheduleItems: ScheduleItem[] = generatedItems.map((gen, idx) => ({
      id: `gen-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      time: gen.time,
      label: gen.label,
      category: gen.category,
      speechText: gen.speechText,
      chimeType: gen.chimeType,
      enableOutroChime: gen.enableOutroChime,
      outroChimeType: gen.outroChimeType,
      days: [...selectedDays],
      enabled: true,
      volume: 1.0,
      audioType: 'tts',
    }));

    // Check if we need to remove or adjust existing dismissal items
    const removedItemIds: string[] = [];
    if (replaceExistingDismissal && existingDismissals.length > 0) {
      existingDismissals.forEach((d) => {
        // If the dismissal only belongs to target days, remove it completely
        const remainingDays = d.days.filter((day) => !selectedDays.includes(day));
        if (remainingDays.length === 0) {
          removedItemIds.push(d.id);
        }
      });
    }

    onAddBatchSchedules(newScheduleItems, {
      removeDismissalDays: replaceExistingDismissal ? selectedDays : undefined,
      removedItemIds: removedItemIds,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-slate-900 border-b border-slate-800 p-5 sm:p-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                <Layers className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">
                  Tambah Jam Pelajaran Lanjutan
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  Generator Otomatis
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Tambahkan jam pelajaran tambahan sekaligus (misal: Jam ke-7, 8, 9 di Hari Jumat) secara otomatis dan terjadwal presisi.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 p-2 rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-200 custom-scrollbar">
          {/* 1. Pilih Hari Target */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>1. Pilih Hari Berlaku Jam Tambahan</span>
              </label>

              {/* Quick Presets for Days */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedDays([5])}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                    selectedDays.length === 1 && selectedDays[0] === 5
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🕌 Khusus Hari Jumat
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDays([1, 2, 3, 4])}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                    selectedDays.length === 4 && selectedDays.every((d) => [1, 2, 3, 4].includes(d))
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🏫 Senin - Kamis
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDays([1, 2, 3, 4, 5, 6])}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                    selectedDays.length === 6
                      ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🗓️ Semua Hari (Senin-Sabtu)
                </button>
              </div>
            </div>

            {/* Day Toggle Buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
              {[
                { day: 1 as DayOfWeek, label: 'Senin' },
                { day: 2 as DayOfWeek, label: 'Selasa' },
                { day: 3 as DayOfWeek, label: 'Rabu' },
                { day: 4 as DayOfWeek, label: 'Kamis' },
                { day: 5 as DayOfWeek, label: 'Jumat' },
                { day: 6 as DayOfWeek, label: 'Sabtu' },
              ].map(({ day, label }) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleToggleDay(day)}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? day === 5
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Pengaturan Jam & Durasi Pelajaran */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <label className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>2. Konfigurasi Jam Pelajaran Tambahan</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Mulai Dari Jam Pelajaran Ke */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Mulai Dari Jam Ke:
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-2.5 rounded-xl shrink-0">
                    Jam Ke -
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={startPeriodNumber}
                    onChange={(e) => setStartPeriodNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-black text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Jumlah Jam yang Ingin Ditambahkan */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Berapa Jam Tambahan:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={periodCount}
                    onChange={(e) => setPeriodCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-black text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-xs text-slate-400 font-bold shrink-0">Jam Pelajaran</span>
                </div>
              </div>

              {/* Jam Mulai (WIB) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Waktu Jam Mulai:
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-black text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Durasi per Jam */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Durasi Tiap Jam:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={90}
                    step={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(10, parseInt(e.target.value, 10) || 35))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-black text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-xs text-slate-400 font-bold shrink-0">Menit / Jam</span>
                </div>
              </div>
            </div>

            {/* Quick Presets for Start Time */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400">⚡ Preset Cepat Jam Mulai:</span>
              <button
                type="button"
                onClick={() => setStartTime('11:10')}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
              >
                11:10 (Lanjut Pagi)
              </button>
              <button
                type="button"
                onClick={() => setStartTime('11:45')}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
              >
                11:45 (Siang Pagi)
              </button>
              <button
                type="button"
                onClick={() => setStartTime('13:00')}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
              >
                🕌 13:00 (Setelah Sholat Jumat)
              </button>
              <button
                type="button"
                onClick={() => setStartTime('13:30')}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
              >
                🕌 13:30 (Siang Ekstra)
              </button>
            </div>
          </div>

          {/* 3. Pengaturan Istirahat & Jam Pulang */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box Istirahat */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBreak}
                    onChange={(e) => setIncludeBreak(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 bg-slate-900"
                  />
                  <Coffee className="w-4 h-4 text-amber-400" />
                  <span>Sertakan Waktu Istirahat di Tengah</span>
                </label>
              </div>

              {includeBreak && (
                <div className="space-y-3 pt-1 text-xs animate-fade-in">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Istirahat Setelah Jam:
                      </label>
                      <select
                        value={breakAfterPeriod}
                        onChange={(e) => setBreakAfterPeriod(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      >
                        {Array.from({ length: periodCount }, (_, i) => startPeriodNumber + i).map((pNum) => (
                          <option key={pNum} value={pNum}>
                            Setelah Jam ke-{pNum}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Durasi Istirahat:
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={60}
                        step={5}
                        value={breakDurationMinutes}
                        onChange={(e) => setBreakDurationMinutes(parseInt(e.target.value, 10) || 15)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Box Jam Pulang Otomatis */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDismissal}
                    onChange={(e) => setIncludeDismissal(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4 bg-slate-900"
                  />
                  <DoorOpen className="w-4 h-4 text-cyan-400" />
                  <span>Tambahkan Bel Jam Pulang di Akhir</span>
                </label>
              </div>

              {includeDismissal && (
                <div className="space-y-2.5 pt-1 text-xs animate-fade-in">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Label Bel Pulang:
                    </label>
                    <input
                      type="text"
                      value={dismissalLabel}
                      onChange={(e) => setDismissalLabel(e.target.value)}
                      placeholder="Jam Pulang Sekolah"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>

                  {existingDismissals.length > 0 && (
                    <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2.5">
                      <label className="flex items-start gap-2 text-[11px] text-amber-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={replaceExistingDismissal}
                          onChange={(e) => setReplaceExistingDismissal(e.target.checked)}
                          className="mt-0.5 rounded border-amber-700 text-amber-500 bg-slate-900"
                        />
                        <span>
                          Gantikan / geser jam pulang lama ({existingDismissals.map((d) => `${d.time} ${d.label}`).join(', ')}) agar tidak berbunyi ganda.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 4. Pengaturan Nada Bel & Ucapan */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <label className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>4. Pilihan Nada Dering & Suara Bel</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Intro Chime */}
              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1.5">
                  Nada Pembuka (Intro):
                </label>
                <select
                  value={chimeType}
                  onChange={(e) => setChimeType(e.target.value as ChimeType)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="westminster">Westminster 4-Tone</option>
                  <option value="classic_3tone">Classic 3-Tone (Do-Mi-Sol)</option>
                  <option value="tube_chime">Tube Chime Soft</option>
                  <option value="islamic_duo">Islamic Duo Chime</option>
                  <option value="electric_bell">Electric Bell Ring</option>
                  {audioSettings.customChimes && audioSettings.customChimes.length > 0 && (
                    <optgroup label="✨ Nada Kustom Anda">
                      {audioSettings.customChimes.map((c) => (
                        <option key={c.id} value={c.id}>
                          ✨ {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Outro Chime */}
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1.5">
                  Nada Penutup (Outro setelah VO):
                </label>
                <select
                  value={enableOutroChime ? outroChimeType : 'none'}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    if (val === 'none') {
                      setEnableOutroChime(false);
                      setOutroChimeType('none');
                    } else {
                      setEnableOutroChime(true);
                      setOutroChimeType(val);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="same_as_intro">🔄 Sama dengan Pembuka</option>
                  <option value="classic_3tone">Classic 3-Tone</option>
                  <option value="tube_chime">Tube Chime Soft</option>
                  <option value="westminster">Westminster 4-Tone</option>
                  <option value="none">🚫 Tanpa Nada Penutup</option>
                </select>
              </div>

              {/* Speech Template */}
              <div>
                <label className="block text-xs font-bold text-cyan-300 mb-1.5">
                  Format Kalimat Pengumuman:
                </label>
                <input
                  type="text"
                  value={speechTemplate}
                  onChange={(e) => setSpeechTemplate(e.target.value)}
                  placeholder="memasuki jam pelajaran ke-{nomor}."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Gunakan <code className="text-cyan-400">{'{nomor}'}</code> untuk nomor jam otomatis.
                </span>
              </div>
            </div>
          </div>

          {/* 5. Live Interactive Preview Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>5. Pratinjau Jadwal yang Akan Ditambahkan ({generatedItems.length} Baris Bel)</span>
              </label>
              <span className="text-xs text-emerald-400 font-bold">
                Hari: {selectedDays.map((d) => getIndonesianDayName(d)).join(', ')}
              </span>
            </div>

            <div className="space-y-2">
              {generatedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-sm text-emerald-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg min-w-[60px] text-center">
                      {item.time}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{item.label}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                            item.category === 'lesson'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : item.category === 'break'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          }`}
                        >
                          {item.category === 'lesson' ? 'Pelajaran' : item.category === 'break' ? 'Istirahat' : 'Pulang'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 italic mt-0.5">
                        "{audioSettings.globalPrefix}{item.speechText}"
                      </p>
                    </div>
                  </div>

                  {onTestSound && (
                    <button
                      type="button"
                      onClick={() =>
                        onTestSound(
                          item.chimeType,
                          `${audioSettings.globalPrefix}${item.speechText}`,
                          item.enableOutroChime,
                          item.outroChimeType
                        )
                      }
                      className="bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Tes Suara</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 border-t border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            Total <span className="text-emerald-400 font-bold">{generatedItems.length} jam bel baru</span> akan langsung aktif di jadwal hari <span className="text-white font-bold">{selectedDays.map((d) => getIndonesianDayName(d)).join(', ')}</span>.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex-1 sm:flex-none"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan & Tambahkan {generatedItems.length} Jam Pelajaran</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
