import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const cache = new Map<string, { value: boolean; at: number }>();
const TTL = 60_000;

export function useFeatureFlag(key: string, defaultValue = true) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    const c = cache.get(key);
    return c && Date.now() - c.at < TTL ? c.value : defaultValue;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const c = cache.get(key);
    if (c && Date.now() - c.at < TTL) {
      setEnabled(c.value);
      setLoading(false);
      return;
    }
    supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', key)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const v = data?.enabled ?? defaultValue;
        cache.set(key, { value: v, at: Date.now() });
        setEnabled(v);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [key, defaultValue]);

  return { enabled, loading };
}
