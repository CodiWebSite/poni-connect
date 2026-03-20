import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';

interface PagePermission {
  page_key: string;
  can_access: boolean;
}

export function usePageAccess() {
  const { role, isSuperAdmin } = useUserRole();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role) {
      setLoading(false);
      return;
    }

    // Super admin always has full access — skip DB query
    if (isSuperAdmin) {
      setPermissions({});
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      const { data, error } = await supabase
        .from('role_page_permissions')
        .select('page_key, can_access')
        .eq('role_key', role);

      if (!error && data) {
        const map: Record<string, boolean> = {};
        (data as PagePermission[]).forEach(row => {
          map[row.page_key] = row.can_access;
        });
        setPermissions(map);
      }
      setLoading(false);
    };

    fetchPermissions();
  }, [role, isSuperAdmin]);

  const canAccessPage = useCallback((pageKey: string): boolean => {
    // Super admin bypasses everything
    if (isSuperAdmin) return true;
    // If permission exists in DB, use it; otherwise default to true
    if (pageKey in permissions) return permissions[pageKey];
    return true;
  }, [isSuperAdmin, permissions]);

  return { canAccessPage, permissions, loading };
}
