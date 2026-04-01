import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

export interface QuickAction {
  icon: LucideIcon;
  label: string;
  path: string;
  gradient: string;
  badge?: number;
}

interface QuickActionsGridProps {
  actions: QuickAction[];
  columns?: 2 | 3 | 4;
}

const QuickActionsGrid = ({ actions, columns = 3 }: QuickActionsGridProps) => {
  const gridCols = columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className={`grid ${gridCols} gap-2 md:gap-3`}>
      {actions.map((action) => (
        <Link key={`${action.path}-${action.label}`} to={action.path} className="group">
          <Card className="hover:shadow-card-hover transition-all duration-300 hover:border-primary/30 hover:-translate-y-1 overflow-hidden relative h-full">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.04] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 pointer-events-none" />
            <CardContent className="p-3 sm:p-4 flex flex-col items-center gap-2 relative">
              <div className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${action.gradient} shadow-md group-hover:scale-110 transition-transform duration-300`}>
                <action.icon className="w-5 h-5 text-primary-foreground" />
                {action.badge != null && action.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 shadow-sm">
                    {action.badge > 99 ? '99+' : action.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-foreground text-center leading-tight">{action.label}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export default QuickActionsGrid;
