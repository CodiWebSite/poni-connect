/**
 * Jurnal centralizat de eșecuri operaționale (e-mailuri, notificări, sincronizări).
 * Scrie direct prin Data API cu service role — best effort, nu blochează niciodată apelantul.
 */

export interface OpsFailure {
  /** Funcția / modulul care a eșuat, ex. "notify-leave-email". */
  source: string;
  /** email | push | sync | job */
  kind?: string;
  /** Ce s-a încercat, pe scurt. */
  subject?: string;
  /** Destinatarul (e-mail, nume utilizator). */
  target?: string;
  error?: string;
  /** Funcția care poate fi reapelată pentru reîncercare. */
  retry_function?: string;
  retry_body?: Record<string, unknown>;
}

export async function logOpsFailure(failure: OpsFailure): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    await fetch(`${url}/rest/v1/ops_failures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        source: failure.source,
        kind: failure.kind ?? "email",
        subject: failure.subject ?? null,
        target: failure.target ?? null,
        error: (failure.error ?? "").slice(0, 2000) || null,
        retry_function: failure.retry_function ?? null,
        retry_body: failure.retry_body ?? null,
      }),
    });
  } catch (e) {
    console.warn("[ops-log] could not record failure:", (e as Error)?.message);
  }
}
