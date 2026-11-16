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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-blue-100 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-8 space-y-5 p-6 sm:p-7">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-black text-slate-900">
              Cadangkan & Impor Jadwal Bel (JSON)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Ekspor */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            1. Salin / Cadangkan Jadwal Aktif
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyJSON}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Semua JSON'}</span>
            </button>
            <button
              onClick={handleDownloadJSON}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Unduh File .JSON</span>
            </button>
          </div>
        </div>

        {/* Section 2: Impor */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            2. Tempel JSON Cadangan untuk Memulihkan
          </label>
          <textarea
            rows={5}
            placeholder="Tempel format JSON jadwal di sini..."
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white"
          />
          {errorMsg && (
            <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
              {errorMsg}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleApplyImport}
              disabled={!jsonText.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Terapkan & Pulihkan Jadwal Ini</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
