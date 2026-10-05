import React from 'react';
import {
  History,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { BellLog } from '../types';

interface BellLogsProps {
  logs: BellLog[];
  onClearLogs: () => void;
  onExportLogsCSV: () => void;
}

export const BellLogs: React.FC<BellLogsProps> = ({
  logs,
  onClearLogs,
  onExportLogsCSV,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-400" />
            <span>Riwayat Audit Bunyi Bel (Bell Logs)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Catatan historis seluruh aktivitas pembunyian bel otomatis dan manual beserta stempel waktu presisi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <>
              <button
                onClick={onExportLogsCSV}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Unduh CSV</span>
              </button>

              <button
                onClick={onClearLogs}
                className="bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Riwayat</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <div className="bg-slate-950/60 rounded-2xl p-12 text-center border border-slate-800 space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <History className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white">Belum Ada Riwayat Bunyi Bel</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Riwayat akan terisi secara otomatis saat jadwal bel berbunyi atau saat tombol tes manual ditekan.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4">Hari</th>
                <th className="py-3.5 px-4">Nama Bel / Keterangan</th>
                <th className="py-3.5 px-4">Tipe Trigger</th>
                <th className="py-3.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {logs.map((log) => {
                const dateStr = new Date(log.timestamp).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {dateStr}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-200 whitespace-nowrap">
                      {log.dayName}
                    </td>

                    <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                      {log.scheduleLabel}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {log.triggerType === 'auto' && (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] font-bold">
                          Otomatis (Jadwal)
                        </span>
                      )}
                      {log.triggerType === 'manual' && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full text-[10px] font-bold">
                          Manual Pad
                        </span>
                      )}
                      {log.triggerType === 'test' && (
                        <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-full text-[10px] font-bold">
                          Uji Coba Tes
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Berhasil</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
