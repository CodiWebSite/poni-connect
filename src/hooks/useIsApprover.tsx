import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useIsApprover() {
  const { user } = useAuth();
  const [isDesignatedApprover, setIsDesignatedApprover] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsDesignatedApprover(false);
      setLoading(false);
      return;
    }

    Promise.all([
      supabase.from('leave_approvers').select('id').eq('approver_user_id', user.id).limit(1),
      supabase.from('leave_department_approvers').select('id').eq('approver_user_id', user.id).limit(1),
    ]).then(([empResult, deptResult]) => {
      setIsDesignatedApprover(
        (empResult.data || []).length > 0 || (deptResult.data || []).length > 0
      );
      setLoading(false);
    });
  }, [user]);

  return { isDesignatedApprover, loading };
}
