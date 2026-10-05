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
} from 'lucide-react';
import {
  AUDIO_FILE_ACCEPT,
  processAudioFile,
  getAudioFormatLabel,
} from '../utils/audioFileUtils';
import { playUniversalAudio, stopAllCustomAudio } from '../utils/universalAudioPlayer';

interface AudioRecorderProps {
  currentAudioUrl?: string;
  currentAudioName?: string;
  onAudioChange: (dataUrl: string | undefined, name: string | undefined) => void;
  title?: string;
  description?: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  currentAudioUrl,
  currentAudioName,
  onAudioChange,
  title = 'Rekam atau Unggah Suara Sendiri',
  description = 'Gunakan mikrofon untuk merekam suara ucapan bel atau unggah file rekaman suara dari HP Android (AAC/M4A) atau MP3/WAV.',
}) => {
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Sync state if external audioUrl changes
  useEffect(() => {
    if (currentAudioUrl) {
      setRecordingState('recorded');
      if (currentAudioName) {
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

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          const timestampName = `Rekaman_Langsung_${new Date().toLocaleTimeString('id-ID').replace(/:/g, '-')}.webm`;
          setDetectedFormat('Rekaman Mikrofon');
          onAudioChange(base64Audio, timestampName);
          setRecordingState('recorded');
        };

        // Stop all track streams
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setRecordingState('recording');

      // Start timer
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            // Auto stop after 60 seconds
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

  // Handle Audio File Upload (Supports AAC, M4A, 3GP, AMR, MP3, WAV, OGG, etc.)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAudioError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    try {
      const processed = await processAudioFile(file, 25 * 1024 * 1024);
      setDetectedFormat(processed.formatLabel);
      onAudioChange(processed.dataUrl, processed.fileName);
      setRecordingState('recorded');
    } catch (err: any) {
      console.error('Audio processing error:', err);
      setAudioError(err.message || 'Gagal memproses file audio. Pastikan file tidak rusak.');
    } finally {
      setIsProcessingFile(false);
      // Reset input value to allow selecting same file again
      e.target.value = '';
    }
  };

  const stopCurrentAudioFnRef = useRef<(() => void) | null>(null);

  // Toggle Preview Play (Web Audio API & AAC decoding support)
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
        console.error('Audio play error:', err);
        setIsPlaying(false);
        setAudioError('Gagal memutar rekaman audio. Format berkas tidak kompatibel.');
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

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
      <div>
        <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
          <Mic className="w-4 h-4 text-emerald-400" />
          <span>{title}</span>
        </h4>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>

      {/* Supported formats helper badge */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
        <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="font-semibold text-slate-300">Format Rekaman Didukung:</span>
        <span className="bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-500/30">
          AAC (HP Android)
        </span>
        <span className="bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
          M4A (Voice Recorder)
        </span>
        <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">3GP / AMR</span>
        <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">MP3 / WAV / OGG</span>
      </div>

      {audioError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{audioError}</span>
        </div>
      )}

      {/* Main Recording / Playback Controls */}
      {currentAudioUrl ? (
        <div className="bg-slate-900 border border-emerald-500/30 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[240px]">
                  {currentAudioName || 'Suara Rekaman Aktif'}
                </p>
                {detectedFormat && (
                  <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">
                    {detectedFormat}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                Audio Tersimpan & Siap Diputar
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={togglePlayPreview}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md shadow-emerald-500/20"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Jeda</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Dengar Suara</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClearAudio}
              className="bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 p-2 rounded-xl transition-all cursor-pointer"
              title="Hapus Rekaman Ini"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : recordingState === 'recording' ? (
        <div className="bg-rose-950/40 border border-rose-500/50 p-5 rounded-xl text-center space-y-3 animate-pulse">
          <div className="flex items-center justify-center gap-2 text-rose-400">
            <Radio className="w-5 h-5 animate-spin" />
            <span className="text-xs font-extrabold tracking-wider uppercase">
              Sedang Merekam Suara Anda...
            </span>
          </div>

          <div className="text-3xl font-mono font-black text-rose-300">
            {formatTime(recordingTime)}
          </div>

          <p className="text-[11px] text-slate-400">
            Bicaralah dengan jelas ke mikrofon. Maksimal durasi 60 detik.
          </p>

          <button
            type="button"
            onClick={stopRecording}
            className="bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 mx-auto cursor-pointer active:scale-95 shadow-lg shadow-rose-500/20"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Hentikan & Simpan Rekaman</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Button Record with Mic */}
          <button
            type="button"
            onClick={startRecording}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-xl text-left transition-all cursor-pointer group flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-white block group-hover:text-emerald-300">
                Mulai Merekam Suara (Mikrofon)
              </span>
              <span className="text-[10px] text-slate-400">
                Rekam langsung ucapan Anda melalui browser
              </span>
            </div>
          </button>

          {/* Button Upload Audio File */}
          <label className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 p-4 rounded-xl text-left transition-all cursor-pointer group flex items-center gap-3 relative">
            <input
              type="file"
              accept={AUDIO_FILE_ACCEPT}
              onChange={handleFileUpload}
              className="hidden"
              disabled={isProcessingFile}
            />
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-extrabold text-white block group-hover:text-cyan-300">
                {isProcessingFile ? 'Memproses Berkas...' : 'Unggah File Audio & HP Android'}
              </span>
              <span className="text-[10px] text-slate-400 block">
                Format AAC (.acc), M4A, 3GP, AMR, MP3, WAV
              </span>
            </div>
          </label>
        </div>
      )}
    </div>
  );
};
