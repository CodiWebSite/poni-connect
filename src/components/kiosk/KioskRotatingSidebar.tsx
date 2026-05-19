import { useState, useEffect, ReactNode, useCallback } from 'react';
import KioskSidebarAnnouncements from './KioskSidebarAnnouncements';
import KioskSidebarRoomBookings from './KioskSidebarRoomBookings';

interface Section {
  key: string;
  label: string;
  component: ReactNode;
  /** Fallback timeout dacă secțiunea nu emite singură evenimentul de avansare. */
  fallbackMs: number;
}

const KIOSK_ADVANCE_EVENT = 'kiosk-sidebar-advance';

const sections: Section[] = [
  // Anunțurile semnalează singure când au terminat scroll-ul; fallback de 90s.
  { key: 'announcements', label: 'Anunțuri', component: <KioskSidebarAnnouncements />, fallbackMs: 90_000 },
  { key: 'rooms', label: 'Săli', component: <KioskSidebarRoomBookings />, fallbackMs: 10_000 },
];

const KioskRotatingSidebar = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToIndex = useCallback((nextIndex: number) => {
    setIsTransitioning(true);
    window.setTimeout(() => {
      setActiveIndex(nextIndex);
      setIsTransitioning(false);
    }, 400);
  }, []);

  const advance = useCallback(() => {
    setActiveIndex(prev => {
      const next = (prev + 1) % sections.length;
      setIsTransitioning(true);
      window.setTimeout(() => setIsTransitioning(false), 400);
      return next;
    });
  }, []);

  useEffect(() => {
    const current = sections[activeIndex];
    let triggered = false;

    const onAdvance = (e: Event) => {
      const detail = (e as CustomEvent<{ from?: string }>).detail;
      // Acceptă orice eveniment care vine din secțiunea curentă (sau fără origin).
      if (detail?.from && detail.from !== current.key) return;
      if (triggered) return;
      triggered = true;
      advance();
    };

    window.addEventListener(KIOSK_ADVANCE_EVENT, onAdvance as EventListener);

    const fallback = window.setTimeout(() => {
      if (triggered) return;
      triggered = true;
      advance();
    }, current.fallbackMs);

    return () => {
      window.removeEventListener(KIOSK_ADVANCE_EVENT, onAdvance as EventListener);
      clearTimeout(fallback);
    };
  }, [activeIndex, advance]);

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
            onClick={() => goToIndex(i)}
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
