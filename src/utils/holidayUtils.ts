import { AudioSettings, DayOfWeek, HolidayPeriod } from '../types';
import { getDayOfWeekNumber, getIndonesianDayName } from './timeSync';

export interface HolidayEvaluationResult {
  isOff: boolean;
  reason: 'day_off' | 'holiday_range' | null;
  label: string | null;
  activePeriod?: HolidayPeriod | null;
}

export function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatShortIndoDate(yyyyMmDd?: string): string {
  if (!yyyyMmDd) return '-';
  const match = yyyyMmDd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return yyyyMmDd;
  const year = parseInt(match[1], 10);
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  return `${day} ${months[monthIdx] || match[2]} ${year}`;
}

/**
 * Evaluates whether bells, murottal, and post-bell tracks should be silenced for a given Date,
 * checking both per-day toggles (disabledDays: Senin-Minggu) and active holiday date ranges
 * (with optional excludedDays & excludedDates exceptions).
 */
export function evaluateDateHolidayStatus(
  date: Date,
  settings: AudioSettings
): HolidayEvaluationResult {
  const dayNum = getDayOfWeekNumber(date) as DayOfWeek;
  const disabledDays = settings.disabledDays ?? [0];

  if (disabledDays.includes(dayNum)) {
    return {
      isOff: true,
      reason: 'day_off',
      label: `Hari ${getIndonesianDayName(dayNum)} (Mode Libur)`,
      activePeriod: null,
    };
  }

  const dateStr = formatDateYYYYMMDD(date);
  const periods = settings.holidayPeriods || [];

  for (const period of periods) {
    if (!period.enabled || !period.startDate || !period.endDate) continue;

    const start = period.startDate <= period.endDate ? period.startDate : period.endDate;
    const end = period.startDate <= period.endDate ? period.endDate : period.startDate;

    if (dateStr >= start && dateStr <= end) {
      if (period.excludedDays && period.excludedDays.includes(dayNum)) {
        continue;
      }
      if (period.excludedDates && period.excludedDates.includes(dateStr)) {
        continue;
      }

      const displayName =
        period.name && period.name.trim()
          ? period.name.trim()
          : `Libur (${formatShortIndoDate(start)} - ${formatShortIndoDate(end)})`;

      return {
        isOff: true,
        reason: 'holiday_range',
        label: displayName,
        activePeriod: period,
      };
    }
  }

  return {
    isOff: false,
    reason: null,
    label: null,
    activePeriod: null,
  };
}
