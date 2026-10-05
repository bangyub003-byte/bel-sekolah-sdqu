import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Upload,
  Mic,
  Plus,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  Music,
  Sparkles,
  Volume2,
  Sliders,
  Radio,
  FileAudio,
  Download,
  AlertCircle,
  X,
  VolumeX,
  Layers,
  Info,
  Check,
  Smartphone,
} from 'lucide-react';
import { AudioSettings, CustomChime, BuiltinChimeType, ChimeType } from '../types';
import { playChimeTone, playCustomAudio, playBellSequence } from '../utils/audioSynth';
import { playUniversalAudio, stopAllCustomAudio } from '../utils/universalAudioPlayer';
import {
  AUDIO_FILE_ACCEPT,
  processAudioFile,
  getAudioFormatLabel,
} from '../utils/audioFileUtils';

interface ChimeManagerProps {
  settings: AudioSettings;
  onUpdateSettings: (newSettings: AudioSettings) => void;
  onLogBell?: (label: string, text: string) => void;
}

export const ChimeManager: React.FC<ChimeManagerProps> = ({
  settings,
  onUpdateSettings,
  onLogBell,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'record'>('upload');

  // Form State
  const [chimeName, setChimeName] = useState('');
  const [chimeCategory, setChimeCategory] = useState<'classic' | 'islamic' | 'modern' | 'jingle' | 'custom'>('custom');
  const [chimeDesc, setChimeDesc] = useState('');
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<number | undefined>(undefined);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // Playback testing state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Full Sequence Test
  const [testText, setTestText] = useState('waktu istirahat telah tiba. Selamat beristirahat.');
  const [isTestingSequence, setIsTestingSequence] = useState(false);
  const [selectedChimeForTest, setSelectedChimeForTest] = useState<ChimeType>(
    settings.defaultChimeId || 'westminster'
  );
  const [selectedOutroForTest, setSelectedOutroForTest] = useState<ChimeType | 'none' | 'same_as_intro'>(
    settings.globalOutroChimeType || 'classic_3tone'
  );
  const [enableOutroForTest, setEnableOutroForTest] = useState<boolean>(
    settings.enableGlobalOutroChime ?? true
  );

  const customChimes = settings.customChimes || [];
  const defaultChimeId = settings.defaultChimeId;
  const useCustomDefaultChime = settings.useCustomDefaultChime ?? false;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Builtin chime presets
  const builtinChimes: { id: BuiltinChimeType; name: string; desc: string; category: string }[] = [
    {
      id: 'westminster',
      name: 'Westminster Quarters (4-Nada Klasik)',
      desc: 'Melodi klasik lonceng 4 nada (E-C-D-G), standar internasional bel sekolah.',
      category: 'Klasik',
    },
    {
      id: 'classic_3tone',
      name: '3-Tone Ascending (Do-Mi-Sol)',
      desc: 'Nada harmonis ceria menaik 3 ketuk untuk pergantian jam pelajaran.',
      category: 'Harmoni',
    },
    {
      id: 'tube_chime',
      name: '2-Tone Tube Chime (Hangat & Lembut)',
      desc: 'Dua nada resonansi tabung yang tenang untuk jam istirahat dan perpustakaan.',
      category: 'Modern',
    },
    {
      id: 'islamic_duo',
      name: 'Melodi Islami (Akrab & Teduh)',
      desc: 'Susunan tangga nada khas yang menenangkan untuk panggilan sholat dan tilawah.',
      category: 'Islami',
    },
    {
      id: 'electric_bell',
      name: 'Bel Listrik Sekolah (Ringing Bell)',
      desc: 'Suara getaran bel listrik mekanik tradisional untuk tanda tegas atau alarm.',
      category: 'Tradisional',
    },
  ];

  const stopPreviewFnRef = useRef<(() => void) | null>(null);

  // Play audio preview with universal decoder (solves AAC, M4A, 3GP, AMR playback)
  const handlePlayPreview = async (id: string, url?: string, isBuiltin = false) => {
    if (playingId === id) {
      // Stop
      if (stopPreviewFnRef.current) {
        stopPreviewFnRef.current();
        stopPreviewFnRef.current = null;
      }
      stopAllCustomAudio();
      setPlayingId(null);
      return;
    }

    // Stop previous playing
    if (stopPreviewFnRef.current) {
      stopPreviewFnRef.current();
      stopPreviewFnRef.current = null;
    }
    stopAllCustomAudio();

    setPlayingId(id);

    if (isBuiltin) {
      playChimeTone(id as BuiltinChimeType, settings.chimeVolume || 1.0).finally(() => {
        setPlayingId(null);
      });
    } else if (url) {
      try {
        const stopFn = await playUniversalAudio(url, settings.chimeVolume || 1.0, () => {
          setPlayingId(null);
          stopPreviewFnRef.current = null;
        });
        stopPreviewFnRef.current = stopFn;
      } catch (err) {
        console.error('Audio play error in ChimeManager:', err);
        setPlayingId(null);
      }
    }
  };

  // Handle File Upload (Supports AAC, M4A, 3GP, AMR, MP3, WAV, OGG, etc.)
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingUpload(true);
    try {
      const processed = await processAudioFile(file, 25 * 1024 * 1024);
      setAudioFileName(processed.fileName);
      setAudioDataUrl(processed.dataUrl);
      if (processed.duration) {
        setAudioDuration(processed.duration);
      }

      if (!chimeName) {
        // Auto-populate name without extension
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setChimeName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadError(err.message || 'Gagal memproses file audio.');
    } finally {
      setIsProcessingUpload(false);
      e.target.value = '';
    }
  };

  // Microphone Recording
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioDataUrl(base64data);
          setAudioFileName(`Rekaman_Nada_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.webm`);
          setAudioDuration(recordingSeconds);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Tidak dapat mengakses mikrofon. Pastikan izin mikrofon telah diberikan di peramban Anda.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Save New Custom Chime
  const handleSaveCustomChime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioDataUrl || !chimeName.trim()) {
      alert('Mohon masukkan nama nada dering dan sediakan audio rekaman/unggah.');
      return;
    }

    const newChime: CustomChime = {
      id: `custom_${Date.now()}`,
      name: chimeName.trim(),
      description: chimeDesc.trim() || undefined,
      audioUrl: audioDataUrl,
      audioName: audioFileName || 'Custom Nada Dering',
      category: chimeCategory,
      durationSec: audioDuration,
      createdAt: Date.now(),
    };

    const updatedList = [newChime, ...customChimes];

    onUpdateSettings({
      ...settings,
      customChimes: updatedList,
      // If no default chime set, set this one
      defaultChimeId: defaultChimeId || newChime.id,
      useCustomDefaultChime: true,
    });

    // Reset Form
    setIsModalOpen(false);
    setChimeName('');
    setChimeDesc('');
    setAudioDataUrl(null);
    setAudioFileName('');
    setAudioDuration(undefined);
    setRecordingSeconds(0);
  };

  // Set as Global Default Chime
  const handleSetDefaultChime = (id: string) => {
    onUpdateSettings({
      ...settings,
      defaultChimeId: id,
      useCustomDefaultChime: true,
    });
  };

  // Toggle Use Custom Default Chime
  const handleToggleUseCustomDefault = (enabled: boolean) => {
    onUpdateSettings({
      ...settings,
      useCustomDefaultChime: enabled,
    });
  };

  // Delete Custom Chime
  const handleDeleteCustomChime = (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus nada dering kustom ini?')) return;

    const updated = customChimes.filter((c) => c.id !== id);
    const newDefault = defaultChimeId === id ? updated[0]?.id || 'westminster' : defaultChimeId;

    onUpdateSettings({
      ...settings,
      customChimes: updated,
      defaultChimeId: newDefault,
      useCustomDefaultChime: updated.length > 0 ? settings.useCustomDefaultChime : false,
    });
  };

  // Download Audio File
  const handleDownloadAudio = (chime: CustomChime) => {
    const a = document.createElement('a');
    a.href = chime.audioUrl;
    a.download = chime.audioName || `${chime.name.replace(/\s+/g, '_')}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Test Full Sequence
  const handleTestFullSequence = async () => {
    if (isTestingSequence) return;
    setIsTestingSequence(true);

    try {
      const full = `${settings.globalPrefix}${testText}`;
      await playBellSequence(
        selectedChimeForTest,
        full,
        settings,
        1.0,
        undefined,
        settings.useClonedVoice ? 'cloned' : 'tts',
        undefined,
        undefined,
        enableOutroForTest,
        selectedOutroForTest
      );
      if (onLogBell) {
        onLogBell('Uji Coba Nada Dering & Bel', full);
      }
    } catch (err) {
      console.error('Test full sequence error:', err);
    } finally {
      setIsTestingSequence(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        {/* Glow background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider">
              <Music className="w-3.5 h-3.5 text-emerald-400" />
              <span>Kustomisasi Nada Dering Bel Sekolah</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Menu Ubah Suara Nada Dering Bel</span>
              <span className="text-xs bg-amber-500 text-slate-950 px-2.5 py-1 rounded-lg font-black uppercase">
                MP3 / WAV / Rekaman
              </span>
            </h2>

            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Pilih dari koleksi nada dering standar atau masukkan/unggah file nada dering bel unik buatan Anda sendiri (lagu mars sekolah, jingle Islami, lonceng gamelan, sirine MP3, dsb).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('upload');
                setIsModalOpen(true);
              }}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              <span>Unggah File Nada Bel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('record');
                setIsModalOpen(true);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Mic className="w-4 h-4 text-emerald-400" />
              <span>Rekam dari Mikrofon</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Default Ringtone Setting Card */}
      <div className="bg-slate-950 border border-emerald-500/30 rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <span>Pengaturan Nada Dering Utama (Global Default)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Tentukan nada dering yang berbunyi secara otomatis sebelum pengumuman suara bel dibacakan.
            </p>
          </div>

          <label className="flex items-center gap-2.5 bg-slate-900 border border-slate-700 px-4 py-2.5 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all">
            <input
              type="checkbox"
              checked={useCustomDefaultChime && customChimes.length > 0}
              disabled={customChimes.length === 0}
              onChange={(e) => handleToggleUseCustomDefault(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 cursor-pointer disabled:opacity-40"
            />
            <span className="text-xs font-bold text-emerald-300">
              {useCustomDefaultChime ? 'Pakai Nada Kustom Sendiri' : 'Pakai Nada Sintesis Bawaan'}
            </span>
          </label>
        </div>

        {/* Volume Slider for Chime Tone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                Volume Nada Dering Bel
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {Math.round((settings.chimeVolume ?? 1.0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.chimeVolume ?? 1.0}
              onChange={(e) =>
                onUpdateSettings({ ...settings, chimeVolume: parseFloat(e.target.value) })
              }
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-xs font-bold text-slate-300 block">Status Nada Dering Aktif:</span>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-emerald-300">
                {useCustomDefaultChime && defaultChimeId
                  ? customChimes.find((c) => c.id === defaultChimeId)?.name || 'Nada Kustom Aktif'
                  : 'Westminster Quarters (4-Nada Bawaan)'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {useCustomDefaultChime
                ? 'Semua bel otomatis akan menggunakan file nada dering yang Anda tentukan.'
                : 'Bel menggunakan sintesis nada lonceng digital Web Audio offline.'}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: Custom Uploaded & Recorded Chimes Library */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileAudio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Koleksi Nada Dering Bel Kustom Anda ({customChimes.length})
              </h3>
              <p className="text-xs text-slate-400">
                File audio yang telah Anda masukkan ke dalam aplikasi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              setIsModalOpen(true);
            }}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Nada Baru</span>
          </button>
        </div>

        {customChimes.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <Music className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="text-sm font-bold text-white">Belum Ada Nada Dering Kustom</h4>
              <p className="text-xs text-slate-400">
                Anda dapat memasukkan file MP3/WAV lagu bel sekolah Anda, sirine, suara tabuh bedug/lonceng asli, atau merekam nada dering langsung dari mikrofon.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('upload');
                  setIsModalOpen(true);
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Unggah File Audio (MP3/WAV)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('record');
                  setIsModalOpen(true);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>Rekam Suara Nada</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customChimes.map((chime) => {
              const isDefault = defaultChimeId === chime.id && useCustomDefaultChime;
              const isPlaying = playingId === chime.id;

              return (
                <div
                  key={chime.id}
                  className={`p-5 rounded-2xl border transition-all space-y-4 relative ${
                    isDefault
                      ? 'bg-emerald-950/25 border-emerald-500 text-white ring-1 ring-emerald-500/50 shadow-lg shadow-emerald-950/40'
                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-white leading-tight">
                          {chime.name}
                        </h4>
                        {isDefault && (
                          <span className="bg-emerald-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Default Utama
                          </span>
                        )}
                      </div>

                      {chime.description && (
                        <p className="text-xs text-slate-400 line-clamp-1">{chime.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 pt-1 font-mono">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300">
                          {chime.category.toUpperCase()}
                        </span>
                        {chime.audioName && (
                          <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded text-[9px] font-sans font-bold">
                            {getAudioFormatLabel(chime.audioName)}
                          </span>
                        )}
                        {chime.durationSec && (
                          <span>~{chime.durationSec}d</span>
                        )}
                        <span className="truncate max-w-[120px]">{chime.audioName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownloadAudio(chime)}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Unduh File Audio"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomChime(chime.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Hapus Nada Dering"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Play & Set Default Toolbar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handlePlayPreview(chime.id, chime.audioUrl, false)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isPlaying
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Hentikan</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Dengarkan Nada</span>
                        </>
                      )}
                    </button>

                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultChime(chime.id)}
                        className="text-xs font-bold text-slate-300 hover:text-emerald-300 bg-slate-800 hover:bg-slate-750 px-3 py-2 rounded-xl transition-all cursor-pointer"
                      >
                        Jadikan Nada Utama
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Built-in Precision Chimes */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Nada Dering Digital Bawaan Sistem (5 Pilihan Sintesis)
            </h3>
            <p className="text-xs text-slate-400">
              Nada dering lonceng digital yang di-generate langsung oleh Web Audio API (100% offline & anti gagal)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {builtinChimes.map((preset) => {
            const isPlaying = playingId === preset.id;
            const isDefault = defaultChimeId === preset.id && !useCustomDefaultChime;

            return (
              <div
                key={preset.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[9px] bg-slate-800 text-cyan-400 px-2 py-0.5 rounded font-mono uppercase font-bold">
                      {preset.category}
                    </span>
                    <h4 className="text-sm font-black text-white mt-1">{preset.name}</h4>
                  </div>
                  {isDefault && (
                    <span className="bg-cyan-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full">
                      Aktif
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400">{preset.desc}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handlePlayPreview(preset.id, undefined, true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isPlaying
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-cyan-300'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Berhenti</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Tes Bunyi</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({
                        ...settings,
                        defaultChimeId: preset.id,
                        useCustomDefaultChime: false,
                      });
                    }}
                    className="text-[11px] font-bold text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    Gunakan Preset Ini
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: Live Test & Sequence Simulator */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-base sm:text-lg font-extrabold text-white">
            Simulator Urutan Bel Lengkap (Nada Pembuka ➔ Pengumuman VO ➔ Nada Penutup)
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          Simulasikan urutan suara bel seperti saat mengudara di speaker sekolah (Nada Dering Pembuka ➔ Jeda ➔ Suara Pengumuman ➔ Nada Dering Penutup ➔ Selesai).
        </p>

        {/* Workflow Diagram */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
          <div className="flex-1 text-center bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2">
            <span className="text-[9px] text-emerald-400 font-bold block">1. Pembuka</span>
            <span className="text-white font-extrabold text-[11px] truncate block">
              {selectedChimeForTest}
            </span>
          </div>
          <span className="text-slate-500 font-bold">➜</span>
          <div className="flex-1 text-center bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-2">
            <span className="text-[9px] text-cyan-400 font-bold block">2. Suara VO</span>
            <span className="text-white font-extrabold text-[11px] truncate block">
              Pengumuman
            </span>
          </div>
          <span className="text-slate-500 font-bold">➜</span>
          <div className={`flex-1 text-center rounded-xl p-2 border transition-all ${
            enableOutroForTest && selectedOutroForTest !== 'none'
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            <span className={`text-[9px] font-bold block ${enableOutroForTest && selectedOutroForTest !== 'none' ? 'text-amber-400' : 'text-slate-500'}`}>
              3. Penutup
            </span>
            <span className="font-extrabold text-[11px] truncate block">
              {enableOutroForTest && selectedOutroForTest !== 'none' ? selectedOutroForTest : 'Tanpa Outro'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* 1. Intro Chime */}
          <div>
            <label className="block text-xs font-bold text-emerald-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>1. Nada Pembuka</span>
            </label>
            <select
              value={selectedChimeForTest}
              onChange={(e) => setSelectedChimeForTest(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <optgroup label="Nada Dering Kustom Buatan Anda">
                {customChimes.map((c) => (
                  <option key={c.id} value={c.id}>
                    ✨ {c.name} ({c.audioName})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Nada Dering Digital Bawaan">
                {builtinChimes.map((b) => (
                  <option key={b.id} value={b.id}>
                    🔔 {b.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 3. Outro Chime */}
          <div>
            <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>3. Nada Penutup (Outro)</span>
            </label>
            <select
              value={enableOutroForTest ? selectedOutroForTest : 'none'}
              onChange={(e) => {
                const val = e.target.value as any;
                if (val === 'none') {
                  setEnableOutroForTest(false);
                  setSelectedOutroForTest('none');
                } else {
                  setEnableOutroForTest(true);
                  setSelectedOutroForTest(val);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="none">🚫 Tanpa Nada Penutup</option>
              <option value="same_as_intro">🔄 Sama Nada Pembuka</option>
              <optgroup label="Nada Digital Penutup">
                <option value="classic_3tone">🔔 Classic 3-Tone (Do-Mi-Sol)</option>
                <option value="tube_chime">🔔 Tube Chime Soft</option>
                <option value="westminster">🔔 Westminster 4-Tone</option>
                <option value="islamic_duo">🔔 Islamic Duo Chime</option>
                <option value="electric_bell">🔔 Electric Bell Ring</option>
              </optgroup>
              <optgroup label="Nada Kustom Buatan Anda">
                {customChimes.map((c) => (
                  <option key={c.id} value={c.id}>
                    ✨ {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Text & Play button */}
          <div>
            <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>2. Teks Pengumuman</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="memasuki jam pelajaran ke-1."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                disabled={isTestingSequence}
                onClick={handleTestFullSequence}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isTestingSequence ? 'Memutar...' : 'Putar Urutan'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Upload or Record Custom Bell Chime */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {activeTab === 'upload' ? 'Unggah File Nada Dering Bel' : 'Rekam Nada Dering Baru'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tambahkan suara nada dering unik ke dalam sistem bel sekolah
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  if (isRecording) stopRecording();
                }}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Selector */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Unggah File (AAC / MP3 / WAV)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('record')}
                className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'record'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>Rekam Mikrofon</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCustomChime} className="space-y-4">
              {/* Tab 1: Upload */}
              {activeTab === 'upload' && (
                <div className="space-y-3">
                  {/* Android format guide badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-semibold text-slate-300">Format Rekaman Didukung:</span>
                    <span className="bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-500/30">
                      AAC (.aac) HP Android
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                      M4A (Voice Recorder)
                    </span>
                    <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">3GP / AMR</span>
                    <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">MP3 / WAV / OGG</span>
                  </div>

                  {uploadError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-950/60 transition-colors relative cursor-pointer group">
                    <input
                      type="file"
                      accept={AUDIO_FILE_ACCEPT}
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      disabled={isProcessingUpload}
                    />
                    <div className="space-y-2 pointer-events-none">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-white">
                        {isProcessingUpload ? 'Memproses Berkas Audio...' : 'Klik untuk memilih file audio atau seret file ke sini'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Mendukung format Rekaman Android (AAC, M4A, 3GP, AMR), MP3, WAV, OGG (Maks. 25MB)
                      </p>
                    </div>
                  </div>

                  {audioDataUrl && (
                    <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="truncate">
                          <span className="text-xs font-bold text-emerald-200 block truncate">
                            {audioFileName}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {getAudioFormatLabel(audioFileName)} {audioDuration ? `• Durasi: ~${audioDuration} detik` : '• Audio siap disimpan'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePlayPreview('modal_preview', audioDataUrl, false)}
                        className="bg-emerald-500 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Tes Putar</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Record */}
              {activeTab === 'record' && (
                <div className="space-y-3 bg-slate-950/80 p-5 rounded-2xl border border-slate-800 text-center">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-300 block">
                      Perekam Nada Dering Mikrofon
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Bunyikan lonceng, alat musik, atau instrumen sekolah di dekat mikrofon.
                    </p>
                  </div>

                  <div className="py-4">
                    <div className="text-3xl font-mono font-black text-emerald-400">
                      00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                    </div>
                    {isRecording && (
                      <p className="text-[11px] text-rose-400 font-bold animate-pulse mt-1">
                        ● Sedang Merekam Suara...
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Mulai Merekam</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
                      >
                        <Pause className="w-4 h-4" />
                        <span>Selesai Merekam</span>
                      </button>
                    )}
                  </div>

                  {audioDataUrl && (
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-emerald-300 font-bold">
                        Hasil Rekaman Tersedia ({recordingSeconds}s)
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePlayPreview('modal_preview', audioDataUrl, false)}
                        className="bg-emerald-500 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Putar Ulang</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Name Field */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nama Nada Dering Bel *
                </label>
                <input
                  type="text"
                  required
                  value={chimeName}
                  onChange={(e) => setChimeName(e.target.value)}
                  placeholder="misal: Lagu Mars SD Qur'an / Jingle 4-Ketuk"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Kategori Nada
                </label>
                <select
                  value={chimeCategory}
                  onChange={(e) => setChimeCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="custom">Kustom / Buatan Sendiri</option>
                  <option value="jingle">Jingle & Lagu Sekolah</option>
                  <option value="islamic">Islami / Rebana / Bedug</option>
                  <option value="classic">Klasik / Lonceng Gamelan</option>
                  <option value="modern">Modern & Harmoni</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={chimeDesc}
                  onChange={(e) => setChimeDesc(e.target.value)}
                  placeholder="misal: Khusus jam masuk kelas pagi dan penutupan pulang"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!audioDataUrl || !chimeName.trim()}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Music className="w-4 h-4" />
                  <span>Simpan Nada Dering</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
