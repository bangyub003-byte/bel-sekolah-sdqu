import React, { useState } from 'react';
import {
  BellRing,
  Clock,
  Sliders,
  CalendarDays,
  History,
  Volume2,
  CheckCircle2,
  Wifi,
  Sparkles,
  Music,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudUpload,
  LogIn,
  LogOut,
} from 'lucide-react';
import { TimeSyncInfo } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  timeSyncInfo: TimeSyncInfo;
  onQuickTestBell: () => void;
  isAudioUnlocked: boolean;
  isMurottalPlaying?: boolean;
  cloudAuthEmail?: string | null;
  cloudStatus?: 'connecting' | 'synced' | 'syncing' | 'error';
  onCloudLogin?: () => void;
  onCloudLogout?: () => void;
  onForcePushCloud?: () => void;
  pwaInstallNode?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  timeSyncInfo,
  onQuickTestBell,
  isAudioUnlocked,
  isMurottalPlaying,
  cloudAuthEmail,
  cloudStatus = 'connecting',
  onCloudLogin,
  onCloudLogout,
  onForcePushCloud,
  pwaInstallNode,
}) => {
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);

  const tabs = [
    { id: 'schedule', label: 'Jadwal Bel Otomatis', icon: CalendarDays },
    { id: 'murottal', label: 'Murottal Otomatis', icon: BookOpen, badge: isMurottalPlaying ? 'MEMUTAR' : 'OTOMATIS' },
    { id: 'chimes', label: 'Nada Dering Bel', icon: Music },
    { id: 'manual', label: 'Pad Bel Manual', icon: BellRing },
    { id: 'time-sync', label: 'Integrasi API Waktu', icon: Clock },
    { id: 'voice', label: 'Pengaturan Suara & TTS', icon: Sliders },
    { id: 'logs', label: 'Riwayat Bell', icon: History },
  ];

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-blue-100 sticky top-0 z-40 shadow-[0_4px_20px_-4px_rgba(30,58,138,0.06)]">
      {/* Top Banner Gradient - Fresh Sky & Royal Blue Accent */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white px-4 py-2 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:row items-center justify-between gap-2 text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 backdrop-blur-xs border border-white/30 px-2.5 py-0.5 rounded-full font-extrabold text-white flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              SD QUR'AN UNGGULAN
            </span>
            <span className="hidden md:inline text-blue-100 text-xs">
              Gunungkidul • Tahun Ajaran 2026/2027
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Sync Badge */}
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20 text-xs">
              <Wifi className={`w-3.5 h-3.5 ${timeSyncInfo.status === 'synced' ? 'text-emerald-300 animate-pulse' : 'text-amber-300'}`} />
              <span>
                {timeSyncInfo.status === 'synced' ? (
                  <span className="text-white">
                    NTP Presisi: <span className="font-mono font-bold text-amber-200">{timeSyncInfo.offsetMs >= 0 ? `+${timeSyncInfo.offsetMs}` : timeSyncInfo.offsetMs}ms</span>
                  </span>
                ) : (
                  <span className="text-amber-200">Sinkronisasi Waktu...</span>
                )}
              </span>
            </div>

            {/* Audio State Badge (Compact dot) */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              isAudioUnlocked
                ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/30'
                : 'bg-amber-400/20 text-amber-100 border border-amber-300/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isAudioUnlocked ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
              <span>{isAudioUnlocked ? 'Audio Aktif' : 'Aktifkan Audio'}</span>
            </div>

            {/* Compact Cloud Real-Time Sync Pill */}
            {cloudAuthEmail ? (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/25 text-xs">
                <Cloud className={`w-3.5 h-3.5 ${cloudStatus === 'syncing' ? 'text-amber-300 animate-pulse' : cloudStatus === 'error' ? 'text-rose-300' : 'text-emerald-300'}`} />
                <span className="font-bold text-white hidden sm:inline">
                  {cloudStatus === 'syncing' ? 'Menyimpan...' : 'Cloud Sync'}
                </span>
                {onForcePushCloud && (
                  <button
                    onClick={onForcePushCloud}
                    title="Kirim pengaturan perangkat ini ke semua perangkat (Cloud)"
                    className="p-0.5 rounded hover:bg-white/20 text-blue-100 hover:text-white transition cursor-pointer"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                  </button>
                )}
                {onCloudLogout && (
                  <button
                    onClick={onCloudLogout}
                    title={`Keluar (${cloudAuthEmail})`}
                    className="p-0.5 rounded hover:bg-white/20 text-blue-100 hover:text-white transition cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              onCloudLogin && (
                <button
                  onClick={onCloudLogin}
                  title="Masuk akun Google Admin untuk menyinkronkan editan ke semua perangkat & tab"
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/25 text-xs font-bold text-white transition cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-300" />
                  <span>Login Sync</span>
                </button>
              )
            )}

            {/* Compact Offline / PWA App Install & Auto-Start Pill */}
            {pwaInstallNode}
          </div>
        </div>
      </div>

      {/* Main Nav Header */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-500 p-0.5 shadow-md shadow-blue-500/25 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-blue-600">
              <BellRing className="w-5 h-5 animate-pulse text-blue-600" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                BEL SEKOLAH OTOMATIS
              </h1>
              <span className="hidden sm:inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                SD Qur'an
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Sistem Bel Presisi & Murottal Otomatis • Full Voice Synthesizer
            </p>
          </div>
        </div>

        {/* Buttons: Quick Test Bell & Toggle Menu */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title={isMenuCollapsed ? "Tampilkan Menu Pilihan" : "Sembunyikan Menu Pilihan"}
          >
            {isMenuCollapsed ? (
              <>
                <ChevronDown className="w-4 h-4 text-blue-600" />
                <span>Buka Menu</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-4 h-4 text-slate-500" />
                <span>Sembunyikan Menu</span>
              </>
            )}
          </button>

          <button
            onClick={onQuickTestBell}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>Tes Bell Seketika</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar (Collapsible) */}
      {!isMenuCollapsed && (
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto scrollbar-none border-t border-slate-100 animate-fadeIn">
          <div className="flex items-center gap-1.5 py-2 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : tab.badge === 'MEMUTAR'
                        ? 'bg-amber-100 text-amber-700 animate-pulse'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
