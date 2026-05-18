import { supabase } from '@/integrations/supabase/client';

/**
 * Logs a sensitive administrative action to audit_logs.
 * Used by RequireReasonDialog AND for actions where we already gathered a reason.
 */
export async function logSensitiveAction(params: {
  action: string;
  reason: string;
  entity_type?: string;
  entity_id?: string | null;
  extra?: Record<string, unknown>;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  await supabase.rpc('log_audit_event', {
    _user_id: uid,
    _action: params.action,
    _entity_type: params.entity_type ?? null,
    _entity_id: params.entity_id ?? null,
    _details: { reason: params.reason, ...(params.extra ?? {}) } as never,
  });
}
