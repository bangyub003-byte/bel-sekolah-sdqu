import React from 'react';
import {
  History,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
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
    <div className="bg-white border border-blue-100 rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-blue-600" />
            <span>Riwayat Audit Bunyi Bel (Bell Logs)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Catatan historis seluruh aktivitas pembunyian bel otomatis dan manual beserta stempel waktu presisi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <>
              <button
                onClick={onExportLogsCSV}
                className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Unduh CSV</span>
              </button>

              <button
                onClick={onClearLogs}
                className="bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
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
        <div className="bg-slate-50 rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-16 h-16 rounded-full bg-white text-slate-400 flex items-center justify-center mx-auto shadow-xs border border-slate-200">
            <History className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Belum Ada Riwayat Bunyi Bel</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Riwayat akan terisi secara otomatis saat jadwal bel berbunyi atau saat tombol tes manual ditekan.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs sm:text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 font-bold">Waktu</th>
                <th className="py-3.5 px-4 font-bold">Hari</th>
                <th className="py-3.5 px-4 font-bold">Nama Bel / Keterangan</th>
                <th className="py-3.5 px-4 font-bold">Tipe Trigger</th>
                <th className="py-3.5 px-4 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
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
                  <tr key={log.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                      {dateStr}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {log.dayName}
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      <div>{log.scheduleLabel}</div>
                      {log.details && (
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 italic">
                          "{log.details}"
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        log.triggerType === 'auto'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : log.triggerType === 'manual'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {log.triggerType}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sukses</span>
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
