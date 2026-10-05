import React, { useState } from 'react';
import {
  Plus,
  Play,
  Edit2,
  Trash2,
  Bell,
  RotateCcw,
  Download,
  Upload,
  Check,
  Search,
  Filter,
  Sparkles,
  CheckCircle,
  XCircle,
  Volume2,
  Layers,
  Clock,
} from 'lucide-react';
import { ScheduleItem, DayOfWeek, BellCategory, AudioSettings } from '../types';
import { getIndonesianDayName } from '../utils/timeSync';

interface ScheduleListProps {
  schedules: ScheduleItem[];
  selectedDay: DayOfWeek;
  audioSettings: AudioSettings;
  onTestScheduleItem: (item: ScheduleItem) => void;
  onEditScheduleItem: (item: ScheduleItem) => void;
  onDeleteScheduleItem: (id: string) => void;
  onToggleScheduleItem: (id: string) => void;
  onAddScheduleItem: () => void;
  onOpenAddExtraPeriods: () => void;
  onResetToDefault: () => void;
  onImportExport: () => void;
}

export const ScheduleList: React.FC<ScheduleListProps> = ({
  schedules,
  selectedDay,
  audioSettings,
  onTestScheduleItem,
  onEditScheduleItem,
  onDeleteScheduleItem,
  onToggleScheduleItem,
  onAddScheduleItem,
  onOpenAddExtraPeriods,
  onResetToDefault,
  onImportExport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Filter schedules by day and search criteria
  const daySchedules = schedules.filter((item) => {
    const matchesDay = item.days.includes(selectedDay);
    const matchesQuery =
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.time.includes(searchQuery) ||
      item.speechText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;

    return matchesDay && matchesQuery && matchesCategory;
  });

  // Sort by time (HH:MM)
  daySchedules.sort((a, b) => a.time.localeCompare(b.time));

  const getCategoryBadge = (category: BellCategory) => {
    switch (category) {
      case 'lesson':
        return {
          label: 'Pelajaran',
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400',
        };
      case 'break':
        return {
          label: 'Istirahat',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400',
        };
      case 'prayer':
        return {
          label: 'Sholat/Ibadah',
          bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          dot: 'bg-indigo-400',
        };
      case 'assembly':
        return {
          label: 'Apel/Upacara',
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dot: 'bg-rose-400',
        };
      case 'dismissal':
        return {
          label: 'Pulang',
          bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          dot: 'bg-cyan-400',
        };
      default:
        return {
          label: 'Umum',
          bg: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
          dot: 'bg-slate-400',
        };
    }
  };

  const getChimeLabel = (chimeType: string) => {
    if (audioSettings.customChimes && audioSettings.customChimes.length > 0) {
      const custom = audioSettings.customChimes.find((c) => c.id === chimeType);
      if (custom) return `✨ ${custom.name}`;
    }

    switch (chimeType) {
      case 'westminster':
        return 'Westminster 4-Tone';
      case 'classic_3tone':
        return 'Chime 3-Tone Classic';
      case 'electric_bell':
        return 'Electric Bell Ring';
      case 'tube_chime':
        return 'Tube Chime Soft';
      case 'islamic_duo':
        return 'Islamic Duo Chime';
      default:
        return chimeType;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>Jadwal Bel Hari {getIndonesianDayName(selectedDay)}</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono">
                {daySchedules.length} Bel Configured
              </span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Bel otomatis berbunyi tepat waktu mengikuti sinkronisasi jam API real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main Add Button */}
          <button
            onClick={onAddScheduleItem}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold px-3.5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal</span>
          </button>

          {/* Batch / Extra Period Button */}
          <button
            onClick={onOpenAddExtraPeriods}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black px-3.5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
            title="Tambah Banyak Jam Pelajaran Sekaligus (Misal: Tambah Jam ke-7, 8, 9 di Hari Jumat)"
          >
            <Layers className="w-4 h-4" />
            <span>Tambah Jam Lanjutan</span>
          </button>

          <button
            onClick={onResetToDefault}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer"
            title="Reset ke Jadwal Standar SD Qur'an Unggulan"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Reset Default</span>
          </button>

          <button
            onClick={onImportExport}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer"
            title="Ekspor / Impor Jadwal"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Ekspor/Impor</span>
          </button>
        </div>
      </div>

      {/* Contextual Smart Helper Banner (e.g. For Friday or extending timetable) */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-950 to-slate-950 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-amber-200">
              {selectedDay === 5
                ? 'Ingin Menambah Jam Pelajaran Tambahan di Hari Jumat?'
                : `Perpanjang Jam Pelajaran Hari ${getIndonesianDayName(selectedDay)}`}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedDay === 5
                ? 'Anda dapat menambahkan Jam Pelajaran ke-7, ke-8, dst. (misal lanjut pukul 11:10 atau setelah Sholat Jumat pukul 13:00) secara otomatis dengan durasi dan nada dering yang rapi.'
                : 'Tambahkan beberapa jam pelajaran berikutnya sekaligus tanpa perlu menghitung menit satu per satu.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAddExtraPeriods}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0 transition-all cursor-pointer active:scale-95"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Buka Menu Tambah Jam</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-auto sm:flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari jadwal (misal: 07:20, Tahfidz, Istirahat)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
          >
            <option value="all">Semua Kategori</option>
            <option value="lesson">Pelajaran</option>
            <option value="break">Istirahat</option>
            <option value="prayer">Sholat / Ibadah</option>
            <option value="assembly">Apel / Upacara</option>
            <option value="dismissal">Jam Pulang</option>
          </select>
        </div>
      </div>

      {/* Schedule Table / Cards */}
      {daySchedules.length === 0 ? (
        <div className="bg-slate-950/60 rounded-2xl p-12 text-center border border-slate-800 space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
            <Bell className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Tidak Ada Jadwal Bel Ditemukan</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Tidak ada item bel untuk hari {getIndonesianDayName(selectedDay)} dengan kriteria pencarian ini.
          </p>
          <button
            onClick={onAddScheduleItem}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bel Baru Hari Ini</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {daySchedules.map((item) => {
            const catBadge = getCategoryBadge(item.category);
            const fullSpeechPreview = `${audioSettings.globalPrefix}${item.speechText}`;

            return (
              <div
                key={item.id}
                className={`bg-slate-950/80 border rounded-2xl p-4 sm:p-5 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  item.enabled
                    ? 'border-slate-800 hover:border-emerald-500/40 hover:bg-slate-950'
                    : 'border-slate-800/50 opacity-60 bg-slate-950/40'
                }`}
              >
                {/* Left: Time & Details */}
                <div className="flex items-start gap-4 w-full md:w-auto">
                  {/* Digital Time Badge */}
                  <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl shrink-0 min-w-[75px]">
                    <span className="font-mono font-black text-xl text-emerald-400 tracking-tight">
                      {item.time}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase">WIB</span>
                  </div>

                  {/* Text Details */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-white tracking-wide truncate">
                        {item.label}
                      </h3>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${catBadge.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${catBadge.dot}`}></span>
                        {catBadge.label}
                      </span>

                      <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded font-mono">
                        {getChimeLabel(item.chimeType)}
                      </span>

                      {item.audioType === 'recording' && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          🎙️ Suara Rekaman
                        </span>
                      )}

                      {item.audioType === 'cloned' && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          ✨ Kloning AI
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300/90 line-clamp-2 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800/60 font-sans italic">
                      {item.audioType === 'recording' ? (
                        <>
                          <span className="text-emerald-400 font-semibold not-italic">File Rekaman: </span>
                          "{item.customAudioName || 'Suara Rekaman Aktif'}"
                        </>
                      ) : item.audioType === 'cloned' ? (
                        <>
                          <span className="text-amber-300 font-semibold not-italic">Pembaca Kloning AI: </span>
                          "{fullSpeechPreview}"
                        </>
                      ) : (
                        <>
                          <span className="text-amber-300 font-semibold not-italic">Speech: </span>
                          "{fullSpeechPreview}"
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-0 border-slate-800/80">
                  {/* Test Play Sound */}
                  <button
                    onClick={() => onTestScheduleItem(item)}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    title="Uji Bunyi Nada & Speech Ucapan"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Tes Bunyi</span>
                  </button>

                  {/* Toggle Active */}
                  <button
                    onClick={() => onToggleScheduleItem(item.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      item.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                    title={item.enabled ? 'Nonaktifkan Bel Ini' : 'Aktifkan Bel Ini'}
                  >
                    {item.enabled ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Aktif</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-slate-500" />
                        <span>Mati</span>
                      </>
                    )}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => onEditScheduleItem(item)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 p-2 rounded-xl transition-all cursor-pointer"
                    title="Edit Item Bel Ini"
                  >
                    <Edit2 className="w-4 h-4 text-cyan-400" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => onDeleteScheduleItem(item.id)}
                    className="bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 p-2 rounded-xl transition-all cursor-pointer"
                    title="Hapus Item Bel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
