import React from 'react';
import {
  Clock,
  Wifi,
  RefreshCw,
  CheckCircle2,
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
    <div className="bg-white border border-blue-100 rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            <span>Integrasi API Sinkronisasi Waktu Real-Time</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Mengoreksi drift jam perangkat lokal secara otomatis menggunakan API Server & NTP publik agar bel sekolah berbunyi 100% presisi.
          </p>
        </div>

        <button
          onClick={onManualSync}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${timeSyncInfo.status === 'syncing' ? 'animate-spin' : ''}`} />
          <span>Sinkronkan Waktu API Sekarang</span>
        </button>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Status Sinkronisasi */}
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Status Sinkronisasi
            </span>
            <Wifi className={`w-5 h-5 ${timeSyncInfo.status === 'synced' ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <span className="text-xl font-black text-slate-900">
                {timeSyncInfo.status === 'synced' ? 'Presisi & Terhubung' : 'Proses Sinkronisasi'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Sumber: <strong className="text-blue-700">{timeSyncInfo.source}</strong>
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-400 font-mono">
            Terakhir dikoreksi:{' '}
            {timeSyncInfo.lastSynced
              ? new Date(timeSyncInfo.lastSynced).toLocaleTimeString('id-ID')
              : 'Baru Saja'}
          </div>
        </div>

        {/* Card 2: Jam Server vs Jam Lokal */}
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Jam Real-Time API
            </span>
            <Server className="w-5 h-5 text-blue-600" />
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                Waktu API Server (WIB):
              </span>
              <span className="text-xl sm:text-2xl font-mono font-black text-blue-700">
                {serverTimeFormatted}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                Jam Perangkat Komputer:
              </span>
              <span className="text-sm font-mono font-bold text-slate-700">
                {localTimeFormatted}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-400 font-mono">
            Toleransi Telat: &lt; 0.05 Detik
          </div>
        </div>

        {/* Card 3: Offset & Latensi */}
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Offset Clock & Latensi
            </span>
            <Activity className="w-5 h-5 text-indigo-500" />
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-xs text-slate-500">Offset Selisih Jam:</span>
              <div className="text-2xl font-mono font-black text-indigo-700">
                {timeSyncInfo.offsetMs >= 0 ? `+${timeSyncInfo.offsetMs}` : timeSyncInfo.offsetMs}{' '}
                <span className="text-xs font-sans text-slate-500 font-normal">milidetik</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500">Round-Trip Latency:</span>
              <div className="text-sm font-mono font-bold text-slate-800">
                {timeSyncInfo.latencyMs} ms
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-emerald-600 font-bold flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Koreksi Otomatis Real-Time</span>
          </div>
        </div>
      </div>

      {/* Interval Selector & Explainer */}
      <div className="bg-slate-50/80 border border-slate-200 p-6 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Pengaturan Otomatisasi Sinkronisasi API</span>
        </h3>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
          <div>
            <label className="text-xs font-bold text-slate-700 block">
              Frekuensi Cek API Waktu Otomatis:
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Sistem akan memanggil endpoint `/api/time` secara berkala untuk memperbarui offset waktu server.
            </p>
          </div>

          <select
            value={syncIntervalMinutes}
            onChange={(e) => setSyncIntervalMinutes(Number(e.target.value))}
            className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold text-blue-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
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
