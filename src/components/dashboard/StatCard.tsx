import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
  iconClassName?: string;
}

const StatCard = ({ title, value, icon: Icon, trend, className, iconClassName }: StatCardProps) => {
  return (
    <div className={cn(
      "bg-card rounded-xl p-5 shadow-sm border border-border hover:shadow-md transition-all duration-300 animate-fade-in",
      "bg-gradient-to-br from-card to-muted/30",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
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
          "w-12 h-12 rounded-xl flex items-center justify-center",
          iconClassName || "bg-primary/10"
        )}>
          <Icon className={cn("w-6 h-6", iconClassName ? "text-primary-foreground" : "text-primary")} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
