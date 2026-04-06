/**
 * Centralized error handler for edge functions.
 * Never expose internal error details to clients.
 */

const GENERIC_MESSAGES: Record<number, string> = {
  400: "Cererea nu a putut fi procesată. Verifică datele introduse.",
  401: "Nu ești autentificat. Te rugăm să te autentifici.",
  403: "Nu ai permisiuni pentru această acțiune.",
  404: "Resursa solicitată nu a fost găsită.",
  429: "Prea multe cereri. Te rugăm să aștepți.",
  500: "Eroare internă. Te rugăm să încerci din nou.",
};

export function safeErrorResponse(
  status: number,
  corsHeaders: Record<string, string>,
  customMessage?: string
): Response {
  const message = customMessage || GENERIC_MESSAGES[status] || GENERIC_MESSAGES[500];
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

export function logAndRespond(
  error: unknown,
  corsHeaders: Record<string, string>,
  context?: string
): Response {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[${context || "edge-function"}] Error:`, msg);
  return safeErrorResponse(500, corsHeaders);
}
