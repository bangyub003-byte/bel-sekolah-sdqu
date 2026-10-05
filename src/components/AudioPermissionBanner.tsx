import React, { useState } from 'react';
import { Volume2, VolumeX, CheckCircle2, Sparkles } from 'lucide-react';
import { getAudioContext, speakTTS, playChimeTone } from '../utils/audioSynth';
import { AudioSettings } from '../types';

interface AudioPermissionBannerProps {
  settings: AudioSettings;
  onActivated: () => void;
}

export const AudioPermissionBanner: React.FC<AudioPermissionBannerProps> = ({
  settings,
  onActivated,
}) => {
  const [activated, setActivated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

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

  if (activated) {
    return (
      <div className="bg-emerald-900/40 border border-emerald-500/30 text-emerald-200 px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm mb-4">
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Sistem Audio Bel Sekolah Aktif & Siap Membunyikan Jadwal Otomatis</span>
        </div>
        <span className="text-xs bg-emerald-800/60 text-emerald-300 px-2.5 py-1 rounded-md font-mono border border-emerald-600/40">
          Autoplay Unlocked
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-0.5 rounded-2xl shadow-lg mb-6 animate-pulse hover:animate-none transition-all">
      <div className="bg-slate-900/95 backdrop-blur-md rounded-[14px] p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <VolumeX className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Izin Audio Perlu Diaktifkan!</span>
              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-normal">
                Penting
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Klik tombol di samping agar browser diizinkan membunyikan nada chime dan ucapan bel otomatis saat jadwal tiba.
            </p>
          </div>
        </div>

        <button
          onClick={handleEnableAudio}
          disabled={loading}
          className="w-full md:w-auto shrink-0 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
              Mengaktifkan...
            </span>
          ) : (
            <>
              <Volume2 className="w-5 h-5" />
              <span>Aktifkan Audio Bel Sekarang</span>
              <Sparkles className="w-4 h-4 text-slate-900 ml-1" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
