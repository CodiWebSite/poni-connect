import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  /** Optional series for the discrete sparkline (oldest → newest) */
  sparkline?: number[];
  hint?: string;
  className?: string;
  /** Legacy: gradient classes for the icon chip. Kept for compatibility. */
  iconClassName?: string;
  onClick?: () => void;
}

const Sparkline = ({ data }: { data: number[] }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 72;
  const h = 22;
  const step = w / (data.length - 1);
  const points = data.map((d, i) => `${(i * step).toFixed(1)},${(h - ((d - min) / range) * (h - 3) - 1.5).toFixed(1)}`);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-primary/60 shrink-0" aria-hidden="true">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  sparkline,
  hint,
  className,
  iconClassName,
  onClick,
}: StatCardProps) => {
  const numericValue = typeof value === 'number' ? value : parseInt(String(value), 10);
  const isNumeric = !isNaN(numericValue) && String(value).trim() !== '';
  const animatedValue = useAnimatedCounter(isNumeric ? numericValue : 0);
  const Wrapper: any = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'surface-card group w-full p-4 text-left animate-fade-in',
        onClick && 'surface-card-interactive cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">{title}</p>
        <span
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15',
            iconClassName && 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="w-4 h-4" />
        </span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-3xl font-display font-bold text-foreground tracking-tight tabular-nums-fixed leading-none">
          {isNumeric ? animatedValue : value}
        </p>
        {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} />}
      </div>

      {(trend || hint) && (
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 font-semibold tabular-nums-fixed',
                trend.value >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {trend.value >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {Math.abs(trend.value)}%
            </span>
          )}
          <span className="text-muted-foreground truncate">{trend?.label ?? hint}</span>
        </div>
      )}
    </Wrapper>
  );
};

export default StatCard;
