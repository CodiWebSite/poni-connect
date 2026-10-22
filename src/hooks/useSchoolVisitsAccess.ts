import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useSchoolVisitsAccess() {
  const { user } = useAuth();
  const [state, setState] = useState({ canAccess: false, loading: true });
  useEffect(() => {
    if (!user) { setState({ canAccess: false, loading: false }); return; }
    supabase.rpc('can_access_school_visits', { _user_id: user.id }).then(({ data }) =>
      setState({ canAccess: !!data, loading: false }));
  }, [user]);
  return state;
}
