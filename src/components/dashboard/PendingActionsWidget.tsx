import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PendingAction {
  id: string;
  icon: LucideIcon;
  label: string;
  count: number;
  severity: 'critical' | 'warning' | 'info';
  link: string;
  description?: string;
}

interface PendingActionsWidgetProps {
  title?: string;
  actions: PendingAction[];
  loading?: boolean;
}

const severityStyles = {
  critical: 'border-destructive/30 bg-destructive/5 text-destructive',
  warning: 'border-warning/30 bg-warning/5 text-warning',
  info: 'border-primary/20 bg-primary/5 text-primary',
};

const PendingActionsWidget = ({ title = 'Necesită acțiune', actions, loading }: PendingActionsWidgetProps) => {
  const totalCount = actions.reduce((sum, a) => sum + a.count, 0);
  const activeActions = actions.filter(a => a.count > 0);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          {title}
          {totalCount > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {totalCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeActions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 text-success/60" />
            <p className="text-sm font-medium">Totul este la zi!</p>
            <p className="text-xs">Nu sunt acțiuni în așteptare.</p>
          </div>
        ) : (
          <ScrollArea className={activeActions.length > 5 ? 'h-[260px]' : undefined}>
            <div className="space-y-2">
              {activeActions.map((action) => (
                <Link
                  key={action.id}
                  to={action.link}
                  className={cn(
                    'flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border transition-all duration-200 hover:scale-[1.01] group',
                    severityStyles[action.severity]
                  )}
                >
                  <action.icon className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{action.label}</p>
                    {action.description && (
                      <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 font-bold text-xs">
                    {action.count}
                  </Badge>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-foreground" />
                </Link>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingActionsWidget;
