import React from 'react';
import {
  Clock,
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Activity,
  Sparkles,
  Zap,
} from 'lucide-react';
import { TimeSyncInfo } from '../types';

interface TimeSyncConfigProps {
  timeSyncInfo: TimeSyncInfo;
  onManualSync: () => void;
  syncIntervalMinutes: number;
  setSyncIntervalMinutes: (interval: number) => void;
  serverTimeFormatted: string;
  localTimeFormatted: string;
}

export const TimeSyncConfig: React.FC<TimeSyncConfigProps> = ({
  timeSyncInfo,
  onManualSync,
  syncIntervalMinutes,
  setSyncIntervalMinutes,
  serverTimeFormatted,
  localTimeFormatted,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-emerald-400" />
            <span>Integrasi API Sinkronisasi Waktu Real-Time</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Mengoreksi drift jam perangkat lokal secara otomatis menggunakan API Server & NTP publik agar bel sekolah berbunyi 100% presisi.
          </p>
        </div>

        <button
          onClick={onManualSync}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-5 py-3 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${timeSyncInfo.status === 'syncing' ? 'animate-spin' : ''}`} />
          <span>Sinkronkan Waktu API Sekarang</span>
        </button>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Status Sinkronisasi */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Status Sinkronisasi
            </span>
            <Wifi className={`w-5 h-5 ${timeSyncInfo.status === 'synced' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <span className="text-xl font-black text-white">
                {timeSyncInfo.status === 'synced' ? 'Presisi & Terhubung' : 'Proses Sinkronisasi'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Sumber: <strong className="text-emerald-300">{timeSyncInfo.source}</strong>
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900 text-[11px] text-slate-500 font-mono">
            Terakhir dikoreksi:{' '}
            {timeSyncInfo.lastSynced
              ? new Date(timeSyncInfo.lastSynced).toLocaleTimeString('id-ID')
              : 'Baru Saja'}
          </div>
        </div>

        {/* Card 2: Jam Server vs Jam Lokal */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Jam Real-Time API
            </span>
            <Server className="w-5 h-5 text-teal-400" />
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                Waktu API Server (WIB):
              </span>
              <span className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                {serverTimeFormatted}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-900">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                Jam Perangkat Komputer:
              </span>
              <span className="text-sm font-mono font-bold text-slate-300">
                {localTimeFormatted}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900 text-[11px] text-slate-400 font-mono">
            Toleransi Telat: &lt; 0.05 Detik
          </div>
        </div>

        {/* Card 3: Offset & Latensi */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Offset Clock & Latensi
            </span>
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-xs text-slate-400">Offset Selisih Jam:</span>
              <div className="text-2xl font-mono font-black text-cyan-300">
                {timeSyncInfo.offsetMs >= 0 ? `+${timeSyncInfo.offsetMs}` : timeSyncInfo.offsetMs}{' '}
                <span className="text-xs font-sans text-slate-400 font-normal">milidetik</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-400">Round-Trip Latency:</span>
              <div className="text-sm font-mono font-bold text-slate-200">
                {timeSyncInfo.latencyMs} ms
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900 text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Koreksi Otomatis Real-Time</span>
          </div>
        </div>
      </div>

      {/* Interval Selector & Explainer */}
      <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Pengaturan Otomatisasi Sinkronisasi API</span>
        </h3>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
          <div>
            <label className="text-xs font-bold text-slate-300 block">
              Frekuensi Cek API Waktu Otomatis:
            </label>
            <p className="text-xs text-slate-400 mt-0.5">
              Sistem akan memanggil endpoint `/api/time` secara berkala untuk memperbarui offset waktu server.
            </p>
          </div>

          <select
            value={syncIntervalMinutes}
            onChange={(e) => setSyncIntervalMinutes(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value={1}>Setiap 1 Menit (Sangat Ketat)</option>
            <option value={5}>Setiap 5 Menit (Rekomendasi)</option>
            <option value={15}>Setiap 15 Menit</option>
            <option value={30}>Setiap 30 Menit</option>
          </select>
        </div>
      </div>
    </div>
  );
};
