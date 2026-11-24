import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Volume2,
  Sparkles,
  Clock,
  Check,
  Play,
  Mic,
  MessageSquare,
  Info,
  CheckCircle2,
  Layers,
  Filter,
  CheckSquare,
  Square,
  HelpCircle,
  Globe,
  Languages,
  Loader2,
  Pause,
} from 'lucide-react';
import { ScheduleItem, DayOfWeek, BellCategory, ChimeType, AudioSettings, AudioType, SpeechLanguage, SpeechInputMode } from '../types';
import { AudioRecorder } from './AudioRecorder';
import {
  playBellSequence,
  playChimeTone,
  translateSpeechWithAI,
  BellPlaybackState,
  subscribeBellPlaybackState,
  togglePauseBellPlayback,
  stopAllBellAudio,
} from '../utils/audioSynth';

export interface BatchVoiceApplyOptions {
  applyVoiceToAll: boolean;
  excludedIds: string[];
  applyChimeAlso: boolean;
}

interface ScheduleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: ScheduleItem, batchOptions?: BatchVoiceApplyOptions) => void;
  editingItem: ScheduleItem | null;
  audioSettings: AudioSettings;
  allSchedules?: ScheduleItem[];
  onTestSound: (
    chime: ChimeType,
    speechText: string,
    customAudioUrl?: string,
    audioType?: AudioType,
    clonedVoiceId?: string,
    enableOutroChime?: boolean,
    outroChimeType?: ChimeType | 'none' | 'same_as_intro',
    speechLanguage?: SpeechLanguage,
    speechInputMode?: SpeechInputMode,
    translatedSpeechText?: string,
    scheduleTime?: string
  ) => void | Promise<void>;
}

export const ScheduleEditorModal: React.FC<ScheduleEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem,
  audioSettings,
  allSchedules = [],
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

  // Outro Chime - default to 'none' so ringtones only play ONCE
  const [enableOutroChime, setEnableOutroChime] = useState<boolean>(false);
  const [outroChimeType, setOutroChimeType] = useState<ChimeType | 'none' | 'same_as_intro'>('none');

  // Batch Apply to other schedules state
  const [applyVoiceToAll, setApplyVoiceToAll] = useState(false);
  const [applyChimeAlso, setApplyChimeAlso] = useState(false);
  const [excludedScheduleIds, setExcludedScheduleIds] = useState<string[]>([]);

  // Multilingual AI Speech state
  const [speechLanguage, setSpeechLanguage] = useState<SpeechLanguage>('id');
  const [speechInputMode, setSpeechInputMode] = useState<SpeechInputMode>('auto_translate');
  const [translatedSpeechText, setTranslatedSpeechText] = useState<string>('');
  const [translatedByLang, setTranslatedByLang] = useState<Partial<Record<SpeechLanguage, { text: string; source: string }>>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // Test sound state & tutorial toggle
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [isPlayingChimeOnly, setIsPlayingChimeOnly] = useState(false);
  const [showCloneTutorial, setShowCloneTutorial] = useState(false);
  const [bellPlayback, setBellPlayback] = useState<BellPlaybackState | null>(null);

  useEffect(() => {
    return subscribeBellPlaybackState((s) => {
      setBellPlayback(s);
      if (!s.isPlaying) {
        setIsPlayingTest(false);
      }
    });
  }, []);

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
      setEnableOutroChime(editingItem.enableOutroChime || false);
      setOutroChimeType(editingItem.outroChimeType || 'none');
      const initLang = editingItem.speechLanguage || 'id';
      const initTrans = editingItem.translatedSpeechText || '';
      setSpeechLanguage(initLang);
      setSpeechInputMode(editingItem.speechInputMode || 'auto_translate');
      setTranslatedSpeechText(initTrans);
      setTranslatedByLang(
        initLang !== 'id' && initTrans
          ? { [initLang]: { text: initTrans, source: `${audioSettings.globalPrefix}${editingItem.speechText}` } }
          : {}
      );
    } else {
      setTime('07:20');
      setLabel("Jam Pelajaran ke-1 (Tahfidzul Qur'an)");
      setCategory('lesson');
      setSpeechText("memasuki jam pelajaran ke-1, Tahfidzul Qur'an.");
      setChimeType('westminster');
      setDays([1, 2, 3, 4, 5, 6]);
      setEnabled(true);
      setAudioType('tts');
      setCustomAudioUrl(undefined);
      setCustomAudioName(undefined);
      setClonedVoiceId(undefined);
      setEnableOutroChime(false);
      setOutroChimeType('none');
      setSpeechLanguage('id');
      setSpeechInputMode('auto_translate');
      setTranslatedSpeechText('');
      setTranslatedByLang({});
    }
    setTranslateError(null);
    // Reset batch state on open
    setApplyVoiceToAll(false);
    setApplyChimeAlso(false);
    setExcludedScheduleIds([]);
  }, [editingItem, isOpen]);

  if (!isOpen) return null;

  const otherSchedules = allSchedules.filter((s) => !editingItem || s.id !== editingItem.id);

  const toggleDay = (day: DayOfWeek) => {
    if (days.includes(day)) {
      if (days.length > 1) {
        setDays(days.filter((d) => d !== day));
      }
    } else {
      setDays([...days, day].sort());
    }
  };

  const toggleExcludeSchedule = (id: string) => {
    setExcludedScheduleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const excludeByCategory = (cats: BellCategory[]) => {
    const matchingIds = otherSchedules
      .filter((s) => cats.includes(s.category))
      .map((s) => s.id);
    
    // If all are already excluded, remove them. Otherwise add them all
    const allPresent = matchingIds.every((id) => excludedScheduleIds.includes(id));
    if (allPresent) {
      setExcludedScheduleIds((prev) => prev.filter((id) => !matchingIds.includes(id)));
    } else {
      setExcludedScheduleIds((prev) => Array.from(new Set([...prev, ...matchingIds])));
    }
  };

  const runTranslationFor = async (
    targetLang: SpeechLanguage,
    rawIndonesianText: string
  ): Promise<string | null> => {
    if (targetLang === 'id') return null;
    const sourceText = `${audioSettings.globalPrefix}${rawIndonesianText.trim()}`;
    if (!sourceText.trim()) return null;

    setIsTranslating(true);
    setTranslateError(null);
    try {
      const result = await translateSpeechWithAI(sourceText, targetLang);
      if (result) {
        setTranslatedSpeechText(result);
        setTranslatedByLang((prev) => ({
          ...prev,
          [targetLang]: { text: result, source: sourceText },
        }));
        return result;
      } else {
        setTranslateError('Gagal menerjemahkan dengan AI. Silakan coba lagi atau isi teks secara manual.');
        return null;
      }
    } catch {
      setTranslateError('Terjadi kesalahan saat menghubungi layanan terjemahan AI.');
      return null;
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSelectSpeechLanguage = async (nextLang: SpeechLanguage) => {
    setSpeechLanguage(nextLang);
    setTranslateError(null);

    if (nextLang === 'id') {
      return;
    }

    const sourceText = `${audioSettings.globalPrefix}${speechText.trim()}`;
    const cachedEntry = translatedByLang[nextLang];

    if (speechInputMode === 'direct_text') {
      setTranslatedSpeechText(cachedEntry?.text || '');
      return;
    }

    // auto_translate mode: reuse if source text hasn't changed, otherwise translate automatically right now
    if (cachedEntry && cachedEntry.source === sourceText && cachedEntry.text.trim()) {
      setTranslatedSpeechText(cachedEntry.text);
    } else {
      setTranslatedSpeechText('');
      await runTranslationFor(nextLang, speechText);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!time || !label.trim()) return;

    let finalTranslatedText = speechLanguage !== 'id' ? translatedSpeechText.trim() : undefined;
    if (speechLanguage !== 'id' && speechInputMode === 'auto_translate') {
      const sourceText = `${audioSettings.globalPrefix}${speechText.trim()}`;
      const cachedEntry = translatedByLang[speechLanguage];
      const isStale = cachedEntry && cachedEntry.source !== sourceText && !translatedSpeechText.trim();
      if (!finalTranslatedText || isStale) {
        const autoRes = await runTranslationFor(speechLanguage, speechText);
        if (autoRes) {
          finalTranslatedText = autoRes.trim();
        }
      }
    }

    const newItem: ScheduleItem = {
      id: editingItem ? editingItem.id : `sch-${Date.now()}`,
      time,
      label: label.trim(),
      category,
      speechText: speechText.trim() || label.trim(),
      speechLanguage,
      speechInputMode,
      translatedSpeechText: speechLanguage !== 'id' ? finalTranslatedText : undefined,
      chimeType,
      days,
      enabled,
      volume: editingItem ? editingItem.volume : 1.0,
      audioType,
      customAudioUrl,
      customAudioName,
      clonedVoiceId,
      enableOutroChime: outroChimeType !== 'none',
      outroChimeType,
    };

    onSave(newItem, {
      applyVoiceToAll,
      excludedIds: excludedScheduleIds,
      applyChimeAlso,
    });
    onClose();
  };

  const handleTranslateNow = async () => {
    if (speechLanguage === 'id') return;
    await runTranslationFor(speechLanguage, speechText);
  };

  const handleTestChimeOnly = async () => {
    if (isPlayingChimeOnly) return;
    setIsPlayingChimeOnly(true);
    try {
      await playChimeTone(chimeType, audioSettings.chimeVolume || 1.0, audioSettings.customChimes);
    } finally {
      setIsPlayingChimeOnly(false);
    }
  };

  const dayList: { num: DayOfWeek; name: string }[] = [
    { num: 1, name: 'Senin' },
    { num: 2, name: 'Selasa' },
    { num: 3, name: 'Rabu' },
    { num: 4, name: 'Kamis' },
    { num: 5, name: 'Jumat' },
    { num: 6, name: 'Sabtu' },
    { num: 0, name: 'Minggu' },
  ];

  const getLanguageLabel = (lang: SpeechLanguage) => {
    switch (lang) {
      case 'ar':
        return 'Bahasa Arab';
      case 'en':
        return 'Bahasa Inggris';
      case 'jv':
        return 'Bahasa Jawa';
      default:
        return 'Bahasa Indonesia';
    }
  };

  const getSourceDisplay = () => {
    if (audioType === 'cloned') return 'Kloning AI';
    if (audioType === 'recording') return customAudioName || 'Suara Rekaman HP';
    return 'TTS Standar Pria (Laki-laki)';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border border-blue-100 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/25 flex items-center justify-center text-amber-300 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>{editingItem ? 'Edit Jadwal Bel Sekolah' : 'Tambah Jadwal Bel Baru'}</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-blue-100 font-medium">
                SD QUR'AN UNGGULAN • Konfigurasi Jam, Teks Speech & Suara Pria
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
            
            {/* Grid 1: Waktu & Kategori (Symmetric 2-column) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Jam Bunyi (WIB)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-base font-mono font-bold text-blue-800 focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kategori Bel
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BellCategory)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  <option value="lesson">📖 Pelajaran</option>
                  <option value="break">☕ Istirahat</option>
                  <option value="prayer">🕌 Sholat / Ibadah</option>
                  <option value="assembly">🚩 Upacara / Apel</option>
                  <option value="dismissal">🏠 Jam Pulang</option>
                  <option value="custom">🔔 Lainnya / Kustom</option>
                </select>
              </div>
            </div>

            {/* Nama Kegiatan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Kegiatan / Keterangan Bel
              </label>
              <input
                type="text"
                required
                placeholder="Misal: Jam Pelajaran ke-1 (Tahfidzul Qur'an)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Pilihan Sumber Suara Ucapan (Symmetric 3-column cards) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Sumber Suara Ucapan Bel
                </label>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  👨 Khusus Suara Laki-laki / Pria
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* TTS Standar Button */}
                <button
                  type="button"
                  onClick={() => setAudioType('tts')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    audioType === 'tts'
                      ? 'bg-blue-50/90 border-blue-500 text-blue-800 ring-2 ring-blue-500/25 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${audioType === 'tts' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-500'}`}>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black block text-slate-900 truncate">TTS Pria (AI)</span>
                    <span className="text-[10px] text-slate-500 block truncate">Suara Laki-laki</span>
                  </div>
                </button>

                {/* Kloning AI Button */}
                <button
                  type="button"
                  onClick={() => setAudioType('cloned')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    audioType === 'cloned'
                      ? 'bg-blue-50/90 border-blue-500 text-blue-800 ring-2 ring-blue-500/25 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${audioType === 'cloned' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-500'}`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black block text-slate-900 truncate">Kloning AI</span>
                    <span className="text-[10px] text-slate-500 block truncate">Tiruan Vokal Anda</span>
                  </div>
                </button>

                {/* Suara Rekaman Button */}
                <button
                  type="button"
                  onClick={() => setAudioType('recording')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    audioType === 'recording'
                      ? 'bg-blue-50/90 border-blue-500 text-blue-800 ring-2 ring-blue-500/25 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${audioType === 'recording' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-500'}`}>
                    <Mic className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black block text-slate-900 truncate">Suara Rekaman</span>
                    <span className="text-[10px] text-slate-500 block truncate">Audio HP 100% Asli</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Input Konten Suara */}
            {audioType === 'tts' || audioType === 'cloned' ? (
              <div className="space-y-3">
                {audioType === 'cloned' && (
                  <div className="space-y-2 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-200/70">
                    <div>
                      <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider mb-1.5">
                        Pilih Profil Suara Kloning AI
                      </label>
                      <select
                        value={clonedVoiceId || ''}
                        onChange={(e) => setClonedVoiceId(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:border-blue-500 font-semibold cursor-pointer shadow-2xs"
                      >
                        <option value="">-- Gunakan Profil Kloning Utama Aktif --</option>
                        {(audioSettings.clonedProfiles || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.prebuiltVoiceFallback || 'Fenrir - Suara Laki-laki'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-blue-700 pt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        Profil disesuaikan dengan nada vokal laki-laki
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCloneTutorial(!showCloneTutorial)}
                        className="font-bold underline text-blue-800 hover:text-blue-950 cursor-pointer"
                      >
                        {showCloneTutorial ? 'Tutup Tips' : 'Petunjuk Kloning'}
                      </button>
                    </div>

                    {showCloneTutorial && (
                      <div className="pt-2 text-[11px] text-slate-700 border-t border-blue-200/60 space-y-1">
                        <p>1. Rekam sampel di tab <strong>Pengaturan Suara &gt; Kloning Suara AI</strong>.</p>
                        <p>2. AI akan membaca kalimat ucapan di bawah dengan karakter vokal yang dipilih.</p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {speechLanguage !== 'id' && speechInputMode === 'direct_text'
                      ? 'Kalimat Bahasa Indonesia (Opsional - Referensi Label)'
                      : `Kalimat Ucapan Bel (${audioType === 'cloned' ? 'Akan Dibaca Kloning AI' : 'TTS Pria'})`}
                  </label>
                  <textarea
                    rows={2}
                    required={speechLanguage === 'id' || speechInputMode === 'auto_translate'}
                    value={speechText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSpeechText(val);
                      if (speechLanguage !== 'id' && speechInputMode === 'auto_translate') {
                        setTranslatedSpeechText('');
                      }
                    }}
                    placeholder="memasuki jam pelajaran ke-1."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                  />

                  {/* Live Spoken Sentence Preview (Indonesian) */}
                  {(speechLanguage === 'id' || speechInputMode === 'auto_translate') && (
                    <div className="mt-2 bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs">
                      <span className="text-blue-900 font-bold block mb-0.5">
                        {speechLanguage === 'id' ? 'Pratinjau Ucapan Lengkap:' : 'Teks Sumber (Bahasa Indonesia):'}
                      </span>
                      <p className="italic text-blue-700 font-medium">
                        "{audioSettings.globalPrefix}{speechText}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Bahasa Suara AI (Indonesia / Arab / Inggris / Jawa) */}
                <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-indigo-600" />
                      <span>Bahasa Suara AI (Arab / Inggris / Jawa / Indonesia)</span>
                    </label>
                    <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                      {getLanguageLabel(speechLanguage)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { code: 'id' as SpeechLanguage, label: '🇮🇩 Indonesia' },
                      { code: 'ar' as SpeechLanguage, label: '🇸🇦 Bahasa Arab' },
                      { code: 'en' as SpeechLanguage, label: '🇬🇧 Inggris' },
                      { code: 'jv' as SpeechLanguage, label: '🇮🇩 Bahasa Jawa' },
                    ].map((opt) => (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => handleSelectSpeechLanguage(opt.code)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          speechLanguage === opt.code
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {speechLanguage !== 'id' && (
                    <div className="pt-2 border-t border-indigo-200/70 space-y-3">
                      {/* 2 Pilihan Mode Input Bahasa */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setSpeechInputMode('auto_translate');
                            if (!translatedSpeechText.trim() && speechText.trim()) {
                              await runTranslationFor(speechLanguage, speechText);
                            }
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border text-left transition cursor-pointer flex items-center gap-2 ${
                            speechInputMode === 'auto_translate'
                              ? 'bg-white border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20'
                              : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <Languages className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>AI Terjemahkan dari Indonesia</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSpeechInputMode('direct_text')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border text-left transition cursor-pointer flex items-center gap-2 ${
                            speechInputMode === 'direct_text'
                              ? 'bg-white border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20'
                              : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>Tulis Teks {getLanguageLabel(speechLanguage)} Sendiri</span>
                        </button>
                      </div>

                      {speechInputMode === 'auto_translate' ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-indigo-900">
                              Hasil Terjemahan AI ({getLanguageLabel(speechLanguage)}):
                            </span>
                            <button
                              type="button"
                              onClick={handleTranslateNow}
                              disabled={isTranslating}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                            >
                              {isTranslating ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Menerjemahkan...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Terjemahkan AI Sekarang</span>
                                </>
                              )}
                            </button>
                          </div>

                          <textarea
                            rows={2}
                            dir={speechLanguage === 'ar' ? 'rtl' : 'ltr'}
                            value={translatedSpeechText}
                            onChange={(e) => setTranslatedSpeechText(e.target.value)}
                            placeholder={`Klik "Terjemahkan AI Sekarang" untuk mengisi otomatis, atau biarkan kosong agar AI menerjemahkan otomatis saat bel berbunyi.`}
                            className="w-full bg-white border border-indigo-200 rounded-xl p-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-indigo-900 block">
                            Masukkan Teks {getLanguageLabel(speechLanguage)} yang Akan Dibacakan AI:
                          </label>
                          <textarea
                            rows={2}
                            required
                            dir={speechLanguage === 'ar' ? 'rtl' : 'ltr'}
                            value={translatedSpeechText}
                            onChange={(e) => setTranslatedSpeechText(e.target.value)}
                            placeholder={
                              speechLanguage === 'ar'
                                ? 'Contoh: انْتِبَاهٌ لِجَمِيعِ الطُّلَّابِ، حَانَ وَقْتُ الدَّرْسِ الْأَوَّلِ'
                                : speechLanguage === 'en'
                                ? 'Example: Attention please all students, it is time for the first lesson.'
                                : 'Contoh: Katur dhumateng sedaya siswa, wekdalipun mlebet pelajaran sepindhah.'
                            }
                            className="w-full bg-white border border-indigo-200 rounded-xl p-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                          />
                        </div>
                      )}

                      {translateError && (
                        <p className="text-[11px] font-semibold text-rose-600">{translateError}</p>
                      )}
                    </div>
                  )}
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
                cloudinaryConfig={{
                  cloudName: audioSettings.cloudinaryCloudName,
                  uploadPreset: audioSettings.cloudinaryUploadPreset,
                }}
              />
            )}

            {/* Alur Urutan Bunyi Bel Visual Flow */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-blue-600" />
                  Alur Urutan Bunyi Bel
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isPlayingTest || isTranslating}
                    onClick={async () => {
                      setIsPlayingTest(true);
                      try {
                        let effectiveTranslation = translatedSpeechText;
                        if (speechLanguage !== 'id' && speechInputMode === 'auto_translate' && !effectiveTranslation.trim()) {
                          const res = await runTranslationFor(speechLanguage, speechText);
                          if (!res) {
                            return;
                          }
                          effectiveTranslation = res;
                        }
                        await onTestSound(
                          chimeType,
                          speechText,
                          customAudioUrl,
                          audioType,
                          clonedVoiceId,
                          outroChimeType !== 'none',
                          outroChimeType,
                          speechLanguage,
                          speechInputMode,
                          effectiveTranslation,
                          time
                        );
                      } finally {
                        setIsPlayingTest(false);
                      }
                    }}
                    className={`text-xs font-bold flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-xl border shadow-xs transition-all active:scale-95 ${
                      isPlayingTest
                        ? 'bg-amber-50 border-amber-300 text-amber-700 animate-pulse'
                        : 'bg-white border-blue-300 text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    {isPlayingTest ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        <span>{bellPlayback?.isPaused ? 'Dijeda...' : 'Memutar Suara Bel...'}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Tes Putar Seluruh Urutan</span>
                      </>
                    )}
                  </button>

                  {(isPlayingTest || bellPlayback?.isPlaying) && (
                    <>
                      <button
                        type="button"
                        onClick={togglePauseBellPlayback}
                        className="text-xs font-bold flex items-center gap-1 cursor-pointer px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                      >
                        {bellPlayback?.isPaused ? (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Lanjut</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-current" />
                            <span>Pause</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          stopAllBellAudio();
                          setIsPlayingTest(false);
                        }}
                        className="text-xs font-bold flex items-center gap-1 cursor-pointer px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span>Berhenti</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white border border-blue-200 rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[10px] font-extrabold text-blue-600 block mb-0.5">1. Pembuka</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block">
                    {chimeType === 'westminster'
                      ? 'Westminster (6.8s)'
                      : chimeType === 'classic_3tone'
                      ? '6-Tone (5.8s)'
                      : chimeType === 'electric_bell'
                      ? 'Bel Listrik (10s)'
                      : chimeType === 'school_dismissal'
                      ? 'Melodi Pulang (6.2s)'
                      : chimeType === 'fire_bell'
                      ? 'Alarm Pemadam (10s)'
                      : chimeType === 'tube_chime'
                      ? 'Tube Chime (5.8s)'
                      : 'Nada Kustom'}
                  </span>
                </div>

                <div className="bg-white border border-blue-200 rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[10px] font-extrabold text-blue-600 block mb-0.5">2. Suara VO</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block">
                    {audioType === 'recording'
                      ? (customAudioName ? 'Rekaman HP' : 'Audio Rekaman')
                      : audioType === 'cloned'
                      ? 'Kloning AI'
                      : 'TTS Pria'}
                  </span>
                </div>

                <div className={`border rounded-xl p-2.5 shadow-2xs ${
                  outroChimeType !== 'none'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}>
                  <span className={`text-[10px] font-extrabold block mb-0.5 ${outroChimeType !== 'none' ? 'text-amber-700' : 'text-slate-400'}`}>
                    3. Penutup
                  </span>
                  <span className="font-bold text-[11px] truncate block">
                    {outroChimeType === 'none' ? 'Tanpa Nada' : outroChimeType === 'same_as_intro' ? 'Sama Pembuka' : 'Nada Outro'}
                  </span>
                </div>
              </div>
            </div>

            {/* Nada Pembuka & Penutup (Symmetric 2-column) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    1. Nada Pembuka (Intro)
                  </label>
                  <button
                    type="button"
                    onClick={handleTestChimeOnly}
                    disabled={isPlayingChimeOnly}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-200 transition-all shadow-2xs"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isPlayingChimeOnly ? 'Memutar...' : 'Putar Nada Saja'}</span>
                  </button>
                </div>
                <select
                  value={chimeType}
                  onChange={(e) => setChimeType(e.target.value as ChimeType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 cursor-pointer font-bold"
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
                    <option value="westminster">Westminster 8-Tone (6.8s - Bel Masuk Sekolah)</option>
                    <option value="classic_3tone">6-Tone Ascending Melodi (5.8s - Ganti Jam)</option>
                    <option value="school_dismissal">Melodi Pulang Ceria (6.2s - Bel Pulang Riang)</option>
                    <option value="electric_bell">Bel Listrik Sekolah Kencang (10s - 3x Dering)</option>
                    <option value="fire_bell">Bel Alarm Pemadam / Darurat (10s - 3x Dentang)</option>
                    <option value="tube_chime">Tube Chime Lembut (5.8s - Istirahat)</option>
                    <option value="islamic_duo">Islamic Duo Chime (6.2s - Syahdu Tenang)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  3. Nada Penutup (Setelah VO)
                </label>
                <select
                  value={outroChimeType}
                  onChange={(e) => {
                    const val = e.target.value as ChimeType | 'none' | 'same_as_intro';
                    setOutroChimeType(val);
                    setEnableOutroChime(val !== 'none');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 cursor-pointer font-medium"
                >
                  <option value="none">🚫 Tidak Ada (Hanya 1x Nada Pembuka - Default)</option>
                  <option value="same_as_intro">🔄 Bunyikan Ulang Nada Pembuka</option>
                  <optgroup label="🔔 Nada Sintesis Penutup">
                    <option value="classic_3tone">6-Tone Ascending Melodi (5.8s)</option>
                    <option value="tube_chime">Tube Chime Soft (5.8s)</option>
                    <option value="westminster">Westminster 8-Tone (6.8s)</option>
                    <option value="school_dismissal">Melodi Pulang Ceria (6.2s)</option>
                    <option value="electric_bell">Bel Listrik Kencang (10s)</option>
                    <option value="fire_bell">Bel Alarm Pemadam (10s)</option>
                    <option value="islamic_duo">Islamic Duo Chime (6.2s)</option>
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
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Hari Berlaku
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {dayList.map((d) => {
                  const isSelected = days.includes(d.num);
                  return (
                    <button
                      type="button"
                      key={d.num}
                      onClick={() => toggleDay(d.num)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FITUR BARU: Terapkan Suara Ini ke Semua Jadwal Bel (Massal dengan Pengecualian) */}
            <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-sky-50/80 border border-blue-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="applyVoiceToAllCheckbox"
                  checked={applyVoiceToAll}
                  onChange={(e) => setApplyVoiceToAll(e.target.checked)}
                  className="w-5 h-5 mt-0.5 accent-blue-600 rounded-md cursor-pointer shrink-0"
                />
                <div className="flex-1">
                  <label htmlFor="applyVoiceToAllCheckbox" className="text-xs sm:text-sm font-black text-blue-950 block cursor-pointer">
                    ⚡ Terapkan Otomatis Suara Ini ke Semua Jadwal Bel
                  </label>
                  <p className="text-[11px] text-blue-800/80 mt-0.5">
                    Terapkan sumber suara <strong>"{getSourceDisplay()}"</strong> ke seluruh jadwal lain tanpa perlu mengubah satu per satu.
                  </p>
                </div>
              </div>

              {applyVoiceToAll && (
                <div className="pt-3 border-t border-blue-200/80 space-y-3 animate-fadeIn">
                  {/* Option: Apply chime also */}
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-800 bg-white/80 p-2.5 rounded-xl border border-blue-100">
                    <input
                      type="checkbox"
                      id="applyChimeAlsoCheckbox"
                      checked={applyChimeAlso}
                      onChange={(e) => setApplyChimeAlso(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded-md cursor-pointer"
                    />
                    <label htmlFor="applyChimeAlsoCheckbox" className="cursor-pointer">
                      Sertakan juga Nada Dering ({chimeType}) untuk diterapkan ke jadwal lain
                    </label>
                  </div>

                  {/* Section Title & Quick Preset Filters */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-blue-600" />
                        Pilih Pengecualian (Jam yang TIDAK ingin diubah suaranya):
                      </span>
                      <span className="text-[10px] text-blue-700 font-bold">
                        {excludedScheduleIds.length} dari {otherSchedules.length} jadwal dikecualikan
                      </span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                      <button
                        type="button"
                        onClick={() => excludeByCategory(['break', 'prayer'])}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition cursor-pointer shadow-2xs"
                      >
                        ☕ Kecualikan Istirahat & Sholat
                      </button>
                      <button
                        type="button"
                        onClick={() => excludeByCategory(['dismissal'])}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition cursor-pointer shadow-2xs"
                      >
                        🏠 Kecualikan Jam Pulang
                      </button>
                      <button
                        type="button"
                        onClick={() => setExcludedScheduleIds([])}
                        className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                      >
                        Terapkan ke Semua (0 Pengecualian)
                      </button>
                    </div>

                    {/* Checklist of other schedules */}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 bg-white p-2 rounded-xl border border-blue-200/80 scrollbar-thin">
                      {otherSchedules.length === 0 ? (
                        <p className="text-xs text-slate-400 p-2 text-center">Tidak ada jadwal lain.</p>
                      ) : (
                        otherSchedules.map((s) => {
                          const isExcluded = excludedScheduleIds.includes(s.id);
                          return (
                            <div
                              key={s.id}
                              onClick={() => toggleExcludeSchedule(s.id)}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                                isExcluded
                                  ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                                  : 'bg-slate-50 border-slate-200 hover:bg-blue-50/50 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isExcluded}
                                  onChange={() => {}}
                                  className="w-4 h-4 accent-amber-600 rounded-md shrink-0 pointer-events-none"
                                />
                                <span className="font-mono font-black text-blue-700 shrink-0">{s.time}</span>
                                <span className="font-semibold truncate">{s.label}</span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white border border-slate-200 text-slate-600">
                                  {s.category}
                                </span>
                                {isExcluded ? (
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                    Dikecualikan
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    Akan Diubah
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Toggle Status Jadwal */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <span className="text-sm font-bold text-slate-900 block">Status Jadwal Bel</span>
                <span className="text-xs text-slate-500">Aktifkan atau nonaktifkan jadwal ini dari bunyi otomatis</span>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded-md cursor-pointer"
              />
            </div>
          </div>

          {/* Form Sticky Footer */}
          <div className="flex items-center justify-end gap-2.5 p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-blue-500/25 flex items-center gap-2 text-xs sm:text-sm transition-all active:scale-95 cursor-pointer"
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
