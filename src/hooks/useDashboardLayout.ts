import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LayoutItem, defaultLayout, resolveLayout } from '@/components/dashboard/dashboardWidgets';

export function useDashboardLayout(roles: string[] = []) {
  const { user } = useAuth();
  const [layout, setLayout] = useState<LayoutItem[]>(() => defaultLayout(roles));
  const rolesKey = roles.join(',');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('user_dashboard_layouts').select('widgets').eq('user_id', user.id).maybeSingle();
      setLayout(resolveLayout(data?.widgets, roles));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, rolesKey]);

  const save = useCallback(async (next: LayoutItem[]) => {
    setLayout(next);
    if (!user) return;
    await supabase.from('user_dashboard_layouts').upsert({ user_id: user.id, widgets: next as any, updated_at: new Date().toISOString() });
  }, [user]);

  const reset = useCallback(async () => {
    setLayout(defaultLayout(roles));
    if (user) await supabase.from('user_dashboard_layouts').delete().eq('user_id', user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, rolesKey]);

  return { layout, save, reset };
}
