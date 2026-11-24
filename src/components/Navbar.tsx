import React, { useState, useRef, useEffect } from 'react';
import {
  BellRing,
  Clock,
  Sliders,
  CalendarDays,
  History,
  Volume2,
  Music,
  BookOpen,
  Cloud,
  CloudUpload,
  LogIn,
  LogOut,
  ChevronDown,
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
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isSettingsMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isSettingsMenuOpen]);

  const isSettingsTabActive =
    activeTab === 'voice' || activeTab === 'time-sync' || activeTab === 'logs';

  const primaryTabs = [
    { id: 'schedule', label: 'Jadwal Bel', icon: CalendarDays },
    { id: 'murottal', label: 'Murottal', icon: BookOpen, activeDot: Boolean(isMurottalPlaying) },
    { id: 'chimes', label: 'Nada Dering', icon: Music },
    { id: 'manual', label: 'Pad Manual', icon: BellRing },
  ];

  const settingsSubItems = [
    { id: 'voice', label: 'Pengaturan Suara & TTS', icon: Sliders },
    { id: 'time-sync', label: 'Integrasi API Waktu', icon: Clock },
    { id: 'logs', label: 'Riwayat Bel', icon: History },
  ];

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Lockup */}
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className="flex items-center gap-3 text-left shrink-0 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/25 shrink-0 group-hover:bg-blue-700 transition-colors">
              <BellRing className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
                  BEL SEKOLAH
                </span>
                <span className="bg-blue-50 text-blue-700 border border-blue-200/80 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap">
                  Otomatis
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap truncate max-w-[190px] sm:max-w-none">
                SD Qur&apos;an Unggulan Gunungkidul
              </p>
            </div>
          </button>

          {/* Zone 2: Center 1-Line Navigation Bar */}
          <nav
            aria-label="Navigasi Utama"
            className="hidden lg:flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-xl p-1"
          >
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsSettingsMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-xs border border-blue-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.activeDot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
              );
            })}

            {/* Pengaturan Dropdown (Voice, Time Sync, Logs) */}
            <div className="relative" ref={settingsDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  if (!isSettingsTabActive) {
                    setActiveTab('voice');
                  }
                  setIsSettingsMenuOpen((prev) => !prev);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isSettingsTabActive
                    ? 'bg-white text-blue-700 shadow-xs border border-blue-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 border border-transparent'
                }`}
              >
                <Sliders
                  className={`w-3.5 h-3.5 ${isSettingsTabActive ? 'text-blue-600' : 'text-slate-400'}`}
                />
                <span>Pengaturan</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isSettingsMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50">
                  {settingsSubItems.map((sub) => {
                    const SubIcon = sub.icon;
                    const subActive = activeTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(sub.id);
                          setIsSettingsMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          subActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <SubIcon className={`w-3.5 h-3.5 ${subActive ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Zone 3: Status Controls & Primary Test Bell Action */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Audio Active Status */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 ${
                isAudioUnlocked
                  ? 'bg-emerald-50 border-emerald-200/80 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isAudioUnlocked ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>{isAudioUnlocked ? 'Audio Aktif' : 'Audio Siaga'}</span>
            </div>

            {/* Offline / PWA Modal Trigger */}
            {pwaInstallNode}

            {/* Cloud Sync Compact Action */}
            {cloudAuthEmail ? (
              <div className="hidden xl:flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 shrink-0">
                <Cloud
                  className={`w-3.5 h-3.5 ${
                    cloudStatus === 'syncing'
                      ? 'text-amber-500 animate-pulse'
                      : cloudStatus === 'error'
                      ? 'text-rose-500'
                      : 'text-emerald-600'
                  }`}
                />
                <span className="font-semibold whitespace-nowrap">
                  {cloudStatus === 'syncing' ? 'Menyimpan...' : 'Cloud Sync'}
                </span>
                {onForcePushCloud && (
                  <button
                    type="button"
                    onClick={onForcePushCloud}
                    title="Kirim pengaturan perangkat ini ke semua perangkat (Cloud)"
                    className="p-0.5 rounded hover:bg-slate-200 text-slate-500 hover:text-blue-700 transition cursor-pointer"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                  </button>
                )}
                {onCloudLogout && (
                  <button
                    type="button"
                    onClick={onCloudLogout}
                    title={`Keluar (${cloudAuthEmail})`}
                    className="p-0.5 rounded hover:bg-slate-200 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              onCloudLogin && (
                <button
                  type="button"
                  onClick={onCloudLogin}
                  title="Masuk akun Google Admin untuk menyinkronkan editan ke semua perangkat"
                  className="hidden xl:flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5 text-blue-600" />
                  <span>Login Sync</span>
                </button>
              )
            )}

            {/* Primary CTA: Tes Bel */}
            <button
              type="button"
              onClick={onQuickTestBell}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-xs shadow-blue-600/20 flex items-center gap-1.5 transition-all active:scale-95 text-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Tes Bel</span>
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Compact 1-Row Horizontal Navigation Strip */}
        <div className="flex lg:hidden items-center gap-1.5 pb-2.5 overflow-x-auto scrollbar-none">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-50 text-slate-600 border border-slate-200/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          {settingsSubItems.map((sub) => {
            const SubIcon = sub.icon;
            const isActive = activeTab === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveTab(sub.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-50 text-slate-600 border border-slate-200/80'
                }`}
              >
                <SubIcon className="w-3.5 h-3.5" />
                <span>{sub.label}</span>
              </button>
            );
          })}
          {cloudAuthEmail ? (
            onCloudLogout && (
              <button
                type="button"
                onClick={onCloudLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Cloud Sync</span>
              </button>
            )
          ) : (
            onCloudLogin && (
              <button
                type="button"
                onClick={onCloudLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-600" />
                <span>Login Sync</span>
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
};
