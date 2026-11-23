import { AudioSettings, DayOfWeek, ScheduleItem } from '../types';
import { DEFAULT_ASAS_SCHEDULES } from '../data/asasSchedule';

export const FRIDAY_EARLY_DISMISSAL_ID = 'jumat-pulang-ekstra-libur';
export const DEFAULT_FRIDAY_EARLY_TIME = '12:30';

const EKSTRA_KEYWORD_REGEX = /\b(ekstra|ekskul|ekstrakurikuler|pramuka)\b/i;

export function getFridayEarlyDismissalTime(settings?: AudioSettings): string {
  const raw = settings?.fridayEarlyDismissalTime?.trim();
  if (raw && /^\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }
  return DEFAULT_FRIDAY_EARLY_TIME;
}

/**
 * Checks whether a regular schedule item should be temporarily skipped on Friday (day 5)
 * because Friday Ekstrakurikuler is set to Libur / Pulang Lebih Awal.
 * Never affects Monday-Thursday or Saturday.
 */
export function isFridayEkstraSuppressedItem(
  item: ScheduleItem,
  day: DayOfWeek,
  settings?: AudioSettings
): boolean {
  if (day !== 5 || !settings?.fridayExtraOff) return false;
  if (item.id === FRIDAY_EARLY_DISMISSAL_ID) return false;

  const earlyTime = getFridayEarlyDismissalTime(settings);
  if (item.time >= earlyTime) {
    return true;
  }

  if (EKSTRA_KEYWORD_REGEX.test(item.label) || EKSTRA_KEYWORD_REGEX.test(item.speechText)) {
    return true;
  }

  return false;
}

/**
 * Builds the active Friday early-dismissal bell schedule (default 12:30 WIB),
 * inheriting the school's dismissal chime / outro / voice preferences.
 */
export function buildFridayEarlyDismissalSchedule(
  schedules: ScheduleItem[],
  settings: AudioSettings
): ScheduleItem {
  const earlyTime = getFridayEarlyDismissalTime(settings);

  // Prefer any existing afternoon dismissal bell (e.g., Friday afternoon dismissal or 13:45 dismissal)
  const fridayAfternoonDismissal = schedules.find(
    (s) =>
      s.category === 'dismissal' &&
      s.days.includes(5) &&
      s.time >= '12:00' &&
      s.id !== FRIDAY_EARLY_DISMISSAL_ID
  );
  const weekdayDismissal =
    schedules.find((s) => s.id === 's-1345') ||
    schedules.find(
      (s) =>
        s.category === 'dismissal' &&
        s.time >= '12:00' &&
        s.id !== FRIDAY_EARLY_DISMISSAL_ID
    );
  const template = fridayAfternoonDismissal || weekdayDismissal;

  const useRecordedDismissalVoice =
    template?.audioType === 'recording' && Boolean(template.customAudioUrl);

  return {
    id: FRIDAY_EARLY_DISMISSAL_ID,
    time: earlyTime,
    label: 'Jam Pulang Hari Jumat (Ekstra Libur)',
    category: 'dismissal',
    speechText:
      'seluruh kegiatan belajar hari Jumat telah selesai karena ekstrakurikuler diliburkan. Persiapkan peralatan Anda dan mari berdoa sebelum pulang setelah sholat Jumat. Hati-hati di jalan.',
    chimeType: template?.chimeType || 'school_dismissal',
    customChimeUrl: template?.customChimeUrl,
    customChimeName: template?.customChimeName,
    enableOutroChime: template?.enableOutroChime ?? settings.enableGlobalOutroChime,
    outroChimeType: template?.outroChimeType ?? settings.globalOutroChimeType,
    customOutroChimeUrl: template?.customOutroChimeUrl ?? settings.globalOutroChimeUrl,
    customOutroChimeName: template?.customOutroChimeName ?? settings.globalOutroChimeName,
    days: [5],
    enabled: true,
    volume: template?.volume ?? 1.0,
    audioType: useRecordedDismissalVoice
      ? 'recording'
      : settings.useClonedVoice
      ? 'cloned'
      : 'tts',
    customAudioUrl: useRecordedDismissalVoice ? template?.customAudioUrl : undefined,
    customAudioName: useRecordedDismissalVoice ? template?.customAudioName : undefined,
    clonedVoiceId: settings.useClonedVoice ? settings.activeClonedVoiceId : undefined,
  };
}

/**
 * Returns IDs and times of existing afternoon/weekday dismissal bells so any Post-Bell
 * Recording attached to regular Jam Pulang (e.g., 13:45 or Friday Ekstra dismissal)
 * also automatically plays when Friday Early Dismissal (12:30) triggers.
 */
export function getDismissalPostBellMatchTargets(schedules: ScheduleItem[]): {
  matchIds: string[];
  matchTimes: string[];
} {
  const matchIds = new Set<string>([FRIDAY_EARLY_DISMISSAL_ID]);
  const matchTimes = new Set<string>();

  for (const s of schedules) {
    if (s.category === 'dismissal' && s.time >= '12:00') {
      matchIds.add(s.id);
      matchTimes.add(s.time);
    }
  }

  return {
    matchIds: Array.from(matchIds),
    matchTimes: Array.from(matchTimes),
  };
}

/**
 * Returns the active, sorted schedules for a given day after applying ASAS mode or Friday Extra mode.
 */
export function getEffectiveDaySchedules(
  schedules: ScheduleItem[],
  day: DayOfWeek,
  settings: AudioSettings
): ScheduleItem[] {
  if (settings.asasModeEnabled) {
    const asasList =
      settings.asasSchedules && settings.asasSchedules.length > 0
        ? settings.asasSchedules
        : DEFAULT_ASAS_SCHEDULES;
    return asasList
      .filter((item) => item.enabled && item.days.includes(day))
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  const baseActive = schedules.filter((item) => {
    if (!item.enabled || !item.days.includes(day)) return false;
    if (isFridayEkstraSuppressedItem(item, day, settings)) return false;
    return true;
  });

  if (day === 5 && settings.fridayExtraOff) {
    const hasCustomEarly = baseActive.some((s) => s.id === FRIDAY_EARLY_DISMISSAL_ID);
    const list = hasCustomEarly
      ? baseActive
      : [...baseActive, buildFridayEarlyDismissalSchedule(schedules, settings)];
    return list.sort((a, b) => a.time.localeCompare(b.time));
  }

  return baseActive.sort((a, b) => a.time.localeCompare(b.time));
}
