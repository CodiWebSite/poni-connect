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

const KioskSidebarAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);
  const [scrollDuration, setScrollDuration] = useState(30);

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

  // Measure content to decide if scrolling is needed
  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const inner = innerRef.current;
      if (!container || !inner) return;

      const containerH = container.clientHeight;
      const contentH = inner.scrollHeight;

      if (contentH > containerH + 10) {
        setNeedsScroll(true);
        // ~30px per second scroll speed
        const duration = Math.max(contentH / 30, 15);
        setScrollDuration(duration);
      } else {
        setNeedsScroll(false);
      }
    };

    // Small delay to let content render
    const timer = setTimeout(measure, 300);
    return () => clearTimeout(timer);
  }, [announcements]);

  if (announcements.length === 0) return null;

  const renderCard = (ann: Announcement, key: string) => (
    <div
      key={key}
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
        {/* Fade edges when scrolling */}
        {needsScroll && (
          <>
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-slate-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-slate-50 to-transparent z-10 pointer-events-none" />
          </>
        )}

        <div
          ref={innerRef}
          className={needsScroll ? 'kiosk-vertical-scroll' : ''}
          style={needsScroll ? { animationDuration: `${scrollDuration}s` } : undefined}
        >
          <div className="space-y-2">
            {announcements.map((ann) => renderCard(ann, ann.id))}
          </div>

          {/* Duplicate for seamless loop */}
          {needsScroll && (
            <div className="space-y-2 mt-6 pt-6 border-t border-dashed border-slate-200">
              {announcements.map((ann) => renderCard(ann, `dup-${ann.id}`))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes kiosk-vertical-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .kiosk-vertical-scroll {
          animation: kiosk-vertical-scroll 30s linear infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
};

export default KioskSidebarAnnouncements;
