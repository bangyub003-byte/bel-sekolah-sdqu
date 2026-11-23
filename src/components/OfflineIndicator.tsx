import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/95 backdrop-blur-sm border border-amber-400/50 px-3.5 py-2 text-xs font-bold text-white shadow-xl animate-fadeIn">
      <WifiOff className="w-3.5 h-3.5 shrink-0 animate-pulse" />
      <span>Mode Offline Aktif — Bel tetap berbunyi otomatis dengan data tersimpan</span>
    </div>
  );
};
