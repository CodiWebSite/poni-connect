import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const StatCardSkeleton = () => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="w-12 h-12 rounded-xl" />
      </div>
    </CardContent>
  </Card>
);

export const ChartSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3 w-56" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-48 w-full rounded-lg" />
    </CardContent>
  </Card>
);

export const LeaveBalanceSkeleton = () => (
  <Card className="lg:col-span-2">
    <CardHeader className="pb-3">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-3 w-64" />
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="text-center p-4 rounded-xl border">
              <Skeleton className="h-8 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto mt-2" />
            </div>
          ))}
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
    </CardContent>
  </Card>
);

export const QuickActionsSkeleton = () => (
  <div className="grid grid-cols-3 gap-3">
    {[1, 2, 3].map(i => (
      <Card key={i}>
        <CardContent className="p-4 flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="h-4 w-20 hidden sm:block" />
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
          <Skeleton className="w-24 h-24 rounded-2xl" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
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
    <Skeleton className="h-10 w-full rounded-lg" />
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-lg" />
    ))}
  </div>
);
