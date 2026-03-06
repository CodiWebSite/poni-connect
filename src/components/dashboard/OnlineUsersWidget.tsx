import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, ChevronDown, ChevronUp } from 'lucide-react';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatNumePrenume } from '@/utils/formatName';

interface OnlineUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
}

const OnlineUsersWidget = () => {
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [expanded, setExpanded] = useState(false);

  const fetchData = async () => {
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: presenceRows } = await supabase
      .from('user_presence')
      .select('user_id')
      .eq('is_online', true)
      .gte('last_seen_at', cutoff);

    const userIds = (presenceRows || []).map(r => r.user_id);
    setOnlineCount(userIds.length);

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, department')
        .in('user_id', userIds);
      setOnlineUsers(
        (profiles || []).map(p => ({
          user_id: p.user_id,
          full_name: formatNumePrenume({ fullName: p.full_name }),
          avatar_url: p.avatar_url,
          department: p.department,
        }))
      );
    } else {
      setOnlineUsers([]);
    }
  };

  useEffect(() => {
    fetchData();
    const pollInterval = setInterval(fetchData, 15_000);

    const channel = supabase
      .channel('online-users')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const animatedCount = useAnimatedCounter(onlineCount);

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm border border-border hover:shadow-md transition-all duration-300 animate-fade-in bg-gradient-to-br from-card to-muted/30">
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

      {onlineUsers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Ascunde' : 'Vezi cine este online'}
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
              {onlineUsers.map(u => (
                <div key={u.user_id} className="flex items-center gap-2 py-1">
                  <div className="relative">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={u.avatar_url || ''} />
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                        {u.full_name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-success border border-background" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{u.full_name}</p>
                    {u.department && (
                      <p className="text-[10px] text-muted-foreground truncate">{u.department}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OnlineUsersWidget;
