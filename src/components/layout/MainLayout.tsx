import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import SocialSidebar from './SocialSidebar';
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
import { AlertTriangle } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  description?: ReactNode;
}

const MainLayout = ({ children, title, description }: MainLayoutProps) => {
  const { isCollapsed } = useSidebarContext();
  const { settings } = useAppSettings();
  const { pathname } = useLocation();
  const isSocial = pathname.startsWith('/social');
  usePresence();
  usePageTracking();
  useIdleLogout();

  return (
    <div className="min-h-screen bg-background">
      {!isSocial && <OnboardingTour />}
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        {isSocial ? <SocialSidebar /> : <Sidebar />}
      </div>
      
      {/* Main content area */}
      <div className={cn(
        "transition-all duration-300",
        isSocial ? "md:pl-64" : (isCollapsed ? "md:pl-20" : "md:pl-64")
      )}>

        <Header title={title} description={description} />
        <main className="p-3 md:p-6 pt-2 md:pt-4">
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
