import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
  iconClassName?: string;
}

const StatCard = ({ title, value, icon: Icon, trend, className, iconClassName }: StatCardProps) => {
  const numericValue = typeof value === 'number' ? value : parseInt(value, 10);
  const isNumeric = !isNaN(numericValue);
  const animatedValue = useAnimatedCounter(isNumeric ? numericValue : 0);

  return (
    <div className={cn(
      "bg-card rounded-xl p-5 shadow-card border border-border/60 transition-all duration-300 animate-fade-in group",
      "hover:shadow-card-hover hover:-translate-y-1",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-display font-bold mt-1.5 text-foreground tracking-tight transition-colors group-hover:text-primary">
            {isNumeric ? animatedValue : value}
          </p>
          {trend && (
            <p className={cn(
              "text-xs mt-2 font-medium",
              trend.value >= 0 ? "text-success" : "text-destructive"
            )}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110",
          "bg-gradient-to-br",
          iconClassName || "from-primary to-info"
        )}>
          <Icon className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
