import { ReactNode, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import PageTransition from './PageTransition';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { usePresence } from '@/hooks/usePresence';
import { usePageTracking } from '@/hooks/useAnalytics';
import { useIdleLogout } from '@/hooks/useIdleLogout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Clock, X } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  description?: ReactNode;
}

const SECRETARIAT_BANNER_KEY = 'secretariat-hours-banner-dismissed';

const SecretariatHoursNotice = () => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(SECRETARIAT_BANNER_KEY) === 'true');
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(SECRETARIAT_BANNER_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-warning/30 bg-warning/10 px-3 py-3 shadow-sm sm:px-4">
      <div className="flex min-w-0 items-start gap-3 pr-9">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-warning/15">
          <Clock className="h-5 w-5 text-warning" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-foreground">
            Program secretariat cu publicul: 09:00–13:00
          </p>
          <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
            Programul de secretariat cu publicul se desfășoară în intervalul 09:00–13:00. Mulțumim pentru înțelegere.
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        className="absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:bg-warning/15 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

const MainLayout = ({ children, title, description }: MainLayoutProps) => {
  const { isCollapsed } = useSidebarContext();
  const { settings } = useAppSettings();
  const location = useLocation();
  usePresence();
  usePageTracking();
  useIdleLogout();

  return (
    <div className="min-h-screen bg-background">
      <OnboardingTour />
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      {/* Main content area */}
      <div className={cn(
        "transition-all duration-300",
        isCollapsed ? "md:pl-20" : "md:pl-64"
      )}>
        <Header title={title} description={description} />
        <main className="p-3 md:p-6 pt-2 md:pt-4">
          {location.pathname === '/' && <SecretariatHoursNotice />}
          {settings.maintenance_mode && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive font-medium">
                Platforma este în mentenanță. Unele funcționalități pot fi temporar indisponibile.
              </p>
            </div>
          )}
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
