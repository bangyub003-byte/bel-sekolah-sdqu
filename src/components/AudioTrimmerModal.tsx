import React, { useEffect, useRef, useState } from 'react';
import {
  Scissors,
  Play,
  Square,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { getAudioContext } from '../utils/audioSynth';
import {
  blobToDataUrl,
  decodeAudioBufferFromUrl,
  extractWaveformPeaks,
  trimAudioBufferToWavBlob,
} from '../utils/audioTrimmer';
import { uploadAudioToCloudinary } from '../utils/cloudAudioUtils';

interface AudioTrimmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioUrl: string;
  audioTitle: string;
  fileName?: string;
  isExistingChime?: boolean;
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  onApplyTrim: (result: {
    audioUrl: string;
    fileName: string;
    durationSec: number;
    saveMode: 'replace' | 'save_as_new';
  }) => void;
}

export const AudioTrimmerModal: React.FC<AudioTrimmerModalProps> = ({
  isOpen,
  onClose,
  audioUrl,
  audioTitle,
  fileName = 'nada_dering.mp3',
  isExistingChime = false,
  cloudinaryCloudName,
  cloudinaryUploadPreset,
  onApplyTrim,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [fadeOutSec, setFadeOutSec] = useState(0.5);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playheadSec, setPlayheadSec] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stopPreviewPlayback = () => {
    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch {}
      previewSourceRef.current = null;
    }
    setIsPlayingPreview(false);
    setPlayheadSec(null);
  };

  useEffect(() => {
    if (!isOpen || !audioUrl) return;
    let cancelled = false;

    setIsLoading(true);
    setLoadError(null);
    stopPreviewPlayback();

    decodeAudioBufferFromUrl(audioUrl)
      .then((buf) => {
        if (cancelled) return;
        audioBufferRef.current = buf;
        const dur = Number(buf.duration.toFixed(2));
        setDuration(dur);
        setStartSec(0);
        setEndSec(dur);
        setPeaks(extractWaveformPeaks(buf, 120));
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadError(
          err?.message ||
            'Audio tidak dapat didekode oleh browser. Pastikan link bersifat publik atau format didukung.'
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      stopPreviewPlayback();
    };
  }, [isOpen, audioUrl]);

  // Draw waveform + cut selection overlays + live playhead
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0 || duration <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const startRatio = Math.max(0, Math.min(1, startSec / duration));
    const endRatio = Math.max(startRatio, Math.min(1, endSec / duration));
    const startX = startRatio * width;
    const endX = endRatio * width;

    // Dimmed cut regions (left & right discarded sections)
    ctx.fillStyle = 'rgba(244, 63, 94, 0.14)';
    if (startX > 0) {
      ctx.fillRect(0, 0, startX, height);
    }
    if (endX < width) {
      ctx.fillRect(endX, 0, width - endX, height);
    }

    // Selected active highlight window
    ctx.fillStyle = 'rgba(16, 185, 129, 0.10)';
    ctx.fillRect(startX, 0, Math.max(2, endX - startX), height);

    // Waveform bars
    const barGap = 2;
    const barWidth = Math.max(1.5, width / peaks.length - barGap);
    peaks.forEach((peak, idx) => {
      const ratio = idx / peaks.length;
      const x = ratio * width;
      const barH = Math.max(4, peak * (height - 14));
      const y = (height - barH) / 2;

      const inSelection = ratio >= startRatio && ratio <= endRatio;
      ctx.fillStyle = inSelection ? '#10b981' : '#475569';
      ctx.fillRect(x, y, barWidth, barH);
    });

    // Cut boundary lines
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();

    // Live playhead cursor
    if (playheadSec !== null) {
      const px = Math.max(0, Math.min(1, playheadSec / duration)) * width;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
  }, [peaks, duration, startSec, endSec, playheadSec]);

  const playRangePreview = (fromSec: number, toSec: number) => {
    const buffer = audioBufferRef.current;
    if (!buffer) return;

    stopPreviewPlayback();

    const safeFrom = Math.max(0, Math.min(fromSec, buffer.duration - 0.1));
    const safeTo = Math.max(safeFrom + 0.1, Math.min(toSec, buffer.duration));
    const clipDur = safeTo - safeFrom;

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    const actualFadeOut = Math.min(fadeOutSec, clipDur * 0.45);
    gainNode.gain.setValueAtTime(1.0, now);
    if (actualFadeOut > 0.01 && clipDur > actualFadeOut) {
      gainNode.gain.setValueAtTime(1.0, now + clipDur - actualFadeOut);
      gainNode.gain.linearRampToValueAtTime(0.0001, now + clipDur);
    }

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    previewSourceRef.current = source;
    setIsPlayingPreview(true);

    const startedAtMs = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startedAtMs) / 1000;
      if (elapsed >= clipDur) {
        stopPreviewPlayback();
        return;
      }
      setPlayheadSec(safeFrom + elapsed);
      previewRafRef.current = requestAnimationFrame(tick);
    };
    previewRafRef.current = requestAnimationFrame(tick);

    source.onended = () => {
      stopPreviewPlayback();
    };

    source.start(0, safeFrom, clipDur);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || duration <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickedSec = Number((ratio * duration).toFixed(1));

    // Snap whichever boundary (start or end) is closer to the click
    const distStart = Math.abs(clickedSec - startSec);
    const distEnd = Math.abs(clickedSec - endSec);
    if (distStart < distEnd && clickedSec < endSec - 0.3) {
      setStartSec(clickedSec);
    } else if (clickedSec > startSec + 0.3) {
      setEndSec(clickedSec);
    }
  };

  const handleTrimAndExport = async (saveMode: 'replace' | 'save_as_new' | 'download_only') => {
    const buffer = audioBufferRef.current;
    if (!buffer) return;

    stopPreviewPlayback();
    setIsExporting(true);
    setLoadError(null);

    try {
      const wavBlob = await trimAudioBufferToWavBlob(buffer, startSec, endSec, fadeOutSec, 0.04);
      const baseClean = fileName.replace(/\.[^/.]+$/, '');
      const trimmedFileName = `${baseClean}_potong.wav`;
      const trimmedDur = Math.max(1, Math.round(endSec - startSec));

      if (saveMode === 'download_only') {
        const blobUrl = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = trimmedFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        setIsExporting(false);
        return;
      }

      let finalUrl: string | null = null;
      if (cloudinaryCloudName) {
        try {
          const uploaded = await uploadAudioToCloudinary(
            wavBlob,
            trimmedFileName,
            cloudinaryCloudName,
            cloudinaryUploadPreset
          );
          finalUrl = uploaded.url;
        } catch {
          // Graceful local fallback
        }
      }

      if (!finalUrl) {
        finalUrl = await blobToDataUrl(wavBlob);
      }

      onApplyTrim({
        audioUrl: finalUrl,
        fileName: trimmedFileName,
        durationSec: trimmedDur,
        saveMode,
      });
      onClose();
    } catch (err: any) {
      setLoadError(err?.message || 'Gagal memotong dan menyimpan audio.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const trimmedDuration = Math.max(0, endSec - startSec);
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-white truncate">
                Pemotong Audio Nada Dering
              </h3>
              <p className="text-xs text-slate-400 truncate">
                {audioTitle} {duration > 0 ? `• Durasi asli ${formatTime(duration)}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopPreviewPlayback();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-300 font-semibold">
              Membaca gelombang suara audio...
            </p>
          </div>
        ) : loadError ? (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 p-4 rounded-2xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Gagal Memuat Audio ke Pemotong</p>
              <p className="text-rose-300/90">{loadError}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Waveform Display */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Klik pada grafik gelombang untuk menggeser titik potong awal/akhir</span>
                <span className="font-mono text-emerald-400 font-bold">
                  Terpilih: {trimmedDuration.toFixed(1)} detik
                </span>
              </div>
              <canvas
                ref={canvasRef}
                width={640}
                height={96}
                onClick={handleCanvasClick}
                className="w-full h-24 rounded-xl bg-slate-900/90 cursor-crosshair block"
              />
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>0:00.0</span>
                <span className="text-rose-400">Area merah muda = bagian terbuang</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Start & End Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Start Cut */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Potong Awal (Mulai)</span>
                  <span className="font-mono text-xs font-black text-emerald-400">
                    {startSec.toFixed(1)}d
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, Number((endSec - 0.3).toFixed(1)))}
                  step={0.1}
                  value={startSec}
                  onChange={(e) => setStartSec(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setStartSec(Math.max(0, Number((startSec - 0.5).toFixed(1))))}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-bold cursor-pointer"
                  >
                    -0.5d
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartSec(0)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-bold cursor-pointer"
                  >
                    Awal (0d)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setStartSec(Math.min(Number((endSec - 0.3).toFixed(1)), Number((startSec + 0.5).toFixed(1))))
                    }
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-bold cursor-pointer"
                  >
                    +0.5d
                  </button>
                </div>
              </div>

              {/* End Cut */}
              <div className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">Potong Akhir (Berhenti)</span>
                  <span className="font-mono text-xs font-black text-amber-400">
                    {endSec.toFixed(1)}d
                  </span>
                </div>
                <input
                  type="range"
                  min={Math.min(duration, Number((startSec + 0.3).toFixed(1)))}
                  max={duration}
                  step={0.1}
                  value={endSec}
                  onChange={(e) => setEndSec(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEndSec(Math.max(Number((startSec + 0.3).toFixed(1)), Number((endSec - 2).toFixed(1))))
                    }
                    className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[11px] text-amber-300 font-bold cursor-pointer border border-amber-500/30"
                  >
                    -2d
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEndSec(Math.max(Number((startSec + 0.3).toFixed(1)), Number((endSec - 0.5).toFixed(1))))
                    }
                    className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[11px] text-amber-300 font-bold cursor-pointer border border-amber-500/30"
                  >
                    -0.5d
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEndSec(Math.min(duration, Number((endSec + 0.5).toFixed(1))))
                    }
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-bold cursor-pointer"
                  >
                    +0.5d
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndSec(duration)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-bold cursor-pointer"
                    title="Kembalikan ke durasi penuh"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Fade Out + Quick Preview Buttons */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-slate-300 font-semibold">Pudar Halus Akhir:</span>
                <select
                  value={fadeOutSec}
                  onChange={(e) => setFadeOutSec(parseFloat(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={0}>Tanpa Pudar (Langsung)</option>
                  <option value={0.5}>0.5 detik (Halus)</option>
                  <option value={1}>1.0 detik (Lembut)</option>
                  <option value={1.5}>1.5 detik (Sangat Lembut)</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isPlayingPreview ? (
                  <button
                    type="button"
                    onClick={stopPreviewPlayback}
                    className="bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Hentikan</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => playRangePreview(Math.max(startSec, endSec - 3.5), endSec)}
                      className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      title="Dengarkan 3.5 detik terakhir tepat sebelum titik potong akhir"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Cek Bagian Akhir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => playRangePreview(startSec, endSec)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Putar Hasil Potongan</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Footer Save Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleTrimAndExport('download_only')}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh .WAV</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => {
                    stopPreviewPlayback();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  Batal
                </button>

                {isExistingChime ? (
                  <>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => handleTrimAndExport('save_as_new')}
                      className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Simpan Sebagai Baru</span>
                    </button>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => handleTrimAndExport('replace')}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Scissors className="w-3.5 h-3.5" />
                      )}
                      <span>{isExporting ? 'Memproses...' : 'Simpan & Timpa Nada Ini'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() => handleTrimAndExport('replace')}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {isExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Scissors className="w-3.5 h-3.5" />
                    )}
                    <span>{isExporting ? 'Memproses...' : 'Terapkan Potongan Audio'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
