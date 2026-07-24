import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Returns whether the current user should see the payslip pilot features.
 * Super-admin and salarizare roles always have access (for testing/support).
 * Otherwise the user's email must be present in payslip_pilot_users.
 */
export function usePayslipPilot() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [inWhitelist, setInWhitelist] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.email) {
        if (alive) setInWhitelist(false);
        return;
      }
      const { data } = await supabase
        .from('payslip_pilot_users')
        .select('id')
        .ilike('email', user.email)
        .maybeSingle();
      if (alive) setInWhitelist(!!data);
    })();
    return () => { alive = false; };
  }, [user?.email]);

  const roleBypass = role === 'super_admin' || role === 'salarizare';
  const isPilot = roleBypass || !!inWhitelist;

  return { isPilot, loading: inWhitelist === null && !roleBypass };
}
