import { useEffect, useState, useCallback } from 'react';
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

const ROTATE_SEC = 8;

const KioskSidebarAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [index, setIndex] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);

  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, content, priority, is_pinned, created_at')
      .or('is_pinned.eq.true,priority.eq.urgent,priority.eq.high')
      .order('created_at', { ascending: false })
      .limit(6);
    if (data) setAnnouncements(data);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    const t = setInterval(fetchAnnouncements, 60_000);
    return () => clearInterval(t);
  }, [fetchAnnouncements]);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const t = setInterval(() => {
      setIndex(p => (p + 1) % announcements.length);
      setFadeKey(k => k + 1);
    }, ROTATE_SEC * 1000);
    return () => clearInterval(t);
  }, [announcements.length]);

  if (announcements.length === 0) return null;

  const current = announcements[index];
  // Truncate content to ~1 sentence
  const shortContent = current.content.length > 120
    ? current.content.substring(0, 120).replace(/\s+\S*$/, '') + '…'
    : current.content;

  return (
    <div className="p-5 shrink-0 overflow-hidden">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Megaphone className="w-3.5 h-3.5" /> Anunțuri
        {announcements.length > 1 && (
          <span className="text-[10px] text-slate-400 font-normal ml-auto tabular-nums">
            {index + 1}/{announcements.length}
          </span>
        )}
      </h3>
      <div key={`ann-${fadeKey}`} className="kiosk-slide-in">
        <div className={`rounded-lg p-3 shadow-sm border ${
          current.priority === 'urgent' 
            ? 'bg-red-50 border-red-200' 
            : current.priority === 'high'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-start gap-2">
            {(current.priority === 'urgent' || current.priority === 'high') && (
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                current.priority === 'urgent' ? 'text-red-500' : 'text-amber-500'
              }`} />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 line-clamp-1">{current.title}</p>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{shortContent}</p>
            </div>
          </div>
        </div>
      </div>
      {announcements.length > 1 && (
        <div className="flex gap-1.5 mt-2 justify-center">
          {announcements.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-primary' : 'bg-slate-300'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export default KioskSidebarAnnouncements;
