import React, { useState } from 'react';
import {
  Plus,
  Play,
  Edit2,
  Trash2,
  Bell,
  RotateCcw,
  Download,
  Search,
  Filter,
  Sparkles,
  CheckCircle,
  XCircle,
  Layers,
  VolumeX,
} from 'lucide-react';
import { ScheduleItem, DayOfWeek, BellCategory, AudioSettings } from '../types';
import { getIndonesianDayName } from '../utils/timeSync';

interface ScheduleListProps {
  schedules: ScheduleItem[];
  selectedDay: DayOfWeek;
  audioSettings: AudioSettings;
  disabledDays?: DayOfWeek[];
  onToggleDisabledDay?: (day: DayOfWeek) => void;
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
  disabledDays = [0],
  onToggleDisabledDay,
  onTestScheduleItem,
  onEditScheduleItem,
  onDeleteScheduleItem,
  onToggleScheduleItem,
  onAddScheduleItem,
  onOpenAddExtraPeriods,
  onResetToDefault,
  onImportExport,
}) => {
  const isSelectedDayDisabled = disabledDays.includes(selectedDay);
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
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
        };
      case 'break':
        return {
          label: 'Istirahat',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
        };
      case 'prayer':
        return {
          label: 'Sholat/Ibadah',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
        };
      case 'assembly':
        return {
          label: 'Apel/Upacara',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500',
        };
      case 'dismissal':
        return {
          label: 'Pulang',
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          dot: 'bg-purple-500',
        };
      default:
        return {
          label: 'Umum',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
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
        return 'Westminster (6.8s)';
      case 'classic_3tone':
        return '6-Tone Melodi (5.8s)';
      case 'school_dismissal':
        return 'Melodi Pulang (6.2s)';
      case 'electric_bell':
        return 'Bel Listrik (10s)';
      case 'fire_bell':
        return 'Bel Alarm Pemadam (10s)';
      case 'tube_chime':
        return 'Tube Chime (5.8s)';
      case 'islamic_duo':
        return 'Islami Maqam (6.2s)';
      default:
        return chimeType;
    }
  };

  return (
    <div className="bg-white border border-blue-100 rounded-3xl p-5 sm:p-7 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>Jadwal Bel Hari {getIndonesianDayName(selectedDay)}</span>
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                {daySchedules.length} Bel Aktif
              </span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Bel otomatis berbunyi tepat waktu mengikuti sinkronisasi jam API real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main Add Button */}
          <button
            onClick={onAddScheduleItem}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal</span>
          </button>

          {/* Batch / Extra Period Button */}
          <button
            onClick={onOpenAddExtraPeriods}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3.5 py-2.5 rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
            title="Tambah Banyak Jam Pelajaran Sekaligus (Misal: Tambah Jam ke-7, 8, 9 di Hari Jumat)"
          >
            <Layers className="w-4 h-4" />
            <span>Tambah Jam Lanjutan</span>
          </button>

          <button
            onClick={onResetToDefault}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer"
            title="Reset ke Jadwal Standar SD Qur'an Unggulan"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Reset Default</span>
          </button>

          <button
            onClick={onImportExport}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer"
            title="Ekspor / Impor Jadwal"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Ekspor/Impor</span>
          </button>
        </div>
      </div>

      {/* Holiday / Day-Off Status Banner (Sabtu / Minggu / Hari Lain yang Dinonaktifkan) */}
      {isSelectedDayDisabled && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
              <VolumeX className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-rose-900">
                Hari {getIndonesianDayName(selectedDay)} Sedang DINONAKTIFKAN (Mode Libur)
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Seluruh bunyi Bel Sekolah &amp; Murottal Otomatis tidak akan berputar pada hari {getIndonesianDayName(selectedDay)} walaupun komputer tetap menyala.
              </p>
            </div>
          </div>
          {onToggleDisabledDay && (
            <button
              type="button"
              onClick={() => onToggleDisabledDay(selectedDay)}
              className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold px-3.5 py-2 rounded-xl text-xs shrink-0 transition cursor-pointer shadow-2xs"
            >
              Aktifkan Hari {getIndonesianDayName(selectedDay)}
            </button>
          )}
        </div>
      )}

      {/* Contextual Smart Helper Banner */}
      <div className="bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-blue-50/40 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200">
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-amber-900">
              {selectedDay === 5
                ? 'Ingin Menambah Jam Pelajaran Tambahan di Hari Jumat?'
                : `Perpanjang Jam Pelajaran Hari ${getIndonesianDayName(selectedDay)}`}
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              {selectedDay === 5
                ? 'Tambahkan Jam ke-7, 8, 9 (lanjut pukul 11:10 atau setelah Sholat Jumat pukul 13:00) secara otomatis dengan durasi dan nada dering rapi.'
                : 'Tambahkan beberapa jam pelajaran berikutnya sekaligus tanpa perlu menghitung menit satu per satu.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAddExtraPeriods}
          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-amber-500/20 shrink-0 transition-all cursor-pointer active:scale-95"
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
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:border-blue-500 transition-all cursor-pointer font-medium"
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
        <div className="bg-slate-50 rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-16 h-16 rounded-full bg-white text-slate-400 flex items-center justify-center mx-auto shadow-xs border border-slate-200">
            <Bell className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Tidak Ada Jadwal Bel Ditemukan</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tidak ada item bel untuk hari {getIndonesianDayName(selectedDay)} dengan kriteria pencarian ini.
          </p>
          <button
            onClick={onAddScheduleItem}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs mt-2 shadow-xs cursor-pointer"
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
                className={`bg-white border rounded-2xl p-4 sm:p-5 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  item.enabled
                    ? 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                    : 'border-slate-200 opacity-60 bg-slate-50/70'
                }`}
              >
                {/* Left: Time & Details */}
                <div className="flex items-start gap-4 w-full md:w-auto">
                  {/* Digital Time Badge */}
                  <div className="flex flex-col items-center justify-center bg-blue-50/80 border border-blue-200/80 px-3.5 py-2.5 rounded-xl shrink-0 min-w-[75px] shadow-xs">
                    <span className="font-mono font-black text-xl text-blue-700 tracking-tight">
                      {item.time}
                    </span>
                    <span className="text-[10px] text-blue-500 font-bold uppercase">WIB</span>
                  </div>

                  {/* Text Details */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-wide truncate">
                        {item.label}
                      </h3>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shrink-0 ${catBadge.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${catBadge.dot}`} />
                        {catBadge.label}
                      </span>

                      <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                        {getChimeLabel(item.chimeType)}
                      </span>

                      {item.audioType === 'recording' && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          🎙️ Suara Rekaman
                        </span>
                      )}

                      {item.audioType === 'cloned' && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          ✨ Kloning AI
                        </span>
                      )}

                      {item.speechLanguage && item.speechLanguage !== 'id' && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          {item.speechLanguage === 'ar'
                            ? '🇸🇦 AI Arab'
                            : item.speechLanguage === 'en'
                            ? '🇬🇧 AI Inggris'
                            : '🇮🇩 AI Jawa'}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 font-sans italic">
                      {item.audioType === 'recording' ? (
                        <>
                          <span className="text-emerald-700 font-bold not-italic">File Rekaman: </span>
                          "{item.customAudioName || 'Suara Rekaman Aktif'}"
                        </>
                      ) : item.speechLanguage && item.speechLanguage !== 'id' && item.translatedSpeechText ? (
                        <>
                          <span className="text-indigo-700 font-bold not-italic">
                            Suara AI ({item.speechLanguage === 'ar' ? 'Arab' : item.speechLanguage === 'en' ? 'Inggris' : 'Jawa'}):{' '}
                          </span>
                          <span dir={item.speechLanguage === 'ar' ? 'rtl' : 'ltr'}>"{item.translatedSpeechText}"</span>
                        </>
                      ) : (
                        <>
                          <span className="text-blue-700 font-bold not-italic">Speech: </span>
                          "{fullSpeechPreview}"
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-0 border-slate-100">
                  {/* Test Play Sound */}
                  <button
                    onClick={() => onTestScheduleItem(item)}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
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
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
                    title={item.enabled ? 'Nonaktifkan Bel Ini' : 'Aktifkan Bel Ini'}
                  >
                    {item.enabled ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Aktif</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>Mati</span>
                      </>
                    )}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => onEditScheduleItem(item)}
                    className="bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 p-2 rounded-xl transition-all cursor-pointer"
                    title="Edit Item Bel Ini"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => onDeleteScheduleItem(item.id)}
                    className="bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 p-2 rounded-xl transition-all cursor-pointer"
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
