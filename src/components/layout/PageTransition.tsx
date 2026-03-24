import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  return (
    <div className="animate-fade-in" style={{ animationDuration: '0.35s' }}>
      {children}
    </div>
  );
};

export default PageTransition;
