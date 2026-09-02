/** Skeleton afișat cât timp se descarcă pachetul unei rute (lazy loading). */
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">Se încarcă...</p>
    </div>
  </div>
);

export default RouteFallback;
