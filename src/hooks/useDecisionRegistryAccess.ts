import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useDecisionRegistryAccess() {
  const { user } = useAuth();
  const [canAccess, setCanAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) { setCanAccess(false); setLoading(false); return; }
    supabase.rpc('can_access_decision_registry', { _user_id: user.id }).then(({ data }) => {
      setCanAccess(!!data);
      setLoading(false);
    });
  }, [user]);
  return { canAccess, loading };
}
