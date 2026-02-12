import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-blob animation-delay-2000" />
      </div>

      <div className="relative text-center space-y-8 max-w-lg">
        {/* Animated 404 number */}
        <div className="relative">
          <h1 className="text-[10rem] md:text-[14rem] font-bold leading-none gradient-text select-none animate-float">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="w-16 h-16 text-muted-foreground/20 animate-pulse" />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Pagina nu a fost găsită
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Ne pare rău, dar pagina <code className="bg-muted px-2 py-0.5 rounded text-sm">{location.pathname}</code> nu există sau a fost mutată.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="hero" size="lg" asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Mergi la Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="lg" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Înapoi
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
