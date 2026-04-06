import { supabase } from '@/integrations/supabase/client';

/**
 * Log an export action to audit_logs via security_events.
 * This is called client-side when a user exports data.
 */
export async function logExportAction(
  userId: string,
  exportType: string,
  recordCount: number,
  details?: Record<string, any>
) {
  try {
    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: 'data_export',
      severity: 'info',
      details: {
        export_type: exportType,
        record_count: recordCount,
        timestamp: new Date().toISOString(),
        ...details,
      },
    });
  } catch {
    // Silent fail - don't block exports
  }
}
