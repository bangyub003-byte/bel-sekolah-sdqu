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
} from 'lucide-react';
import { DayOfWeek, TimeSyncInfo, ScheduleItem } from '../types';
import { getIndonesianDayName } from '../utils/timeSync';
import { BellPlaybackState } from '../utils/audioSynth';
import { getGunungkidulPrayerSummary } from '../utils/prayerTimes';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

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

  const isTodayDisabled = disabledDays.includes(todayDayNumber);

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
    <div className="space-y-3.5">
      {/* 1. Main Official School Clock Hero Card */}
      <section className="clock-grid-bg border border-slate-200/80 rounded-3xl px-5 sm:px-8 py-5 sm:py-7 shadow-[0_6px_28px_rgba(15,23,42,0.04)] relative overflow-hidden">
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
        <div className="py-6 sm:py-9 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center justify-center font-mono tabular-nums font-extrabold tracking-tight select-none leading-none">
            <span className="text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] text-slate-900">
              {formattedHours}
            </span>
            <span className="text-4xl sm:text-6xl md:text-7xl lg:text-[6.25rem] text-blue-600 mx-1.5 sm:mx-3">
              :
            </span>
            <span className="text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] text-slate-900">
              {formattedMinutes}
            </span>
            <span className="text-4xl sm:text-6xl md:text-7xl lg:text-[6.25rem] text-blue-600 mx-1.5 sm:mx-3">
              :
            </span>
            <span className="text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] text-amber-500">
              {formattedSeconds}
            </span>
            <span className="ml-3 sm:ml-4 self-end mb-1.5 sm:mb-3 bg-blue-600 text-white font-sans font-extrabold text-[11px] sm:text-xs px-2.5 py-1 rounded-lg shadow-xs whitespace-nowrap">
              WIB
            </span>
          </div>

          {/* Centered Date & Semester/Mode Pill */}
          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2.5 bg-white border border-slate-200/90 rounded-full px-4 py-1.5 shadow-2xs">
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{formattedDate}</span>
            </span>
            <span className="bg-blue-50 text-blue-700 border border-blue-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap">
              {asasModeEnabled ? 'Mode ASAS' : semesterLabel}
            </span>
          </div>
        </div>
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
                    ? `Hari ${getIndonesianDayName(todayDayNumber)} Libur`
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
                  ? 'Bel & Murottal dimatikan otomatis pada hari libur'
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
                  {isTodayDisabled ? 'Hari Libur' : 'Selesai'}
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
                entry.isActive
                  ? 'border-2 border-emerald-500 bg-emerald-50/40'
                  : entry.isNext
                  ? 'border border-blue-300 bg-blue-50/50'
                  : 'border border-slate-200/80 bg-slate-50/40'
              }`}
            >
              {entry.isActive && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap">
                  AKTIF
                </span>
              )}
              <div
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  entry.isActive
                    ? 'text-emerald-700'
                    : entry.isNext
                    ? 'text-blue-700'
                    : 'text-slate-500'
                }`}
              >
                {entry.label}
              </div>
              <div
                className={`mt-1 text-sm sm:text-base font-mono font-extrabold tabular-nums ${
                  entry.isActive
                    ? 'text-emerald-900'
                    : entry.isNext
                    ? 'text-blue-700'
                    : 'text-slate-900'
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
                  <button
                    key={day.num}
                    type="button"
                    onClick={() => setSelectedDay(day.num)}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all relative flex items-center justify-between gap-1 cursor-pointer ${
                      isSelected
                        ? isDayOff
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'bg-blue-600 text-white shadow-sm'
                        : isDayOff
                        ? 'bg-rose-50/70 hover:bg-rose-50 text-rose-800 border border-rose-200'
                        : 'bg-slate-50 hover:bg-blue-50/70 text-slate-700 border border-slate-200/80 hover:border-blue-200'
                    }`}
                  >
                    <span>{day.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isDayOff && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold ${
                            isSelected
                              ? 'bg-rose-500 text-white'
                              : 'bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                        >
                          Off
                        </span>
                      )}
                      {isToday && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold ${
                            isSelected
                              ? 'bg-white text-blue-700'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}
                        >
                          Hari Ini
                        </span>
                      )}
                    </div>
                  </button>
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
                  {[
                    { num: 6 as DayOfWeek, label: 'Sabtu' },
                    { num: 0 as DayOfWeek, label: 'Minggu' },
                  ].map((wk) => {
                    const isOff = disabledDays.includes(wk.num);
                    return (
                      <button
                        key={wk.num}
                        type="button"
                        onClick={() => onToggleDisabledDay(wk.num)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isOff
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isOff ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <span>{wk.label}: {isOff ? 'Nonaktif (Mati)' : 'Aktif'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {scheduleListNode}
        </div>
      )}
    </div>
  );
};
