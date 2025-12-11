import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const MainLayout = ({ children, title, description }: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      {/* Main content area */}
      <div className="md:pl-64 transition-all duration-300">
        <Header title={title} description={description} />
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
