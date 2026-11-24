import { AudioSettings, AudioType, SpeechLanguage } from '../types';

const INDONESIAN_ONES = [
  'nol',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas',
];

function numberToIndonesianWords(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 59) return String(n);
  if (n <= 11) return INDONESIAN_ONES[n];
  if (n < 20) return `${INDONESIAN_ONES[n - 10]} belas`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? `${INDONESIAN_ONES[tens]} puluh` : `${INDONESIAN_ONES[tens]} puluh ${INDONESIAN_ONES[ones]}`;
}

/**
 * Formats an HH:MM string into natural spoken Indonesian for crisp AI TTS & Web Speech pronunciation.
 * Examples:
 * - "07:00" -> "Sekarang pukul tujuh tepat."
 * - "07:20" -> "Sekarang pukul tujuh lewat dua puluh menit."
 * - "12:30" -> "Sekarang pukul dua belas lewat tiga puluh menit."
 */
export function formatSpokenIndonesianTime(hhmm?: string): string {
  if (!hhmm) return '';
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return '';
  }

  const hourWords = numberToIndonesianWords(hour);
  if (minute === 0) {
    return `Sekarang pukul ${hourWords} tepat.`;
  }

  const minuteWords = numberToIndonesianWords(minute);
  return `Sekarang pukul ${hourWords} lewat ${minuteWords} menit.`;
}

/**
 * Resolves whether and with which AI voice the current-time announcement should be spoken.
 * Shared between playBellSequence() and offline pre-caching so cache keys match 100%.
 */
export function resolveTimeAnnouncementConfig(
  audioType: AudioType,
  speechLanguage: SpeechLanguage,
  settings: AudioSettings,
  clonedVoiceId?: string
): {
  shouldAnnounceTime: boolean;
  voiceName: string;
  voiceDescription: string;
} {
  const useMultilingualAi = speechLanguage !== 'id';
  const shouldAnnounceTime =
    settings.enableTTS !== false || audioType === 'cloned' || useMultilingualAi;

  const targetVoiceId =
    clonedVoiceId || (settings.useClonedVoice ? settings.activeClonedVoiceId : undefined);
  const activeProfile = settings.clonedProfiles?.find((p) => p.id === targetVoiceId);

  const voiceName =
    audioType === 'cloned'
      ? activeProfile?.prebuiltVoiceFallback || (targetVoiceId === 'Puck' ? 'Puck' : 'Fenrir')
      : 'Fenrir';

  const voiceDescription =
    audioType === 'cloned' ? activeProfile?.name || 'Suara Pria AI' : 'Suara Pria AI';

  return {
    shouldAnnounceTime,
    voiceName,
    voiceDescription,
  };
}
