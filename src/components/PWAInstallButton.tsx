import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Download,
  HardDriveDownload,
  Laptop,
  Loader2,
  Power,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { AudioSettings, MurottalConfig, ScheduleItem } from '../types';
import {
  cacheAllAppAudioForOffline,
  getOfflineCacheStats,
  OfflinePreCacheProgress,
} from '../utils/offlineCache';

interface PWAInstallButtonProps {
  schedules: ScheduleItem[];
  audioSettings: AudioSettings;
  murottalConfig: MurottalConfig;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  schedules,
  audioSettings,
  murottalConfig,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [stats, setStats] = useState<{
    totalHttpUrls: number;
    cachedHttpUrls: number;
    localCount: number;
    cachedTtsCount: number;
    totalTtsTargets: number;
    cachedScheduleTtsCount: number;
  }>({
    totalHttpUrls: 0,
    cachedHttpUrls: 0,
    localCount: 0,
    cachedTtsCount: 0,
    totalTtsTargets: 0,
    cachedScheduleTtsCount: 0,
  });
  const [isCachingAudio, setIsCachingAudio] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<OfflinePreCacheProgress | null>(null);
  const [cacheResultMsg, setCacheResultMsg] = useState<string | null>(null);
  const [cacheResultWarning, setCacheResultWarning] = useState(false);

  const refreshStats = async () => {
    const s = await getOfflineCacheStats(schedules, audioSettings, murottalConfig);
    setStats(s);
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        setSwReady(Boolean(reg && (reg.active || reg.waiting || reg.installing)));
      } catch {
        setSwReady(false);
      }
    }
  };

  useEffect(() => {
    refreshStats();
    const onReady = () => setSwReady(true);
    const onMurottalUpdated = () => refreshStats();
    window.addEventListener('pwa-offline-ready', onReady);
    window.addEventListener('murottal-tracks-updated', onMurottalUpdated);
    return () => {
      window.removeEventListener('pwa-offline-ready', onReady);
      window.removeEventListener('murottal-tracks-updated', onMurottalUpdated);
    };
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      refreshStats();
      setCacheResultMsg(null);
    }
  }, [isModalOpen, schedules, audioSettings, murottalConfig]);

  const handleInstallNow = async () => {
    const accepted = await install();
    if (accepted) {
      await refreshStats();
    }
  };

  const handleCacheAudioOffline = async () => {
    setIsCachingAudio(true);
    setCacheResultMsg(null);
    setCacheResultWarning(false);
    setCacheProgress({
      phase: stats.totalHttpUrls > 0 ? 'murottal' : 'tts',
      done: 0,
      total: Math.max(1, stats.totalHttpUrls || stats.totalTtsTargets),
      label: 'Memulai...',
      statusText: 'Menyiapkan daftar Murottal, audio bel, & suara AI TTS...',
    });
    try {
      const result = await cacheAllAppAudioForOffline(
        schedules,
        audioSettings,
        murottalConfig,
        (progress) => {
          setCacheProgress(progress);
        },
        async () => {
          await refreshStats();
        }
      );
      await refreshStats();

      const totalReadyTts = result.downloadedTts + result.alreadyCachedTts;
      const parts: string[] = [];

      if (result.totalMurottal > 0) {
        if (result.failedMurottalUrls.length === 0) {
          parts.push(`${result.murottalSuccessCount}/${result.totalMurottal} Murottal siap offline`);
        } else {
          parts.push(
            `${result.murottalSuccessCount}/${result.totalMurottal} Murottal tersimpan (${result.failedMurottalUrls.length} gagal)`
          );
        }
      }

      const otherTotal = result.totalHttp - result.totalMurottal;
      const otherSuccess = result.successCount - result.murottalSuccessCount;
      const otherFailed = result.failedUrls.length - result.failedMurottalUrls.length;
      if (otherTotal > 0) {
        if (otherFailed === 0) {
          parts.push(`${otherSuccess}/${otherTotal} audio bel/cloud siap offline`);
        } else {
          parts.push(`${otherSuccess}/${otherTotal} audio bel/cloud tersimpan (${otherFailed} gagal)`);
        }
      }

      if (result.totalTts > 0) {
        if (result.failedTts === 0) {
          parts.push(
            `${totalReadyTts}/${result.totalTts} suara AI TTS jadwal siap offline (${result.downloadedTts} baru diunduh)`
          );
        } else {
          parts.push(
            `${totalReadyTts}/${result.totalTts} suara AI TTS tersimpan (${result.failedTts} belum selesai)`
          );
        }
      }

      if (result.failedTts > 0 || result.failedUrls.length > 0) {
        setCacheResultWarning(true);
        setCacheResultMsg(
          `${parts.join(' • ') || 'Proses selesai sebagian.'}. Sebagian file gagal diunduh karena kendala jaringan; periksa koneksi internet Anda.`
        );
      } else if (parts.length === 0) {
        setCacheResultMsg(
          'Semua audio Anda sudah tersimpan secara lokal di perangkat ini dan siap dipakai tanpa internet.'
        );
      } else {
        setCacheResultMsg(
          `Berhasil! ${parts.join(' • ')}. Seluruh bel siap berbunyi 100% tanpa internet.`
        );
      }
    } finally {
      setIsCachingAudio(false);
      setCacheProgress(null);
    }
  };

  const handleDownloadAutoStartBat = () => {
    const targetUrl = typeof window !== 'undefined' ? window.location.origin : 'https://vercel.app';
    const batLines = [
      '@echo off',
      'title Bel Sekolah Otomatis - SD Quran Unggulan',
      ':: Menunggu sebentar agar sistem Windows & speaker siap',
      'timeout /t 4 /nobreak >nul',
      `set "APP_URL=${targetUrl}"`,
      '',
      ':: Prioritas 1: Microsoft Edge dalam mode Aplikasi Mandiri + Izin Suara Otomatis',
      'if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (',
      '  start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%APP_URL%" --autoplay-policy=no-user-gesture-required',
      '  exit /b',
      ')',
      'if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (',
      '  start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%APP_URL%" --autoplay-policy=no-user-gesture-required',
      '  exit /b',
      ')',
      '',
      ':: Prioritas 2: Google Chrome dalam mode Aplikasi Mandiri + Izin Suara Otomatis',
      'if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (',
      '  start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%APP_URL%" --autoplay-policy=no-user-gesture-required',
      '  exit /b',
      ')',
      'if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (',
      '  start "" "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" --app="%APP_URL%" --autoplay-policy=no-user-gesture-required',
      '  exit /b',
      ')',
      '',
      ':: Cadangan: Browser default Windows',
      'start "" "%APP_URL%"',
    ].join('\r\n');

    const blob = new Blob([batLines], { type: 'application/bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Buka-Bel-Otomatis-SD-Quran.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      {/* Compact Header Pill — clean white-surface style for 1-row header */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        title="Pengaturan Aplikasi Offline (PWA) & Buka Otomatis Saat Komputer Menyala"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
          !isOnline
            ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
            : isInstalled || isInstallable
            ? 'bg-slate-50 hover:bg-blue-50 border-slate-200 text-slate-700'
            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        {!isOnline ? (
          <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        ) : isInstallable && !isInstalled ? (
          <Download className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        ) : (
          <HardDriveDownload className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        )}
        <span>
          {!isOnline
            ? 'Offline Aktif'
            : isInstallable && !isInstalled
            ? 'Install Offline'
            : isInstalled
            ? 'App Offline'
            : 'Online (Tersimpan)'}
        </span>
      </button>

      {/* Modal Mode Offline & Auto-Start Komputer (via Portal ke document.body agar tidak terpotong header) */}
      {isModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          >
            <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-blue-100 overflow-hidden my-auto text-slate-800 animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <HardDriveDownload className="w-5 h-5 text-amber-300 shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-black leading-tight">
                    Mode Offline & Auto-Start Komputer
                  </h3>
                  <p className="text-[11px] text-blue-100 font-medium">
                    Tetap berjalan penuh dari link Vercel Anda walau internet mati / lemot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs sm:text-sm leading-relaxed">
              {/* Status Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div
                  className={`rounded-2xl p-3 border flex items-center gap-2.5 ${
                    isOnline
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {isOnline ? (
                    <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs">
                      {isOnline ? 'Koneksi Internet Tersedia' : 'Sedang Mode Offline'}
                    </div>
                    <div className="text-[11px] opacity-80 truncate">
                      {swReady
                        ? 'Sistem PWA Offline sudah aktif di browser ini'
                        : 'Buka sekali saat online agar sistem tersimpan'}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl p-3 border bg-blue-50 border-blue-200 text-blue-900 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs">
                      {isInstalled ? 'Terpasang Sebagai Aplikasi' : 'Sinkron ke Link Vercel'}
                    </div>
                    <div className="text-[11px] opacity-80 truncate">
                      {typeof window !== 'undefined' ? window.location.hostname : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 1: Install as Offline Desktop / Mobile PWA */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0">
                      1
                    </span>
                    <span>Pasang Aplikasi Offline di Komputer (PWA)</span>
                  </div>
                  {isInstalled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold">
                      <CheckCircle2 className="w-3 h-3" />
                      Terpasang
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600">
                  Aplikasi ini terhubung langsung ke link Vercel Anda, namun seluruh kode aplikasi dan jadwal tersimpan otomatis di memori komputer. Jika internet sekolah tiba-tiba terputus atau lemot, bel dan jam tetap berjalan normal memakai jam lokal komputer.
                </p>

                {!isInstalled && isInstallable && (
                  <button
                    type="button"
                    onClick={handleInstallNow}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition active:scale-95 text-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install Aplikasi Bel Sekarang (1 Klik)</span>
                  </button>
                )}

                {!isInstalled && isIOS && (
                  <div className="bg-white border border-blue-200 rounded-xl p-3 text-xs text-slate-700 flex items-start gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Untuk iPhone / iPad (Safari):</strong> Ketuk ikon{' '}
                      <strong>Bagikan (Share)</strong> di toolbar bawah, lalu pilih{' '}
                      <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
                    </div>
                  </div>
                )}

                {!isInstalled && !isInstallable && !isIOS && (
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                    Jika tombol install cepat belum muncul, buka link Vercel Anda di{' '}
                    <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong>, lalu klik
                    ikon <strong>Install (komputer/tanda +)</strong> di ujung kanan kolom alamat
                    web atau menu <strong>⋮ → Aplikasi / Apps → Install</strong>.
                  </div>
                )}
              </div>

              {/* Section 2: Pre-cache Audio & Murottal for 100% Offline Playback */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0">
                      2
                    </span>
                    <span>Simpan Semua Audio & Murottal untuk Offline</span>
                  </div>
                  <button
                    type="button"
                    onClick={refreshStats}
                    className="text-slate-400 hover:text-blue-600 p-1 rounded-lg hover:bg-white transition cursor-pointer"
                    title="Segarkan status cache"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white border border-slate-200 rounded-xl p-2">
                    <div className="text-sm font-black text-blue-700">{stats.localCount}</div>
                    <div className="text-[10px] font-semibold text-slate-500">Audio Lokal</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-2">
                    <div className="text-sm font-black text-emerald-700">
                      {stats.cachedHttpUrls}/{stats.totalHttpUrls}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500">Link/Murottal Offline</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-2">
                    <div className="text-sm font-black text-indigo-700">{stats.cachedTtsCount}</div>
                    <div className="text-[10px] font-semibold text-slate-500">
                      Suara AI Ter-cache ({stats.cachedScheduleTtsCount}/{stats.totalTtsTargets} jadwal)
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600">
                  Klik tombol di bawah saat internet tersambung untuk mengunduh nada dering cloud, Murottal, serta seluruh pengumuman Suara AI TTS (Reguler, ASAS, Jumat Ekstra & terjemahannya) agar saat offline tetap memakai suara AI utama yang fasih.
                </p>

                {cacheProgress && (
                  <div
                    className={`bg-white border rounded-xl p-2.5 space-y-1.5 ${
                      cacheProgress.phase === 'cooldown' ? 'border-amber-200' : 'border-blue-200'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between gap-2 text-[11px] font-bold ${
                        cacheProgress.phase === 'cooldown' ? 'text-amber-700' : 'text-blue-800'
                      }`}
                    >
                      <span className="truncate">{cacheProgress.statusText}</span>
                      <span className="shrink-0">
                        {cacheProgress.done}/{cacheProgress.total}
                      </span>
                    </div>
                    <div
                      className={`w-full h-2 rounded-full overflow-hidden ${
                        cacheProgress.phase === 'cooldown' ? 'bg-amber-100' : 'bg-blue-100'
                      }`}
                    >
                      <div
                        className={`h-full transition-all duration-200 ${
                          cacheProgress.phase === 'cooldown' ? 'bg-amber-500' : 'bg-blue-600'
                        }`}
                        style={{
                          width: `${Math.round(
                            (cacheProgress.done / Math.max(1, cacheProgress.total)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {cacheResultMsg && (
                  <div
                    className={`border rounded-xl p-2.5 text-xs font-semibold ${
                      cacheResultWarning
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    {cacheResultMsg}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCacheAudioOffline}
                  disabled={isCachingAudio}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-xl shadow-xs flex items-center justify-center gap-2 transition text-xs cursor-pointer"
                >
                  {isCachingAudio ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan Audio Offline...</span>
                    </>
                  ) : (
                    <>
                      <HardDriveDownload className="w-3.5 h-3.5" />
                      <span>Unduh & Simpan Paket Audio Offline</span>
                    </>
                  )}
                </button>
              </div>

              {/* Section 3: Auto-Start on Computer Boot */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0">
                    3
                  </span>
                  <span>Buka Otomatis Saat Komputer Dinyalakan</span>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-blue-600" />
                      <span>Cara A (Bawaan Chrome / Edge setelah Install App):</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Buka <code className="bg-slate-100 px-1 rounded font-mono font-bold">edge://apps</code> atau{' '}
                      <code className="bg-slate-100 px-1 rounded font-mono font-bold">chrome://apps</code> → klik
                      kanan ikon <strong>Bel Sekolah Otomatis</strong> → aktifkan{' '}
                      <strong>"Start app when you sign in"</strong> (Mulai otomatis saat masuk Windows).
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Power className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Cara B (File Launcher Otomatis Windows + Izin Audio Tanpa Klik):</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Unduh file launcher di bawah, lalu tekan{' '}
                      <strong>Windows + R</strong> → ketik{' '}
                      <code className="bg-slate-100 px-1 rounded font-mono font-bold">shell:startup</code>{' '}
                      → pindahkan file hasil unduhan ke folder Startup tersebut. Setiap PC menyala, bel otomatis terbuka dalam mode aplikasi dan audio langsung diizinkan tanpa perlu diklik.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadAutoStartBat}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-2 transition text-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Launcher Auto-Start Windows (.bat)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Selesai
              </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
