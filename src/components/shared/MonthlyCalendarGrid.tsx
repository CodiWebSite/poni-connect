import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isWeekend, isSameMonth } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isPublicHoliday, getPublicHolidayName } from '@/utils/romanianHolidays';

export interface DayInfo {
  isLeave?: boolean;
  leaveLabel?: string;
  isCustomHoliday?: boolean;
  customHolidayName?: string;
}

interface MonthlyCalendarGridProps {
  currentMonth: Date;
  getDayInfo?: (day: Date) => DayInfo;
  compact?: boolean;
}

const DAY_HEADERS = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

const MonthlyCalendarGrid = ({ currentMonth, getDayInfo, compact = false }: MonthlyCalendarGridProps) => {
  const { weeks } = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // getDay returns 0=Sun, we need 0=Mon
    const startDow = (getDay(monthStart) + 6) % 7;

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    days.forEach(d => cells.push(d));
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return { weeks };
  }, [currentMonth]);

  const cellSize = compact ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  const headerSize = compact ? 'text-[10px]' : 'text-xs';

  return (
    <div className="select-none">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={cn(
              'text-center font-semibold py-1 rounded-sm',
              headerSize,
              i >= 5 ? 'text-orange-500 bg-orange-500/10' : 'text-muted-foreground'
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="grid gap-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map((day, di) => {
              if (!day) {
                return <div key={di} className={cn(cellSize, 'rounded-md')} />;
              }

              const weekend = isWeekend(day);
              const publicHoliday = isPublicHoliday(day);
              const holidayName = getPublicHolidayName(day);
              const today = isToday(day);
              const info = getDayInfo?.(day) || {};

              // Priority: leave > custom holiday > public holiday > weekend > normal
              let bgClass = '';
              let textClass = 'text-foreground';
              let borderClass = '';
              let title = '';

              if (info.isLeave) {
                bgClass = 'bg-sky-500/25';
                borderClass = 'ring-2 ring-sky-500/50 ring-inset';
                textClass = 'text-sky-700 dark:text-sky-300 font-bold';
                title = info.leaveLabel || 'Concediu';
              } else if (info.isCustomHoliday) {
                bgClass = 'bg-amber-500/20';
                textClass = 'text-amber-700 dark:text-amber-300 font-semibold';
                title = info.customHolidayName || 'Zi liberă instituție';
              } else if (publicHoliday) {
                bgClass = 'bg-red-500/15';
                textClass = 'text-red-600 dark:text-red-400 font-semibold';
                title = holidayName || 'Sărbătoare legală';
              } else if (weekend) {
                bgClass = 'bg-orange-500/10';
                textClass = 'text-orange-500 font-medium';
              }

              return (
                <div
                  key={di}
                  className={cn(
                    cellSize,
                    'flex items-center justify-center rounded-md transition-colors cursor-default',
                    bgClass,
                    borderClass,
                    today && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                  )}
                  title={title || undefined}
                >
                  <span className={cn(textClass)}>{format(day, 'd')}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonthlyCalendarGrid;
