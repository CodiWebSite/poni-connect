import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  leave_module_beta: boolean;
  maintenance_mode: boolean;
  homepage_message: string;
}

const defaults: AppSettings = {
  leave_module_beta: true,
  maintenance_mode: false,
  homepage_message: '',
};

function parseSettings(data: { key: string; value: any }[]): AppSettings {
  const map: Record<string, any> = {};
  data.forEach(row => { map[row.key] = row.value; });
  return {
    leave_module_beta: map.leave_module_beta === true,
    maintenance_mode: map.maintenance_mode === true,
    homepage_message: typeof map.homepage_message === 'string' ? map.homepage_message : '',
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaults);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('key, value');
    if (data) setSettings(parseSettings(data));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('app_settings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
        fetchSettings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchSettings]);

  return { settings, loading };
}
