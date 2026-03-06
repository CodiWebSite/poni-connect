import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const HEARTBEAT_INTERVAL = 1_000; // 1s

export function usePresence() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!user) return;

    const upsert = async () => {
      await supabase
        .from('user_presence')
        .upsert(
          { user_id: user.id, last_seen_at: new Date().toISOString(), is_online: true },
          { onConflict: 'user_id' }
        );
    };

    // Initial heartbeat
    upsert();

    // Periodic heartbeat
    intervalRef.current = setInterval(upsert, HEARTBEAT_INTERVAL);

    const handleUnload = async () => {
      // Best effort: mark offline on page close
      supabase
        .from('user_presence')
        .update({ is_online: false, last_seen_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .then(() => {});
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleUnload);
      // Mark offline on unmount
      supabase
        .from('user_presence')
        .update({ is_online: false, last_seen_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .then(() => {});
    };
  }, [user]);
}
