import React from 'react';
import {
  BellRing,
  Clock,
  Sliders,
  CalendarDays,
  Activity,
  History,
  Volume2,
  CheckCircle2,
  Wifi,
  Sparkles,
  Music,
} from 'lucide-react';
import { TimeSyncInfo } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  timeSyncInfo: TimeSyncInfo;
  onQuickTestBell: () => void;
  isAudioUnlocked: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  timeSyncInfo,
  onQuickTestBell,
  isAudioUnlocked,
}) => {
  const tabs = [
    { id: 'schedule', label: 'Jadwal Bel Otomatis', icon: CalendarDays },
    { id: 'chimes', label: 'Nada Dering Bel', icon: Music },
    { id: 'manual', label: 'Pad Bel Manual', icon: BellRing },
    { id: 'time-sync', label: 'Integrasi API Waktu', icon: Clock },
    { id: 'voice', label: 'Pengaturan Suara & TTS', icon: Sliders },
    { id: 'logs', label: 'Riwayat Bell', icon: History },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
      {/* Top Banner Gradient */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white px-4 py-2.5 shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-950/40 border border-emerald-300/30 px-2 py-0.5 rounded-md font-bold text-emerald-100 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              SD QUR'AN UNGGULAN
            </span>
            <span className="hidden md:inline text-emerald-100/90">
              Gunungkidul • Tahun Ajaran 2026/2027
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Badge */}
            <div className="flex items-center gap-1.5 bg-slate-950/40 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20 text-xs">
              <Wifi className={`w-3.5 h-3.5 ${timeSyncInfo.status === 'synced' ? 'text-emerald-300 animate-pulse' : 'text-amber-300'}`} />
              <span>
                {timeSyncInfo.status === 'synced' ? (
                  <span className="text-emerald-200">
                    NTP API Presisi: <span className="font-mono text-white font-bold">{timeSyncInfo.offsetMs >= 0 ? `+${timeSyncInfo.offsetMs}` : timeSyncInfo.offsetMs}ms</span>
                  </span>
                ) : (
                  <span className="text-amber-200">Menyinkronkan Waktu...</span>
                )}
              </span>
            </div>

            {/* Audio State Badge */}
            <div className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isAudioUnlocked
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
            }`}>
              {isAudioUnlocked ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isAudioUnlocked ? 'Audio Aktif' : 'Audio Perlu Diaktifkan'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Nav Header */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
              <BellRing className="w-6 h-6 animate-pulse text-emerald-400" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                BEL SEKOLAH OTOMATIS
              </h1>
              <span className="hidden sm:inline-block bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                Full Color Pro
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              SD QUR'AN UNGGULAN • Jadwal & Voice Synthesizer Real-Time
            </p>
          </div>
        </div>

        {/* Quick Test Bell Button */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={onQuickTestBell}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>Tes Bell Seketika</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="max-w-7xl mx-auto px-4 overflow-x-auto scrollbar-none border-t border-slate-800">
        <div className="flex items-center gap-2 py-2 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-emerald-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
