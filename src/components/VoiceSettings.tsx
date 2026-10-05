import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Volume2,
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Mic,
  Radio,
} from 'lucide-react';
import { AudioSettings } from '../types';
import { getAvailableVoices, speakTTS, playChimeTone, playCustomAudio } from '../utils/audioSynth';
import { AudioRecorder } from './AudioRecorder';
import { AudioCloningManager } from './AudioCloningManager';

interface VoiceSettingsProps {
  settings: AudioSettings;
  onUpdateSettings: (newSettings: AudioSettings) => void;
  onResetSettings: () => void;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      const avail = getAvailableVoices();
      setVoices(avail);
    };

    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleTestVoice = async () => {
    setTesting(true);
    try {
      await playChimeTone('westminster', settings.chimeVolume, settings.customChimes);
      await new Promise((res) => setTimeout(res, 350));

      if (settings.useCustomPrefixAudio && settings.customPrefixAudioUrl) {
        await playCustomAudio(settings.customPrefixAudioUrl, settings.volume);
      } else {
        const testText = `${settings.globalPrefix}memasuki jam pelajaran ke-1, Tahfidzul Qur'an. Uji coba suara berhasil.`;
        await speakTTS(testText, settings);
      }

      // If outro chime is enabled
      if (settings.enableGlobalOutroChime) {
        await new Promise((res) => setTimeout(res, settings.outroChimeDelayMs || 500));
        const outroType = settings.globalOutroChimeType === 'same_as_intro'
          ? 'westminster'
          : settings.globalOutroChimeType || 'classic_3tone';
        await playChimeTone(outroType, settings.chimeVolume, settings.customChimes, settings.globalOutroChimeUrl);
      }
    } catch (err) {
      console.error('Test voice error:', err);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-emerald-400" />
            <span>Pengaturan Suara & Rekaman Sendiri</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Sesuaikan kalimat awalan pengumuman, rekam suara asli Anda via mikrofon, atau pilih aksen TTS Bahasa Indonesia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestVoice}
            disabled={testing}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
          >
            {testing ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                Memutar Tes...
              </span>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Tes Suara Lengkap</span>
              </>
            )}
          </button>

          <button
            onClick={onResetSettings}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 p-2.5 rounded-xl transition-all cursor-pointer"
            title="Reset Pengaturan Suara ke Default"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* AI Voice Cloning Section */}
      <AudioCloningManager settings={settings} onUpdateSettings={onUpdateSettings} />

      {/* Global Custom Voice Recording Box */}
      <div className="bg-slate-950 border border-emerald-500/30 p-6 rounded-3xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-400" />
              <span>Perekam Suara Awalan Bel (Custom Audio Prefix)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Anda bisa mengganti ucapan awalan otomatis dengan rekaman suara asli Anda sendiri (misal: "Perhatian kepada seluruh siswa SD Qur'an Unggulan...").
            </p>
          </div>

          <label className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={!!settings.useCustomPrefixAudio}
              onChange={(e) =>
                onUpdateSettings({ ...settings, useCustomPrefixAudio: e.target.checked })
              }
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-emerald-300">Gunakan Suara Rekaman Ini</span>
          </label>
        </div>

        <AudioRecorder
          currentAudioUrl={settings.customPrefixAudioUrl}
          currentAudioName={settings.customPrefixAudioName}
          onAudioChange={(url, name) =>
            onUpdateSettings({
              ...settings,
              customPrefixAudioUrl: url,
              customPrefixAudioName: name,
              useCustomPrefixAudio: !!url,
            })
          }
          title="Rekam Awalan Pembuka Bel"
          description="Rekam suara dari mikrofon Anda atau unggah file rekaman suara dari HP Android (AAC/M4A), MP3, atau WAV sebagai ucapan pembuka bel."
        />
      </div>

      {/* Global Prefix Sentence Box */}
      <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
        <label className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Kalimat Awalan Teks Speech (Global Prefix TTS)</span>
        </label>
        <p className="text-xs text-slate-400">
          Kalimat di bawah ini diucapkan jika tidak menggunakan rekaman suara langsung:
        </p>
        <input
          type="text"
          value={settings.globalPrefix}
          onChange={(e) => onUpdateSettings({ ...settings, globalPrefix: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-emerald-300 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Grid Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Voice Selection Dropdown */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
          <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Mic className="w-4 h-4 text-emerald-400" />
            <span>Pilihan Akses Suara Pembaca (TTS Voice)</span>
          </label>

          <select
            value={settings.voiceURI}
            onChange={(e) => onUpdateSettings({ ...settings, voiceURI: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">-- Suara Otomatis Indonesia (Sistem) --</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-500 block">
            Rekomendasi: Pilih suara berlabel "Indonesian / id-ID" untuk pelafalan Bahasa Indonesia yang jernih.
          </span>
        </div>

        {/* Volume Controls */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
          <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>Volume Nada Chime & Speech</span>
          </label>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>Volume Nada Chime:</span>
                <span className="text-emerald-400">{Math.round(settings.chimeVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.chimeVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, chimeVolume: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>Volume Ucapan TTS:</span>
                <span className="text-emerald-400">{Math.round(settings.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, volume: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Speed & Pitch Controls */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
          <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
            Kecepatan & Nada Bicara
          </label>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>Kecepatan Bicara (Rate):</span>
                <span className="text-cyan-400">{settings.rate}x</span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.4}
                step={0.05}
                value={settings.rate}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, rate: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>Nada Tinggi/Rendah (Pitch):</span>
                <span className="text-cyan-400">{settings.pitch}x</span>
              </div>
              <input
                type="range"
                min={0.7}
                max={1.3}
                step={0.05}
                value={settings.pitch}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, pitch: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Repeat & Enable TTS Toggle */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
          <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
            Opsi Pengulangan & Pengaktifan
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Aktifkan Suara Ucapan TTS</span>
              <input
                type="checkbox"
                checked={settings.enableTTS}
                onChange={(e) => onUpdateSettings({ ...settings, enableTTS: e.target.checked })}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Ulangi Ucapan Pesan</span>
              <select
                value={settings.repeatSpeechCount}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, repeatSpeechCount: Number(e.target.value) })
                }
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-400 cursor-pointer"
              >
                <option value={1}>1 Kali Ucapan</option>
                <option value={2}>2 Kali Pengulangan</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-900 text-[11px] text-slate-500">
            Setiap bel otomatis berbunyi, nada chime dimainkan terlebih dahulu lalu disusul ucapan pesan.
          </div>
        </div>
      </div>

      {/* Global Outro Chime Card */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <h3 className="text-base font-extrabold text-white">
                Nada Dering Penutup Otomatis (Outro Chime setelah Rekaman VO)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Membunyikan nada lonceng/chime kembali setelah suara rekaman atau pengumuman selesai berbicara.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={settings.enableGlobalOutroChime ?? false}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  enableGlobalOutroChime: e.target.checked,
                  globalOutroChimeType: settings.globalOutroChimeType || 'classic_3tone',
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            <span className="ml-3 text-xs font-bold text-slate-200">
              {settings.enableGlobalOutroChime ? 'Aktif' : 'Nonaktif'}
            </span>
          </label>
        </div>

        {/* Visual Workflow */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
          <div className="flex-1 text-center bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2">
            <span className="text-[10px] text-emerald-400 font-bold block">1. Nada Pembuka</span>
            <span className="text-white font-extrabold text-xs">Intro Chime</span>
          </div>
          <span className="text-slate-500 font-bold">➜</span>
          <div className="flex-1 text-center bg-cyan-950/40 border border-cyan-500/30 rounded-lg p-2">
            <span className="text-[10px] text-cyan-400 font-bold block">2. Suara / Rekaman</span>
            <span className="text-white font-extrabold text-xs">Pengumuman VO</span>
          </div>
          <span className="text-slate-500 font-bold">➜</span>
          <div className={`flex-1 text-center rounded-lg p-2 border transition-all ${
            settings.enableGlobalOutroChime
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            <span className={`text-[10px] font-bold block ${settings.enableGlobalOutroChime ? 'text-amber-400' : 'text-slate-500'}`}>
              3. Nada Penutup
            </span>
            <span className="font-extrabold text-xs">
              {settings.enableGlobalOutroChime ? 'Outro Chime' : 'Langsung Selesai'}
            </span>
          </div>
        </div>

        {settings.enableGlobalOutroChime && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Pilihan Nada Penutup (Outro Chime)
              </label>
              <select
                value={settings.globalOutroChimeType || 'classic_3tone'}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    globalOutroChimeType: e.target.value as any,
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="same_as_intro">🔄 Sama dengan Nada Pembuka (Westminster/Kustom)</option>
                <option value="classic_3tone">🔔 Classic 3-Tone Ascending (Do-Mi-Sol)</option>
                <option value="tube_chime">🔔 Tube Chime Soft (Melodik Halus)</option>
                <option value="westminster">🔔 Westminster 4-Tone</option>
                <option value="islamic_duo">🔔 Islamic Duo Chime (Syahdu Tenang)</option>
                <option value="electric_bell">🔔 Electric Bell Ring</option>
                {(settings.customChimes && settings.customChimes.length > 0) && (
                  <optgroup label="✨ Nada Dering Kustom Buatan Anda">
                    {settings.customChimes.map((c) => (
                      <option key={c.id} value={c.id}>
                        ✨ {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
                <span>Jeda Waktu Sebelum Nada Penutup:</span>
                <span className="text-amber-400 font-mono">
                  {settings.outroChimeDelayMs ?? 500} ms ({( (settings.outroChimeDelayMs ?? 500) / 1000 ).toFixed(1)} detik)
                </span>
              </div>
              <input
                type="range"
                min={200}
                max={1500}
                step={50}
                value={settings.outroChimeDelayMs ?? 500}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    outroChimeDelayMs: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-amber-500 cursor-pointer mt-1"
              />
              <span className="text-[10px] text-slate-500 block mt-1">
                Waktu hening sejenak setelah suara rekaman berhenti sebelum nada penutup berbunyi.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
