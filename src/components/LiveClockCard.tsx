import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Bell,
  RefreshCw,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  ChevronDown,
  VolumeX,
  Pause,
  Play,
  Square,
  Edit2,
  X,
} from 'lucide-react';
import { DayOfWeek, TimeSyncInfo, ScheduleItem } from '../types';
import { getIndonesianDayName } from '../utils/timeSync';
import { BellPlaybackState } from '../utils/audioSynth';

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
}) => {
  const [isEditingFriday, setIsEditingFriday] = useState(false);
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

  const formatCountdown = (secs: number | null) => {
    if (secs === null || secs < 0) return 'Tidak ada jadwal bel tersisa hari ini';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h} jam ${m} menit ${s} detik`;
    if (m > 0) return `${m} menit ${s} detik`;
    return `${s} detik lagi!`;
  };

  const scrollToSchedule = () => {
    const el = document.getElementById('jadwal-pelajaran-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Hero Viewport Section: Huge Clock + Next Bell (Lifted higher so both fit on screen) */}
      <section className="flex flex-col gap-3 sm:gap-3.5">
        {/* Top Header & Giant Clock Container */}
        <div className="bg-white border border-blue-100 rounded-3xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(30,58,138,0.05)] relative overflow-hidden flex flex-col justify-between">
          {/* Subtle Ambient Light Glows */}
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-50/60 rounded-full blur-3xl pointer-events-none" />

          {/* Clock Header Bar */}
          <div className="relative z-10 flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2 sm:mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/90 flex items-center gap-1.5 shadow-2xs">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                Jam Server Presisi Real-Time
              </span>
            </div>

            <button
              onClick={onManualSync}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 px-2.5 py-1 rounded-xl transition-all border border-slate-200 hover:border-blue-300 cursor-pointer shadow-xs active:scale-95"
              title="Sinkronkan Jam dengan Server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${timeSyncInfo.status === 'syncing' ? 'animate-spin' : ''}`} />
              <span>Sinkron API</span>
            </button>
          </div>

          {/* Giant Time Digits Display (Dominant & Majestic, Lifted Higher) */}
          <div className="relative z-10 my-1 sm:my-3 text-center flex flex-col items-center justify-center">
            <div className="inline-flex items-baseline font-mono tracking-tighter font-black text-slate-900 text-6xl sm:text-7xl md:text-8xl lg:text-9xl drop-shadow-xs select-none leading-none">
              <span className="hover:text-blue-600 transition-colors">{formattedHours}</span>
              <span className="text-blue-600 animate-pulse mx-1 sm:mx-2">:</span>
              <span className="hover:text-blue-600 transition-colors">{formattedMinutes}</span>
              <span className="text-blue-600 animate-pulse mx-1 sm:mx-2">:</span>
              <span className="text-amber-500 hover:text-amber-600 transition-colors text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
                {formattedSeconds}
              </span>
              <span className="text-xs sm:text-base font-sans font-black text-blue-700 ml-2 sm:ml-3 bg-blue-50 px-2 sm:px-3 py-0.5 rounded-xl border border-blue-200 shadow-2xs align-middle">
                WIB
              </span>
            </div>

            {/* Date and Quick Repeat / Playback Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2 sm:mt-3 text-slate-600 text-xs sm:text-sm font-bold">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>{formattedDate}</span>
              {latestScheduleItem && onTriggerScheduleBell && (
                <button
                  type="button"
                  onClick={() => onTriggerScheduleBell(latestScheduleItem)}
                  title={`Bunyikan bel jadwal saat ini / sebelumnya (${latestScheduleItem.time} - ${latestScheduleItem.label})`}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 px-2 py-0.5 rounded-lg border border-blue-200 hover:border-blue-600 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <Bell className="w-3 h-3" />
                  <span>Bel {latestScheduleItem.time}</span>
                </button>
              )}
              {bellPlayback?.isPlaying && (
                <>
                  {onTogglePauseBell && (
                    <button
                      type="button"
                      onClick={onTogglePauseBell}
                      title={bellPlayback.isPaused ? 'Lanjutkan suara bel' : 'Jeda (Pause) suara bel'}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-white bg-amber-50 hover:bg-amber-500 px-2 py-0.5 rounded-lg border border-amber-200 hover:border-amber-500 transition-all cursor-pointer shadow-2xs active:scale-95"
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
                      title="Hentikan suara bel sekarang"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 px-2 py-0.5 rounded-lg border border-rose-200 hover:border-rose-600 transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Square className="w-2.5 h-2.5 fill-current" />
                      <span>Berhenti</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Server API Precision Info Footer */}
          <div className="relative z-10 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] sm:text-xs text-slate-500 gap-2 mt-1 sm:mt-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                Sumber Waktu: <strong className="text-slate-800">{timeSyncInfo.source}</strong>
              </span>
            </div>
            <div className="font-mono text-[11px] text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 font-semibold">
              Offset: {timeSyncInfo.offsetMs >= 0 ? `+${timeSyncInfo.offsetMs}` : timeSyncInfo.offsetMs} ms • Latensi: {timeSyncInfo.latencyMs} ms
            </div>
          </div>
        </div>

        {/* Bel Sekolah Berikutnya Card (Subordinate, Fully Visible, Clean) */}
        <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/50 border border-amber-200 rounded-2xl p-3.5 sm:p-4 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-black font-mono text-base flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                {nextScheduleItem ? nextScheduleItem.time : '--:--'}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200">
                    Bel Sekolah Berikutnya
                  </span>
                  {asasModeEnabled && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                      Mode ASAS
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Hari Ini ({getIndonesianDayName(todayDayNumber)})
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate mt-0.5">
                  {isTodayDisabled
                    ? `Hari ${getIndonesianDayName(todayDayNumber)} Dinonaktifkan (Mode Libur)`
                    : nextScheduleItem
                    ? nextScheduleItem.label
                    : 'Semua Jadwal Bel Hari Ini Telah Berbunyi'}
                </h3>
              </div>
            </div>

            {/* Countdown Box */}
            <div className="w-full sm:w-auto bg-amber-100/70 border border-amber-200 rounded-xl px-3.5 py-1.5 text-center shrink-0">
              <span className="text-[9px] font-bold text-amber-800 block uppercase tracking-wider">
                {isTodayDisabled ? 'Status Hari Ini:' : 'Hitung Mundur:'}
              </span>
              <span className="text-sm sm:text-base font-black text-amber-700 font-mono">
                {isTodayDisabled ? 'Bel & Murottal Mati Otomatis' : formatCountdown(countdownSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* Scroll Cue to Reveal Schedule Below the Fold */}
        <div className="pt-1 pb-1 text-center">
          <button
            onClick={scrollToSchedule}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-blue-700 bg-white hover:bg-blue-50 px-3.5 py-1.5 rounded-full border border-slate-200 hover:border-blue-300 shadow-2xs transition-all cursor-pointer"
          >
            <span>Gulir ke bawah untuk melihat tabel jadwal pelajaran</span>
            <ChevronDown className="w-3.5 h-3.5 text-blue-600 animate-bounce" />
          </button>
        </div>
      </section>

      {/* Target Section (Reached via scroll down): Day Selector & Schedules */}
      <div id="jadwal-pelajaran-section" className="pt-2">
        {/* Day Selector Bar */}
        <div className="bg-white border border-blue-100 rounded-3xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-black text-slate-900 tracking-wider">
                PILIH HARI JADWAL PELAJARAN:
              </span>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Hari ini:{' '}
              <strong className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
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
                  onClick={() => setSelectedDay(day.num)}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all relative flex items-center justify-between gap-1 cursor-pointer ${
                    isSelected
                      ? isDayOff
                        ? 'bg-slate-700 text-white shadow-md scale-[1.02]'
                        : 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                      : isDayOff
                      ? 'bg-rose-50/60 hover:bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-slate-50 hover:bg-blue-50/70 text-slate-700 border border-slate-200/80 hover:border-blue-200'
                  }`}
                >
                  <span>{day.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {isDayOff && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
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
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
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

          {/* Weekend Auto-Silence Control (Sabtu & Minggu) */}
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
                          <span className="text-xs font-black text-slate-900">
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
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-mono font-black text-slate-900 text-xs focus:outline-hidden focus:border-blue-500 cursor-pointer"
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
      </div>
    </div>
  );
};
