import { createClient } from "@supabase/supabase-js";

/**
 * Shared authentication helpers for edge functions.
 */

export interface AuthResult {
  userId: string;
  token: string;
}

export interface AuthRoleResult extends AuthResult {
  role: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Extract and validate JWT from the Authorization header.
 * Returns the user ID or null if invalid.
 */
export async function validateJWT(
  req: Request
): Promise<{ userId: string; error?: never } | { userId?: never; error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: new Response(JSON.stringify({ error: "Nu ești autentificat." }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }),
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return {
      error: new Response(JSON.stringify({ error: "Nu ești autentificat." }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }),
    };
  }

  return { userId: data.claims.sub as string };
}

/**
 * Validate JWT and check that the user has a specific role.
 */
export async function requireRole(
  req: Request,
  requiredRole: string
): Promise<{ userId: string; error?: never } | { userId?: never; error: Response }> {
  const auth = await validateJWT(req);
  if (auth.error) return auth;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!roleData || roleData.role !== requiredRole) {
    return {
      error: new Response(
        JSON.stringify({ error: "Nu ai permisiuni pentru această acțiune." }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      ),
    };
  }

  return { userId: auth.userId };
}

/**
 * Get client IP from request headers.
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Get the service role Supabase client.
 */
export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}
