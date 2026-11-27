import React, { useState } from 'react';
import {
  BellRing,
  Coffee,
  HeartHandshake,
  DoorOpen,
  AlertTriangle,
  Megaphone,
  Play,
  Volume2,
  Globe,
  Sparkles,
  Loader2,
  Pause,
  Square,
} from 'lucide-react';
import { ChimeType, AudioSettings, SpeechLanguage, SpeechInputMode } from '../types';
import {
  playBellSequence,
  translateSpeechWithAI,
  BellPlaybackState,
  subscribeBellPlaybackState,
  togglePauseBellPlayback,
  stopAllBellAudio,
} from '../utils/audioSynth';
import { getSynchronizedDate, format24HourTime } from '../utils/timeSync';

interface ManualBellPadProps {
  audioSettings: AudioSettings;
  onLogManualBell: (label: string, speechText: string) => void;
}

export const ManualBellPad: React.FC<ManualBellPadProps> = ({
  audioSettings,
  onLogManualBell,
}) => {
  const [customText, setCustomText] = useState('');
  const [customLanguage, setCustomLanguage] = useState<SpeechLanguage>('id');
  const [customInputMode, setCustomInputMode] = useState<SpeechInputMode>('auto_translate');
  const [isTranslating, setIsTranslating] = useState(false);
  const [customChime, setCustomChime] = useState<ChimeType>('westminster');
  const [customOutroChime, setCustomOutroChime] = useState<ChimeType | 'none' | 'same_as_intro'>('same_as_intro');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [bellPlayback, setBellPlayback] = useState<BellPlaybackState | null>(null);

  React.useEffect(() => {
    return subscribeBellPlaybackState((s) => {
      setBellPlayback(s);
      if (!s.isPlaying) {
        setIsPlaying(false);
        setActivePresetId(null);
      }
    });
  }, []);

  const manualPresets = [
    {
      id: 'p-masuk',
      title: 'Bel Masuk Kelas',
      desc: 'Pengumuman masuk ke dalam kelas',
      chime: 'westminster' as ChimeType,
      outroChime: 'classic_3tone' as ChimeType,
      speechText: 'memasuki jam pelajaran. Seluruh murid diharapkan segera masuk ke dalam kelas masing-masing.',
      icon: BellRing,
      iconBg: 'bg-blue-100 text-blue-700',
      border: 'border-blue-200',
      activeRing: 'ring-blue-500',
    },
    {
      id: 'p-istirahat',
      title: 'Bel Waktu Istirahat',
      desc: 'Pengumuman jam istirahat siswa',
      chime: 'tube_chime' as ChimeType,
      outroChime: 'tube_chime' as ChimeType,
      speechText: 'memasuki waktu istirahat. Selamat beristirahat dan tetap menjaga kebersihan lingkungan sekolah.',
      icon: Coffee,
      iconBg: 'bg-amber-100 text-amber-700',
      border: 'border-amber-200',
      activeRing: 'ring-amber-500',
    },
    {
      id: 'p-sholat',
      title: 'Bel Sholat / Ibadah',
      desc: 'Panggilan persiapan Sholat Dzuhur',
      chime: 'islamic_duo' as ChimeType,
      outroChime: 'islamic_duo' as ChimeType,
      speechText: 'memasuki waktu persiapan Sholat Dzuhur Berjamaah. Mari bersiap menuju tempat ibadah.',
      icon: HeartHandshake,
      iconBg: 'bg-emerald-100 text-emerald-700',
      border: 'border-emerald-200',
      activeRing: 'ring-emerald-500',
    },
    {
      id: 'p-pulang',
      title: 'Bel Pulang Sekolah',
      desc: 'Pengumuman jam selesai pelajaran',
      chime: 'school_dismissal' as ChimeType,
      outroChime: 'electric_bell' as ChimeType,
      speechText: 'kegiatan belajar mengajar hari ini telah selesai. Selamat jalan dan hati-hati di jalan.',
      icon: DoorOpen,
      iconBg: 'bg-purple-100 text-purple-700',
      border: 'border-purple-200',
      activeRing: 'ring-purple-500',
    },
    {
      id: 'p-darurat',
      title: 'Bel Darurat / Peringatan',
      desc: 'Alarm peringatan darurat sekolah',
      chime: 'electric_bell' as ChimeType,
      outroChime: 'electric_bell' as ChimeType,
      speechText: 'perhatian seluruh warga sekolah, mohon bersiap untuk kegiatan evakuasi atau pengumuman darurat.',
      icon: AlertTriangle,
      iconBg: 'bg-rose-100 text-rose-700',
      border: 'border-rose-200',
      activeRing: 'ring-rose-500',
    },
  ];

  const handleTriggerPreset = async (preset: typeof manualPresets[0]) => {
    if (isPlaying) return;
    setIsPlaying(true);
    setActivePresetId(preset.id);

    const fullText = `${audioSettings.globalPrefix}${preset.speechText}`;

    const currentHHMM = format24HourTime(getSynchronizedDate(), false);

    try {
      await playBellSequence(
        preset.chime,
        fullText,
        audioSettings,
        1.0,
        undefined,
        'tts',
        undefined,
        undefined,
        true,
        preset.outroChime || 'same_as_intro',
        undefined,
        'id',
        'auto_translate',
        undefined,
        {
          label: preset.title,
          scheduleTime: currentHHMM,
          spokenTime: currentHHMM,
          skipPostBellTracks: true,
        }
      );
      onLogManualBell(`Bel Manual: ${preset.title}`, fullText);
    } catch (err) {
      console.error('Trigger manual bell error:', err);
    } finally {
      setIsPlaying(false);
      setActivePresetId(null);
    }
  };

  const handleTranslateCustomPreview = async () => {
    if (!customText.trim() || customLanguage === 'id' || isTranslating) return;
    setIsTranslating(true);
    try {
      const translated = await translateSpeechWithAI(customText.trim(), customLanguage);
      if (translated) {
        setCustomText(translated);
        setCustomInputMode('direct_text');
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTriggerCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim() || isPlaying) return;

    setIsPlaying(true);
    setActivePresetId('custom');

    const rawText = customText.trim();
    const fullText =
      customLanguage === 'id' ? `${audioSettings.globalPrefix}${rawText}` : rawText;

    try {
      let resolvedTargetText =
        customLanguage !== 'id' && customInputMode === 'direct_text' ? rawText : undefined;

      if (customLanguage !== 'id' && customInputMode === 'auto_translate') {
        const translated = await translateSpeechWithAI(rawText, customLanguage);
        if (translated) {
          resolvedTargetText = translated;
        }
      }

      const currentHHMM = format24HourTime(getSynchronizedDate(), false);

      await playBellSequence(
        customChime,
        fullText,
        audioSettings,
        1.0,
        undefined,
        customLanguage !== 'id' ? 'cloned' : 'tts',
        undefined,
        undefined,
        customOutroChime !== 'none',
        customOutroChime,
        undefined,
        customLanguage,
        customInputMode,
        resolvedTargetText,
        {
          label: `Siaran Manual (${customLanguage.toUpperCase()})`,
          scheduleTime: currentHHMM,
          spokenTime: currentHHMM,
          skipPostBellTracks: true,
        }
      );
      onLogManualBell(`Bel Manual Custom (${customLanguage.toUpperCase()})`, resolvedTargetText || fullText);
      setCustomText('');
    } catch (err) {
      console.error('Trigger custom bell error:', err);
    } finally {
      setIsPlaying(false);
      setActivePresetId(null);
    }
  };

  return (
    <div className="bg-white border border-blue-100 rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <BellRing className="w-6 h-6 text-blue-600" />
            <span>Pad Bel Manual Seketika (Instant Manual Bell)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tekan tombol preset di bawah ini untuk membunyikan bel secara manual kapan saja tanpa menunggu jadwal jam.
          </p>
        </div>

        {(isPlaying || bellPlayback?.isPlaying) && (
          <div className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold flex flex-wrap items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-600 animate-pulse" />
            <span>{bellPlayback?.isPaused ? 'Bel Dijeda (Pause)' : 'Sedang Membunyikan Bel...'}</span>
            <button
              type="button"
              onClick={togglePauseBellPlayback}
              className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              {bellPlayback?.isPaused ? (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Lanjut</span>
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Pause</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={stopAllBellAudio}
              className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Berhenti</span>
            </button>
          </div>
        )}
      </div>

      {/* Preset Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {manualPresets.map((preset) => {
          const Icon = preset.icon;
          const isThisPlaying = activePresetId === preset.id;

          return (
            <button
              key={preset.id}
              onClick={() => handleTriggerPreset(preset)}
              disabled={isPlaying}
              className={`group bg-white border ${preset.border} rounded-2xl p-5 text-left transition-all hover:shadow-md hover:scale-[1.01] active:scale-95 cursor-pointer flex flex-col justify-between shadow-xs ${
                isThisPlaying ? `ring-2 ${preset.activeRing} bg-blue-50/40` : 'hover:bg-slate-50/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 rounded-2xl ${preset.iconBg} flex items-center justify-center shadow-xs shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                    Manual Trigger
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors">
                  {preset.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{preset.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Bunyikan Sekarang</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {preset.chime}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Broadcast Box */}
      <form onSubmit={handleTriggerCustom} className="bg-slate-50/80 border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold text-slate-900">Siaran Bel Custom / Pengumuman Khusus</h3>
        </div>

        <p className="text-xs text-slate-500">
          Ketik kalimat bebas di bawah ini. Sistem akan membunyikan nada chime lalu membacakan pesan tersebut ke speaker sekolah secara langsung:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-6 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700">
                Pesan Siaran Pengumuman:
              </label>

              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                <select
                  value={customLanguage}
                  onChange={(e) => {
                    setCustomLanguage(e.target.value as SpeechLanguage);
                    setCustomInputMode('auto_translate');
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 cursor-pointer focus:outline-hidden focus:border-blue-500"
                >
                  <option value="id">🇮🇩 Bahasa Indonesia</option>
                  <option value="ar">🇸🇦 Bahasa Arab (AI)</option>
                  <option value="en">🇬🇧 Bahasa Inggris (AI)</option>
                  <option value="jv">🇮🇩 Bahasa Jawa (AI)</option>
                </select>
              </div>
            </div>

            {customLanguage !== 'id' && (
              <div className="flex flex-wrap items-center justify-between gap-1.5 bg-indigo-50/70 border border-indigo-200 rounded-xl px-2.5 py-1.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCustomInputMode('auto_translate')}
                    className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                      customInputMode === 'auto_translate'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    Tulis Indonesia (AI Translate)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomInputMode('direct_text')}
                    className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                      customInputMode === 'direct_text'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    Tulis Teks Sendiri
                  </button>
                </div>

                {customInputMode === 'auto_translate' && (
                  <button
                    type="button"
                    onClick={handleTranslateCustomPreview}
                    disabled={!customText.trim() || isTranslating}
                    className="px-2 py-0.5 rounded-md bg-white border border-indigo-300 text-indigo-700 font-bold flex items-center gap-1 hover:bg-indigo-100 cursor-pointer disabled:opacity-50"
                  >
                    {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>Pratinjau Terjemahan</span>
                  </button>
                )}
              </div>
            )}

            <textarea
              rows={3}
              required
              dir={customLanguage === 'ar' && customInputMode === 'direct_text' ? 'rtl' : 'ltr'}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder={
                customLanguage === 'id'
                  ? 'Contoh: Diberitahukan kepada perwakilan ketua kelas 5B untuk berkumpul di ruang guru...'
                  : customInputMode === 'auto_translate'
                  ? 'Tulis kalimat Bahasa Indonesia, nanti AI otomatis menerjemahkan & membacakannya...'
                  : customLanguage === 'ar'
                  ? 'Tulis teks Bahasa Arab di sini...'
                  : customLanguage === 'en'
                  ? 'Write English announcement text here...'
                  : 'Tulis ukara Basa Jawa ing mriki...'
              }
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-6 space-y-3 flex flex-col justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-blue-700 block mb-1">
                  1. Nada Pembuka (Intro):
                </label>
                <select
                  value={customChime}
                  onChange={(e) => setCustomChime(e.target.value as ChimeType)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 cursor-pointer font-medium"
                >
                  {(audioSettings.customChimes && audioSettings.customChimes.length > 0) && (
                    <optgroup label="✨ Nada Dering Kustom">
                      {audioSettings.customChimes.map((c) => (
                        <option key={c.id} value={c.id}>
                          ✨ {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="🔔 Nada Sintesis">
                    <option value="westminster">Westminster Chime (6.8s)</option>
                    <option value="classic_3tone">6-Tone Melodi (5.8s)</option>
                    <option value="school_dismissal">Melodi Pulang Ceria (6.2s)</option>
                    <option value="electric_bell">Bel Listrik Kencang (10s)</option>
                    <option value="fire_bell">Bel Alarm Pemadam (10s)</option>
                    <option value="tube_chime">Tube Chime Lembut (5.8s)</option>
                    <option value="islamic_duo">Islamic Duo Chime (6.2s)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-amber-700 block mb-1">
                  3. Nada Penutup (Outro):
                </label>
                <select
                  value={customOutroChime}
                  onChange={(e) => setCustomOutroChime(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 cursor-pointer font-medium"
                >
                  <option value="same_as_intro">🔄 Sama Nada Pembuka</option>
                  <option value="none">🚫 Tanpa Penutup</option>
                  <optgroup label="🔔 Nada Sintesis">
                    <option value="classic_3tone">6-Tone Melodi (5.8s)</option>
                    <option value="school_dismissal">Melodi Pulang Ceria (6.2s)</option>
                    <option value="electric_bell">Bel Listrik Kencang (10s)</option>
                    <option value="fire_bell">Bel Alarm Pemadam (10s)</option>
                    <option value="tube_chime">Tube Chime Soft (5.8s)</option>
                    <option value="westminster">Westminster Chime (6.8s)</option>
                    <option value="islamic_duo">Islamic Duo (6.2s)</option>
                  </optgroup>
                  {(audioSettings.customChimes && audioSettings.customChimes.length > 0) && (
                    <optgroup label="✨ Nada Kustom">
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

            <button
              type="submit"
              disabled={isPlaying || !customText.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 text-xs transition-all active:scale-95 cursor-pointer"
            >
              <Megaphone className="w-4 h-4" />
              <span>{isPlaying ? 'Sedang Menyiarkan Bel...' : 'Siarkan Pengumuman Lengkap'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
