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
  return ones === 0
    ? `${INDONESIAN_ONES[tens]} puluh`
    : `${INDONESIAN_ONES[tens]} puluh ${INDONESIAN_ONES[ones]}`;
}

const JAVANESE_KRAMA_ONES = [
  'nol',
  'setunggal',
  'kalih',
  'tiga',
  'sekawan',
  'gangsal',
  'enem',
  'pitu',
  'wolu',
  'sanga',
  'sedasa',
  'sewelas',
];

function numberToJavaneseKramaWords(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 59) return String(n);
  if (n <= 11) return JAVANESE_KRAMA_ONES[n];
  if (n < 20) return `${JAVANESE_KRAMA_ONES[n - 10]} welas`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const tensLabel =
    tens === 2
      ? 'kalih dasa'
      : tens === 3
      ? 'tigang dasa'
      : tens === 4
      ? 'sekawan dasa'
      : 'seket';
  return ones === 0 ? tensLabel : `${tensLabel} ${JAVANESE_KRAMA_ONES[ones]}`;
}

const ENGLISH_ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const ENGLISH_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];

function numberToEnglishWords(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 59) return String(n);
  if (n < 20) return ENGLISH_ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? ENGLISH_TENS[tens] : `${ENGLISH_TENS[tens]} ${ENGLISH_ONES[ones]}`;
}

const ARABIC_ORDINAL_HOURS = [
  'الثَّانِيَةَ عَشْرَةَ',
  'الْوَاحِدَةُ',
  'الثَّانِيَةُ',
  'الثَّالِثَةُ',
  'الرَّابِعَةُ',
  'الْخَامِسَةُ',
  'السَّادِسَةُ',
  'السَّابِعَةُ',
  'الثَّامِنَةُ',
  'التَّاسِعَةُ',
  'الْعَاشِرَةُ',
  'الْحَادِيَةَ عَشْرَةَ',
];

const ARABIC_MIN_3_10: Record<number, string> = {
  3: 'ثَلَاثُ',
  4: 'أَرْبَعُ',
  5: 'خَمْسُ',
  6: 'سِتُّ',
  7: 'سَبْعُ',
  8: 'ثَمَانِي',
  9: 'تِسْعُ',
  10: 'عَشْرُ',
};

const ARABIC_MIN_11_19: Record<number, string> = {
  11: 'إِحْدَى عَشْرَةَ',
  12: 'اثْنَتَا عَشْرَةَ',
  13: 'ثَلَاثَ عَشْرَةَ',
  14: 'أَرْبَعَ عَشْرَةَ',
  15: 'خَمْسَ عَشْرَةَ',
  16: 'سِتَّ عَشْرَةَ',
  17: 'سَبْعَ عَشْرَةَ',
  18: 'ثَمَانِيَ عَشْرَةَ',
  19: 'تِسْعَ عَشْرَةَ',
};

const ARABIC_COMPOUND_ONES: Record<number, string> = {
  1: 'إِحْدَى',
  2: 'اثْنَتَانِ',
  3: 'ثَلَاثٌ',
  4: 'أَرْبَعٌ',
  5: 'خَمْسٌ',
  6: 'سِتٌّ',
  7: 'سَبْعٌ',
  8: 'ثَمَانٍ',
  9: 'تِسْعٌ',
};

const ARABIC_TENS: Record<number, string> = {
  2: 'عِشْرُونَ',
  3: 'ثَلَاثُونَ',
  4: 'أَرْبَعُونَ',
  5: 'خَمْسُونَ',
};

function formatSpokenArabicTime(hour: number, minute: number): string {
  const hourAr = ARABIC_ORDINAL_HOURS[hour % 12];
  const periodAr = hour < 12 ? 'صَبَاحًا' : hour < 15 ? 'ظُهْرًا' : 'مَسَاءً';

  if (minute === 0) {
    return `السَّاعَةُ الْآنَ ${hourAr} تَمَامًا ${periodAr}.`;
  }
  if (minute === 1) {
    return `السَّاعَةُ الْآنَ ${hourAr} وَدَقِيقَةٌ وَاحِدَةٌ ${periodAr}.`;
  }
  if (minute === 2) {
    return `السَّاعَةُ الْآنَ ${hourAr} وَدَقِيقَتَانِ ${periodAr}.`;
  }
  if (minute <= 10) {
    return `السَّاعَةُ الْآنَ ${hourAr} وَ${ARABIC_MIN_3_10[minute]} دَقَائِقَ ${periodAr}.`;
  }
  if (minute <= 19) {
    return `السَّاعَةُ الْآنَ ${hourAr} وَ${ARABIC_MIN_11_19[minute]} دَقِيقَةً ${periodAr}.`;
  }

  const tens = Math.floor(minute / 10);
  const ones = minute % 10;
  const minuteAr =
    ones === 0
      ? ARABIC_TENS[tens]
      : `${ARABIC_COMPOUND_ONES[ones]} وَ${ARABIC_TENS[tens]}`;

  return `السَّاعَةُ الْآنَ ${hourAr} وَ${minuteAr} دَقِيقَةً ${periodAr}.`;
}

function formatSpokenJavaneseTime(hour: number, minute: number): string {
  const hourWords = numberToJavaneseKramaWords(hour);
  if (minute === 0) {
    return `Sakmenika tabuh ${hourWords} trep.`;
  }
  const minuteWords = numberToJavaneseKramaWords(minute);
  return `Sakmenika tabuh ${hourWords} langkung ${minuteWords} menit.`;
}

function formatSpokenEnglishTime(hour: number, minute: number): string {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const hourWords = numberToEnglishWords(hour12);
  const period = hour < 12 ? 'a.m.' : 'p.m.';

  if (minute === 0) {
    return `It is now ${hourWords} o'clock ${period}.`;
  }
  const minuteWords = numberToEnglishWords(minute);
  if (minute < 10) {
    return `It is now ${hourWords} oh ${minuteWords} ${period}.`;
  }
  return `It is now ${hourWords} ${minuteWords} ${period}.`;
}

/**
 * Formats an HH:MM string into natural spoken Indonesian for crisp AI TTS & Web Speech pronunciation.
 * Examples:
 * - "07:00" -> "Sekarang pukul tujuh tepat."
 * - "07:20" -> "Sekarang pukul tujuh lewat dua puluh menit."
 * - "12:30" -> "Sekarang pukul dua belas lewat tiga puluh menit."
 */
export function formatSpokenIndonesianTime(hhmm?: string): string {
  return formatSpokenTime(hhmm, 'id');
}

/**
 * Formats an HH:MM string into natural spoken time matching the selected schedule language
 * ('id' Indonesian, 'jv' Javanese Krama, 'en' English, 'ar' Arabic Fusha).
 */
export function formatSpokenTime(hhmm?: string, language: SpeechLanguage = 'id'): string {
  if (!hhmm) return '';
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return '';
  }

  if (language === 'jv') {
    return formatSpokenJavaneseTime(hour, minute);
  }
  if (language === 'en') {
    return formatSpokenEnglishTime(hour, minute);
  }
  if (language === 'ar') {
    return formatSpokenArabicTime(hour, minute);
  }

  const hourWords = numberToIndonesianWords(hour);
  if (minute === 0) {
    return `Sekarang pukul ${hourWords} tepat.`;
  }

  const minuteWords = numberToIndonesianWords(minute);
  return `Sekarang pukul ${hourWords} lewat ${minuteWords} menit.`;
}

/**
 * Combines fixed schedule spoken time + announcement body into one unified string
 * so offline pre-caching and live playback generate the exact same CacheStorage key.
 */
export function buildAnnouncementWithTime(
  hhmm: string | undefined,
  language: SpeechLanguage,
  announcementText: string
): string {
  const timePart = formatSpokenTime(hhmm, language).trim();
  const bodyPart = (announcementText || '').trim();
  if (!timePart) return bodyPart;
  if (!bodyPart) return timePart;
  return `${timePart} ${bodyPart}`;
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
