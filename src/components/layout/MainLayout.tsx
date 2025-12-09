import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const MainLayout = ({ children, title, description }: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64 transition-all duration-300">
        <Header title={title} description={description} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
