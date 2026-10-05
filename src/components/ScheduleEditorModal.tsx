import React, { useState, useEffect } from 'react';
import { X, Save, Volume2, Sparkles, Clock, Check, Play, Mic, MessageSquare } from 'lucide-react';
import { ScheduleItem, DayOfWeek, BellCategory, ChimeType, AudioSettings, AudioType } from '../types';
import { AudioRecorder } from './AudioRecorder';
import { playBellSequence } from '../utils/audioSynth';

interface ScheduleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: ScheduleItem) => void;
  editingItem: ScheduleItem | null;
  audioSettings: AudioSettings;
  onTestSound: (
    chime: ChimeType,
    speechText: string,
    customAudioUrl?: string,
    audioType?: AudioType,
    clonedVoiceId?: string,
    enableOutroChime?: boolean,
    outroChimeType?: ChimeType | 'none' | 'same_as_intro'
  ) => void;
}

export const ScheduleEditorModal: React.FC<ScheduleEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem,
  audioSettings,
  onTestSound,
}) => {
  const [time, setTime] = useState('07:20');
  const [label, setLabel] = useState("Jam Pelajaran ke-1 (Tahfidzul Qur'an)");
  const [category, setCategory] = useState<BellCategory>('lesson');
  const [speechText, setSpeechText] = useState("memasuki jam pelajaran ke-1, Tahfidzul Qur'an.");
  const [chimeType, setChimeType] = useState<ChimeType>('westminster');
  const [days, setDays] = useState<DayOfWeek[]>([1, 2, 3, 4, 5, 6]);
  const [enabled, setEnabled] = useState(true);

  // Custom Recording & Cloned Voice state
  const [audioType, setAudioType] = useState<AudioType>('tts');
  const [customAudioUrl, setCustomAudioUrl] = useState<string | undefined>(undefined);
  const [customAudioName, setCustomAudioName] = useState<string | undefined>(undefined);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | undefined>(undefined);

  // Outro Chime (Nada Dering setelah rekaman VO selesai)
  const [enableOutroChime, setEnableOutroChime] = useState<boolean>(false);
  const [outroChimeType, setOutroChimeType] = useState<ChimeType | 'none' | 'same_as_intro'>('none');

  useEffect(() => {
    if (editingItem) {
      setTime(editingItem.time);
      setLabel(editingItem.label);
      setCategory(editingItem.category);
      setSpeechText(editingItem.speechText);
      setChimeType(editingItem.chimeType);
      setDays(editingItem.days);
      setEnabled(editingItem.enabled);
      setAudioType(editingItem.audioType || 'tts');
      setCustomAudioUrl(editingItem.customAudioUrl);
      setCustomAudioName(editingItem.customAudioName);
      setClonedVoiceId(editingItem.clonedVoiceId);
      setEnableOutroChime(editingItem.enableOutroChime ?? (editingItem.outroChimeType && editingItem.outroChimeType !== 'none' ? true : false));
      setOutroChimeType(editingItem.outroChimeType || (editingItem.enableOutroChime ? 'same_as_intro' : 'none'));
    } else {
      // Default values for new item
      setTime('08:00');
      setLabel('Kegiatan Belajar');
      setCategory('lesson');
      setSpeechText('memasuki jam pelajaran.');
      setChimeType('westminster');
      setDays([1, 2, 3, 4, 5]);
      setEnabled(true);
      setAudioType('tts');
      setCustomAudioUrl(undefined);
      setCustomAudioName(undefined);
      setClonedVoiceId(audioSettings.activeClonedVoiceId);
      setEnableOutroChime(audioSettings.enableGlobalOutroChime ?? false);
      setOutroChimeType(audioSettings.globalOutroChimeType || (audioSettings.enableGlobalOutroChime ? 'same_as_intro' : 'none'));
    }
  }, [editingItem, isOpen, audioSettings]);

  if (!isOpen) return null;

  const toggleDay = (dayNum: DayOfWeek) => {
    if (days.includes(dayNum)) {
      setDays(days.filter((d) => d !== dayNum));
    } else {
      setDays([...days, dayNum].sort());
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time || !label) return;

    const savedItem: ScheduleItem = {
      id: editingItem ? editingItem.id : `s-${Date.now()}`,
      time,
      label,
      category,
      speechText,
      chimeType,
      enableOutroChime: outroChimeType !== 'none',
      outroChimeType,
      days,
      enabled,
      volume: 1.0,
      audioType,
      customAudioUrl,
      customAudioName,
      clonedVoiceId,
    };

    onSave(savedItem);
    onClose();
  };

  const dayList: { num: DayOfWeek; name: string }[] = [
    { num: 1, name: 'Senin' },
    { num: 2, name: 'Selasa' },
    { num: 3, name: 'Rabu' },
    { num: 4, name: 'Kamis' },
    { num: 5, name: 'Jumat' },
    { num: 6, name: 'Sabtu' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 p-5 sm:p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>{editingItem ? 'Edit Jadwal Bel' : 'Tambah Jadwal Bel Baru'}</span>
            </h3>
            <p className="text-xs text-emerald-100/90 mt-1">
              SD QUR'AN UNGGULAN • Konfigurasi Jam, Teks Speech & Suara Rekaman
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-950/40 hover:bg-slate-950 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Grid 1: Waktu & Kategori */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Jam Bunyi (WIB)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Kategori Bel
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BellCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="lesson">Pelajaran</option>
                <option value="break">Istirahat</option>
                <option value="prayer">Sholat / Ibadah</option>
                <option value="assembly">Apel / Upacara / Imtaq</option>
                <option value="dismissal">Jam Pulang</option>
                <option value="custom">Lainnya / Custom</option>
              </select>
            </div>
          </div>

          {/* Label / Nama Kegiatan */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Nama Kegiatan / Keterangan
            </label>
            <input
              type="text"
              required
              placeholder="Misal: Jam Pelajaran ke-1 (Tahfidzul Qur'an)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Audio Source Selector (TTS vs Kloning Suara AI vs Suara Rekaman) */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Sumber Suara Ucapan Bel
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setAudioType('tts')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  audioType === 'tts'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${audioType === 'tts' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-white">TTS Standar</span>
                  <span className="text-[10px] text-slate-400">Pembaca sistem</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAudioType('cloned')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  audioType === 'cloned'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${audioType === 'cloned' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-white">Kloning AI</span>
                  <span className="text-[10px] text-slate-400">Suara AI tiruan</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAudioType('recording')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  audioType === 'recording'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${audioType === 'recording' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-white">Suara Rekaman</span>
                  <span className="text-[10px] text-slate-400">File audio asli</span>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Input: TTS / Cloned Voice / Audio Recorder */}
          {audioType === 'tts' || audioType === 'cloned' ? (
            <div className="space-y-3">
              {audioType === 'cloned' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Pilih Profil Suara Kloning AI
                  </label>
                  <select
                    value={clonedVoiceId || ''}
                    onChange={(e) => setClonedVoiceId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">-- Gunakan Profil Kloning Utama Aktif --</option>
                    {(audioSettings.clonedProfiles || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.prebuiltVoiceFallback || 'Kore'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Kalimat Ucapan Speech ({audioType === 'cloned' ? 'Akan Dibaca Suara Kloning AI' : 'TTS'})
                </label>
                <textarea
                  rows={2}
                  required
                  value={speechText}
                  onChange={(e) => setSpeechText(e.target.value)}
                  placeholder="memasuki jam pelajaran ke-1."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />

                {/* Live Spoken Sentence Preview */}
                <div className="mt-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <span className="text-amber-300 font-bold block mb-1">Pratinjau Ucapan Lengkap:</span>
                  <p className="italic text-emerald-200">
                    "{audioSettings.globalPrefix} {speechText}"
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <AudioRecorder
              currentAudioUrl={customAudioUrl}
              currentAudioName={customAudioName}
              onAudioChange={(url, name) => {
                setCustomAudioUrl(url);
                setCustomAudioName(name);
              }}
              title="Rekam Suara untuk Bel Ini"
              description="Suara rekaman ini akan diputar setelah nada chime bel berbunyi."
            />
          )}

          {/* Visual Sequence Flow Indicator */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Alur Urutan Bunyi Bel
              </span>
              <button
                type="button"
                onClick={() =>
                  onTestSound(
                    chimeType,
                    speechText,
                    customAudioUrl,
                    audioType,
                    clonedVoiceId,
                    outroChimeType !== 'none',
                    outroChimeType
                  )
                }
                className="text-xs text-emerald-400 hover:text-emerald-300 font-black flex items-center gap-1.5 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Tes Putar Seluruh Urutan</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px]">
              <div className="flex-1 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2 text-center">
                <span className="text-[9px] font-bold text-emerald-400 block">1. Pembuka</span>
                <span className="font-extrabold text-white truncate block text-[11px]">
                  {chimeType === 'westminster'
                    ? 'Westminster'
                    : chimeType === 'classic_3tone'
                    ? '3-Tone'
                    : chimeType === 'tube_chime'
                    ? 'Tube Chime'
                    : chimeType === 'electric_bell'
                    ? 'Electric Bell'
                    : chimeType === 'islamic_duo'
                    ? 'Islamic Duo'
                    : 'Nada Kustom'}
                </span>
              </div>

              <div className="text-slate-500 font-bold">➜</div>

              <div className="flex-1 bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-2 text-center">
                <span className="text-[9px] font-bold text-cyan-400 block">2. Suara / VO</span>
                <span className="font-extrabold text-white truncate block text-[11px]">
                  {audioType === 'recording'
                    ? (customAudioName ? 'Rekaman HP' : 'Rekaman VO')
                    : audioType === 'cloned'
                    ? 'Kloning AI'
                    : 'Suara TTS'}
                </span>
              </div>

              <div className="text-slate-500 font-bold">➜</div>

              <div className={`flex-1 border rounded-xl p-2 text-center transition-all ${
                outroChimeType !== 'none'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}>
                <span className={`text-[9px] font-bold block ${outroChimeType !== 'none' ? 'text-amber-400' : 'text-slate-500'}`}>
                  3. Penutup
                </span>
                <span className="font-extrabold truncate block text-[11px]">
                  {outroChimeType === 'none'
                    ? 'Tanpa Nada'
                    : outroChimeType === 'same_as_intro'
                    ? 'Sama Pembuka'
                    : outroChimeType === 'classic_3tone'
                    ? '3-Tone'
                    : outroChimeType === 'westminster'
                    ? 'Westminster'
                    : outroChimeType === 'tube_chime'
                    ? 'Tube Chime'
                    : outroChimeType === 'islamic_duo'
                    ? 'Islamic Duo'
                    : 'Nada Outro'}
                </span>
              </div>
            </div>
          </div>

          {/* Pengaturan Nada Bel: Pembuka & Penutup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Jenis Nada Chime Pembuka */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>1. Nada Pembuka (Intro)</span>
                </label>
              </div>

              <select
                value={chimeType}
                onChange={(e) => setChimeType(e.target.value as ChimeType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {(audioSettings.customChimes && audioSettings.customChimes.length > 0) && (
                  <optgroup label="✨ Nada Dering Kustom Buatan Anda">
                    {audioSettings.customChimes.map((c) => (
                      <option key={c.id} value={c.id}>
                        ✨ {c.name} ({c.audioName || 'File Kustom'})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="🔔 Nada Dering Sintesis Digital">
                  <option value="westminster">Westminster 4-Tone (Standar Bel Sekolah)</option>
                  <option value="classic_3tone">Classic 3-Tone Ascending (Do-Mi-Sol)</option>
                  <option value="electric_bell">Electric Bell Ring (Lonceng Logam)</option>
                  <option value="tube_chime">Tube Chime Soft (Melodik Halus)</option>
                  <option value="islamic_duo">Islamic Duo Chime (Syahdu Tenang)</option>
                </optgroup>
              </select>
            </div>

            {/* 2. Jenis Nada Chime Penutup (Outro setelah Rekaman VO Selesai) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>3. Nada Penutup (Setelah VO)</span>
                </label>
              </div>

              <select
                value={outroChimeType}
                onChange={(e) => {
                  const val = e.target.value as ChimeType | 'none' | 'same_as_intro';
                  setOutroChimeType(val);
                  setEnableOutroChime(val !== 'none');
                }}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none cursor-pointer ${
                  outroChimeType !== 'none'
                    ? 'border-amber-500/50 focus:border-amber-400'
                    : 'border-slate-800 focus:border-slate-700'
                }`}
              >
                <option value="none">🚫 Tidak Ada (Langsung Selesai)</option>
                <option value="same_as_intro">🔄 Sama dengan Nada Pembuka</option>
                <optgroup label="🔔 Nada Sintesis Penutup">
                  <option value="classic_3tone">Classic 3-Tone (Do-Mi-Sol)</option>
                  <option value="tube_chime">Tube Chime Soft</option>
                  <option value="westminster">Westminster 4-Tone</option>
                  <option value="islamic_duo">Islamic Duo Chime</option>
                  <option value="electric_bell">Electric Bell Ring</option>
                </optgroup>
                {(audioSettings.customChimes && audioSettings.customChimes.length > 0) && (
                  <optgroup label="✨ Nada Kustom Buatan Anda">
                    {audioSettings.customChimes.map((c) => (
                      <option key={c.id} value={c.id}>
                        ✨ {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Hari Berlaku */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Hari Berlaku
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {dayList.map((d) => {
                const isSelected = days.includes(d.num);
                return (
                  <button
                    type="button"
                    key={d.num}
                    onClick={() => toggleDay(d.num)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle Active */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-sm font-bold text-white">Status Jadwal Bel</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              <span className="ml-3 text-xs font-semibold text-slate-300">
                {enabled ? 'Aktif' : 'Nonaktif'}
              </span>
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 text-xs transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Jadwal</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
