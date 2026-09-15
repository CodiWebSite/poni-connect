import { format, isWeekend } from 'date-fns';

/**
 * Sărbătorile legale din România (Codul Muncii, art. 139).
 * Zilele fixe sunt definite o singură dată, iar cele mobile
 * (Vinerea Mare, Paște, Rusalii) sunt calculate automat din
 * data Paștelui ortodox — deci calendarul e valid pentru orice an.
 */

const FIXED_HOLIDAYS: { mmdd: string; name: string }[] = [
  { mmdd: '01-01', name: 'Anul Nou' },
  { mmdd: '01-02', name: 'Anul Nou' },
  { mmdd: '01-06', name: 'Boboteaza' },
  { mmdd: '01-07', name: 'Sf. Ioan Botezătorul' },
  { mmdd: '01-24', name: 'Ziua Unirii Principatelor Române' },
  { mmdd: '05-01', name: 'Ziua Muncii' },
  { mmdd: '06-01', name: 'Ziua Copilului' },
  { mmdd: '08-15', name: 'Adormirea Maicii Domnului' },
  { mmdd: '11-30', name: 'Sf. Andrei' },
  { mmdd: '12-01', name: 'Ziua Națională' },
  { mmdd: '12-25', name: 'Crăciunul' },
  { mmdd: '12-26', name: 'Crăciunul' },
];

/** Paștele ortodox (algoritm Meeus, calendar iulian + 13 zile pentru 1900–2099). */
export function getOrthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3 = martie, 4 = aprilie
  const day = ((d + e + 114) % 31) + 1;
  const julian = new Date(year, month - 1, day);
  julian.setDate(julian.getDate() + 13);
  return julian;
}

function toKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function shift(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

const cache = new Map<number, Record<string, string>>();

/** Toate sărbătorile legale ale unui an: { 'yyyy-MM-dd': 'denumire' } */
export function getHolidaysForYear(year: number): Record<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const map: Record<string, string> = {};
  FIXED_HOLIDAYS.forEach(h => { map[`${year}-${h.mmdd}`] = h.name; });

  const easter = getOrthodoxEaster(year);
  map[toKey(shift(easter, -2))] = 'Vinerea Mare';
  map[toKey(easter)] = 'Paștele';
  map[toKey(shift(easter, 1))] = 'Paștele (a doua zi)';
  map[toKey(shift(easter, 49))] = 'Rusaliile';
  map[toKey(shift(easter, 50))] = 'Rusaliile (a doua zi)';

  cache.set(year, map);
  return map;
}

/** Listă de date (yyyy-MM-dd) pentru un an — compatibilă cu utilizările anterioare. */
export function getPublicHolidayDates(year: number): string[] {
  return Object.keys(getHolidaysForYear(year)).sort();
}

/** Menținut pentru compatibilitate: acces prin PUBLIC_HOLIDAYS[year]. */
export const PUBLIC_HOLIDAYS: Record<number, string[]> = new Proxy({} as Record<number, string[]>, {
  get: (_t, prop) => {
    const year = Number(prop);
    return Number.isFinite(year) ? getPublicHolidayDates(year) : undefined;
  },
  has: () => true,
});

export function isPublicHoliday(day: Date): boolean {
  return !!getHolidaysForYear(day.getFullYear())[format(day, 'yyyy-MM-dd')];
}

export function getPublicHolidayName(day: Date): string | null {
  return getHolidaysForYear(day.getFullYear())[format(day, 'yyyy-MM-dd')] || null;
}

export function isDayOff(day: Date, customHolidayDates?: string[]): boolean {
  if (isWeekend(day)) return true;
  if (isPublicHoliday(day)) return true;
  if (customHolidayDates) {
    return customHolidayDates.includes(format(day, 'yyyy-MM-dd'));
  }
  return false;
}
