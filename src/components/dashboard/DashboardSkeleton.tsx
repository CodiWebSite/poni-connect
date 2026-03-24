import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/** Shimmer skeleton with animated gradient */
const Shimmer = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "rounded-md bg-gradient-to-r from-muted via-muted-foreground/[0.06] to-muted bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]",
      className
    )}
    {...props}
  />
);

export const StatCardSkeleton = () => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-8 w-16" />
          <Shimmer className="h-3 w-20" />
        </div>
        <Shimmer className="w-12 h-12 rounded-xl" />
      </div>
    </CardContent>
  </Card>
);

export const ChartSkeleton = () => (
  <Card>
    <CardHeader>
      <Shimmer className="h-5 w-40" />
      <Shimmer className="h-3 w-56" />
    </CardHeader>
    <CardContent>
      <Shimmer className="h-48 w-full rounded-lg" />
    </CardContent>
  </Card>
);

export const LeaveBalanceSkeleton = () => (
  <Card className="lg:col-span-2">
    <CardHeader className="pb-3">
      <Shimmer className="h-5 w-48" />
      <Shimmer className="h-3 w-64" />
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="text-center p-4 rounded-xl border">
              <Shimmer className="h-8 w-12 mx-auto" />
              <Shimmer className="h-3 w-16 mx-auto mt-2" />
            </div>
          ))}
        </div>
        <Shimmer className="h-3 w-full" />
      </div>
    </CardContent>
  </Card>
);

export const QuickActionsSkeleton = () => (
  <div className="grid grid-cols-3 gap-3">
    {[1, 2, 3].map(i => (
      <Card key={i}>
        <CardContent className="p-4 flex items-center gap-3">
          <Shimmer className="w-10 h-10 rounded-xl" />
          <Shimmer className="h-4 w-20 hidden sm:block" />
        </CardContent>
      </Card>
    ))}
  </div>
);

export const ProfileSkeleton = () => (
  <div className="space-y-6">
    <Card className="overflow-hidden border-0 shadow-lg">
      <div className="p-8">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <Shimmer className="w-24 h-24 rounded-2xl" />
          <div className="space-y-3 flex-1">
            <Shimmer className="h-8 w-48" />
            <Shimmer className="h-4 w-32" />
            <div className="flex gap-2">
              <Shimmer className="h-6 w-20 rounded-full" />
              <Shimmer className="h-6 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </Card>
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <LeaveBalanceSkeleton />
      </div>
      <div className="lg:col-span-2 space-y-6">
        <ChartSkeleton />
      </div>
    </div>
  </div>
);

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2">
    <Shimmer className="h-10 w-full rounded-lg" />
    {Array.from({ length: rows }).map((_, i) => (
      <Shimmer key={i} className="h-12 w-full rounded-lg" />
    ))}
  </div>
);
