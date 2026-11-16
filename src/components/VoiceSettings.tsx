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
  Globe,
  Cloud,
  ExternalLink,
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
        const useValidLocalVoice = settings.voiceURI && voices.some((v) => v.voiceURI === settings.voiceURI);
        await speakTTS(
          testText,
          settings,
          useValidLocalVoice ? undefined : (settings.useClonedVoice ? settings.activeClonedVoiceId : 'Fenrir'),
          !useValidLocalVoice
        );
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
    <div className="bg-white border border-blue-100 rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-blue-600" />
            <span>Pengaturan Suara & Rekaman Sendiri</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Sesuaikan kalimat awalan pengumuman, rekam suara asli Anda via mikrofon, atau pilih aksen TTS Bahasa Indonesia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestVoice}
            disabled={testing}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
          >
            {testing ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 p-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
            title="Reset Pengaturan Suara ke Default"
          >
            <RotateCcw className="w-4 h-4 text-amber-500" />
          </button>
        </div>
      </div>

      {/* AI Voice Cloning Section */}
      <AudioCloningManager settings={settings} onUpdateSettings={onUpdateSettings} />

      {/* Global Custom Voice Recording Box */}
      <div className="bg-slate-50 border border-blue-200/80 p-6 rounded-3xl space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-blue-600" />
              <span>Perekam Suara Awalan Bel (Custom Audio Prefix)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Anda bisa mengganti ucapan awalan otomatis dengan rekaman suara asli Anda sendiri (misal: "Perhatian kepada seluruh siswa SD Qur'an Unggulan...").
            </p>
          </div>

          <label className="flex items-center gap-2 bg-white border border-slate-300 px-3.5 py-2 rounded-xl cursor-pointer shrink-0 shadow-xs">
            <input
              type="checkbox"
              checked={!!settings.useCustomPrefixAudio}
              onChange={(e) =>
                onUpdateSettings({ ...settings, useCustomPrefixAudio: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-800">Gunakan Suara Rekaman Ini</span>
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
          cloudinaryConfig={{
            cloudName: settings.cloudinaryCloudName,
            uploadPreset: settings.cloudinaryUploadPreset,
          }}
        />
      </div>

      {/* Global Prefix Sentence Box */}
      <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
        <label className="text-xs font-extrabold text-blue-700 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Kalimat Awalan Teks Speech (Global Prefix TTS)</span>
        </label>
        <p className="text-xs text-slate-500">
          Kalimat di bawah ini diucapkan jika tidak menggunakan rekaman suara langsung:
        </p>
        <input
          type="text"
          value={settings.globalPrefix}
          onChange={(e) => onUpdateSettings({ ...settings, globalPrefix: e.target.value })}
          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
        />
      </div>

      {/* Grid Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Voice Selection Dropdown */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Mic className="w-4 h-4 text-blue-600" />
            <span>Pilihan Suara Pembaca TTS (Khusus Pria / Laki-laki)</span>
          </label>

          <select
            value={voices.some((v) => v.voiceURI === settings.voiceURI) ? settings.voiceURI : ''}
            onChange={(e) => onUpdateSettings({ ...settings, voiceURI: e.target.value })}
            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:border-blue-500 cursor-pointer"
          >
            <option value="">-- 👨 Suara Otomatis Pria Indonesia (AI Manusia) --</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                👨 {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-500 block">
            Suara telah disetel khusus vokal laki-laki/pria (Ustadz & Santri) dengan intonasi mantap dan tegas.
          </span>
        </div>

        {/* Volume Controls */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-blue-600" />
            <span>Volume Nada Chime & Speech</span>
          </label>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Volume Nada Chime:</span>
                <span className="text-blue-700 font-mono">{Math.round(settings.chimeVolume * 100)}%</span>
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
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Volume Ucapan TTS:</span>
                <span className="text-blue-700 font-mono">{Math.round(settings.volume * 100)}%</span>
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
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Speed & Pitch Controls */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Kecepatan & Nada Bicara
          </label>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Kecepatan Bicara (Rate):</span>
                <span className="text-blue-700 font-mono">{settings.rate}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={settings.rate}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, rate: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Tinggi Nada Suara (Pitch):</span>
                <span className="text-blue-700 font-mono">{settings.pitch}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={settings.pitch}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, pitch: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Repeat Speech Controls */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Pengulangan Ucapan Bel (Repeat)
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, repeatSpeechCount: 1 })}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                settings.repeatSpeechCount === 1
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Ucapkan 1 Kali
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, repeatSpeechCount: 2 })}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                settings.repeatSpeechCount === 2
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Ucapkan 2 Kali (Repeat)
            </button>
          </div>
        </div>
      </div>

      {/* Global Outro Chime Settings */}
      <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Nada Penutup Pengumuman (Global Outro Chime)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bunyikan nada penutup otomatis setelah pengumuman suara selesai.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={!!settings.enableGlobalOutroChime}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  enableGlobalOutroChime: e.target.checked,
                  globalOutroChimeType: settings.globalOutroChimeType || 'classic_3tone',
                })
              }
              className="w-5 h-5 accent-blue-600 cursor-pointer"
            />
            <span className="ml-2 text-xs font-bold text-slate-800">
              {settings.enableGlobalOutroChime ? 'Aktif' : 'Nonaktif'}
            </span>
          </label>
        </div>

        {settings.enableGlobalOutroChime && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="same_as_intro">🔄 Sama dengan Nada Pembuka</option>
                <option value="classic_3tone">🔔 6-Tone Ascending Melodi (5.8s)</option>
                <option value="school_dismissal">🔔 Melodi Pulang Ceria (6.2s)</option>
                <option value="electric_bell">🔔 Bel Listrik Kencang (10s - 3x Dering)</option>
                <option value="fire_bell">🔔 Bel Alarm Pemadam / Gong (10s)</option>
                <option value="westminster">🔔 Westminster 8-Tone (6.8s)</option>
                <option value="tube_chime">🔔 Tube Chime Soft (5.8s)</option>
                <option value="islamic_duo">🔔 Islamic Duo Chime (6.2s)</option>
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
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                <span>Jeda Waktu Sebelum Nada Penutup:</span>
                <span className="text-blue-700 font-mono">
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
                className="w-full accent-blue-600 cursor-pointer mt-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Penyimpanan Cloud Online (Multi-Perangkat / GitHub & Vercel) */}
      <div className="bg-gradient-to-br from-blue-50/80 via-white to-sky-50/70 border border-blue-200 p-6 rounded-3xl space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-600" />
              <span>Upload Audio ke Cloud Online (Sinkron Semua HP & Laptop)</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Agar hasil upload suara VO, nada depan, dan nada penutup otomatis tersimpan online &amp; bisa diputar di perangkat mana saja saat di-deploy ke Vercel.
            </p>
          </div>

          <span
            className={`text-[11px] font-bold px-3 py-1 rounded-full border shrink-0 flex items-center gap-1.5 ${
              settings.cloudinaryCloudName
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{settings.cloudinaryCloudName ? 'Cloud Upload Aktif' : 'Mode Link / Lokal'}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Cloudinary Cloud Name (Gratis)
            </label>
            <input
              type="text"
              placeholder="misal: dxyz123abc"
              value={settings.cloudinaryCloudName || ''}
              onChange={(e) =>
                onUpdateSettings({ ...settings, cloudinaryCloudName: e.target.value.trim() })
              }
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Unsigned Upload Preset
            </label>
            <input
              type="text"
              placeholder="misal: bel_sekolah"
              value={settings.cloudinaryUploadPreset || ''}
              onChange={(e) =>
                onUpdateSettings({ ...settings, cloudinaryUploadPreset: e.target.value.trim() })
              }
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>

        <div className="bg-white/90 border border-blue-100 rounded-2xl p-3.5 text-xs text-slate-600 space-y-1.5">
          <div className="font-bold text-slate-800 flex items-center justify-between">
            <span>Cara Praktis Aktifkan Upload Langsung ke Cloud (2 Menit):</span>
            <a
              href="https://cloudinary.com/users/register_free"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 underline"
            >
              <span>Daftar Cloudinary Gratis</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
            <li>Buat akun gratis di Cloudinary, salin <strong>Cloud Name</strong> dari Dashboard lalu tempel di kolom kiri.</li>
            <li>Buka menu <strong>Settings &gt; Upload &gt; Upload presets</strong>, buat preset mode <strong>Unsigned</strong> (misal: <code>bel_sekolah</code>) dan isi di kolom kanan.</li>
            <li>Selesai! Setiap Anda upload file rekaman atau rekam mic di <strong>Nada Dering Bel</strong> / <strong>Edit Jadwal VO</strong>, file otomatis tersimpan online. Anda juga tetap bisa memakai fitur <strong>Link Cloud (Google Drive / Dropbox)</strong> tanpa akun tambahan.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
