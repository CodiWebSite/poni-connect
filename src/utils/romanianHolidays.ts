import { format, isWeekend } from 'date-fns';

// Romanian public holidays for 2025-2030 (fixed + variable Orthodox Easter/Rusalii)
export const PUBLIC_HOLIDAYS: Record<number, string[]> = {
  2025: [
    '2025-01-01','2025-01-02','2025-01-06','2025-01-07','2025-01-24',
    '2025-04-18','2025-04-19','2025-04-20','2025-04-21',
    '2025-05-01','2025-06-01','2025-06-08','2025-06-09',
    '2025-08-15','2025-11-30','2025-12-01','2025-12-25','2025-12-26',
  ],
  2026: [
    '2026-01-01','2026-01-02','2026-01-06','2026-01-07','2026-01-24',
    '2026-04-10','2026-04-11','2026-04-12','2026-04-13',
    '2026-05-01','2026-05-31','2026-06-01',
    '2026-08-15','2026-11-30','2026-12-01','2026-12-25','2026-12-26',
  ],
  2027: [
    '2027-01-01','2027-01-02','2027-01-06','2027-01-07','2027-01-24',
    '2027-05-01','2027-05-02','2027-05-03','2027-05-04',
    '2027-06-01','2027-06-20','2027-06-21',
    '2027-08-15','2027-11-30','2027-12-01','2027-12-25','2027-12-26',
  ],
};

export const HOLIDAY_NAMES: Record<string, string> = {
  '01-01': 'Anul Nou', '01-02': 'Anul Nou', '01-06': 'Boboteaza', '01-07': 'Sf. Ioan',
  '01-24': 'Ziua Unirii', '05-01': 'Ziua Muncii', '06-01': 'Ziua Copilului',
  '08-15': 'Adormirea Maicii Domnului', '11-30': 'Sf. Andrei',
  '12-01': 'Ziua Națională', '12-25': 'Crăciunul', '12-26': 'Crăciunul',
};

export function isPublicHoliday(day: Date): boolean {
  const year = day.getFullYear();
  const dateStr = format(day, 'yyyy-MM-dd');
  return PUBLIC_HOLIDAYS[year]?.includes(dateStr) ?? false;
}

export function getPublicHolidayName(day: Date): string | null {
  const dateStr = format(day, 'yyyy-MM-dd');
  const year = day.getFullYear();
  if (!PUBLIC_HOLIDAYS[year]?.includes(dateStr)) return null;
  const mmdd = format(day, 'MM-dd');
  return HOLIDAY_NAMES[mmdd] || 'Sărbătoare legală';
}

export function isDayOff(day: Date, customHolidayDates?: string[]): boolean {
  if (isWeekend(day)) return true;
  if (isPublicHoliday(day)) return true;
  if (customHolidayDates) {
    const dateStr = format(day, 'yyyy-MM-dd');
    return customHolidayDates.includes(dateStr);
  }
  return false;
}
