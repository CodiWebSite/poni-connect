import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_ROUTES = `
Harta rutelor platformei ICMPP:
- / → Dashboard (pagina principală, rezumat activitate)
- /leave-request → Depunere cerere de concediu
- /leave-calendar → Calendar concedii (vizualizare departament/institut)
- /my-profile → Profilul meu (date personale, sold concediu)
- /my-team → Echipa mea (membrii departamentului)
- /hr-management → Gestiune HR (doar HR/sef_srus/super_admin)
- /medicina-muncii → Medicina Muncii (dosare medicale)
- /admin → Administrare platformă (doar super_admin)
- /settings → Setări cont
- /formulare → Formulare și șabloane
- /library → Bibliotecă instituțională
- /salarizare → Salarizare (doar rol salarizare/super_admin)
- /announcements → Anunțuri
- /room-bookings → Rezervări săli
- /activitati → Activități recreative
- /chat → Mesagerie internă
- /install → Instalare aplicație
- /arhiva → Arhivă documente
- /system-status → Stare sistem
- /changelog → Noutăți platformă
- /inventory → Inventar echipamente
- /ghid → Ghid platformă
`;

const ROLE_ACCESS_MAP: Record<string, string> = {
  super_admin: "Acces complet la toate modulele platformei.",
  director_institut: "Dashboard, concedii, echipă, anunțuri, HR (vizualizare), bibliotecă, rezervări.",
  director_adjunct: "Dashboard, concedii, echipă, anunțuri, HR (vizualizare), bibliotecă, rezervări.",
  secretar_stiintific: "Dashboard, concedii, echipă, anunțuri, bibliotecă, rezervări.",
  sef_srus: "Dashboard, concedii, echipă, HR (gestionare completă), anunțuri, rezervări.",
  sef: "Dashboard, concedii, echipa proprie, aprobări cereri departament.",
  hr: "Dashboard, concedii, HR (gestionare completă), anunțuri.",
  bibliotecar: "Dashboard, concedii, bibliotecă (gestionare).",
  salarizare: "Dashboard, concedii, salarizare (gestionare).",
  secretariat: "Dashboard, concedii, formulare, anunțuri.",
  achizitii: "Dashboard, concedii, achiziții.",
  contabilitate: "Dashboard, concedii, contabilitate.",
  oficiu_juridic: "Dashboard, concedii, juridic.",
  compartiment_comunicare: "Dashboard, concedii, comunicare, anunțuri.",
  medic_medicina_muncii: "Dashboard, concedii, medicina muncii (gestionare dosare).",
  user: "Dashboard, concedii proprii, profil, mesagerie, anunțuri.",
};

async function getContext(supabase: any, userId: string, userRole: string) {
  const ctx: Record<string, any> = {};

  // Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, department, position")
    .eq("user_id", userId)
    .single();
  ctx.profile = profile;

  // Leave balance
  const { data: leave } = await supabase
    .from("employee_records")
    .select("total_leave_days, used_leave_days, remaining_leave_days, hire_date, contract_type")
    .eq("user_id", userId)
    .single();
  ctx.leave = leave;

  // Recent leave requests (own)
  const { data: myRequests } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, working_days, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  ctx.myRequests = myRequests || [];

  // Recent announcements
  const { data: announcements } = await supabase
    .from("announcements")
    .select("title, priority, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  ctx.announcements = announcements || [];

  // Changelog
  const { data: changelog } = await supabase
    .from("changelog_entries")
    .select("title, version, created_at")
    .order("created_at", { ascending: false })
    .limit(3);
  ctx.changelog = changelog || [];

  // Unread notifications count
  const { count: unreadNotifs } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  ctx.unreadNotifications = unreadNotifs || 0;

  // HR/admin extended context
  const privilegedRoles = ["super_admin", "hr", "sef_srus"];
  if (privilegedRoles.includes(userRole)) {
    const { count: pendingLeave } = await supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    ctx.pendingLeaveRequests = pendingLeave || 0;

    const { count: pendingHR } = await supabase
      .from("hr_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    ctx.pendingHRRequests = pendingHR || 0;

    // Expiring CI documents (next 90 days)
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);
    const { count: expiringDocs } = await supabase
      .from("employee_personal_data")
      .select("id", { count: "exact", head: true })
      .lt("ci_expiry_date", in90Days.toISOString().split("T")[0])
      .gt("ci_expiry_date", new Date().toISOString().split("T")[0])
      .eq("is_archived", false);
    ctx.expiringDocuments = expiringDocs || 0;
  }

  // Super admin extra
  if (userRole === "super_admin") {
    const { data: healthCheck } = await supabase
      .from("health_check_logs")
      .select("overall, checked_at")
      .order("checked_at", { ascending: false })
      .limit(1)
      .single();
    ctx.systemHealth = healthCheck;
  }

  return ctx;
}

function buildSystemPrompt(userRole: string, context: Record<string, any>, currentRoute: string) {
  const profile = context.profile || {};
  const leave = context.leave || {};
  const roleAccess = ROLE_ACCESS_MAP[userRole] || ROLE_ACCESS_MAP["user"];

  let contextData = `
DATELE UTILIZATORULUI CURENT:
- Nume: ${profile.full_name || "necunoscut"}
- Departament: ${profile.department || "necunoscut"}
- Funcție: ${profile.position || "necunoscută"}
- Rol platformă: ${userRole}
- Acces module: ${roleAccess}

SOLD CONCEDIU:
- Total zile: ${leave.total_leave_days ?? "nedisponibil"}
- Zile folosite: ${leave.used_leave_days ?? "nedisponibil"}
- Zile rămase: ${leave.remaining_leave_days ?? (leave.total_leave_days != null ? leave.total_leave_days - (leave.used_leave_days || 0) : "nedisponibil")}
- Tip contract: ${leave.contract_type || "nedisponibil"}

CERERI CONCEDIU RECENTE (ale utilizatorului):
${context.myRequests?.length ? context.myRequests.map((r: any) => `- ${r.start_date} → ${r.end_date} (${r.working_days} zile) — Status: ${r.status}`).join("\n") : "Nicio cerere recentă."}

ANUNȚURI RECENTE:
${context.announcements?.length ? context.announcements.map((a: any) => `- ${a.title} (${a.priority || "normal"}) — ${a.created_at?.split("T")[0]}`).join("\n") : "Niciun anunț recent."}

NOUTĂȚI PLATFORMĂ:
${context.changelog?.length ? context.changelog.map((c: any) => `- v${c.version}: ${c.title}`).join("\n") : "Nicio noutate recentă."}

NOTIFICĂRI NECITITE: ${context.unreadNotifications}
`;

  if (["super_admin", "hr", "sef_srus"].includes(userRole)) {
    contextData += `
CONTEXT ADMINISTRATIV:
- Cereri concediu în așteptare: ${context.pendingLeaveRequests ?? "N/A"}
- Cereri HR în așteptare: ${context.pendingHRRequests ?? "N/A"}
- Documente CI ce expiră în 90 zile: ${context.expiringDocuments ?? "N/A"}
`;
  }

  if (userRole === "super_admin" && context.systemHealth) {
    contextData += `- Stare sistem: ${context.systemHealth.overall} (verificat: ${context.systemHealth.checked_at?.split("T")[0]})\n`;
  }

  return `Ești IRIS — Inteligență pentru Resurse Interne și Suport — asistentul AI al platformei intranet ICMPP (Institutul de Chimie Macromoleculară "Petru Poni" din Iași).

IDENTITATE ȘI TON:
- Răspunzi EXCLUSIV în limba română
- Ton academic, clar, politicos, cald, profesionist
- Ești calm, util, precis — fără răspunsuri pompoase sau robotice
- Te adresezi cu "dumneavoastră" utilizatorului
- Ești un copilot intern academic, nu un chatbot generalist

REGULI STRICTE:
1. NU inventa date — dacă nu ai o informație, spune clar "Nu am acces la această informație" sau "Nu pot confirma acest lucru"
2. NU expune date ale altor utilizatori — răspunzi DOAR cu datele utilizatorului curent
3. NU faci modificări — ești read-only, ghidezi utilizatorul către acțiunea corectă
4. NU aprobi cereri, NU modifici roluri, NU ștergi date
5. Rolul "admin" NU există în platformă — doar "super_admin" are acces total
6. Respectă strict rolurile și permisiunile platformei
7. Când nu poți ajuta, redirecționează către modulul/pagina potrivită sau către administratorul de sistem
8. Nu expune CNP, CI, adresă, telefon — niciodată, nici măcar datele proprii ale utilizatorului (acestea sunt restricționate global)

CE POȚI FACE:
- Răspunde la întrebări despre platformă și funcționalitățile ei
- Oferă ghidaj contextual (ce pagină să acceseze, ce pași să urmeze)
- Rezumă informații relevante (sold concediu, cereri, anunțuri, noutăți)
- Explică statusuri, pași și fluxuri (ex: cum se depune o cerere de concediu)
- Ajută la navigare (link-uri directe către module)
- Interoghează datele existente ale utilizatorului

PAGINA CURENTĂ A UTILIZATORULUI: ${currentRoute}

${PLATFORM_ROUTES}

${contextData}

Răspunde concis și util. Dacă utilizatorul întreabă ceva ce nu ține de platformă, redirecționează-l politicos. Oferă link-uri către paginile relevante când este cazul (ex: "Puteți accesa [Cerere concediu](/leave-request) pentru a depune o cerere.").`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Neautorizat" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Neautorizat" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .single();
    const userRole = roleData?.role || "user";

    const { messages, currentRoute } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mesaje lipsă" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context
    const context = await getContext(supabase, userId, userRole);
    const systemPrompt = buildSystemPrompt(userRole, context, currentRoute || "/");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limită de cereri depășită. Încercați din nou mai târziu." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credite insuficiente pentru AI. Contactați administratorul." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Eroare la serviciul AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("iris-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Eroare necunoscută" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
