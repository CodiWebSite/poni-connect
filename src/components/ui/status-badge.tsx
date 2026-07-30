import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle2, Clock, XCircle, Ban, Send, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap',
  {
    variants: {
      status: {
        approved: 'bg-success/10 text-success border-success/25',
        pending: 'bg-warning/10 text-warning border-warning/25',
        rejected: 'bg-destructive/10 text-destructive border-destructive/25',
        cancelled: 'bg-muted text-muted-foreground border-border',
        distributed: 'bg-info/10 text-info border-info/25',
        neutral: 'bg-secondary text-secondary-foreground border-border',
      },
    },
    defaultVariants: { status: 'neutral' },
  },
);

export type StatusKind = NonNullable<VariantProps<typeof statusBadgeVariants>['status']>;

const META: Record<StatusKind, { label: string; icon: React.ElementType }> = {
  approved: { label: 'Aprobat', icon: CheckCircle2 },
  pending: { label: 'În așteptare', icon: Clock },
  rejected: { label: 'Respins', icon: XCircle },
  cancelled: { label: 'Anulat', icon: Ban },
  distributed: { label: 'Distribuit', icon: Send },
  neutral: { label: '—', icon: CircleDot },
};

/** Maps raw DB status strings onto the shared visual vocabulary. */
export const resolveStatusKind = (raw?: string | null): StatusKind => {
  const s = (raw || '').toLowerCase();
  if (['approved', 'aprobat', 'aprobata', 'completed', 'finalizat'].includes(s)) return 'approved';
  if (['rejected', 'respins', 'respinsa', 'denied'].includes(s)) return 'rejected';
  if (['cancelled', 'canceled', 'anulat', 'anulata'].includes(s)) return 'cancelled';
  if (['distributed', 'distribuit', 'sent', 'trimis'].includes(s)) return 'distributed';
  if (!s) return 'neutral';
  return 'pending';
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Raw status from the database, or an explicit kind. */
  status?: string | null;
  label?: string;
  showIcon?: boolean;
}

export const StatusBadge = ({ status, label, showIcon = true, className, ...props }: StatusBadgeProps) => {
  const kind = resolveStatusKind(status);
  const meta = META[kind];
  const Icon = meta.icon;
  return (
    <span className={cn(statusBadgeVariants({ status: kind }), className)} {...props}>
      {showIcon && <Icon className="w-3 h-3" />}
      {label ?? meta.label}
    </span>
  );
};

export { statusBadgeVariants };
