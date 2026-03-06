import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wifi } from 'lucide-react';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

const OnlineUsersWidget = () => {
  const [onlineCount, setOnlineCount] = useState(0);

  const fetchCount = async () => {
    // Consider users online if last_seen < 60s ago and is_online=true
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from('user_presence')
      .select('*', { count: 'exact', head: true })
      .eq('is_online', true)
      .gte('last_seen_at', cutoff);
    setOnlineCount(count || 0);
  };

  useEffect(() => {
    fetchCount();

    // Fallback polling every 15s to catch missed realtime events
    const pollInterval = setInterval(fetchCount, 15_000);

    // Subscribe to realtime changes
    const channel = supabase
      .channel('online-users')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const animatedCount = useAnimatedCounter(onlineCount);

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm border border-border hover:shadow-md transition-all duration-300 animate-fade-in bg-gradient-to-br from-card to-muted/30 hover:scale-[1.02] hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">Online acum</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{animatedCount}</p>
          <p className="text-xs mt-2 font-medium text-success flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse inline-block" />
            în timp real
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success/20">
          <Wifi className="w-6 h-6 text-success" />
        </div>
      </div>
    </div>
  );
};

export default OnlineUsersWidget;
