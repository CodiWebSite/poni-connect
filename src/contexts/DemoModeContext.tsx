import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DemoModeContextType {
  isDemo: boolean;
  toggleDemo: () => void;
}

const DemoModeContext = createContext<DemoModeContextType>({ isDemo: false, toggleDemo: () => {} });

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(() => {
    try {
      return localStorage.getItem('icmpp-demo-mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('icmpp-demo-mode', String(isDemo));
  }, [isDemo]);

  const toggleDemo = () => setIsDemo(prev => !prev);

  return (
    <DemoModeContext.Provider value={{ isDemo, toggleDemo }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export const useDemoMode = () => useContext(DemoModeContext);
