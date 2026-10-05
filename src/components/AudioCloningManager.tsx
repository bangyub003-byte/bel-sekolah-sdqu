import React, { useState } from 'react';
import {
  Sparkles,
  Mic,
  Plus,
  CheckCircle2,
  Trash2,
  Play,
  Volume2,
  Sliders,
  Radio,
  X,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import { AudioSettings, ClonedVoiceProfile } from '../types';
import { AudioRecorder } from './AudioRecorder';
import { generateClonedTTSAudio, playCustomAudio } from '../utils/audioSynth';

interface AudioCloningManagerProps {
  settings: AudioSettings;
  onUpdateSettings: (newSettings: AudioSettings) => void;
}

export const AudioCloningManager: React.FC<AudioCloningManagerProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileDesc, setProfileDesc] = useState('');
  const [sampleAudioUrl, setSampleAudioUrl] = useState<string | undefined>(undefined);
  const [sampleAudioName, setSampleAudioName] = useState<string | undefined>(undefined);
  const [fallbackVoice, setFallbackVoice] = useState<'Kore' | 'Puck' | 'Fenrir' | 'Zephyr' | 'Aoede'>('Kore');

  // Test state
  const [testText, setTestText] = useState(
    "Assalamu'alaikum, ini adalah uji coba suara kloningan AI untuk bel sekolah SD Qur'an Unggulan."
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const profiles = settings.clonedProfiles || [];
  const activeProfileId = settings.activeClonedVoiceId;

  // Save new voice profile
  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    const newProfile: ClonedVoiceProfile = {
      id: `clone_${Date.now()}`,
      name: profileName.trim(),
      description: profileDesc.trim() || undefined,
      sampleAudioUrl,
      sampleAudioName,
      createdAt: Date.now(),
      prebuiltVoiceFallback: fallbackVoice,
    };

    const updatedProfiles = [newProfile, ...profiles];
    onUpdateSettings({
      ...settings,
      clonedProfiles: updatedProfiles,
      activeClonedVoiceId: activeProfileId || newProfile.id,
      useClonedVoice: true,
    });

    // Reset form
    setProfileName('');
    setProfileDesc('');
    setSampleAudioUrl(undefined);
    setSampleAudioName(undefined);
    setIsModalOpen(false);
  };

  // Activate Profile
  const handleSelectActiveProfile = (id: string) => {
    onUpdateSettings({
      ...settings,
      activeClonedVoiceId: id,
      useClonedVoice: true,
    });
  };

  // Toggle Use Cloned Voice
  const handleToggleClonedVoice = (enabled: boolean) => {
    onUpdateSettings({
      ...settings,
      useClonedVoice: enabled,
    });
  };

  // Delete Profile
  const handleDeleteProfile = (id: string) => {
    const updated = profiles.filter((p) => p.id !== id);
    const newActive = activeProfileId === id ? updated[0]?.id : activeProfileId;

    onUpdateSettings({
      ...settings,
      clonedProfiles: updated,
      activeClonedVoiceId: newActive,
      useClonedVoice: updated.length > 0 ? settings.useClonedVoice : false,
    });
  };

  // Test Voice Cloning with AI Gemini
  const handleTestClone = async (sampleUrl?: string, fallback = 'Kore', name = '') => {
    setIsTesting(true);
    setTestError(null);

    try {
      const audioUrl = await generateClonedTTSAudio(
        testText,
        sampleUrl,
        fallback,
        name || 'Uji coba kloning suara'
      );

      if (audioUrl) {
        await playCustomAudio(audioUrl, settings.volume || 1.0);
      } else {
        setTestError('Gagal menghasilkan suara kloningan AI. Pastikan server terhubung.');
      }
    } catch (err: any) {
      console.error('Test clone error:', err);
      setTestError('Terjadi kesalahan saat memproses kloning suara AI.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-slate-950 border border-emerald-500/30 p-6 rounded-3xl space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400 fill-current" />
              Fitur AI Voice Cloning
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2 mt-1.5">
            <Wand2 className="w-5 h-5 text-emerald-400" />
            <span>Kloning Suara & Profil Pembaca TTS Custom</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Rekam suara asli Anda (misal: Guru, Kepala Sekolah, Ustadz) lalu AI Gemini akan menirukan gaya vokal Anda untuk membaca semua jadwal pesan bel sekolah.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3.5 py-2 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={!!settings.useClonedVoice && profiles.length > 0}
              disabled={profiles.length === 0}
              onChange={(e) => handleToggleClonedVoice(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 cursor-pointer disabled:opacity-50"
            />
            <span className="text-xs font-bold text-emerald-300">
              {settings.useClonedVoice ? 'Suara Kloning Aktif' : 'Aktifkan Suara Kloning'}
            </span>
          </label>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Kloning Suara Baru</span>
          </button>
        </div>
      </div>

      {/* Profiles List */}
      {profiles.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Belum Ada Profil Suara Kloning</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Buat profil kloning suara pertama Anda dengan merekam suara 5-10 detik melalui mikrofon atau unggah file rekaman dari HP Android (AAC/M4A) atau MP3.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Mulai Kloning Suara Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((profile) => {
            const isActive = activeProfileId === profile.id && settings.useClonedVoice;

            return (
              <div
                key={profile.id}
                className={`p-5 rounded-2xl border transition-all space-y-3 relative ${
                  isActive
                    ? 'bg-emerald-950/20 border-emerald-500 text-white ring-1 ring-emerald-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-white">{profile.name}</h4>
                      {isActive && (
                        <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Utama Aktif
                        </span>
                      )}
                    </div>
                    {profile.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{profile.description}</p>
                    )}
                    <p className="text-[10px] font-mono text-emerald-400 mt-1">
                      Karakter Vokal AI: {profile.prebuiltVoiceFallback || 'Kore'} •{' '}
                      {profile.sampleAudioUrl ? 'Menggunakan Sampel Rekaman' : 'Preset AI'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(profile.id)}
                    className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Hapus Profil Suara"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Profile Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={() =>
                      handleTestClone(
                        profile.sampleAudioUrl,
                        profile.prebuiltVoiceFallback,
                        profile.name
                      )
                    }
                    className="bg-slate-800 hover:bg-slate-700 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isTesting ? 'Memproses AI...' : 'Tes Dengar Suara'}</span>
                  </button>

                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => handleSelectActiveProfile(profile.id)}
                      className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Pilih Suara Ini
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Global Quick Test Input */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <label className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
          Pratinjau Kloning Suara AI (Ketik Kalimat Tes)
        </label>

        {testError && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{testError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Ketik kalimat ucapan bel yang ingin dicoba..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            disabled={isTesting || profiles.length === 0}
            onClick={() => {
              const active = profiles.find((p) => p.id === activeProfileId) || profiles[0];
              if (active) {
                handleTestClone(
                  active.sampleAudioUrl,
                  active.prebuiltVoiceFallback,
                  active.name
                );
              }
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isTesting ? 'Sintesis AI...' : 'Putar Suara AI Kloning'}</span>
          </button>
        </div>
      </div>

      {/* Modal Form to Create Cloned Voice */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Mic className="w-5 h-5 text-emerald-400" />
                  <span>Tambah Profil Kloning Suara Baru</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rekam atau unggah sampel vokal untuk melatih karakter suara AI Gemini.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nama Pemilik Suara / Jabatan *
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="misal: Suara Ustadz H. Ahmad / Kepala Sekolah"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Deskripsi / Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={profileDesc}
                  onChange={(e) => setProfileDesc(e.target.value)}
                  placeholder="misal: Suara pria dewasa berwibawa, intonasi ramah Islami"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Sample Audio Recorder Component */}
              <AudioRecorder
                currentAudioUrl={sampleAudioUrl}
                currentAudioName={sampleAudioName}
                onAudioChange={(url, name) => {
                  setSampleAudioUrl(url);
                  setSampleAudioName(name);
                }}
                title="1. Rekam Sampel Suara Anda (Minimal 5 Detik)"
                description="Bacakan kalimat contoh ini ke mikrofon: 'Assalamu'alaikum warahmatullah, selamat pagi anak-anak SD Qur'an Unggulan.'"
              />

              {/* Fallback Prebuilt Voice Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  2. Pilih Karakter dasar AI Voice
                </label>
                <select
                  value={fallbackVoice}
                  onChange={(e) => setFallbackVoice(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="Kore">Kore - Suara Pria Berwibawa & Hangat</option>
                  <option value="Zephyr">Zephyr - Suara Wanita Ramah & Jelas</option>
                  <option value="Puck">Puck - Suara Pria Energik & Ceria</option>
                  <option value="Fenrir">Fenrir - Suara Pria Dalam & Resmi</option>
                  <option value="Aoede">Aoede - Suara Wanita Lembut & Tenang</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Simpan Profil Kloning</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
