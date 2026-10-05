import React from 'react';
import {
  Clock,
  Calendar,
  Bell,
  RefreshCw,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { DayOfWeek, TimeSyncInfo, ScheduleItem } from '../types';
import { getIndonesianDayName } from '../utils/timeSync';

interface LiveClockCardProps {
  currentTime: Date;
  selectedDay: DayOfWeek;
  setSelectedDay: (day: DayOfWeek) => void;
  todayDayNumber: DayOfWeek;
  timeSyncInfo: TimeSyncInfo;
  onManualSync: () => void;
  nextScheduleItem: ScheduleItem | null;
  countdownSeconds: number | null;
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
}) => {
  const daysList: { num: DayOfWeek; name: string }[] = [
    { num: 1, name: 'Senin' },
    { num: 2, name: 'Selasa' },
    { num: 3, name: 'Rabu' },
    { num: 4, name: 'Kamis' },
    { num: 5, name: 'Jumat' },
    { num: 6, name: 'Sabtu' },
  ];

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
    if (secs === null || secs < 0) return 'Tidak ada jadwal tersisa hari ini';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h} jam ${m} menit ${s} detik`;
    if (m > 0) return `${m} menit ${s} detik`;
    return `${s} detik lagi!`;
  };

  return (
    <div className="space-y-6">
      {/* Main Top Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Giant Digital Clock Card */}
        <div className="lg:col-span-7 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/80 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between">
          {/* Background Glow Accents */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-extrabold tracking-wider uppercase text-emerald-400 bg-emerald-900/40 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Jam Server Presisi
                </span>
              </div>

              <button
                onClick={onManualSync}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-all border border-slate-700 cursor-pointer"
                title="Sinkronkan dengan Server API"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${timeSyncInfo.status === 'syncing' ? 'animate-spin' : ''}`} />
                <span>Sinkron API</span>
              </button>
            </div>

            {/* Giant Time Display */}
            <div className="my-2 text-center sm:text-left">
              <div className="inline-flex items-baseline font-mono tracking-tight font-black text-white text-5xl sm:text-7xl lg:text-8xl drop-shadow-md">
                <span>{formattedHours}</span>
                <span className="text-emerald-400 animate-pulse mx-1">:</span>
                <span>{formattedMinutes}</span>
                <span className="text-emerald-400 animate-pulse mx-1">:</span>
                <span className="text-amber-400 text-4xl sm:text-6xl lg:text-7xl">{formattedSeconds}</span>
                <span className="text-xs sm:text-sm font-sans font-bold text-slate-400 ml-3">WIB</span>
              </div>

              {/* Date String */}
              <div className="flex items-center gap-2 mt-3 text-slate-300 text-sm sm:text-base font-medium">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{formattedDate}</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
                  Waktu Real-Time
                </span>
              </div>
            </div>
          </div>

          {/* Sync status footer inside clock card */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                Status: <strong className="text-slate-200">{timeSyncInfo.source}</strong>
              </span>
            </div>
            <div className="font-mono text-emerald-300/80 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800">
              Offset: {timeSyncInfo.offsetMs} ms • Latensi: {timeSyncInfo.latencyMs} ms
            </div>
          </div>
        </div>

        {/* Right: Next Bell Countdown Card */}
        <div className="lg:col-span-5 bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 text-amber-400 pointer-events-none">
            <Bell className="w-32 h-32" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                <Zap className="w-3.5 h-3.5" />
                <span>Bel Sekolah Berikutnya</span>
              </div>
              <span className="text-xs text-amber-200/70 font-mono bg-slate-800 px-2 py-0.5 rounded">
                Hari Ini ({getIndonesianDayName(todayDayNumber)})
              </span>
            </div>

            {nextScheduleItem ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-black flex flex-col items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 font-mono text-lg">
                    {nextScheduleItem.time}
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
                      {nextScheduleItem.label}
                    </h3>
                    <p className="text-xs text-amber-200/80 mt-1 line-clamp-2 italic">
                      "{nextScheduleItem.speechText}"
                    </p>
                  </div>
                </div>

                {/* Countdown display */}
                <div className="bg-slate-950/80 rounded-2xl p-4 border border-amber-500/20 text-center">
                  <div className="text-xs text-slate-400 font-medium mb-1">
                    Hitung Mundur Bunyi Bel:
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight animate-pulse">
                    {formatCountdown(countdownSeconds)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white">Semua Bel Hari Ini Telah Selesai</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Semua jadwal bel untuk hari {getIndonesianDayName(todayDayNumber)} telah berbunyi. Sistem siap untuk besok.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              SD QUR'AN UNGGULAN
            </span>
            <span className="text-amber-300 font-medium">Auto-Trigger System</span>
          </div>
        </div>
      </div>

      {/* Day Selector Pills */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
              PILIH PRATINJAU HARI JADWAL:
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Hari ini:{' '}
            <strong className="text-emerald-400 font-bold">
              {getIndonesianDayName(todayDayNumber)}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {daysList.map((day) => {
            const isToday = day.num === todayDayNumber;
            const isSelected = day.num === selectedDay;

            return (
              <button
                key={day.num}
                onClick={() => setSelectedDay(day.num)}
                className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all relative flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20 scale-[1.02]'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                }`}
              >
                <span>{day.name}</span>
                {isToday && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isSelected
                        ? 'bg-slate-950 text-emerald-300'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    Hari Ini
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
