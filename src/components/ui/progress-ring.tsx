import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  children?: React.ReactNode;
}

const ProgressRing = ({
  value,
  size = 120,
  strokeWidth = 10,
  className,
  trackClassName,
  children,
}: ProgressRingProps) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timeout);
  }, [value]);

  const getColor = (v: number) => {
    if (v >= 75) return 'hsl(var(--destructive))';
    if (v >= 50) return 'hsl(38 90% 50%)';
    if (v >= 25) return 'hsl(200 80% 45%)';
    return 'hsl(145 65% 40%)';
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(animatedValue)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export { ProgressRing };
