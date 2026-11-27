import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Bell,
  RefreshCw,
  VolumeX,
  Pause,
  Play,
  Square,
  Edit2,
  X,
  Sun,
  ChevronRight,
  ChevronUp,
  ListChecks,
  CalendarOff,
  Plus,
  Trash2,
  Power,
} from 'lucide-react';
import { DayOfWeek, TimeSyncInfo, ScheduleItem, HolidayPeriod } from '../types';
import { getIndonesianDayName } from '../utils/timeSync';
import { BellPlaybackState } from '../utils/audioSynth';
import { getGunungkidulPrayerSummary } from '../utils/prayerTimes';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  HolidayEvaluationResult,
  formatDateYYYYMMDD,
  formatShortIndoDate,
} from '../utils/holidayUtils';

interface LiveClockCardProps {
  currentTime: Date;
  selectedDay: DayOfWeek;
  setSelectedDay: (day: DayOfWeek) => void;
  todayDayNumber: DayOfWeek;
  timeSyncInfo: TimeSyncInfo;
  onManualSync: () => void;
  nextScheduleItem: ScheduleItem | null;
  countdownSeconds: number | null;
  latestScheduleItem?: ScheduleItem | null;
  onTriggerScheduleBell?: (item: ScheduleItem) => void;
  disabledDays?: DayOfWeek[];
  onToggleDisabledDay?: (day: DayOfWeek) => void;
  holidayPeriods?: HolidayPeriod[];
  onUpdateHolidayPeriods?: (periods: HolidayPeriod[]) => void;
  todayHolidayStatus?: HolidayEvaluationResult;
  fridayExtraOff?: boolean;
  fridayEarlyDismissalTime?: string;
  onToggleFridayExtraOff?: () => void;
  onUpdateFridayEarlyTime?: (time: string) => void;
  onTriggerFridayEarlyDismissalNow?: () => void;
  asasModeEnabled?: boolean;
  onToggleAsasMode?: () => void;
  bellPlayback?: BellPlaybackState;
  onTogglePauseBell?: () => void;
  onStopBell?: () => void;
  totalTodayBells?: number;
  scheduleListNode?: React.ReactNode;
}

export const LiveClockCard: React.FC<LiveClockCardProps> = ({
  currentTime,
  selectedDay,
  setSelectedDay,
  todayDayNumber,
  timeSyncInfo,
  onManualSync,
  nextScheduleItem,
  countdownSeconds,
  latestScheduleItem,
  onTriggerScheduleBell,
  disabledDays = [0],
  onToggleDisabledDay,
  holidayPeriods = [],
  onUpdateHolidayPeriods,
  todayHolidayStatus,
  fridayExtraOff = false,
  fridayEarlyDismissalTime = '12:30',
  onToggleFridayExtraOff,
  onUpdateFridayEarlyTime,
  onTriggerFridayEarlyDismissalNow,
  asasModeEnabled = false,
  onToggleAsasMode,
  bellPlayback,
  onTogglePauseBell,
  onStopBell,
  totalTodayBells = 0,
  scheduleListNode,
}) => {
  const isOnline = useOnlineStatus();
  const [isEditingFriday, setIsEditingFriday] = useState(false);
  const [isScheduleTableOpen, setIsScheduleTableOpen] = useState(false);
  const [isHolidayPanelOpen, setIsHolidayPanelOpen] = useState(false);
  const [exceptionDateDrafts, setExceptionDateDrafts] = useState<Record<string, string>>({});
  const fridayPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isEditingFriday) return;
    const handleOutside = (e: MouseEvent) => {
      if (fridayPopoverRef.current && !fridayPopoverRef.current.contains(e.target as Node)) {
        setIsEditingFriday(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEditingFriday(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isEditingFriday]);

  const daysList: { num: DayOfWeek; name: string }[] = [
    { num: 1, name: 'Senin' },
    { num: 2, name: 'Selasa' },
    { num: 3, name: 'Rabu' },
    { num: 4, name: 'Kamis' },
    { num: 5, name: 'Jumat' },
    { num: 6, name: 'Sabtu' },
    { num: 0, name: 'Minggu' },
  ];

  const isTodayDisabled = todayHolidayStatus
    ? todayHolidayStatus.isOff
    : disabledDays.includes(todayDayNumber);

  const todayDateStr = formatDateYYYYMMDD(currentTime);
  const primaryHolidayPeriod = holidayPeriods[0] || null;
  const anyHolidayRangeEnabled = holidayPeriods.some((p) => p.enabled);

  const handleOpenOrInitHolidayPanel = () => {
    if (!isHolidayPanelOpen && holidayPeriods.length === 0 && onUpdateHolidayPeriods) {
      const nextWeek = new Date(currentTime);
      nextWeek.setDate(nextWeek.getDate() + 14);
      onUpdateHolidayPeriods([
        {
          id: `hol-${Date.now()}`,
          name: 'Liburan Semester',
          enabled: false,
          startDate: todayDateStr,
          endDate: formatDateYYYYMMDD(nextWeek),
          excludedDays: [],
          excludedDates: [],
        },
      ]);
    }
    setIsHolidayPanelOpen((prev) => !prev);
  };

  const handleQuickToggleHolidayRanges = () => {
    if (!onUpdateHolidayPeriods) return;
    if (holidayPeriods.length === 0) {
      const nextWeek = new Date(currentTime);
      nextWeek.setDate(nextWeek.getDate() + 14);
      onUpdateHolidayPeriods([
        {
          id: `hol-${Date.now()}`,
          name: 'Liburan Semester',
          enabled: true,
          startDate: todayDateStr,
          endDate: formatDateYYYYMMDD(nextWeek),
          excludedDays: [],
          excludedDates: [],
        },
      ]);
      setIsHolidayPanelOpen(true);
      return;
    }
    const nextEnabled = !anyHolidayRangeEnabled;
    onUpdateHolidayPeriods(
      holidayPeriods.map((p, idx) => (idx === 0 || !nextEnabled ? { ...p, enabled: nextEnabled } : p))
    );
  };

  const handleAddHolidayPeriod = () => {
    if (!onUpdateHolidayPeriods) return;
    const nextWeek = new Date(currentTime);
    nextWeek.setDate(nextWeek.getDate() + 7);
    onUpdateHolidayPeriods([
      ...holidayPeriods,
      {
        id: `hol-${Date.now()}`,
        name: `Libur Sekolah ${holidayPeriods.length + 1}`,
        enabled: true,
        startDate: todayDateStr,
        endDate: formatDateYYYYMMDD(nextWeek),
        excludedDays: [],
        excludedDates: [],
      },
    ]);
  };

  const handleUpdatePeriod = (id: string, patch: Partial<HolidayPeriod>) => {
    if (!onUpdateHolidayPeriods) return;
    onUpdateHolidayPeriods(
      holidayPeriods.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const handleTogglePeriodExcludedDay = (period: HolidayPeriod, day: DayOfWeek) => {
    const current = period.excludedDays || [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort();
    handleUpdatePeriod(period.id, { excludedDays: next });
  };

  const handleAddPeriodExcludedDate = (period: HolidayPeriod) => {
    const dateVal = exceptionDateDrafts[period.id];
    if (!dateVal) return;
    const current = period.excludedDates || [];
    if (!current.includes(dateVal)) {
      handleUpdatePeriod(period.id, { excludedDates: [...current, dateVal].sort() });
    }
    setExceptionDateDrafts((prev) => ({ ...prev, [period.id]: '' }));
  };

  const handleRemovePeriodExcludedDate = (period: HolidayPeriod, dateToRemove: string) => {
    const current = period.excludedDates || [];
    handleUpdatePeriod(period.id, {
      excludedDates: current.filter((d) => d !== dateToRemove),
    });
  };

  const handleDeletePeriod = (id: string) => {
    if (!onUpdateHolidayPeriods) return;
    onUpdateHolidayPeriods(holidayPeriods.filter((p) => p.id !== id));
  };

  const formattedHours = String(currentTime.getHours()).padStart(2, '0');
  const formattedMinutes = String(currentTime.getMinutes()).padStart(2, '0');
  const formattedSeconds = String(currentTime.getSeconds()).padStart(2, '0');

  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const prayerSummary = getGunungkidulPrayerSummary(currentTime);

  const getCountdownParts = (secs: number | null) => {
    if (secs === null || secs < 0) return null;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return {
      hours: String(h).padStart(2, '0'),
      minutes: String(m).padStart(2, '0'),
      seconds: String(s).padStart(2, '0'),
      hasHours: h > 0,
    };
  };

  const countdownParts = getCountdownParts(countdownSeconds);

  const getChimeDisplayName = (chimeType?: string) => {
    switch (chimeType) {
      case 'westminster':
        return 'Westminster Chime';
      case 'classic_3tone':
        return 'Classic 3-Tone Chime';
      case 'electric_bell':
        return 'Bel Listrik Sekolah';
      case 'tube_chime':
        return 'Tube Chime';
      case 'islamic_duo':
        return 'Melodi Islami Maqam';
      case 'fire_bell':
        return 'Alarm Sekolah';
      case 'school_dismissal':
        return 'Melodi Bel Pulang';
      default:
        return 'Nada Bel Sekolah';
    }
  };

  const handleOpenAndScrollSchedule = () => {
    if (!isScheduleTableOpen) {
      setIsScheduleTableOpen(true);
      setTimeout(() => {
        document.getElementById('jadwal-pelajaran-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 60);
    } else {
      setIsScheduleTableOpen(false);
    }
  };

  const academicMonth = currentTime.getMonth(); // 0-indexed (0 = Jan, 6 = Jul)
  const semesterLabel = academicMonth >= 6 ? 'Semester Ganjil' : 'Semester Genap';

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* 1. Main Official School Clock Hero Card — fills desktop viewport cleanly */}
      <section className="clock-grid-bg border border-slate-200/80 rounded-3xl px-6 sm:px-10 py-6 sm:py-8 min-h-[380px] sm:min-h-[430px] lg:min-h-[calc(100vh-23.5rem)] flex flex-col justify-between shadow-[0_6px_28px_rgba(15,23,42,0.04)] relative overflow-hidden">
        {/* Top Metadata Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="inline-flex items-center gap-2 bg-blue-50/90 border border-blue-200/70 rounded-full px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-blue-700 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            <span>WAKTU RESMI SEKOLAH</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {latestScheduleItem && onTriggerScheduleBell && (
              <button
                type="button"
                onClick={() => onTriggerScheduleBell(latestScheduleItem)}
                title={`Putar ulang bel terakhir (${latestScheduleItem.time} - ${latestScheduleItem.label})`}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Bell className="w-3 h-3 text-blue-600" />
                <span>
                  Bel Terakhir: {latestScheduleItem.time} ({latestScheduleItem.label})
                </span>
              </button>
            )}

            <span className="inline-flex items-center bg-slate-100/90 border border-slate-200/80 text-slate-600 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap">
              Zona Waktu Asia/Jakarta
            </span>

            <button
              type="button"
              onClick={onManualSync}
              title="Sinkronkan Jam dengan Server API"
              className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3 h-3 text-blue-600 ${
                  timeSyncInfo.status === 'syncing' ? 'animate-spin' : ''
                }`}
              />
              <span>
                {timeSyncInfo.status === 'syncing'
                  ? 'Sinkron...'
                  : `Sync (${timeSyncInfo.offsetMs >= 0 ? `+${timeSyncInfo.offsetMs}` : timeSyncInfo.offsetMs}ms)`}
              </span>
            </button>

            {bellPlayback?.isPlaying && (
              <div className="inline-flex items-center gap-1.5">
                {onTogglePauseBell && (
                  <button
                    type="button"
                    onClick={onTogglePauseBell}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200 cursor-pointer whitespace-nowrap"
                  >
                    {bellPlayback.isPaused ? (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Lanjut</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3 h-3 fill-current" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>
                )}
                {onStopBell && (
                  <button
                    type="button"
                    onClick={onStopBell}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200 cursor-pointer whitespace-nowrap"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    <span>Berhenti</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center Giant Tabular Digital Clock */}
        <div className="my-auto py-8 sm:py-12 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center justify-center font-mono tabular-nums font-extrabold tracking-tight select-none leading-none">
            <span className="text-6xl sm:text-8xl md:text-9xl lg:text-[9.5rem] xl:text-[11.5rem] 2xl:text-[13rem] text-slate-900">
              {formattedHours}
            </span>
            <span className="text-5xl sm:text-7xl md:text-8xl lg:text-[8.5rem] xl:text-[10rem] 2xl:text-[11.5rem] text-blue-600 mx-2 sm:mx-4">
              :
            </span>
            <span className="text-6xl sm:text-8xl md:text-9xl lg:text-[9.5rem] xl:text-[11.5rem] 2xl:text-[13rem] text-slate-900">
              {formattedMinutes}
            </span>
            <span className="text-5xl sm:text-7xl md:text-8xl lg:text-[8.5rem] xl:text-[10rem] 2xl:text-[11.5rem] text-blue-600 mx-2 sm:mx-4">
              :
            </span>
            <span className="text-6xl sm:text-8xl md:text-9xl lg:text-[9.5rem] xl:text-[11.5rem] 2xl:text-[13rem] text-amber-500">
              {formattedSeconds}
            </span>
            <span className="ml-3 sm:ml-5 self-end mb-2 sm:mb-4 xl:mb-5 bg-blue-600 text-white font-sans font-extrabold text-xs sm:text-sm xl:text-base px-3 sm:px-3.5 py-1.5 rounded-xl shadow-xs whitespace-nowrap">
              WIB
            </span>
          </div>

          {/* Centered Date & Semester/Mode Pill */}
          <div className="mt-7 sm:mt-9 inline-flex flex-wrap items-center justify-center gap-2.5 bg-white border border-slate-200/90 rounded-full px-5 py-2 shadow-2xs">
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm lg:text-base font-bold text-slate-800 whitespace-nowrap">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{formattedDate}</span>
            </span>
            <span className="bg-blue-50 text-blue-700 border border-blue-200/80 px-3 py-0.5 rounded-full text-xs font-bold whitespace-nowrap">
              {asasModeEnabled ? 'Mode ASAS' : semesterLabel}
            </span>
          </div>
        </div>
        <div className="hidden sm:block" aria-hidden="true" />
      </section>

      {/* 2. Next Bell & Countdown Banner (2-column structured horizontal card) */}
      <section className="bg-gradient-to-r from-[#FFFBEB] via-[#FEF9E7] to-[#FFFDF5] border border-amber-200/90 rounded-2xl px-4 sm:px-6 py-3.5 shadow-2xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4">
          {/* Left Column: Badges + Next Bell Info */}
          <div className="lg:col-span-6 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg whitespace-nowrap">
                BEL BERIKUTNYA
              </span>
              <button
                type="button"
                onClick={onToggleAsasMode}
                title={
                  asasModeEnabled
                    ? 'Mode ASAS sedang aktif. Klik untuk ganti ke Mode Reguler.'
                    : 'Klik untuk aktifkan Mode ASAS'
                }
                className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  asasModeEnabled
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-800'
                }`}
              >
                {asasModeEnabled ? 'MODE ASAS' : 'MODE REGULER'}
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                  {isTodayDisabled
                    ? todayHolidayStatus?.reason === 'holiday_range'
                      ? todayHolidayStatus.label || 'Libur Sekolah (Rentang Tanggal)'
                      : `Hari ${getIndonesianDayName(todayDayNumber)} Libur`
                    : nextScheduleItem
                    ? nextScheduleItem.label
                    : 'Jadwal Hari Ini Selesai'}
                </h2>
                {nextScheduleItem && !isTodayDisabled && (
                  <span className="inline-flex items-center gap-1 bg-white border border-amber-200 text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tabular-nums whitespace-nowrap">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>{nextScheduleItem.time} WIB</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {isTodayDisabled
                  ? 'Bel, Murottal & rekaman tambahan dimatikan otomatis (Mode Libur)'
                  : nextScheduleItem
                  ? `${getChimeDisplayName(nextScheduleItem.chimeType)} + Speech Voice Synthesizer`
                  : 'Semua jadwal bel hari ini telah berbunyi dengan lancar'}
              </p>
            </div>
          </div>

          {/* Right Column: Framed Countdown Box + Total & Quick Link */}
          <div className="lg:col-span-6 flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-3 sm:gap-5">
            {/* Countdown Box */}
            <div className="bg-white/95 border border-amber-200 rounded-xl px-4 py-2 flex items-center justify-between sm:justify-start gap-3 shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 whitespace-nowrap">
                HITUNG MUNDUR
              </span>
              {isTodayDisabled || !countdownParts ? (
                <span className="text-xs sm:text-sm font-bold text-amber-700 whitespace-nowrap">
                  {isTodayDisabled
                    ? todayHolidayStatus?.reason === 'holiday_range'
                      ? 'Libur Tanggal'
                      : 'Hari Libur'
                    : 'Selesai'}
                </span>
              ) : (
                <div className="flex items-baseline gap-1.5 font-mono font-extrabold text-amber-600 tabular-nums whitespace-nowrap">
                  {countdownParts.hasHours && (
                    <>
                      <span className="text-lg sm:text-xl">{countdownParts.hours}</span>
                      <span className="text-[10px] font-sans font-bold text-amber-700">JAM</span>
                      <span className="text-base text-amber-500 mx-0.5">:</span>
                    </>
                  )}
                  <span className="text-lg sm:text-xl">{countdownParts.minutes}</span>
                  <span className="text-[10px] font-sans font-bold text-amber-700">MENIT</span>
                  <span className="text-base text-amber-500 mx-0.5">:</span>
                  <span className="text-lg sm:text-xl">{countdownParts.seconds}</span>
                  <span className="text-[10px] font-sans font-bold text-amber-700">DETIK</span>
                </div>
              )}
            </div>

            {/* Total Today & Quick Link */}
            <div className="text-left sm:text-right shrink-0">
              <div className="text-xs font-semibold text-slate-600 tabular-nums whitespace-nowrap">
                Total Hari Ini: <strong className="text-slate-900">{totalTodayBells} Bel</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isScheduleTableOpen) {
                    handleOpenAndScrollSchedule();
                  } else {
                    document.getElementById('jadwal-pelajaran-section')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                {nextScheduleItem
                  ? `Bel Berikutnya: ${nextScheduleItem.time} WIB →`
                  : 'Lihat Semua Jadwal →'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Horizontal Prayer & Dhuha Schedule Bar (Kemenag Gunungkidul) */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:px-5 sm:py-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sun className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="text-xs font-extrabold tracking-wide uppercase text-slate-800">
              JADWAL SHOLAT &amp; DHUHA HARI INI{' '}
              <span className="font-semibold text-slate-400">(KEMENAG GUNUNGKIDUL)</span>
            </h3>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold tabular-nums whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>
              Menuju {prayerSummary.nextLabel}: {prayerSummary.countdownStr}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {prayerSummary.entries.map((entry) => (
            <div
              key={entry.id}
              className={`relative rounded-xl px-3 py-2.5 text-center transition-colors ${
                entry.isNext
                  ? 'border border-blue-300 bg-blue-50/50'
                  : 'border border-slate-200/80 bg-slate-50/40'
              }`}
            >
              <div
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  entry.isNext ? 'text-blue-700' : 'text-slate-500'
                }`}
              >
                {entry.label}
              </div>
              <div
                className={`mt-1 text-sm sm:text-base font-mono font-extrabold tabular-nums ${
                  entry.isNext ? 'text-blue-700' : 'text-slate-900'
                }`}
              >
                {entry.time}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Bottom System Status & Schedule Table Trigger Bar */}
      <section className="bg-white border border-slate-200/80 rounded-2xl px-4 sm:px-5 py-3 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 min-w-0">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            <span>
              Status Sistem:{' '}
              <strong className={isOnline ? 'text-slate-900' : 'text-amber-800'}>
                {isOnline
                  ? 'Operasional Normal (Terhubung Otomatis)'
                  : 'Mode Offline Aktif (Berjalan Lokal)'}
              </strong>
            </span>
          </span>
          <span className="hidden md:inline text-slate-300">|</span>
          <span className="text-slate-500">
            Kalender Bel &amp; Waktu Sholat Otomatis Aktif
          </span>
          <span className="hidden xl:inline text-slate-300">•</span>
          <span className="hidden xl:inline text-[11px] font-mono text-slate-400 tabular-nums">
            {timeSyncInfo.source} ({timeSyncInfo.offsetMs >= 0 ? `+${timeSyncInfo.offsetMs}` : timeSyncInfo.offsetMs}ms)
          </span>
        </div>

        <button
          type="button"
          onClick={handleOpenAndScrollSchedule}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ListChecks className="w-4 h-4 shrink-0" />
          <span>
            {isScheduleTableOpen
              ? 'Tutup Tabel Jadwal Lengkap'
              : 'Lihat & Kelola Tabel Jadwal Lengkap'}
          </span>
          {isScheduleTableOpen ? (
            <ChevronUp className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
        </button>
      </section>

      {/* 5. Expandable & Scrollable Schedule Management Section */}
      {isScheduleTableOpen && (
        <div id="jadwal-pelajaran-section" className="pt-1 space-y-4 animate-fadeIn">
          {/* Day Selector Bar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-extrabold text-slate-900 tracking-wider uppercase">
                  PILIH HARI JADWAL PELAJARAN
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Hari ini:{' '}
                <strong className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/80">
                  {getIndonesianDayName(todayDayNumber)}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {daysList.map((day) => {
                const isToday = day.num === todayDayNumber;
                const isSelected = day.num === selectedDay;
                const isDayOff = disabledDays.includes(day.num);

                return (
                  <div
                    key={day.num}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDay(day.num)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDay(day.num);
                      }
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all relative flex flex-col justify-between gap-2 cursor-pointer select-none ${
                      isSelected
                        ? isDayOff
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'bg-blue-600 text-white shadow-sm'
                        : isDayOff
                        ? 'bg-rose-50/80 hover:bg-rose-50 text-rose-900 border border-rose-200'
                        : 'bg-slate-50 hover:bg-blue-50/70 text-slate-700 border border-slate-200/80 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{day.name}</span>
                      {isToday && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold shrink-0 ${
                            isSelected
                              ? 'bg-white text-blue-700'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}
                        >
                          Hari Ini
                        </span>
                      )}
                    </div>

                    {onToggleDisabledDay && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleDisabledDay(day.num);
                        }}
                        title={
                          isDayOff
                            ? `Klik untuk AKTIFKAN kembali bel, murottal, & rekaman di hari ${day.name}`
                            : `Klik untuk MATIKAN (OFF) seluruh bel, murottal, & rekaman di hari ${day.name}`
                        }
                        className={`w-full px-2 py-1 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? isDayOff
                              ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-400'
                              : 'bg-white/95 hover:bg-white text-emerald-700 border-white/80 shadow-2xs'
                            : isDayOff
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isDayOff
                              ? isSelected
                                ? 'bg-white'
                                : 'bg-rose-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span>{isDayOff ? 'OFF (Libur)' : 'ON (Aktif)'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Weekend Auto-Silence, Mode ASAS & Jumat Ekstra Controls */}
            {onToggleDisabledDay && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <VolumeX className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>
                    <strong className="text-slate-800">Mode Hari Libur:</strong> Hari yang dinonaktifkan otomatis mematikan <strong>Bel &amp; Murottal</strong> meski PC hidup 24 jam.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onToggleAsasMode && (
                    <button
                      type="button"
                      onClick={onToggleAsasMode}
                      title={
                        asasModeEnabled
                          ? 'Mode Bel Khusus ASAS sedang AKTIF. Klik untuk kembali ke jadwal normal.'
                          : 'Klik untuk mengaktifkan Mode Bel Khusus ASAS (Asesmen Akhir Semester)'
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        asasModeEnabled
                          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-xs'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          asasModeEnabled ? 'bg-emerald-300 animate-pulse' : 'bg-indigo-400'
                        }`}
                      />
                      <span>{asasModeEnabled ? 'Mode ASAS: AKTIF' : 'Mode ASAS: Nonaktif'}</span>
                    </button>
                  )}
                  {onToggleFridayExtraOff && (
                    <div className="relative" ref={fridayPopoverRef}>
                      <div
                        className={`rounded-lg text-[11px] font-bold border transition-all flex items-center overflow-hidden ${
                          fridayExtraOff
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={onToggleFridayExtraOff}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            setIsEditingFriday(true);
                          }}
                          title={
                            fridayExtraOff
                              ? `Klik 1x: Aktifkan Ekstra Jumat • Klik 2x / ikon pensil: Ubah jam pulang (${fridayEarlyDismissalTime} WIB)`
                              : `Klik 1x: Liburkan Ekstra Jumat (Pulang ${fridayEarlyDismissalTime} WIB) • Klik 2x / ikon pensil: Atur jam`
                          }
                          className={`px-2.5 py-1 flex items-center gap-1.5 cursor-pointer transition-colors ${
                            fridayExtraOff ? 'hover:bg-amber-100' : 'hover:bg-blue-100'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${fridayExtraOff ? 'bg-amber-500' : 'bg-blue-500'}`} />
                          <span>
                            {fridayExtraOff
                              ? `Jumat Ekstra: Libur (Pulang ${fridayEarlyDismissalTime})`
                              : 'Jumat Ekstra: Aktif'}
                          </span>
                        </button>

                        {onUpdateFridayEarlyTime && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsEditingFriday((prev) => !prev);
                            }}
                            title="Klik untuk edit jam pulang hari Jumat & aksi cepat"
                            className={`px-1.5 py-1 border-l cursor-pointer transition-colors ${
                              fridayExtraOff
                                ? 'border-amber-200 hover:bg-amber-100 text-amber-700'
                                : 'border-blue-200 hover:bg-blue-100 text-blue-600'
                            }`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {isEditingFriday && (
                        <div className="absolute left-0 sm:left-auto sm:right-0 bottom-full mb-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 z-50 space-y-3 text-left">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-xs font-extrabold text-slate-900">
                              Atur Ekstra Hari Jumat
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsEditingFriday(false)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {onUpdateFridayEarlyTime && (
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 block">
                                Jam Pulang Awal Saat Ekstra Libur (WIB):
                              </label>
                              <input
                                type="time"
                                value={fridayEarlyDismissalTime}
                                onChange={(e) => {
                                  if (e.target.value) onUpdateFridayEarlyTime(e.target.value);
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-mono font-extrabold text-slate-900 text-xs focus:outline-hidden focus:border-blue-500 cursor-pointer"
                              />
                            </div>
                          )}

                          <div className="flex flex-col gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={onToggleFridayExtraOff}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                fridayExtraOff
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                  : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                              }`}
                            >
                              {fridayExtraOff
                                ? 'Aktifkan Ekstra Jumat (Normal)'
                                : `Liburkan Ekstra (Pulang ${fridayEarlyDismissalTime})`}
                            </button>

                            {fridayExtraOff && onTriggerFridayEarlyDismissalNow && (
                              <button
                                type="button"
                                onClick={() => {
                                  onTriggerFridayEarlyDismissalNow();
                                  setIsEditingFriday(false);
                                }}
                                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>Bunyikan Bel Pulang Sekarang</span>
                              </button>
                            )}
                          </div>

                          <p className="text-[10px] text-slate-500 leading-snug">
                            Tip: Klik 1x pada tombol untuk ubah status, klik 2x atau tekan ikon pensil untuk ubah jam.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {onUpdateHolidayPeriods && (
                    <div
                      className={`rounded-lg text-[11px] font-bold border transition-all flex items-center overflow-hidden ${
                        anyHolidayRangeEnabled
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={handleQuickToggleHolidayRanges}
                        title={
                          anyHolidayRangeEnabled
                            ? 'Libur Rentang Tanggal sedang ON. Klik untuk nonaktifkan sementara.'
                            : 'Klik untuk aktifkan Libur Rentang Tanggal (Liburan Semester)'
                        }
                        className={`px-2.5 py-1 flex items-center gap-1.5 cursor-pointer transition-colors ${
                          anyHolidayRangeEnabled ? 'hover:bg-rose-100' : 'hover:bg-slate-100'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            anyHolidayRangeEnabled ? 'bg-rose-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        <span>
                          {anyHolidayRangeEnabled && primaryHolidayPeriod
                            ? `Libur Tgl: ON (${formatShortIndoDate(primaryHolidayPeriod.startDate)} - ${formatShortIndoDate(primaryHolidayPeriod.endDate)})`
                            : 'Libur Tanggal: Nonaktif'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenOrInitHolidayPanel}
                        title="Atur rentang tanggal libur semester & pengecualian hari"
                        className={`px-2 py-1 border-l flex items-center gap-1 cursor-pointer transition-colors ${
                          anyHolidayRangeEnabled
                            ? 'border-rose-200 hover:bg-rose-100 text-rose-700'
                            : 'border-slate-200 hover:bg-slate-100 text-blue-700'
                        }`}
                      >
                        <CalendarOff className="w-3 h-3" />
                        <span>Atur Tanggal</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Expandable Semester / Date-Range Holiday Configurator with Day & Date Exceptions */}
            {isHolidayPanelOpen && onUpdateHolidayPeriods && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <CalendarOff className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">
                        Pengaturan Libur Rentang Tanggal (Liburan Semester) &amp; Pengecualian Hari
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Atur tanggal mulai–selesai libur. Semua bel, murottal, &amp; rekaman tambahan otomatis mati di rentang ini kecuali hari/tanggal yang Anda kecualikan.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleAddHolidayPeriod}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Rentang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsHolidayPanelOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                      title="Tutup panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {holidayPeriods.length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
                    Belum ada rentang tanggal libur. Klik <strong>Tambah Rentang</strong> untuk mengatur jadwal liburan semester.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {holidayPeriods.map((period) => {
                      const draftExceptionDate = exceptionDateDrafts[period.id] || '';
                      return (
                        <div
                          key={period.id}
                          className={`rounded-2xl border p-3.5 space-y-3 transition-colors ${
                            period.enabled
                              ? 'bg-rose-50/40 border-rose-200'
                              : 'bg-slate-50/70 border-slate-200'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdatePeriod(period.id, { enabled: !period.enabled })
                                }
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 cursor-pointer transition-all ${
                                  period.enabled
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-2xs'
                                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                                <span>{period.enabled ? 'ON (Libur Aktif)' : 'OFF (Nonaktif)'}</span>
                              </button>

                              <input
                                type="text"
                                value={period.name || ''}
                                onChange={(e) =>
                                  handleUpdatePeriod(period.id, { name: e.target.value })
                                }
                                placeholder="Nama Liburan (misal: Liburan Semester Ganjil)"
                                className="flex-1 min-w-[180px] bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                  Dari:
                                </span>
                                <input
                                  type="date"
                                  value={period.startDate}
                                  onChange={(e) =>
                                    handleUpdatePeriod(period.id, { startDate: e.target.value })
                                  }
                                  className="text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-hidden cursor-pointer"
                                />
                              </div>

                              <span className="text-xs font-bold text-slate-400">s/d</span>

                              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                  Sampai:
                                </span>
                                <input
                                  type="date"
                                  value={period.endDate}
                                  onChange={(e) =>
                                    handleUpdatePeriod(period.id, { endDate: e.target.value })
                                  }
                                  className="text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-hidden cursor-pointer"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeletePeriod(period.id)}
                                title="Hapus rentang tanggal ini"
                                className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Pengecualian Hari (Hari yang tetap aktif berbunyi meski masuk rentang libur) */}
                          <div className="pt-2 border-t border-slate-200/70 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-bold text-slate-700 block">
                                Pengecualian Hari{' '}
                                <span className="font-normal text-slate-500">
                                  (Klik hari jika di hari tersebut bel/murottal TETAP AKTIF meski masuk tanggal libur):
                                </span>
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {daysList.map((d) => {
                                  const isExcepted = (period.excludedDays || []).includes(d.num);
                                  return (
                                    <button
                                      key={d.num}
                                      type="button"
                                      onClick={() => handleTogglePeriodExcludedDay(period, d.num)}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                        isExcepted
                                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                                      }`}
                                    >
                                      {isExcepted ? `✓ ${d.name} (Tetap Aktif)` : d.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Optional Specific Date Exceptions (e.g., Pembagian Rapor) */}
                            <div className="space-y-1.5 shrink-0">
                              <span className="text-[11px] font-bold text-slate-700 block">
                                Pengecualian Tanggal Khusus (Opsional):
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <input
                                  type="date"
                                  value={draftExceptionDate}
                                  min={period.startDate || undefined}
                                  max={period.endDate || undefined}
                                  onChange={(e) =>
                                    setExceptionDateDrafts((prev) => ({
                                      ...prev,
                                      [period.id]: e.target.value,
                                    }))
                                  }
                                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                                />
                                <button
                                  type="button"
                                  disabled={!draftExceptionDate}
                                  onClick={() => handleAddPeriodExcludedDate(period)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-50 cursor-pointer"
                                >
                                  + Kecualikan Tgl
                                </button>
                              </div>
                              {period.excludedDates && period.excludedDates.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {period.excludedDates.map((exDate) => (
                                    <span
                                      key={exDate}
                                      className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                    >
                                      <span>{formatShortIndoDate(exDate)} (Aktif)</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemovePeriodExcludedDate(period, exDate)
                                        }
                                        className="hover:text-rose-600 cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {scheduleListNode}
        </div>
      )}
    </div>
  );
};
