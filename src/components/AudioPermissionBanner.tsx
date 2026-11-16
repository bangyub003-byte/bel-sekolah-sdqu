import React, { useState } from 'react';
import { Volume2, VolumeX, CheckCircle2, Sparkles, HelpCircle, X, Power, Laptop, ShieldCheck } from 'lucide-react';
import { getAudioContext, speakTTS, playChimeTone } from '../utils/audioSynth';
import { AudioSettings } from '../types';

interface AudioPermissionBannerProps {
  settings: AudioSettings;
  onActivated: () => void;
  isAudioUnlocked?: boolean;
}

export const AudioPermissionBanner: React.FC<AudioPermissionBannerProps> = ({
  settings,
  onActivated,
  isAudioUnlocked = false,
}) => {
  const [activated, setActivated] = useState<boolean>(isAudioUnlocked);
  const [loading, setLoading] = useState<boolean>(false);
  const [showAutoStartGuide, setShowAutoStartGuide] = useState<boolean>(false);

  const isActuallyActive = activated || isAudioUnlocked;

  const handleEnableAudio = async () => {
    setLoading(true);
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Play a gentle welcome chime & speech test
      await playChimeTone('classic_3tone', 0.8);
      await speakTTS("Audio bel sekolah otomatis SD QUR'AN UNGGULAN telah aktif.", settings);

      setActivated(true);
      onActivated();
    } catch (err) {
      console.error('Failed to enable audio:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {isActuallyActive ? (
        <div className="flex items-center justify-between px-2 py-0.5 text-xs text-slate-500 mb-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700 tracking-wide">Audio Hidup</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAutoStartGuide(true)}
            className="text-[10px] text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Power className="w-3 h-3 text-slate-400" />
            <span>Panduan Auto-Start</span>
          </button>
        </div>
      ) : (
        <div className="bg-amber-50/85 border border-amber-200 rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3 mb-2 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200 shadow-xs">
              <VolumeX className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Izin Audio Perlu Diaktifkan
                </h3>
                <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded-full font-bold">
                  Sekali Klik
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Peramban mewajibkan interaksi pertama agar nada dering, murottal pagi 06:30, dan suara pengumuman berbunyi otomatis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
            <button
              type="button"
              onClick={() => setShowAutoStartGuide(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-700 hover:bg-slate-50 border border-slate-200 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Power className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Panduan</span> Auto-Start PC
            </button>

            <button
              onClick={handleEnableAudio}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer text-xs"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengaktifkan...
                </span>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Aktifkan Audio Bel</span>
                  <Sparkles className="w-3 h-3 text-amber-300" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal Panduan Hidup Otomatis Saat Komputer Dinyalakan (Tanpa Sentuh) */}
      {showAutoStartGuide && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-blue-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Power className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm sm:text-base font-black">
                  Panduan Hidup Otomatis Tanpa Perlu Guru Sentuh
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoStartGuide(false)}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl flex items-start gap-2.5 text-blue-900">
                <Laptop className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-xs font-extrabold mb-0.5">
                    Tanya: Bisakah bel & murottal berbunyi sendiri saat komputer dinyalakan tanpa disentuh guru?
                  </strong>
                  <span className="text-xs">
                    <strong>BISA 100%!</strong> Ikuti 2 pengaturan sekali saja berikut agar saat komputer dinyalakan (atau dipasang timer saklar listrik pagi), browser langsung membuka bel dan suara langsung berbunyi otomatis jam 06:30.
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px]">1</span>
                    <span>Izinkan Suara di Browser (Google Chrome / Edge)</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-7">
                    Agar Chrome tidak membisukan suara otomatis saat komputer baru menyala:
                  </p>
                  <ol className="list-disc pl-11 text-xs text-slate-600 space-y-1">
                    <li>Klik ikon <strong>Gembok / Setelan Situs</strong> di sebelah kiri alamat web ini.</li>
                    <li>Pilih <strong>Setelan Situs (Site Settings)</strong>.</li>
                    <li>Cari baris <strong>Suara (Sound)</strong>, lalu ubah dari "Otomatis" menjadi <strong>"Izinkan" (Allow)</strong>.</li>
                  </ol>
                </div>

                <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px]">2</span>
                    <span>Buka Web Bel Otomatis Saat Komputer Hidup</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-7">
                    Agar web bel sekolah langsung terbuka setiap Windows dinyalakan:
                  </p>
                  <ol className="list-disc pl-11 text-xs text-slate-600 space-y-1">
                    <li>Tekan tombol keyboard <strong>Windows + R</strong>.</li>
                    <li>Ketik <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono font-bold">shell:startup</code> lalu tekan <strong>Enter</strong>.</li>
                    <li>Salin shortcut browser Chrome web bel ini ke dalam folder tersebut.</li>
                  </ol>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-emerald-900 flex items-start gap-2 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Setelah 2 langkah di atas dilakukan, komputer sekolah siap dipasangkan timer colokan listrik otomatis. Begitu komputer menyala jam 06:15, Chrome langsung terbuka dan murottal jam 06:30 akan langsung melantun tanpa perlu disentuh siapapun!
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowAutoStartGuide(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Saya Mengerti & Siap Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
