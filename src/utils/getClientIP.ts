import { supabase } from '@/integrations/supabase/client';

export async function getClientIP(): Promise<string> {
  try {
    const { data } = await supabase.functions.invoke('check-ip-access');
    return data?.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}
