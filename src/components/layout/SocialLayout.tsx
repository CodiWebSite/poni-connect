import { ReactNode } from 'react';
import SocialSidebar from './SocialSidebar';
import Header from './Header';
import PageTransition from './PageTransition';
import { usePresence } from '@/hooks/usePresence';
import { usePageTracking } from '@/hooks/useAnalytics';
import { useIdleLogout } from '@/hooks/useIdleLogout';

interface SocialLayoutProps {
  children: ReactNode;
  title: string;
  description?: ReactNode;
}

const SocialLayout = ({ children, title, description }: SocialLayoutProps) => {
  usePresence();
  usePageTracking();
  useIdleLogout();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <SocialSidebar />
      </div>

      <div className="md:pl-64">
        <Header title={title} description={description} />
        <main className="p-3 md:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
};

export default SocialLayout;
