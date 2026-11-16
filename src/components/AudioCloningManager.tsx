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
  Info,
  HelpCircle,
} from 'lucide-react';
import { AudioSettings, ClonedVoiceProfile } from '../types';
import { AudioRecorder } from './AudioRecorder';
import {
  generateClonedTTSAudio,
  playCustomAudio,
  speakTTS,
  getIsAiTtsQuotaExceeded,
} from '../utils/audioSynth';

interface AudioCloningManagerProps {
  settings: AudioSettings;
  onUpdateSettings: (newSettings: AudioSettings) => void;
}

export const AudioCloningManager: React.FC<AudioCloningManagerProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showTutorialGuide, setShowTutorialGuide] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profileDesc, setProfileDesc] = useState('');
  const [sampleAudioUrl, setSampleAudioUrl] = useState<string | undefined>(undefined);
  const [sampleAudioName, setSampleAudioName] = useState<string | undefined>(undefined);
  const [fallbackVoice, setFallbackVoice] = useState<'Kore' | 'Puck' | 'Fenrir' | 'Zephyr' | 'Charon'>('Kore');

  const [playbackMode, setPlaybackMode] = useState<'direct_recording' | 'ai_synthesis'>('ai_synthesis');

  // Test state
  const [testText, setTestText] = useState(
    "Assalamu'alaikum, ini adalah uji coba suara untuk bel sekolah SD Qur'an Unggulan."
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
      playbackMode,
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
    setPlaybackMode('ai_synthesis');
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

  // Toggle Mode (AI Synthesis vs Direct Recording)
  const handleToggleProfileMode = (id: string) => {
    const updated = profiles.map((p) => {
      if (p.id === id) {
        const nextMode = p.playbackMode === 'ai_synthesis' ? 'direct_recording' : 'ai_synthesis';
        return { ...p, playbackMode: nextMode };
      }
      return p;
    });
    onUpdateSettings({
      ...settings,
      clonedProfiles: updated,
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

  // Test AI Speech Synthesis (Always reads announcement text)
  const handleTestAiSpeech = async (profile: ClonedVoiceProfile) => {
    setIsTesting(true);
    setTestError(null);

    try {
      const audioUrl = await generateClonedTTSAudio(
        testText,
        profile.sampleAudioUrl,
        profile.prebuiltVoiceFallback || 'Kore',
        profile.name || 'Uji coba suara'
      );

      if (audioUrl) {
        await playCustomAudio(audioUrl, settings.volume || 1.0);
      } else {
        await speakTTS(testText, { ...settings, enableTTS: true }, profile.prebuiltVoiceFallback || 'Kore', true);
      }
    } catch (_err) {
      await speakTTS(testText, { ...settings, enableTTS: true }, profile.prebuiltVoiceFallback || 'Kore', true);
    } finally {
      setIsTesting(false);
    }
  };

  // Play Raw Sample Audio (The recorded voice file)
  const handlePlaySampleAudio = async (url: string) => {
    try {
      await playCustomAudio(url, settings.volume || 1.0);
    } catch (_e) {}
  };

  return (
    <div className="bg-white border border-blue-100 p-6 sm:p-7 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-50 text-blue-700 text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Fitur AI Voice & Profil Suara
            </span>
            <button
              type="button"
              onClick={() => setShowFaqModal(true)}
              className="text-slate-500 hover:text-blue-600 text-xs flex items-center gap-1 underline cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Apakah AI bisa kloning 90%?</span>
            </button>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2 mt-1.5">
            <Wand2 className="w-5 h-5 text-blue-600" />
            <span>Kloning Suara & Profil Pembaca Suara Custom</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Gunakan profil suara vokal AI atau gunakan rekaman suara langsung untuk membacakan pesan bel sekolah.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={!!settings.useClonedVoice && profiles.length > 0}
              disabled={profiles.length === 0}
              onChange={(e) => handleToggleClonedVoice(e.target.checked)}
              className="w-4 h-4 accent-blue-600 cursor-pointer disabled:opacity-50"
            />
            <span className="text-xs font-bold text-slate-800">
              {settings.useClonedVoice ? 'Suara Kloning Aktif' : 'Aktifkan Suara Kloning'}
            </span>
          </label>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Kloning Suara Baru</span>
          </button>
        </div>
      </div>

      {getIsAiTtsQuotaExceeded() && (
        <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed space-y-1">
            <p className="font-bold">
              ℹ️ Info Kuota AI TTS: Batas harian Free Tier (10 panggilan/hari) sedang tercapai
            </p>
            <p className="text-amber-800">
              Sistem secara otomatis mengaktifkan mesin suara lokal browser & audio rekaman asli. <strong>Bel sekolah tetap berbunyi 100% lancar dan normal tanpa gangguan.</strong> Untuk suara yang 100% persis suara Anda tanpa batasan kuota AI, gunakan opsi <strong>Mode Rekaman Suara Langsung</strong> saat membuat/mengedit profil.
            </p>
          </div>
        </div>
      )}

      {/* Tutorial Card: Panduan Lengkap Cara Menggunakan Kloning Suara */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">
                📖 Tutorial & Panduan Cara Menggunakan Kloning Suara AI
              </h4>
              <p className="text-xs text-slate-600">
                Ikuti 3 langkah mudah berikut untuk mengaktifkan dan menguji suara bel:
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTutorialGuide(!showTutorialGuide)}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
          >
            {showTutorialGuide ? 'Sembunyikan' : 'Buka Tutorial'}
          </button>
        </div>

        {showTutorialGuide && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-blue-100 text-xs text-slate-700">
            <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs space-y-1">
              <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                Langkah 1
              </span>
              <h5 className="font-bold text-slate-900 text-xs">Buat Profil Suara</h5>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Klik tombol <strong>"+ Kloning Suara Baru"</strong>. Rekam suara Anda (5–15 detik) membaca kalimat pengumuman sekolah, lalu simpan.
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs space-y-1">
              <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                Langkah 2
              </span>
              <h5 className="font-bold text-slate-900 text-xs">Pilih Profil di Jadwal Bel</h5>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Buka tab <strong>"Jadwal Bel Otomatis"</strong>, edit salah satu jam pelajaran. Pilih tombol <strong>"Kloning AI"</strong> dan tentukan profil yang telah Anda buat.
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs space-y-1">
              <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                Langkah 3 / Alternatif 100%
              </span>
              <h5 className="font-bold text-slate-900 text-xs">Tes Bunyi atau Suara Asli</h5>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Klik <strong>"Tes Putar Seluruh Urutan"</strong>. Jika ingin suara guru/murid <strong>100% persis tanpa variasi AI</strong>, gunakan opsi <strong>"Suara Rekaman"</strong>!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info Callout for 90% Voice Cloning question */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 border border-blue-200">
            <Info className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
              Pertanyaan: Apakah AI Bisa Kloning Suara 90% Mirip?
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Untuk kemiripan 90%–95%, dibutuhkan mesin komputasi suara khusus. Opsi <strong>paling jernih, 100% mirip asli, dan gratis</strong> adalah opsi <strong>"Suara Rekaman"</strong> di modal jadwal bel yang memutar persis suara asli rekaman Anda.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFaqModal(true)}
          className="bg-white hover:bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-xl text-xs border border-blue-200 shadow-xs shrink-0 cursor-pointer"
        >
          Pelajari Detail
        </button>
      </div>

      {/* Profiles List */}
      {profiles.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-200 shadow-xs">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">Belum Ada Profil Suara Kloning</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Buat profil suara pertama Anda dengan merekam sampel audio melalui mikrofon atau unggah rekaman vokal dari ponsel (AAC/M4A/MP3).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Mulai Kloning Suara Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((profile) => {
            const isActive = activeProfileId === profile.id && settings.useClonedVoice;
            const isDirectMode = profile.playbackMode === 'direct_recording';

            return (
              <div
                key={profile.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 relative ${
                  isActive
                    ? 'bg-blue-50/60 border-blue-400 text-slate-900 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-slate-900 truncate">{profile.name}</h4>
                      {isActive && (
                        <span className="bg-blue-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          Utama Aktif
                        </span>
                      )}
                    </div>
                    {profile.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{profile.description}</p>
                    )}

                    {/* Mode Selector Pill / Toggle Button */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleToggleProfileMode(profile.id)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                          isDirectMode
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                        }`}
                        title="Klik untuk beralih mode pemutaran"
                      >
                        {isDirectMode ? (
                          <>
                            <Mic className="w-3 h-3 text-emerald-600" />
                            <span>Mode: Putar Rekaman Asli (100% Persis)</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            <span>Mode: Sintesis AI ({profile.prebuiltVoiceFallback || 'Kore'})</span>
                          </>
                        )}
                        <span className="text-[9px] underline opacity-75 ml-1">Ubah</span>
                      </button>

                      {profile.sampleAudioUrl && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          • {profile.sampleAudioName || 'Sampel vokal ada'}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(profile.id)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                    title="Hapus Profil Suara"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Profile Actions: Dual Test Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      disabled={isTesting}
                      onClick={() => handleTestAiSpeech(profile)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isTesting ? 'Membaca...' : 'Uji Suara AI (Baca Teks)'}</span>
                    </button>

                    {profile.sampleAudioUrl && (
                      <button
                        type="button"
                        onClick={() => handlePlaySampleAudio(profile.sampleAudioUrl!)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                        title="Dengar rekaman audio asli yang Anda unggah/rekam"
                      >
                        <Play className="w-3 h-3 fill-current text-slate-600" />
                        <span>Dengar Rekaman</span>
                      </button>
                    )}
                  </div>

                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => handleSelectActiveProfile(profile.id)}
                      className="text-xs text-blue-700 hover:text-blue-900 font-bold px-2 py-1 rounded-lg hover:bg-blue-50 cursor-pointer"
                    >
                      Jadikan Utama
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal FAQ Explanation */}
      {showFaqModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-blue-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span>Penjelasan Kemiripan Voice Cloning 90%</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFaqModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                <strong>1. Mengapa menu sebelumnya belum mencapai 90% mirip?</strong><br />
                TTS standar browser dan Gemini saat ini menggunakan model pembaca vokal sintetis (suara robotik/penyiar). Mereka belum melakukan <em>deep zero-shot voice cloning</em> secara langsung dari file audio pendek.
              </p>
              <p>
                <strong>2. Apakah teknologi AI bisa membuat kloningan 90%+?</strong><br />
                <strong>Bisa!</strong> Teknologi seperti <em>ElevenLabs VoiceLab</em> atau <em>XTTS-v2</em> mampu mengkloning suara dengan kemiripan hingga 90%–95% dengan sampel suara 1–3 menit. Namun layanan tersebut memerlukan langganan API berbayar tersendiri.
              </p>
              <p>
                <strong>3. Rekomendasi Terbaik Untuk Sekolah (100% Mirip & Gratis):</strong><br />
                Gunakan fitur <strong>Perekam Suara Langsung</strong> (tombol mikrofon atau unggah MP3 rekaman asli) yang sudah kami sediakan di bawah ini. Dengan merekam suara Anda sendiri, hasilnya dijamin <strong>100% akurat</strong>, alami, dan tidak terdengar seperti robot.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFaqModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Create Profile */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl border border-blue-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleCreateProfile} className="flex flex-col max-h-[88vh] overflow-hidden">
              {/* Modal Header (Fixed at top) */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-600" />
                  <span>Buat Profil Suara Baru</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Profil Suara:
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Contoh: Suara Ustadz Ahmad, Suara Kepala Sekolah..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sampel Rekaman Suara Vokal:
                  </label>
                  <AudioRecorder
                    currentAudioUrl={sampleAudioUrl}
                    currentAudioName={sampleAudioName}
                    onAudioChange={(url, name) => {
                      setSampleAudioUrl(url);
                      setSampleAudioName(name);
                    }}
                    title="Rekam Sampel Vokal (5-10 Detik)"
                    description="Ucapkan kalimat pendek santai untuk dijadikan referensi suara vokal."
                  />
                </div>

                {/* Mode Pemutaran Suara */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pilihan Hasil Suara:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPlaybackMode('ai_synthesis')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        playbackMode === 'ai_synthesis'
                          ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-extrabold flex items-center gap-1.5 text-slate-900">
                        <Sparkles className={`w-3.5 h-3.5 ${playbackMode === 'ai_synthesis' ? 'text-blue-600' : 'text-slate-300'}`} />
                        Sintesis AI (Baca Teks)
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-1 leading-snug">
                        Membaca teks pengumuman otomatis dengan karakter vokal AI.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPlaybackMode('direct_recording')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        playbackMode === 'direct_recording'
                          ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-extrabold flex items-center gap-1.5 text-slate-900">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${playbackMode === 'direct_recording' ? 'text-blue-600' : 'text-slate-300'}`} />
                        Rekaman Asli (100% Persis)
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-1 leading-snug">
                        Memutar file rekaman suara asli tanpa distorsi atau perubahan.
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Karakter Dasar Vokal AI:
                  </label>
                  <select
                    value={fallbackVoice}
                    onChange={(e) => setFallbackVoice(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Kore">Kore - Suara Wanita / Ustadzah (Ramah & Hangat)</option>
                    <option value="Fenrir">Fenrir - Suara Pria / Ustadz (Berwibawa & Mantap)</option>
                    <option value="Puck">Puck - Suara Murid / Santri Anak (Ceria & Jelas)</option>
                    <option value="Zephyr">Zephyr - Suara Netral (Tenang & Santun)</option>
                    <option value="Charon">Charon - Suara Pengumuman Resmi (Tegas & Jelas)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {playbackMode === 'direct_recording'
                      ? 'Catatan: Mode "Rekaman Asli" akan memutar rekaman suara asli Anda secara langsung.'
                      : 'AI akan membaca kalimat pengumuman dengan pilihan karakter vokal di atas.'}
                  </p>
                </div>
              </div>

              {/* Sticky Pinned Footer - ALWAYS VISIBLE */}
              <div className="flex items-center justify-end gap-2.5 p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Profil Suara</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
