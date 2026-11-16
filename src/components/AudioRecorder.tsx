import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  Upload,
  Trash2,
  CheckCircle,
  Volume2,
  AlertCircle,
  Radio,
  Smartphone,
  Sparkles,
  Globe,
  Link2,
  Check,
} from 'lucide-react';
import {
  AUDIO_FILE_ACCEPT,
  processAudioFile,
  getAudioFormatLabel,
} from '../utils/audioFileUtils';
import { playUniversalAudio, stopAllCustomAudio } from '../utils/universalAudioPlayer';
import { normalizeAudioCloudUrl, isCloudAudioUrl, uploadAudioToCloudinary } from '../utils/cloudAudioUtils';

interface AudioRecorderProps {
  currentAudioUrl?: string;
  currentAudioName?: string;
  onAudioChange: (dataUrl: string | undefined, name: string | undefined) => void;
  title?: string;
  description?: string;
  cloudinaryConfig?: {
    cloudName?: string;
    uploadPreset?: string;
  };
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  currentAudioUrl,
  currentAudioName,
  onAudioChange,
  title = 'Rekam atau Unggah Suara Sendiri',
  description = 'Gunakan mikrofon untuk merekam suara ucapan bel atau unggah file rekaman suara dari HP Android (AAC/M4A) atau MP3/WAV.',
  cloudinaryConfig,
}) => {
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);

  // Cloud Link input mode
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [urlInputValue, setUrlInputValue] = useState<string>('');
  const [urlNameValue, setUrlNameValue] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Sync state if external audioUrl changes
  useEffect(() => {
    if (currentAudioUrl) {
      setRecordingState('recorded');
      if (isCloudAudioUrl(currentAudioUrl)) {
        setDetectedFormat('🌐 Cloud Online');
      } else if (currentAudioName) {
        setDetectedFormat(getAudioFormatLabel(currentAudioName));
      }
    } else {
      setDetectedFormat(null);
    }
  }, [currentAudioUrl, currentAudioName]);

  // Clean up recording timer and player
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainderSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainderSecs.toString().padStart(2, '0')}`;
  };

  // Start Recording via MediaRecorder
  const startRecording = async () => {
    setAudioError(null);
    audioChunksRef.current = [];
    setRecordingTime(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setAudioError('Perangkat atau browser Anda tidak mendukung perekaman suara langsung.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Always release microphone tracks immediately
        stream.getTracks().forEach((track) => track.stop());

        const actualMime = mediaRecorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        if (audioBlob.size < 64) {
          setAudioError('Rekaman terlalu singkat atau kosong. Silakan coba rekam ulang.');
          setRecordingState('idle');
          return;
        }

        const ext = actualMime.includes('mp4') ? 'm4a' : actualMime.includes('ogg') ? 'ogg' : 'webm';
        const timestampName = `Rekaman_Langsung_${new Date().toLocaleTimeString('id-ID').replace(/:/g, '-')}.${ext}`;

        // If Cloudinary configured, upload to cloud for universal HP/PC access
        if (cloudinaryConfig?.cloudName) {
          setIsProcessingFile(true);
          try {
            const uploaded = await uploadAudioToCloudinary(
              audioBlob,
              timestampName,
              cloudinaryConfig.cloudName,
              cloudinaryConfig.uploadPreset
            );
            setDetectedFormat('🌐 Cloud Online');
            onAudioChange(uploaded.url, timestampName);
            setRecordingState('recorded');
            return;
          } catch (cloudErr: any) {
            console.warn('Cloudinary upload fallback to local:', cloudErr);
          } finally {
            setIsProcessingFile(false);
          }
        }

        // Local Fallback
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setDetectedFormat('Rekaman Mikrofon');
          onAudioChange(base64Audio, timestampName);
          setRecordingState('recorded');
        };
      };

      mediaRecorder.start(200);
      setRecordingState('recording');

      // Start timer
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setAudioError('Izin mikrofon ditolak atau tidak tersedia. Pastikan Anda mengizinkan akses mikrofon di browser.');
      setRecordingState('idle');
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Handle Audio File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAudioError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    try {
      // If Cloudinary configured, upload directly to cloud
      if (cloudinaryConfig?.cloudName) {
        try {
          const uploaded = await uploadAudioToCloudinary(
            file,
            file.name,
            cloudinaryConfig.cloudName,
            cloudinaryConfig.uploadPreset
          );
          setDetectedFormat('🌐 Cloud Online');
          onAudioChange(uploaded.url, file.name);
          setRecordingState('recorded');
          return;
        } catch (cloudErr: any) {
          console.warn('Cloudinary upload fallback to local storage:', cloudErr);
          setAudioError(`Cloud upload: ${cloudErr.message}. Beralih ke penyimpanan lokal.`);
        }
      }

      // Local processed file
      const processed = await processAudioFile(file, 25 * 1024 * 1024);
      setDetectedFormat(processed.formatLabel);
      onAudioChange(processed.dataUrl, processed.fileName);
      setRecordingState('recorded');
    } catch (err: any) {
      console.error('Audio processing error:', err);
      setAudioError(err.message || 'Gagal memproses file audio. Pastikan file tidak rusak.');
    } finally {
      setIsProcessingFile(false);
      e.target.value = '';
    }
  };

  // Handle Online Link (Google Drive, Dropbox, Cloudinary, Web URL)
  const handleSaveOnlineUrl = () => {
    if (!urlInputValue.trim()) return;
    const normalized = normalizeAudioCloudUrl(urlInputValue.trim());
    const name = urlNameValue.trim() || 'Audio Cloud Online (Link)';

    setDetectedFormat('🌐 Cloud Online');
    onAudioChange(normalized, name);
    setRecordingState('recorded');
    setShowUrlInput(false);
    setUrlInputValue('');
    setUrlNameValue('');
  };

  const stopCurrentAudioFnRef = useRef<(() => void) | null>(null);

  // Toggle Preview Play
  const togglePlayPreview = async () => {
    if (!currentAudioUrl) return;
    setAudioError(null);

    if (isPlaying) {
      if (stopCurrentAudioFnRef.current) {
        stopCurrentAudioFnRef.current();
        stopCurrentAudioFnRef.current = null;
      }
      stopAllCustomAudio();
      setIsPlaying(false);
    } else {
      stopAllCustomAudio();
      setIsPlaying(true);

      try {
        const stopFn = await playUniversalAudio(currentAudioUrl, 1.0, () => {
          setIsPlaying(false);
          stopCurrentAudioFnRef.current = null;
        });
        stopCurrentAudioFnRef.current = stopFn;
      } catch (err: any) {
        console.warn('Audio preview warning:', err?.message || err);
        setIsPlaying(false);
        setAudioError(
          err?.message && !err.message.includes('Fallback')
            ? err.message
            : 'Gagal memutar rekaman audio. Pastikan format berkas didukung atau link Google Drive disetel ke Publik.'
        );
      }
    }
  };

  // Delete Current Audio
  const handleClearAudio = () => {
    if (stopCurrentAudioFnRef.current) {
      stopCurrentAudioFnRef.current();
      stopCurrentAudioFnRef.current = null;
    }
    stopAllCustomAudio();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
    setRecordingState('idle');
    setRecordingTime(0);
    setDetectedFormat(null);
    onAudioChange(undefined, undefined);
  };

  const isCurrentAudioCloud = isCloudAudioUrl(currentAudioUrl);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 sm:p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5 text-emerald-400" />
          <span>{title}</span>
        </h4>
        <span className="text-[10px] text-slate-400 hidden sm:inline">{description}</span>
      </div>

      {/* Supported formats helper badge */}
      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400 bg-slate-900/80 px-2 py-1.5 rounded-lg border border-slate-800/80">
        <Smartphone className="w-3 h-3 text-cyan-400 shrink-0" />
        <span className="font-semibold text-slate-300">Format:</span>
        <span className="bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-500/30">
          AAC (HP Android)
        </span>
        <span className="bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
          M4A / MP3 / WAV
        </span>
        <span className="bg-blue-500/20 text-blue-300 font-bold px-1.5 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
          <Globe className="w-2.5 h-2.5" />
          Link Cloud / GDrive
        </span>
      </div>

      {audioError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{audioError}</span>
        </div>
      )}

      {/* Main Recording / Playback Controls */}
      {currentAudioUrl ? (
        <div className="bg-slate-900 border border-emerald-500/30 p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-bold text-white truncate max-w-[160px] sm:max-w-[220px]">
                  {currentAudioName || 'Suara Rekaman Aktif'}
                </p>
                {isCurrentAudioCloud ? (
                  <span className="text-[9px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-500/30 shrink-0 flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5" />
                    Bisa di Semua HP & Laptop
                  </span>
                ) : (
                  <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 shrink-0">
                    {detectedFormat || 'Lokal'}
                  </span>
                )}
              </div>
              <span className="text-[9px] text-emerald-400 font-mono block">
                {isCurrentAudioCloud ? '🌐 Tersimpan Online di Cloud (Siap Diputar)' : 'Audio Tersimpan di Browser & Siap Diputar'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={togglePlayPreview}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Jeda</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Dengar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClearAudio}
              className="bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 p-1.5 rounded-lg transition-all cursor-pointer"
              title="Hapus Rekaman Ini"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : recordingState === 'recording' ? (
        <div className="bg-rose-950/40 border border-rose-500/50 p-3.5 rounded-xl text-center space-y-2 animate-pulse">
          <div className="flex items-center justify-center gap-2 text-rose-400">
            <Radio className="w-4 h-4 animate-spin" />
            <span className="text-xs font-extrabold tracking-wider uppercase">
              Sedang Merekam...
            </span>
          </div>

          <div className="text-2xl font-mono font-black text-rose-300">
            {formatTime(recordingTime)}
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 mx-auto cursor-pointer active:scale-95 shadow-md shadow-rose-500/20"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Hentikan & Simpan</span>
          </button>
        </div>
      ) : showUrlInput ? (
        /* Cloud Link Input Form */
        <div className="bg-slate-900 border border-blue-500/40 p-3 rounded-xl space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Tempel Link Audio Online (Google Drive / Web / Cloud)
            </span>
            <button
              type="button"
              onClick={() => setShowUrlInput(false)}
              className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              Batal
            </button>
          </div>

          <input
            type="url"
            placeholder="https://drive.google.com/... atau https://.../audio.mp3"
            value={urlInputValue}
            onChange={(e) => setUrlInputValue(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
          />

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Label nama suara (opsional)"
              value={urlNameValue}
              onChange={(e) => setUrlNameValue(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleSaveOnlineUrl}
              disabled={!urlInputValue.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition shadow-xs"
            >
              <Check className="w-3 h-3" />
              <span>Gunakan Link</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            💡 Link Google Drive atau Dropbox otomatis diubah ke tautan streaming yang bisa berbunyi di semua HP & PC.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Button Record with Mic */}
          <button
            type="button"
            onClick={startRecording}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 p-2.5 rounded-xl text-left transition-all cursor-pointer group flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Mic className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block group-hover:text-emerald-300 leading-tight">
                Rekam Mic
              </span>
              <span className="text-[10px] text-slate-400">Browser</span>
            </div>
          </button>

          {/* Button Upload Audio File */}
          <label className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 p-2.5 rounded-xl text-left transition-all cursor-pointer group flex items-center gap-2 relative">
            <input
              type="file"
              accept={AUDIO_FILE_ACCEPT}
              onChange={handleFileUpload}
              className="hidden"
              disabled={isProcessingFile}
            />
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Upload className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block group-hover:text-cyan-300 leading-tight">
                {isProcessingFile ? 'Memproses...' : 'Upload File'}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">HP/PC</span>
            </div>
          </label>

          {/* Button Cloud Audio Link */}
          <button
            type="button"
            onClick={() => setShowUrlInput(true)}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 p-2.5 rounded-xl text-left transition-all cursor-pointer group flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Globe className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block group-hover:text-blue-300 leading-tight">
                Link Cloud
              </span>
              <span className="text-[10px] text-slate-400">Semua HP/PC</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
