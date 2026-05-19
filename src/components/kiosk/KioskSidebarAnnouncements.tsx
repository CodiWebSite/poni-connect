import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Megaphone, AlertTriangle } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string | null;
  is_pinned: boolean | null;
  created_at: string;
}

const KIOSK_ADVANCE_EVENT = 'kiosk-sidebar-advance';
const HOLD_TOP_MS = 2500;     // pauză la început înainte de scroll
const HOLD_BOTTOM_MS = 3000;  // pauză la final după ce s-a ajuns jos
const SCROLL_SPEED_PX_S = 28; // viteza scroll-ului (px / secundă)
const NO_SCROLL_DISPLAY_MS = 9000; // dacă încape tot, cât stă vizibil

const KioskSidebarAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [scrollDuration, setScrollDuration] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'holdTop' | 'scrolling' | 'holdBottom'>('idle');
  const [totalMs, setTotalMs] = useState(0);
  const [progressArmed, setProgressArmed] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, content, priority, is_pinned, created_at')
      .or('is_pinned.eq.true,priority.eq.urgent,priority.eq.high')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setAnnouncements(data);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    const t = setInterval(fetchAnnouncements, 60_000);
    return () => clearInterval(t);
  }, [fetchAnnouncements]);

  // Choreography: measure → hold top → scroll → hold bottom → advance
  useEffect(() => {
    if (announcements.length === 0) return;

    let timers: number[] = [];
    const advance = () => {
      window.dispatchEvent(
        new CustomEvent(KIOSK_ADVANCE_EVENT, { detail: { from: 'announcements' } })
      );
    };

    const measureTimer = window.setTimeout(() => {
      const container = containerRef.current;
      const inner = innerRef.current;
      if (!container || !inner) return;

      const distance = Math.max(0, inner.scrollHeight - container.clientHeight);

      if (distance < 8) {
        // Tot conținutul încape — stă afișat fix, apoi avansează
        setScrollDistance(0);
        setScrollDuration(0);
        setPhase('idle');
        timers.push(window.setTimeout(advance, NO_SCROLL_DISPLAY_MS));
        return;
      }

      const duration = Math.max(distance / SCROLL_SPEED_PX_S, 6);
      setScrollDistance(distance);
      setScrollDuration(duration);
      setPhase('holdTop');

      timers.push(
        window.setTimeout(() => setPhase('scrolling'), HOLD_TOP_MS)
      );
      timers.push(
        window.setTimeout(() => setPhase('holdBottom'), HOLD_TOP_MS + duration * 1000)
      );
      timers.push(
        window.setTimeout(advance, HOLD_TOP_MS + duration * 1000 + HOLD_BOTTOM_MS)
      );
    }, 350);

    return () => {
      clearTimeout(measureTimer);
      timers.forEach(clearTimeout);
    };
  }, [announcements]);

  if (announcements.length === 0) return null;

  const translateY =
    phase === 'scrolling' || phase === 'holdBottom' ? -scrollDistance : 0;
  const transition =
    phase === 'scrolling' ? `transform ${scrollDuration}s linear` : 'none';

  const renderCard = (ann: Announcement) => (
    <div
      key={ann.id}
      className={`rounded-lg p-3 shadow-sm border ${
        ann.priority === 'urgent'
          ? 'bg-red-50 border-red-200'
          : ann.priority === 'high'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-start gap-2">
        {(ann.priority === 'urgent' || ann.priority === 'high') && (
          <AlertTriangle
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              ann.priority === 'urgent' ? 'text-red-500' : 'text-amber-500'
            }`}
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{ann.title}</p>
          <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{ann.content}</p>
        </div>
      </div>
    </div>
  );

  const isScrollable = scrollDistance > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-2 shrink-0">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Megaphone className="w-3.5 h-3.5" /> Anunțuri
          <span className="text-[10px] text-slate-400 font-normal ml-auto tabular-nums">
            {announcements.length}
          </span>
        </h3>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden relative px-5 pb-3">
        {isScrollable && (
          <>
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-slate-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-slate-50 to-transparent z-10 pointer-events-none" />
          </>
        )}

        <div
          ref={innerRef}
          style={{
            transform: `translateY(${translateY}px)`,
            transition,
            willChange: 'transform',
          }}
        >
          <div className="space-y-2">
            {announcements.map(renderCard)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KioskSidebarAnnouncements;
