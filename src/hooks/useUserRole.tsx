import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'user' | 'super_admin' | 'hr';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && !error) {
        // Map legacy roles to current ones
        const r = data.role as string;
        if (r === 'super_admin') setRole('super_admin');
        else if (r === 'hr') setRole('hr');
        else setRole('user');
      } else {
        setRole('user');
      }
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  const isSuperAdmin = role === 'super_admin';
  const isHR = role === 'hr';
  const isStaff = isSuperAdmin || isHR;
  
  // Can manage employee records and documents (HR department)
  const canManageHR = isSuperAdmin || isHR;
  
  // Can manage content (events, calendar)
  const canManageContent = isSuperAdmin || isHR;

  return { 
    role, 
    isSuperAdmin,
    isHR,
    isStaff,
    canManageContent,
    canManageHR,
    loading 
  };
}
