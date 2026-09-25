import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Video, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface LiveEvent {
  id: string;
  title: string;
  start_date: string;
  meetingUrl: string;
}

const URL_RE = /(https?:\/\/[^\s]*(zoom\.us|teams\.microsoft\.com|meet\.google\.com)[^\s]*)/i;

/**
 * Shows a prominent join banner for online events happening today
 * (from 2h before start until 4h after).
 */
const LiveEventBanner = () => {
  const [event, setEvent] = useState<LiveEvent | null>(null);

  useEffect(() => {
    const load = async () => {
      const now = Date.now();
      const from = new Date(now - 4 * 60 * 60 * 1000).toISOString();
      const to = new Date(now + 12 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('events')
        .select('id, title, description, location, start_date')
        .gte('start_date', from)
        .lte('start_date', to)
        .order('start_date', { ascending: true });

      const match = (data || [])
        .map((e: any) => {
          const found = `${e.location || ''} ${e.description || ''}`.match(URL_RE);
          return found ? { id: e.id, title: e.title, start_date: e.start_date, meetingUrl: found[1] } : null;
        })
        .find(Boolean) as LiveEvent | undefined;

      setEvent(match || null);
    };
    load();
  }, []);

  if (!event) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
        <Video className="w-5 h-5 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{event.title}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" />
          {format(new Date(event.start_date), "EEEE, d MMMM, HH:mm", { locale: ro })} · participare online
        </p>
      </div>
      <Button asChild variant="hero" size="sm" className="flex-shrink-0">
        <a href={event.meetingUrl} target="_blank" rel="noopener noreferrer">
          Intră în ședință
        </a>
      </Button>
    </div>
  );
};

export default LiveEventBanner;
