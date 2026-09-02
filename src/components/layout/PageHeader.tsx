import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  /** Etichetă instituțională scurtă, afișată deasupra titlului. */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Butoane / controale afișate în dreapta. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Titlu de pagină unificat (direcția neo-instituțională):
 * bară de accent brand, etichetă majusculă, titlu display, subtitlu discret.
 */
const PageHeader = ({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  className,
}: PageHeaderProps) => (
  <div
    className={cn(
      'mb-5 sm:mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
      className
    )}
  >
    <div className="flex items-start gap-3 sm:gap-4 min-w-0">
      <span
        aria-hidden="true"
        className="mt-1 hidden sm:block h-11 w-[3px] shrink-0 rounded-full bg-gradient-to-b from-primary to-accent"
      />
      {Icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
      )}
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl truncate">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{description}</p>
        )}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
