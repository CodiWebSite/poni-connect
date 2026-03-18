import { useState, useEffect, ReactNode } from 'react';
import KioskSidebarAnnouncements from './KioskSidebarAnnouncements';
import KioskSidebarRoomBookings from './KioskSidebarRoomBookings';

interface Section {
  key: string;
  label: string;
  component: ReactNode;
}

const ROTATE_INTERVAL = 10_000; // 10 seconds

const sections: Section[] = [
  { key: 'announcements', label: 'Anunțuri', component: <KioskSidebarAnnouncements /> },
  { key: 'rooms', label: 'Săli', component: <KioskSidebarRoomBookings /> },
];

const KioskRotatingSidebar = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex(prev => (prev + 1) % sections.length);
        setIsTransitioning(false);
      }, 400);
    }, ROTATE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div
          className={`absolute inset-0 flex flex-col transition-all duration-400 ease-in-out ${
            isTransitioning
              ? 'opacity-0 translate-y-3 scale-[0.98]'
              : 'opacity-100 translate-y-0 scale-100'
          }`}
        >
          {sections[activeIndex].component}
        </div>
      </div>

      <div className="px-5 py-3 flex items-center justify-center gap-2 shrink-0 border-t border-white/10">
        {sections.map((section, i) => (
          <button
            key={section.key}
            onClick={() => {
              setIsTransitioning(true);
              setTimeout(() => {
                setActiveIndex(i);
                setIsTransitioning(false);
              }, 400);
            }}
            className="group flex items-center gap-1.5"
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === activeIndex
                  ? 'w-6 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]'
                  : 'w-1.5 bg-slate-400/40 group-hover:bg-slate-400/70'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default KioskRotatingSidebar;
