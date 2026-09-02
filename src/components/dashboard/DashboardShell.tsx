import { cn } from '@/lib/utils';
import { Children, ReactNode, isValidElement } from 'react';
import ErrorBoundary from '@/components/system/ErrorBoundary';

/**
 * Izolează fiecare widget într-o barieră de eroare proprie, astfel încât un
 * singur card căzut să nu golească întregul dashboard.
 */
const isolate = (children: ReactNode) =>
  Children.map(children, (child, i) =>
    isValidElement(child) ? (
      <ErrorBoundary key={child.key ?? i} variant="inline" label="Acest card">
        {child}
      </ErrorBoundary>
    ) : (
      child
    )
  );

/** Row of compact stat cards at the top of every role dashboard. */
export const StatRow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>{isolate(children)}</div>
);

/** Main bento area: wide content column + narrow side column. */
export const BentoGrid = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('grid grid-cols-1 lg:grid-cols-3 gap-4', className)}>{children}</div>
);

export const BentoMain = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('lg:col-span-2 space-y-4 min-w-0', className)}>{isolate(children)}</div>
);

export const BentoSide = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('space-y-4 min-w-0', className)}>{isolate(children)}</div>
);

/** Consistent section heading used across dashboards. */
export const SectionTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h3 className={cn('text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider', className)}>
    {children}
  </h3>
);
