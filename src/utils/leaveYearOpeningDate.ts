export function canOpenLeaveYear(year: number, now = new Date()): boolean {
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const currentYear = Number(local.find(part => part.type === 'year')?.value);
  return Number.isInteger(year) && currentYear >= year;
}