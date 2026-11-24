export interface PrayerTimeEntry {
  id: 'subuh' | 'syuruq' | 'dhuha' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';
  label: string;
  time: string;
  minutesOfDay: number;
  isActive: boolean;
  isNext: boolean;
}

export interface GunungkidulPrayerSummary {
  entries: PrayerTimeEntry[];
  nextLabel: string;
  countdownStr: string;
}

/**
 * Deterministic astronomical prayer time calculation for Wonosari, Gunungkidul
 * (7°58' S, 110°36' E / -7.9667, 110.6025, WIB UTC+7) using Kemenag RI angles
 * (Fajr 20°, Isha 18°, Shafi'i Asr, Dhuha 4.5°, +2 min Ihtiyat).
 * Runs 100% locally offline with zero external API dependencies.
 */
export function getGunungkidulPrayerSummary(now: Date): GunungkidulPrayerSummary {
  const lat = -7.9667;
  const lng = 110.6025;
  const tz = 7;
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jd =
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045 -
    0.5;
  const D = jd - 2451545.0;

  const g = (357.529 + 0.98560028 * D) % 360;
  const q = (280.459 + 0.98564736 * D) % 360;
  const L = (q + 1.915 * Math.sin(g * rad) + 0.02 * Math.sin(2 * g * rad)) % 360;
  const e = 23.439 - 0.00000036 * D;
  const RA = (Math.atan2(Math.cos(e * rad) * Math.sin(L * rad), Math.cos(L * rad)) * deg) / 15;
  const eqtRaw = q / 15 - ((RA + 24) % 24);
  const eqt = eqtRaw > 12 ? eqtRaw - 24 : eqtRaw < -12 ? eqtRaw + 24 : eqtRaw;
  const decl = Math.asin(Math.sin(e * rad) * Math.sin(L * rad)) * deg;
  const transit = 12 + tz - lng / 15 - eqt;

  const hourAngle = (altDeg: number) => {
    const cosH =
      (Math.sin(altDeg * rad) - Math.sin(lat * rad) * Math.sin(decl * rad)) /
      (Math.cos(lat * rad) * Math.cos(decl * rad));
    return (Math.acos(Math.max(-1, Math.min(1, cosH))) * deg) / 15;
  };

  const asrAlt = Math.atan(1 / (1 + Math.tan(Math.abs(lat - decl) * rad))) * deg;
  const ihtiyat = 2 / 60;

  const toMinutes = (hours: number) => Math.round(hours * 60) % (24 * 60);
  const fmtMinutes = (totalMins: number) => {
    const hh = Math.floor(totalMins / 60) % 24;
    const min = totalMins % 60;
    return `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const rawItems: Array<{
    id: PrayerTimeEntry['id'];
    label: string;
    minutesOfDay: number;
  }> = [
    { id: 'subuh', label: 'SUBUH', minutesOfDay: toMinutes(transit - hourAngle(-20) + ihtiyat) },
    { id: 'syuruq', label: 'SYURUQ', minutesOfDay: toMinutes(transit - hourAngle(-0.833)) },
    { id: 'dhuha', label: 'DHUHA', minutesOfDay: toMinutes(transit - hourAngle(4.5) + ihtiyat) },
    { id: 'dzuhur', label: 'DZUHUR', minutesOfDay: toMinutes(transit + ihtiyat) },
    { id: 'ashar', label: 'ASHAR', minutesOfDay: toMinutes(transit + hourAngle(asrAlt) + ihtiyat) },
    { id: 'maghrib', label: 'MAGHRIB', minutesOfDay: toMinutes(transit + hourAngle(-0.833) + ihtiyat) },
    { id: 'isya', label: 'ISYA', minutesOfDay: toMinutes(transit + hourAngle(-18) + ihtiyat) },
  ];

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Determine current active window & next upcoming obligatory prayer/slot
  let activeIndex = -1;
  for (let i = 0; i < rawItems.length; i++) {
    if (nowMinutes >= rawItems[i].minutesOfDay) {
      activeIndex = i;
    }
  }
  if (activeIndex === -1) {
    activeIndex = rawItems.length - 1; // Between midnight and Subuh -> Isya window
  }

  let nextIndex = rawItems.findIndex((item) => item.minutesOfDay > nowMinutes);
  if (nextIndex === -1) {
    nextIndex = 0; // After Isya -> next is Subuh tomorrow
  }

  const nextItem = rawItems[nextIndex];
  const diffMinutes =
    nextItem.minutesOfDay > nowMinutes
      ? nextItem.minutesOfDay - nowMinutes
      : 24 * 60 - nowMinutes + nextItem.minutesOfDay;
  const diffH = Math.floor(diffMinutes / 60);
  const diffM = diffMinutes % 60;

  const titleCaseMap: Record<PrayerTimeEntry['id'], string> = {
    subuh: 'Subuh',
    syuruq: 'Syuruq',
    dhuha: 'Dhuha',
    dzuhur: 'Dzuhur',
    ashar: 'Ashar',
    maghrib: 'Maghrib',
    isya: 'Isya',
  };

  const entries: PrayerTimeEntry[] = rawItems.map((item, idx) => ({
    id: item.id,
    label: item.label,
    time: fmtMinutes(item.minutesOfDay),
    minutesOfDay: item.minutesOfDay,
    isActive: idx === activeIndex,
    isNext: idx === nextIndex,
  }));

  return {
    entries,
    nextLabel: titleCaseMap[nextItem.id],
    countdownStr: `${String(diffH).padStart(2, '0')}j ${String(diffM).padStart(2, '0')}m`,
  };
}
