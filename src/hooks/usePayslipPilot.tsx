import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Returns whether the current user should see the payslip pilot features.
 * Super-admin and salarizare roles always have access (for testing/support).
 * Otherwise the backend checks whether the user's email is present in payslip_pilot_users.
 */
export function usePayslipPilot() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [inWhitelist, setInWhitelist] = useState<boolean | null>(null);
  const roleBypass = role === 'super_admin' || role === 'salarizare';

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) {
        if (alive) setInWhitelist(false);
        return;
      }
      if (roleBypass) {
        if (alive) setInWhitelist(true);
        return;
      }

      const { data, error } = await supabase.rpc('is_payslip_pilot_user', {
        _user_id: user.id,
      });

      if (alive) setInWhitelist(!error && data === true);
    })();
    return () => { alive = false; };
  }, [user?.id, roleBypass]);

  const isPilot = roleBypass || !!inWhitelist;

  return { isPilot, loading: inWhitelist === null && !roleBypass };
}
