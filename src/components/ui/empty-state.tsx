import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}

/** Shared empty state: illustration + message + optional action. */
export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
  compact = false,
}: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center animate-fade-in',
      compact ? 'py-6 px-3 gap-1.5' : 'py-10 px-4 gap-2',
      className,
    )}
  >
    <div
      className={cn(
        'rounded-2xl flex items-center justify-center bg-muted/70 text-muted-foreground ring-1 ring-border',
        compact ? 'w-10 h-10' : 'w-14 h-14',
      )}
    >
      <Icon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
    </div>
    <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>{title}</p>
    {description && (
      <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">{description}</p>
    )}
    {actionLabel && onAction && (
      <Button size="sm" variant="outline" className="mt-2" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);

export default EmptyState;
