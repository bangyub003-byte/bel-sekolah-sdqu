import React, { useState } from 'react';
import {
  BellRing,
  Coffee,
  HeartHandshake,
  DoorOpen,
  AlertTriangle,
  Megaphone,
  Play,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { ChimeType, AudioSettings } from '../types';
import { playBellSequence } from '../utils/audioSynth';

interface ManualBellPadProps {
  audioSettings: AudioSettings;
  onLogManualBell: (label: string, speechText: string) => void;
}

export const ManualBellPad: React.FC<ManualBellPadProps> = ({
  audioSettings,
  onLogManualBell,
}) => {
  const [customText, setCustomText] = useState('');
  const [customChime, setCustomChime] = useState<ChimeType>('westminster');
  const [customOutroChime, setCustomOutroChime] = useState<ChimeType | 'none' | 'same_as_intro'>('same_as_intro');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const manualPresets = [
    {
      id: 'p-masuk',
      title: 'Bel Masuk Kelas',
      desc: 'Pengumuman masuk ke dalam kelas',
      chime: 'westminster' as ChimeType,
      outroChime: 'classic_3tone' as ChimeType,
      speechText: 'memasuki jam pelajaran. Seluruh murid diharapkan segera masuk ke dalam kelas masing-masing.',
      icon: BellRing,
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/20',
      border: 'border-emerald-500/40',
    },
    {
      id: 'p-istirahat',
      title: 'Bel Waktu Istirahat',
      desc: 'Pengumuman jam istirahat siswa',
      chime: 'tube_chime' as ChimeType,
      outroChime: 'tube_chime' as ChimeType,
      speechText: 'memasuki waktu istirahat. Selamat beristirahat dan tetap menjaga kebersihan lingkungan sekolah.',
      icon: Coffee,
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/20',
      border: 'border-amber-500/40',
    },
    {
      id: 'p-sholat',
      title: 'Bel Sholat / Ibadah',
      desc: 'Panggilan persiapan Sholat Dzuhur',
      chime: 'islamic_duo' as ChimeType,
      outroChime: 'islamic_duo' as ChimeType,
      speechText: 'memasuki waktu persiapan Sholat Dzuhur Berjamaah. Mari bersiap menuju tempat ibadah.',
      icon: HeartHandshake,
      gradient: 'from-indigo-500 to-purple-600',
      shadow: 'shadow-indigo-500/20',
      border: 'border-indigo-500/40',
    },
    {
      id: 'p-pulang',
      title: 'Bel Pulang Sekolah',
      desc: 'Pengumuman jam selesai pelajaran',
      chime: 'tube_chime' as ChimeType,
      outroChime: 'classic_3tone' as ChimeType,
      speechText: 'kegiatan belajar mengajar hari ini telah selesai. Selamat jalan dan hati-hati di jalan.',
      icon: DoorOpen,
      gradient: 'from-cyan-500 to-blue-600',
      shadow: 'shadow-cyan-500/20',
      border: 'border-cyan-500/40',
    },
    {
      id: 'p-darurat',
      title: 'Bel Darurat / Peringatan',
      desc: 'Alarm peringatan darurat sekolah',
      chime: 'electric_bell' as ChimeType,
      outroChime: 'electric_bell' as ChimeType,
      speechText: 'perhatian seluruh warga sekolah, mohon bersiap untuk kegiatan evakuasi atau pengumuman darurat.',
      icon: AlertTriangle,
      gradient: 'from-rose-500 to-red-600',
      shadow: 'shadow-rose-500/20',
      border: 'border-rose-500/40',
    },
  ];

  const handleTriggerPreset = async (preset: typeof manualPresets[0]) => {
    if (isPlaying) return;
    setIsPlaying(true);
    setActivePresetId(preset.id);

    const fullText = `${audioSettings.globalPrefix}${preset.speechText}`;

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
        preset.outroChime || 'same_as_intro'
      );
      onLogManualBell(`Bel Manual: ${preset.title}`, fullText);
    } catch (err) {
      console.error('Trigger manual bell error:', err);
    } finally {
      setIsPlaying(false);
      setActivePresetId(null);
    }
  };

  const handleTriggerCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim() || isPlaying) return;

    setIsPlaying(true);
    setActivePresetId('custom');

    const fullText = `${audioSettings.globalPrefix}${customText.trim()}`;

    try {
      await playBellSequence(
        customChime,
        fullText,
        audioSettings,
        1.0,
        undefined,
        'tts',
        undefined,
        undefined,
        customOutroChime !== 'none',
        customOutroChime
      );
      onLogManualBell('Bel Manual Custom Pengumuman', fullText);
      setCustomText('');
    } catch (err) {
      console.error('Trigger custom bell error:', err);
    } finally {
      setIsPlaying(false);
      setActivePresetId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <BellRing className="w-6 h-6 text-emerald-400" />
            <span>Pad Bel Manual Seketika (Instant Manual Bell)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tekan tombol preset di bawah ini untuk membunyikan bel secara manual kapan saja tanpa menunggu jadwal jam.
          </p>
        </div>

        {isPlaying && (
          <div className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span>Sedang Membunyikan Bel Manual...</span>
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
              className={`group bg-slate-950 border ${preset.border} rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-95 cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                isThisPlaying ? 'ring-2 ring-emerald-400 bg-slate-900' : 'hover:bg-slate-900/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${preset.gradient} text-slate-950 flex items-center justify-center shadow-lg ${preset.shadow} shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded font-mono">
                    Manual Trigger
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                  {preset.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1">{preset.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Bunyikan Sekarang</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {preset.chime}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Broadcast Box */}
      <form onSubmit={handleTriggerCustom} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">Siaran Bel Custom / Pengumuman Khusus</h3>
        </div>

        <p className="text-xs text-slate-400">
          Ketik kalimat bebas di bawah ini. Sistem akan membunyikan nada chime lalu membacakan pesan tersebut ke speaker sekolah secara langsung:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-6 space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Pesan Siaran Pengumuman:
            </label>
            <textarea
              rows={3}
              required
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Contoh: Diberitahukan kepada perwakilan ketua kelas 5B untuk berkumpul di ruang guru..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-6 space-y-3 flex flex-col justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-emerald-300 block mb-1">
                  1. Nada Pembuka (Intro):
                </label>
                <select
                  value={customChime}
                  onChange={(e) => setCustomChime(e.target.value as ChimeType)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
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
                    <option value="westminster">Westminster Chime</option>
                    <option value="classic_3tone">Classic 3-Tone</option>
                    <option value="electric_bell">Electric Bell</option>
                    <option value="tube_chime">Tube Chime</option>
                    <option value="islamic_duo">Islamic Duo</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-amber-300 block mb-1">
                  3. Nada Penutup (Outro):
                </label>
                <select
                  value={customOutroChime}
                  onChange={(e) => setCustomOutroChime(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="same_as_intro">🔄 Sama Nada Pembuka</option>
                  <option value="none">🚫 Tanpa Penutup</option>
                  <optgroup label="🔔 Nada Sintesis">
                    <option value="classic_3tone">Classic 3-Tone</option>
                    <option value="tube_chime">Tube Chime</option>
                    <option value="westminster">Westminster Chime</option>
                    <option value="islamic_duo">Islamic Duo</option>
                    <option value="electric_bell">Electric Bell</option>
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
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-slate-950 font-black py-2.5 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 text-xs transition-all active:scale-95 cursor-pointer"
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
