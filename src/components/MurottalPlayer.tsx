import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Upload,
  Clock,
  Sparkles,
  BookOpen,
  Music,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Repeat,
  Shuffle,
  Calendar,
  Layers,
  Search,
  Plus,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { MurottalTrack, MurottalConfig, MurottalScheduleSlot, DayOfWeek } from '../types';
import { DEFAULT_JUZ_30_TRACKS } from '../data/defaultMurottal';
import {
  saveCustomMurottalTrack,
  getCustomMurottalTracks,
  deleteCustomMurottalTrack,
} from '../utils/murottalStorage';
import { getIndonesianDayName } from '../utils/timeSync';

interface MurottalPlayerProps {
  config: MurottalConfig;
  onUpdateConfig: (newConfig: MurottalConfig) => void;
  isPlaying: boolean;
  activeTrack: MurottalTrack | null;
  onPlayTrack: (track: MurottalTrack) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  currentTimeFormatted: string;
  isAudioUnlocked: boolean;
  onUnlockAudio: () => void;
  disabledDays?: DayOfWeek[];
}

export const MurottalPlayer: React.FC<MurottalPlayerProps> = ({
  config,
  onUpdateConfig,
  isPlaying,
  activeTrack,
  onPlayTrack,
  onPause,
  onResume,
  onStop,
  currentTimeFormatted,
  isAudioUnlocked,
  onUnlockAudio,
  disabledDays = [0],
}) => {
  const [customTracks, setCustomTracks] = useState<MurottalTrack[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [activeTabSub, setActiveTabSub] = useState<'juz30' | 'custom' | 'settings'>('juz30');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load custom tracks from IndexedDB
  useEffect(() => {
    getCustomMurottalTracks().then((tracks) => {
      setCustomTracks(tracks);
    });
  }, []);

  const allTracks = [...customTracks, ...DEFAULT_JUZ_30_TRACKS];

  const filteredJuz30 = DEFAULT_JUZ_30_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.surahNumber && t.surahNumber.toString().includes(searchQuery))
  );

  const filteredCustom = customTracks.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    try {
      const file = files[0];
      const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|aac|ogg)$/i)) {
        throw new Error('Mohon pilih file audio berformat MP3, M4A, WAV, atau AAC.');
      }

      // Convert to Base64 or Blob URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        const audioUrl = event.target?.result as string;
        const newTrack: MurottalTrack = {
          id: `custom-murottal-${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          reciter: 'File Audio Mandiri',
          audioUrl,
          isCustomUpload: true,
          fileSizeMb: Number((file.size / (1024 * 1024)).toFixed(1)),
          uploadedAt: Date.now(),
        };

        await saveCustomMurottalTrack(newTrack);
        setCustomTracks((prev) => [newTrack, ...prev]);
        window.dispatchEvent(new Event('murottal-tracks-updated'));
        setUploadSuccess(`Audio "${newTrack.title}" berhasil disimpan!`);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };

      reader.onerror = () => {
        setUploadError('Gagal membaca file audio.');
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || 'Terjadi kesalahan saat mengunggah file.');
      setIsUploading(false);
    }
  };

  const handleDeleteCustom = async (trackId: string) => {
    if (confirm('Hapus file audio ini dari daftar?')) {
      await deleteCustomMurottalTrack(trackId);
      setCustomTracks((prev) => prev.filter((t) => t.id !== trackId));
      window.dispatchEvent(new Event('murottal-tracks-updated'));
      if (activeTrack?.id === trackId) {
        onStop();
      }
    }
  };

  const toggleDay = (day: DayOfWeek) => {
    const current = config.activeDays || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort();
    onUpdateConfig({ ...config, activeDays: updated });
  };

  const handleNextTrack = () => {
    const list = activeTabSub === 'custom' && customTracks.length > 0 ? customTracks : DEFAULT_JUZ_30_TRACKS;
    const currentIndex = list.findIndex((t) => t.id === activeTrack?.id);
    const nextIndex = (currentIndex + 1) % list.length;
    onPlayTrack(list[nextIndex]);
  };

  const handlePrevTrack = () => {
    const list = activeTabSub === 'custom' && customTracks.length > 0 ? customTracks : DEFAULT_JUZ_30_TRACKS;
    const currentIndex = list.findIndex((t) => t.id === activeTrack?.id);
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    onPlayTrack(list[prevIndex]);
  };

  const scheduleSlots: MurottalScheduleSlot[] =
    config.scheduleSlots && config.scheduleSlots.length > 0
      ? config.scheduleSlots
      : [
          {
            id: 'slot-pagi',
            time: config.autoStartTime || '06:00',
            label: 'Murottal Pagi Sebelum Bel Masuk',
            enabled: config.enabledAutoPlay,
            trackId: config.selectedTrackId || 'thaha-078',
            days: config.activeDays || [1, 2, 3, 4, 5, 6],
            stopAfterMinutes: 45,
          },
        ];

  const handleAddScheduleSlot = () => {
    const newSlot: MurottalScheduleSlot = {
      id: `slot-${Date.now()}`,
      time: '09:45',
      label: 'Murottal Pertengahan Pelajaran / Istirahat',
      enabled: true,
      trackId: 'thaha-078',
      days: [1, 2, 3, 4, 5, 6],
      stopAfterMinutes: 20,
    };
    onUpdateConfig({
      ...config,
      scheduleSlots: [...scheduleSlots, newSlot],
    });
  };

  const handleUpdateScheduleSlot = (slotId: string, updates: Partial<MurottalScheduleSlot>) => {
    const updated = scheduleSlots.map((s) => (s.id === slotId ? { ...s, ...updates } : s));
    const first = updated[0];
    onUpdateConfig({
      ...config,
      autoStartTime: first ? first.time : config.autoStartTime,
      enabledAutoPlay: first ? first.enabled : config.enabledAutoPlay,
      scheduleSlots: updated,
    });
  };

  const handleDeleteScheduleSlot = (slotId: string) => {
    if (scheduleSlots.length <= 1) return;
    const updated = scheduleSlots.filter((s) => s.id !== slotId);
    onUpdateConfig({
      ...config,
      scheduleSlots: updated,
    });
  };

  const handleToggleSlotDay = (slotId: string, day: DayOfWeek) => {
    const slot = scheduleSlots.find((s) => s.id === slotId);
    if (!slot) return;
    const cur = slot.days || [];
    const nextDays = cur.includes(day)
      ? cur.filter((d) => d !== day)
      : [...cur, day].sort();
    handleUpdateScheduleSlot(slotId, { days: nextDays });
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Card - Clean White & Friendly Lingora Theme */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-blue-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
        {/* Subtle Decorative Background Gradient & Circles */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-100/60 via-indigo-50/40 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none blur-2xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-50/40 rounded-full pointer-events-none blur-2xl" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Murottal SD Qur'an Unggulan</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Pemutar Murottal Otomatis ({config.autoStartTime} WIB & Fleksibel)
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed">
              Murottal merdu <strong className="text-blue-700 font-bold">Muhammad Thaha Al-Junayd (Versi Anak / Juz 30 Lengkap)</strong> otomatis diputar terjadwal mulai pukul <strong className="text-slate-900 font-extrabold">{config.autoStartTime} WIB</strong> maupun di pertengahan jam pelajaran/istirahat yang bisa Anda atur bebas. Anda juga dapat mengunggah file MP3 murottal sendiri.
            </p>

            {/* Quick Status Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                config.enabledAutoPlay
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>Otomatis Jam {config.autoStartTime}: {config.enabledAutoPlay ? 'AKTIF' : 'NONAKTIF'}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Qari: Muhammad Thaha Al-Junayd (Versi Anak)</span>
              </span>

              {isPlaying && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                  <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Sedang Berputar: {activeTrack?.title}</span>
                </span>
              )}
            </div>
          </div>

          {/* Player Controller Card */}
          <div className="w-full lg:w-96 bg-gradient-to-b from-blue-50/70 to-slate-50/70 p-5 rounded-2xl border border-blue-200/80 shadow-sm shrink-0">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Status Pemutar</span>
              <span className="font-mono text-blue-600">{currentTimeFormatted}</span>
            </div>

            {/* Now Playing Title */}
            <div className="bg-white p-3 rounded-xl border border-blue-100 mb-4 shadow-xs">
              <div className="text-xs text-slate-400 font-medium">Surah / Track Aktif:</div>
              <div className="text-sm font-black text-slate-900 truncate mt-0.5">
                {activeTrack?.title || DEFAULT_JUZ_30_TRACKS[1].title}
              </div>
              <div className="text-xs text-blue-600 font-semibold truncate">
                {activeTrack?.reciter || 'Muhammad Thaha Al-Junayd (Versi Anak)'}
              </div>
            </div>

            {/* Transport Buttons */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                type="button"
                onClick={handlePrevTrack}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 hover:text-blue-600 flex items-center justify-center shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Surah Sebelumnya"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {isPlaying ? (
                <button
                  type="button"
                  onClick={onPause}
                  className="w-14 h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 transition-all active:scale-95 cursor-pointer"
                  title="Jeda (Pause)"
                >
                  <Pause className="w-6 h-6" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const target = activeTrack || DEFAULT_JUZ_30_TRACKS[1];
                    onPlayTrack(target);
                  }}
                  className="w-14 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all active:scale-95 cursor-pointer"
                  title="Putar Sekarang"
                >
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                </button>
              )}

              <button
                type="button"
                onClick={onStop}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:border-rose-400 hover:bg-rose-50 text-slate-700 hover:text-rose-600 flex items-center justify-center shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Berhenti (Stop)"
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleNextTrack}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 hover:text-blue-600 flex items-center justify-center shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Surah Berikutnya"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-3 px-2">
              <button
                type="button"
                onClick={() => onUpdateConfig({ ...config, volume: config.volume === 0 ? 0.8 : 0 })}
                className="text-slate-500 hover:text-blue-600 cursor-pointer"
              >
                {config.volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-blue-600" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.volume}
                onChange={(e) =>
                  onUpdateConfig({ ...config, volume: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <span className="text-xs font-mono font-bold text-slate-600 w-8 text-right">
                {Math.round(config.volume * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation for Murottal */}
      <div className="bg-white rounded-2xl p-2 border border-blue-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTabSub('juz30')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTabSub === 'juz30'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Murottal Juz 30 Muhammad Thaha ({DEFAULT_JUZ_30_TRACKS.length} Surah)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabSub('custom')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTabSub === 'custom'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Audio Sendiri ({customTracks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabSub('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTabSub === 'settings'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Jadwal Otomatis ({config.autoStartTime})</span>
          </button>
        </div>

        {/* Search bar */}
        {activeTabSub !== 'settings' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari surat / juz..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
        )}
      </div>

      {/* Sub-tab 1: Juz 30 Tracklist */}
      {activeTabSub === 'juz30' && (
        <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Daftar Surah Juz 30 (Muhammad Thaha Al-Junayd - Versi Anak)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik tombol putar pada surat yang ingin didengarkan. Secara otomatis akan berputar di pagi hari jam {config.autoStartTime} WIB.
              </p>
            </div>
            <div className="text-xs text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              {filteredJuz30.length} Surah Siap Putar
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredJuz30.map((track) => {
              const isThisPlaying = isPlaying && activeTrack?.id === track.id;
              const isSelected = config.selectedTrackId === track.id;

              return (
                <div
                  key={track.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isThisPlaying
                      ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                      : isSelected
                      ? 'bg-blue-50/40 border-blue-200'
                      : 'bg-white hover:bg-slate-50/80 border-slate-150'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-blue-100/80 text-blue-800 text-xs font-black flex items-center justify-center shrink-0">
                      {track.surahNumber || '•'}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {track.reciter} • {track.durationStr || 'Audio'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateConfig({ ...config, selectedTrackId: track.id });
                        if (isThisPlaying) {
                          onPause();
                        } else {
                          onPlayTrack(track);
                        }
                      }}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isThisPlaying
                          ? 'bg-amber-500 text-white shadow-md'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      }`}
                      title={isThisPlaying ? 'Jeda' : 'Putar Surah Ini'}
                    >
                      {isThisPlaying ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-tab 2: Custom Upload */}
      {activeTabSub === 'custom' && (
        <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Upload File Murottal Mandiri (MP3 / M4A / WAV)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unggah file rekaman murottal pilihan sekolah. File tersimpan aman di peramban dan dapat diputar offline kapan saja.
              </p>
            </div>
          </div>

          {/* Upload Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50/80 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
              className="hidden"
            />
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">
                {isUploading ? 'Sedang Membaca & Menyimpan Audio...' : 'Klik untuk Memilih File Murottal'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Mendukung format MP3, M4A, WAV, AAC, atau OGG. Bebas ukuran file.
              </p>
            </div>
          </div>

          {uploadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Custom Files List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              File Murottal yang Sudah Diunggah ({customTracks.length})
            </h4>

            {customTracks.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-150 text-slate-400 text-xs">
                Belum ada file audio yang diunggah. Anda dapat mengunggah file murottal qari favorit Anda di sini!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredCustom.map((track) => {
                  const isThisPlaying = isPlaying && activeTrack?.id === track.id;

                  return (
                    <div
                      key={track.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isThisPlaying
                          ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <Music className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-extrabold text-slate-900 truncate">
                            {track.title}
                          </h4>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {track.fileSizeMb ? `${track.fileSizeMb} MB` : 'Audio Mandiri'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateConfig({ ...config, selectedTrackId: track.id });
                            if (isThisPlaying) {
                              onPause();
                            } else {
                              onPlayTrack(track);
                            }
                          }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                            isThisPlaying
                              ? 'bg-amber-500 text-white shadow-md'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                          }`}
                          title={isThisPlaying ? 'Jeda' : 'Putar Audio'}
                        >
                          {isThisPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCustom(track.id)}
                          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
                          title="Hapus Audio"
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
        </div>
      )}

      {/* Sub-tab 3: Automatic Schedule Settings */}
      {activeTabSub === 'settings' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-blue-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-6">
          <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span>Pengaturan Jadwal Otomatis Murottal</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Murottal otomatis berputar di jam yang Anda tentukan (pagi jam 06:00 / 06:30, pertengahan jam pelajaran, atau waktu istirahat).
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddScheduleSlot}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jam Murottal Baru</span>
            </button>
          </div>

          {/* Quick Preset Selector for Morning */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Jam Mulai Pagi Utama</h4>
                  <p className="text-xs text-slate-500">Pilih cepat atau ketik jam berapa pun:</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabledAutoPlay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onUpdateConfig({
                      ...config,
                      enabledAutoPlay: checked,
                      scheduleSlots: scheduleSlots.map((s, idx) =>
                        idx === 0 ? { ...s, enabled: checked } : s
                      ),
                    });
                  }}
                  className="w-6 h-6 accent-blue-600 rounded-md cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={config.autoStartTime}
                    onChange={(e) => {
                      const newTime = e.target.value;
                      onUpdateConfig({
                        ...config,
                        autoStartTime: newTime,
                        scheduleSlots: scheduleSlots.map((s, idx) =>
                          idx === 0 ? { ...s, time: newTime } : s
                        ),
                      });
                    }}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-hidden focus:border-blue-600 cursor-pointer"
                  />
                  <span className="text-xs text-slate-500 font-semibold">WIB</span>
                </div>

                {/* Quick Presets: 06:00, 06:15, 06:30, 06:45, 07:00 */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateConfig({
                        ...config,
                        autoStartTime: '06:00',
                        scheduleSlots: scheduleSlots.map((s, idx) =>
                          idx === 0 ? { ...s, time: '06:00' } : s
                        ),
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      config.autoStartTime === '06:00'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    06:00 (Jam 6 Pagi)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateConfig({
                        ...config,
                        autoStartTime: '06:15',
                        scheduleSlots: scheduleSlots.map((s, idx) =>
                          idx === 0 ? { ...s, time: '06:15' } : s
                        ),
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      config.autoStartTime === '06:15'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    06:15
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateConfig({
                        ...config,
                        autoStartTime: '06:30',
                        scheduleSlots: scheduleSlots.map((s, idx) =>
                          idx === 0 ? { ...s, time: '06:30' } : s
                        ),
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      config.autoStartTime === '06:30'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    06:30 (Setengah 7)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateConfig({
                        ...config,
                        autoStartTime: '06:45',
                        scheduleSlots: scheduleSlots.map((s, idx) =>
                          idx === 0 ? { ...s, time: '06:45' } : s
                        ),
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      config.autoStartTime === '06:45'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    06:45
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateConfig({
                        ...config,
                        autoStartTime: '07:00',
                        scheduleSlots: scheduleSlots.map((s, idx) =>
                          idx === 0 ? { ...s, time: '07:00' } : s
                        ),
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      config.autoStartTime === '07:00'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    07:00
                  </button>
                </div>
              </div>
            </div>

            {/* Auto-Stop on Bell & Repeat Mode */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Auto-Pause Saat Bel Sekolah Berbunyi</h4>
                  <p className="text-xs text-slate-500">Murottal otomatis jeda sejenak saat bel masuk / istirahat berbunyi.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.autoStopOnBell}
                  onChange={(e) => onUpdateConfig({ ...config, autoStopOnBell: e.target.checked })}
                  className="w-6 h-6 accent-blue-600 rounded-md cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mode Pemutaran Surat:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ ...config, repeatMode: 'repeat_all' })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                      config.repeatMode === 'repeat_all'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Lanjut Surat Berikutnya</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ ...config, repeatMode: 'repeat_one' })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                      config.repeatMode === 'repeat_one'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Ulangi Surat yang Sama</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Daftar Jadwal Pemutaran Murottal (Multi-Slot Fleksibel) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Daftar Jam Murottal Otomatis Fleksibel</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full">
                    {scheduleSlots.length} Jadwal
                  </span>
                </h4>
                <p className="text-xs text-slate-500">
                  Anda bisa mengatur beberapa jam pemutaran sekaligus (misal jam 06:00 pagi, pertengahan pelajaran 09:45, atau istirahat dzuhur 11:45).
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {scheduleSlots.map((slot, index) => {
                const targetTrack =
                  allTracks.find((t) => t.id === slot.trackId) || DEFAULT_JUZ_30_TRACKS[1];

                return (
                  <div
                    key={slot.id}
                    className="p-4 bg-slate-50 hover:bg-blue-50/30 border border-slate-200 rounded-2xl transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={slot.label}
                          onChange={(e) => handleUpdateScheduleSlot(slot.id, { label: e.target.value })}
                          placeholder="Nama Jadwal (misal: Murottal Pertengahan Pelajaran)..."
                          className="font-extrabold text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-hidden px-1 py-0.5"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Test Play button */}
                        <button
                          type="button"
                          onClick={() => onPlayTrack(targetTrack)}
                          className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                          title="Uji putar surat jadwal ini"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Uji Putar</span>
                        </button>

                        {/* Enable/Disable Toggle */}
                        <button
                          type="button"
                          onClick={() => handleUpdateScheduleSlot(slot.id, { enabled: !slot.enabled })}
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold border transition-all cursor-pointer ${
                            slot.enabled
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-200 text-slate-600 border-slate-300'
                          }`}
                        >
                          {slot.enabled ? '✓ AKTIF' : 'NONAKTIF'}
                        </button>

                        {/* Delete slot button (if more than 1) */}
                        {scheduleSlots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteScheduleSlot(slot.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Hapus jadwal ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Slot Configuration Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      {/* Jam Mulai */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Jam Mulai:
                        </label>
                        <input
                          type="time"
                          value={slot.time}
                          onChange={(e) => handleUpdateScheduleSlot(slot.id, { time: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-blue-600 cursor-pointer"
                        />
                      </div>

                      {/* Pilihan Surat */}
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Surat / Audio yang Diputar:
                        </label>
                        <select
                          value={slot.trackId || 'thaha-078'}
                          onChange={(e) => handleUpdateScheduleSlot(slot.id, { trackId: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-hidden focus:border-blue-600 cursor-pointer"
                        >
                          <optgroup label="Murottal Juz 30 (Muhammad Thaha Al-Junayd - Versi Anak)">
                            {DEFAULT_JUZ_30_TRACKS.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title} ({t.durationStr})
                              </option>
                            ))}
                          </optgroup>
                          {customTracks.length > 0 && (
                            <optgroup label="Audio Murottal Unggahan Anda">
                              {customTracks.map((c) => (
                                <option key={c.id} value={c.id}>
                                  ✨ {c.title} ({c.durationStr || 'Audio Kustom'})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Durasi Maksimal */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Durasi Berputar:
                        </label>
                        <select
                          value={slot.stopAfterMinutes || 0}
                          onChange={(e) =>
                            handleUpdateScheduleSlot(slot.id, {
                              stopAfterMinutes: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-hidden focus:border-blue-600 cursor-pointer"
                        >
                          <option value={0}>Sampai Selesai / Bel Masuk</option>
                          <option value={15}>15 Menit</option>
                          <option value={30}>30 Menit</option>
                          <option value={45}>45 Menit</option>
                          <option value={60}>60 Menit</option>
                        </select>
                      </div>
                    </div>

                    {/* Hari Aktif Selector for this Slot */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-500 mr-1">Hari:</span>
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                        const isDaySelected = (slot.days || []).includes(day as DayOfWeek);
                        const isGloballyOff = disabledDays.includes(day as DayOfWeek);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleToggleSlotDay(slot.id, day as DayOfWeek)}
                            title={isGloballyOff ? 'Hari ini sedang dinonaktifkan di Mode Hari Libur (Murottal tetap mati)' : ''}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                              isGloballyOff
                                ? 'bg-rose-50 text-rose-600 border-rose-200 line-through opacity-75'
                                : isDaySelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {getIndonesianDayName(day as DayOfWeek).substring(0, 3)}
                          </button>
                        );
                      })}
                      {(disabledDays.includes(6) || disabledDays.includes(0)) && (
                        <span className="text-[10px] text-rose-600 font-semibold ml-1">
                          ({disabledDays.map((d) => getIndonesianDayName(d)).join(' & ')} dimatikan otomatis di Mode Libur)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
