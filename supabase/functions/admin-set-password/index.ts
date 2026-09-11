import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Nu ești autentificat." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller) return json({ error: "Sesiune invalidă." }, 401);

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleData) return json({ error: "Doar Super Admin poate reseta parola." }, 403);

    const { userId, password } = await req.json();
    if (!userId || typeof password !== "string" || password.length < 10) {
      return json({ error: "Parola trebuie să aibă minimum 10 caractere." }, 400);
    }
    if (userId === caller.id) {
      return json({ error: "Folosește pagina de profil pentru propria parolă." }, 400);
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updErr) {
      const msg = /pwned|compromis|weak/i.test(updErr.message)
        ? "Parola aleasă este considerată nesigură. Generează alta."
        : "Nu s-a putut schimba parola.";
      console.error("updateUserById failed:", updErr.message);
      return json({ error: msg }, 400);
    }

    await admin.from("audit_logs").insert({
      user_id: caller.id,
      action: "admin_password_reset",
      entity_type: "auth_user",
      entity_id: userId,
      details: { performed_by: caller.email },
    } as any);

    return json({ success: true });
  } catch (e) {
    console.error("admin-set-password error:", e instanceof Error ? e.message : e);
    return json({ error: "Eroare internă." }, 500);
  }
});
