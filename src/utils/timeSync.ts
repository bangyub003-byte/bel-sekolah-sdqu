import { TimeSyncInfo } from '../types';

let currentOffsetMs = 0;
let lastSyncTime: number | null = null;

/**
 * Perform high-precision time synchronization with server API / external NTP endpoint
 */
export async function syncTimeWithAPI(): Promise<{ offsetMs: number; latencyMs: number; source: string }> {
  // Fast fail-over when browser is completely offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      offsetMs: currentOffsetMs,
      latencyMs: 0,
      source: 'Jam Komputer Lokal (Mode Offline)',
    };
  }

  const fetchWithTimeout = async (url: string, timeoutMs = 3000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { cache: 'no-store', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const tRequest = Date.now();

  try {
    // Try primary server endpoint /api/time
    const response = await fetchWithTimeout('/api/time', 3000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const tResponse = Date.now();
    const latencyMs = Math.round((tResponse - tRequest) / 2);

    // Server reported timestamp
    const serverTimestamp = data.timestamp;
    currentOffsetMs = serverTimestamp - (tResponse - latencyMs);
    lastSyncTime = Date.now();

    return {
      offsetMs: currentOffsetMs,
      latencyMs,
      source: 'Server API (/api/time)',
    };
  } catch {
    // Fallback sync with public WorldTimeAPI
    try {
      const fbReq = Date.now();
      const fbResp = await fetchWithTimeout('https://worldtimeapi.org/api/timezone/Asia/Jakarta', 3000);
      if (fbResp.ok) {
        const fbData = await fbResp.json();
        const fbRespTime = Date.now();
        const latencyMs = Math.round((fbRespTime - fbReq) / 2);
        const serverTimestamp = fbData.unixtime * 1000;

        currentOffsetMs = serverTimestamp - (fbRespTime - latencyMs);
        lastSyncTime = Date.now();

        return {
          offsetMs: currentOffsetMs,
          latencyMs,
          source: 'WorldTimeAPI (Asia/Jakarta)',
        };
      }
    } catch {
      // Offline or unreachable
    }

    // Default to local device clock if offline / slow network
    return {
      offsetMs: currentOffsetMs,
      latencyMs: 0,
      source: 'Jam Komputer Lokal (Mode Offline)',
    };
  }
}

/**
 * Get accurate current time in milliseconds incorporating calculated offset
 */
export function getSynchronizedDate(): Date {
  return new Date(Date.now() + currentOffsetMs);
}

/**
 * Get current day of week (1 = Monday, 2 = Tuesday, ..., 6 = Saturday, 0 = Sunday)
 */
export function getDayOfWeekNumber(date: Date): number {
  return date.getDay(); // 0 = Sunday, 1 = Monday, ...
}

export function getIndonesianDayName(dayNum: number): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[dayNum] || 'Senin';
}

/**
 * Format time HH:MM:SS
 */
export function format24HourTime(date: Date, includeSeconds = true): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  if (!includeSeconds) return `${hours}:${minutes}`;
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function getCurrentSyncOffset(): number {
  return currentOffsetMs;
}

export function getLastSyncTimestamp(): number | null {
  return lastSyncTime;
}
