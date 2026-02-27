import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import PageTransition from './PageTransition';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { useAppSettings } from '@/hooks/useAppSettings';
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
        <main className="p-4 md:p-6">
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
