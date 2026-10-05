import React, { useState } from 'react';
import { X, Download, Upload, Copy, Check, Sparkles } from 'lucide-react';
import { ScheduleItem } from '../types';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedules: ScheduleItem[];
  onImportSchedules: (newSchedules: ScheduleItem[]) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  schedules,
  onImportSchedules,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const currentJsonString = JSON.stringify(schedules, null, 2);

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(currentJsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(currentJsonString);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `jadwal-bel-sd-quran-unggulan-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleApplyImport = () => {
    setErrorMsg('');
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        throw new Error('Format JSON harus berupa array daftar jadwal!');
      }
      onImportSchedules(parsed);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'JSON tidak valid!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-8 space-y-5 p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xl font-black text-white">Ekspor / Impor Jadwal Bel JSON</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Export Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
            1. Ekspor Cadangan Jadwal Saat Ini
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadJSON}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh File .JSON</span>
            </button>

            <button
              onClick={handleCopyJSON}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Tersalin!' : 'Salin Teks JSON'}</span>
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
            2. Impor / Timpa Jadwal Dari Teks JSON
          </h4>
          <p className="text-xs text-slate-400">
            Tempelkan struktur kode JSON jadwal bel baru di kotak di bawah ini untuk memuat konfigurasi:
          </p>

          <textarea
            rows={5}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="Tempel teks JSON jadwal bel di sini..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />

          {errorMsg && (
            <div className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/30">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleApplyImport}
              disabled={!jsonText.trim()}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Terapkan Impor Jadwal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
