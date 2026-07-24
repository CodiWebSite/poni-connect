import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Returns whether the current user's email is in the payslip pilot whitelist.
 * Feature is closed during pilot — tab is hidden completely for non-pilot users.
 */
export function usePayslipPilot() {
  const { user } = useAuth();
  const [isPilot, setIsPilot] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.email) {
        if (alive) setIsPilot(false);
        return;
      }
      const { data } = await supabase
        .from('payslip_pilot_users')
        .select('id')
        .ilike('email', user.email)
        .maybeSingle();
      if (alive) setIsPilot(!!data);
    })();
    return () => { alive = false; };
  }, [user?.email]);

  return { isPilot: !!isPilot, loading: isPilot === null };
}
