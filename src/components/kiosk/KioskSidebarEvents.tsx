import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';

interface EventData {
  id: string;
  title: string;
  start_date: string;
  location: string | null;
}

const MONTHS_RO = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

const formatEventDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_RO[d.getMonth()].substring(0, 3)} · ${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
};

const isToday = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

const isThisWeek = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + (7 - now.getDay()));
  return d <= weekEnd;
};

type TimeScope = 'azi' | 'săptămâna aceasta' | 'luna aceasta' | 'viitoare';

const KioskSidebarEvents = () => {
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [scope, setScope] = useState<TimeScope>('azi');

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title, start_date, location')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(20);
    if (data) setAllEvents(data);
  }, []);

  useEffect(() => {
    fetchEvents();
    const t = setInterval(fetchEvents, 60_000);
    return () => clearInterval(t);
  }, [fetchEvents]);

  // Smart scope: find smallest scope that has events
  useEffect(() => {
    if (allEvents.length === 0) {
      setScope('viitoare');
      return;
    }
    const todayEvents = allEvents.filter(e => isToday(e.start_date));
    if (todayEvents.length > 0) { setScope('azi'); return; }
    const weekEvents = allEvents.filter(e => isThisWeek(e.start_date));
    if (weekEvents.length > 0) { setScope('săptămâna aceasta'); return; }
    // Check this month
    const now = new Date();
    const monthEvents = allEvents.filter(e => {
      const d = new Date(e.start_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    if (monthEvents.length > 0) { setScope('luna aceasta'); return; }
    setScope('viitoare');
  }, [allEvents]);

  const filteredEvents = (() => {
    if (scope === 'azi') return allEvents.filter(e => isToday(e.start_date));
    if (scope === 'săptămâna aceasta') return allEvents.filter(e => isThisWeek(e.start_date));
    if (scope === 'luna aceasta') {
      const now = new Date();
      return allEvents.filter(e => {
        const d = new Date(e.start_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }
    return allEvents.slice(0, 4);
  })();

  return (
    <div className="p-5 flex-1 min-h-0 overflow-hidden">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5" />
        Evenimente
        <span className="text-[10px] text-slate-400 font-normal ml-auto capitalize">
          {scope}
        </span>
      </h3>
      {filteredEvents.length > 0 ? (
        <ul className="space-y-2">
          {filteredEvents.slice(0, 4).map(ev => (
            <li key={ev.id} className="rounded-lg bg-white border border-slate-200 p-2.5 shadow-sm">
              <p className="text-sm font-medium text-slate-700 line-clamp-1">{ev.title}</p>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs text-slate-400">{formatEventDate(ev.start_date)}</p>
                {ev.location && (
                  <p className="text-xs text-slate-400 flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" />{ev.location}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm text-center">
          <p className="text-sm text-slate-500">Niciun eveniment azi</p>
          <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
            <ChevronRight className="w-3 h-3" /> Verifică calendarul pentru mai multe
          </p>
        </div>
      )}
    </div>
  );
};

export default KioskSidebarEvents;
