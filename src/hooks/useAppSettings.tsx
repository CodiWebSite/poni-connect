import { useState, useEffect } from 'react';
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

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('app_settings').select('key, value').then(({ data }) => {
      if (data) {
        const map: Record<string, any> = {};
        data.forEach(row => { map[row.key] = row.value; });
        setSettings({
          leave_module_beta: map.leave_module_beta === true,
          maintenance_mode: map.maintenance_mode === true,
          homepage_message: typeof map.homepage_message === 'string' ? map.homepage_message : '',
        });
      }
      setLoading(false);
    });
  }, []);

  return { settings, loading };
}
