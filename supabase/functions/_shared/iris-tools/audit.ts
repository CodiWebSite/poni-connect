import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export async function logIrisAction(
  serviceClient: any,
  userId: string,
  action: string,
  entityType: string | null,
  entityId: string | null,
  details: Record<string, any>,
  ip: string
) {
  await serviceClient.from("audit_logs").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: { ...details, initiated_via: "iris", ip },
  });
}

export function getClientIP(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
