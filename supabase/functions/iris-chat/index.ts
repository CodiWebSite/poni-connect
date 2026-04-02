import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { logIrisAction, getClientIP } from "../_shared/iris-tools/audit.ts";
import {
  checkLeaveBalance,
  checkLeaveOverlaps,
  calculateWorkingDays,
  findApprover,
  createLeaveRequest,
  getPendingApprovals,
  getTeamOnLeave,
} from "../_shared/iris-tools/leave.ts";
import {
  createCorrectionRequest,
  createHelpdeskTicket,
  createHRRequest,
} from "../_shared/iris-tools/requests.ts";
import {
  getEmployeeSummary,
  getExpiringDocuments,
  getEmployeesWithoutAccounts,
} from "../_shared/iris-tools/hr.ts";
import { getSystemSummary } from "../_shared/iris-tools/system.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_ROUTES = `
Harta rutelor platformei ICMPP:
- / → Dashboard (pagina principală)
- /leave-request → Depunere cerere de concediu
- /leave-calendar → Calendar concedii
- /my-profile → Profilul meu
- /my-team → Echipa mea
- /hr-management → Gestiune HR (HR/sef_srus/super_admin)
- /medicina-muncii → Medicina Muncii
- /admin → Administrare (super_admin)
- /settings → Setări cont
- /formulare → Formulare și șabloane
- /library → Bibliotecă
- /salarizare → Salarizare
- /announcements → Anunțuri
- /room-bookings → Rezervări săli
- /activitati → Activități recreative
- /chat → Mesagerie internă
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

// ---- TOOL DEFINITIONS ----
const IRIS_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_leave_balance",
      description: "Verifică soldul de concediu al utilizatorului curent (zile totale, folosite, rămase, report, bonus).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_leave_request",
      description: "Pregătește o cerere de concediu de odihnă. Verifică soldul, suprapunerile, calculează zilele lucrătoare și găsește aprobatorul. Returnează un rezumat pentru confirmare.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Data început (YYYY-MM-DD)" },
          end_date: { type: "string", description: "Data sfârșit (YYYY-MM-DD)" },
          replacement_name: { type: "string", description: "Numele înlocuitorului (opțional, implicit '—')" },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_approvals",
      description: "Afișează cererile de concediu în așteptare de aprobare. Disponibil pentru șefi de departament, HR și super_admin.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_team_on_leave",
      description: "Verifică cine din echipă/departament este în concediu într-o perioadă.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Data început perioadă (YYYY-MM-DD, implicit azi)" },
          end_date: { type: "string", description: "Data sfârșit perioadă (YYYY-MM-DD, implicit azi)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_helpdesk_ticket",
      description: "Pregătește un tichet HelpDesk. Returnează rezumatul pentru confirmare.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Subiectul tichetului" },
          message: { type: "string", description: "Descrierea problemei" },
        },
        required: ["subject", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_correction_request",
      description: "Pregătește o cerere de corecție a datelor personale. Returnează rezumatul pentru confirmare.",
      parameters: {
        type: "object",
        properties: {
          field_name: { type: "string", description: "Numele câmpului de corectat" },
          current_value: { type: "string", description: "Valoarea curentă (dacă e cunoscută)" },
          requested_value: { type: "string", description: "Valoarea corectă dorită" },
          reason: { type: "string", description: "Motivul corecției" },
        },
        required: ["field_name", "requested_value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_hr_request",
      description: "Pregătește o cerere HR (adeverință de salariat, adeverință vechime, etc.). Returnează rezumatul pentru confirmare.",
      parameters: {
        type: "object",
        properties: {
          request_type: { type: "string", description: "Tipul cererii: adeverinta_salariat, adeverinta_vechime, adeverinta_venit, alt_document" },
          details: { type: "string", description: "Detalii suplimentare despre cerere" },
        },
        required: ["request_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_employee_summary",
      description: "Rezumat complet despre un angajat: date personale, sold concediu, documente, cereri. Disponibil doar pentru HR, sef_srus și super_admin.",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string", description: "Numele (parțial sau complet) al angajatului" },
        },
        required: ["employee_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expiring_documents",
      description: "Documente CI ce expiră în perioada specificată. Doar HR/super_admin.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Număr de zile în viitor (implicit 90)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_system_summary",
      description: "Rezumat operațional complet al sistemului: stare, cereri, tichete, utilizatori. Doar super_admin.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ---- TOOL EXECUTOR ----
async function executeTool(
  toolName: string,
  args: Record<string, any>,
  supabase: any,
  userId: string,
  userRole: string,
  profile: any,
): Promise<any> {
  const hrRoles = ["super_admin", "hr", "sef_srus"];
  const approverRoles = ["super_admin", "hr", "sef_srus", "sef", "director_institut", "director_adjunct", "secretar_stiintific"];

  switch (toolName) {
    case "check_leave_balance":
      return await checkLeaveBalance(supabase, userId);

    case "prepare_leave_request": {
      const balance = await checkLeaveBalance(supabase, userId);
      if (balance.error) return balance;
      const wd = calculateWorkingDays(args.start_date, args.end_date);
      if (wd <= 0) return { error: "Perioada selectată nu conține zile lucrătoare." };
      if (wd > balance.totalAvailable) return { error: `Sold insuficient: ${balance.totalAvailable} zile disponibile, cererea necesită ${wd}.` };
      const overlaps = await checkLeaveOverlaps(supabase, userId, args.start_date, args.end_date);
      if (overlaps.length > 0) return { error: `Suprapunere cu cererea existentă ${overlaps[0].start_date} — ${overlaps[0].end_date}.` };
      const approver = await findApprover(supabase, userId);
      return {
        action_required: true,
        action_type: "create_leave",
        summary: {
          startDate: args.start_date,
          endDate: args.end_date,
          workingDays: wd,
          replacementName: args.replacement_name || "—",
          approverName: approver?.name || "Nedesemnat",
          currentBalance: balance.totalAvailable,
          balanceAfter: balance.totalAvailable - wd,
        },
      };
    }

    case "get_pending_approvals":
      if (!approverRoles.includes(userRole)) return { error: "Nu aveți permisiunea de a vedea aprobările în așteptare." };
      return await getPendingApprovals(supabase, userId, userRole);

    case "get_team_on_leave":
      return await getTeamOnLeave(supabase, userId, args.start_date, args.end_date);

    case "prepare_helpdesk_ticket":
      return {
        action_required: true,
        action_type: "create_helpdesk_ticket",
        summary: {
          subject: args.subject,
          message: args.message,
          senderName: profile?.full_name || "Necunoscut",
          senderEmail: profile?.email || "necunoscut",
        },
      };

    case "prepare_correction_request":
      return {
        action_required: true,
        action_type: "create_correction_request",
        summary: {
          fieldName: args.field_name,
          currentValue: args.current_value || "necunoscut",
          requestedValue: args.requested_value,
          reason: args.reason || "Corecție solicitată prin IRIS",
        },
      };

    case "prepare_hr_request":
      return {
        action_required: true,
        action_type: "create_hr_request",
        summary: {
          requestType: args.request_type,
          details: args.details || "",
        },
      };

    case "get_employee_summary":
      if (!hrRoles.includes(userRole)) return { error: "Nu aveți permisiunea de a accesa dosarele angajaților." };
      return await getEmployeeSummary(supabase, args.employee_name);

    case "get_expiring_documents":
      if (!hrRoles.includes(userRole)) return { error: "Nu aveți permisiunea de a vedea documentele expirate." };
      return await getExpiringDocuments(supabase, args.days || 90);

    case "get_system_summary":
      if (userRole !== "super_admin") return { error: "Doar super_admin poate accesa rezumatul de sistem." };
      return await getSystemSummary(supabase);

    default:
      return { error: `Tool necunoscut: ${toolName}` };
  }
}

// ---- ACTION EXECUTOR (after user confirmation) ----
async function executeAction(
  actionType: string,
  data: Record<string, any>,
  supabase: any,
  userId: string,
  userRole: string,
  profile: any,
  ip: string,
) {
  // Normalize common AI mismatches
  const typeMap: Record<string, string> = {
    "create_request": "create_hr_request",
    "create_ticket": "create_helpdesk_ticket",
    "create_correction": "create_correction_request",
    "submit_leave": "create_leave",
    "request_leave": "create_leave",
  };
  const normalizedType = typeMap[actionType] || actionType;

  switch (normalizedType) {
    case "create_leave": {
      const result = await createLeaveRequest(
        supabase, supabase, userId,
        data.startDate, data.endDate,
        data.replacementName || "—", ip
      );
      if (result.error) return result;
      await logIrisAction(supabase, userId, "create_leave_request", "leave_request", result.requestId, {
        start_date: data.startDate,
        end_date: data.endDate,
        working_days: result.workingDays,
        request_number: result.requestNumber,
      }, ip);
      return result;
    }

    case "create_helpdesk_ticket": {
      const result = await createHelpdeskTicket(
        supabase, profile?.full_name || "Necunoscut",
        data.senderEmail || profile?.email || "necunoscut@icmpp.ro",
        data.subject, data.message
      );
      if (result.error) return result;
      await logIrisAction(supabase, userId, "create_helpdesk_ticket", "helpdesk_ticket", result.ticketId, {
        subject: data.subject,
      }, ip);
      return result;
    }

    case "create_correction_request": {
      const result = await createCorrectionRequest(
        supabase, userId,
        data.fieldName, data.currentValue || "",
        data.requestedValue, data.reason || "Corecție solicitată prin IRIS"
      );
      if (result.error) return result;
      await logIrisAction(supabase, userId, "create_correction_request", "data_correction", result.requestId, {
        field_name: data.fieldName,
        requested_value: data.requestedValue,
      }, ip);
      return result;
    }

    case "create_hr_request": {
      const result = await createHRRequest(
        supabase, userId,
        data.requestType, { details: data.details || "", initiated_via: "iris" }
      );
      if (result.error) return result;
      await logIrisAction(supabase, userId, "create_hr_request", "hr_request", result.requestId, {
        request_type: data.requestType,
      }, ip);
      return result;
    }

    default:
      return { error: `Tip de acțiune necunoscut: ${actionType}` };
  }
}

// ---- CONTEXT BUILDER ----
async function getContext(supabase: any, userId: string, userRole: string) {
  const ctx: Record<string, any> = {};

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, department, position")
    .eq("user_id", userId)
    .single();
  ctx.profile = profile;

  const { data: leave } = await supabase
    .from("employee_records")
    .select("total_leave_days, used_leave_days, remaining_leave_days, hire_date, contract_type")
    .eq("user_id", userId)
    .single();
  ctx.leave = leave;

  const { data: myRequests } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, working_days, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  ctx.myRequests = myRequests || [];

  const { data: announcements } = await supabase
    .from("announcements")
    .select("title, priority, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  ctx.announcements = announcements || [];

  const { data: changelog } = await supabase
    .from("changelog_entries")
    .select("title, version, created_at")
    .order("created_at", { ascending: false })
    .limit(3);
  ctx.changelog = changelog || [];

  const { count: unreadNotifs } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  ctx.unreadNotifications = unreadNotifs || 0;

  if (["super_admin", "hr", "sef_srus"].includes(userRole)) {
    const { count: pendingLeave } = await supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending_department_head", "pending_srus"]);
    ctx.pendingLeaveRequests = pendingLeave || 0;

    const { count: pendingHR } = await supabase
      .from("hr_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    ctx.pendingHRRequests = pendingHR || 0;

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
  const remaining = leave.remaining_leave_days ?? (leave.total_leave_days != null ? leave.total_leave_days - (leave.used_leave_days || 0) : "nedisponibil");

  let contextData = `
DATELE UTILIZATORULUI CURENT:
- Nume: ${profile.full_name || "necunoscut"}
- Departament: ${profile.department || "necunoscut"}
- Funcție: ${profile.position || "necunoscută"}
- Rol platformă: ${userRole}
- Acces module: ${roleAccess}

SOLD CONCEDIU: Total ${leave.total_leave_days ?? "N/A"} | Folosite ${leave.used_leave_days ?? "N/A"} | Rămase ${remaining}

CERERI RECENTE: ${context.myRequests?.length ? context.myRequests.map((r: any) => `${r.start_date}→${r.end_date} (${r.working_days}z, ${r.status})`).join("; ") : "Nicio cerere"}

NOTIFICĂRI NECITITE: ${context.unreadNotifications}
`;

  if (["super_admin", "hr", "sef_srus"].includes(userRole)) {
    contextData += `\nCONTEXT ADMIN: Concedii pending: ${context.pendingLeaveRequests ?? 0} | HR pending: ${context.pendingHRRequests ?? 0} | CI expiră 90z: ${context.expiringDocuments ?? 0}`;
  }
  if (userRole === "super_admin" && context.systemHealth) {
    contextData += ` | Sistem: ${context.systemHealth.overall}`;
  }

  return `Ești IRIS v2 — Inteligență pentru Resurse Interne și Suport — copilotul operațional al platformei intranet ICMPP (Institutul de Chimie Macromoleculară "Petru Poni" din Iași).

IDENTITATE: Ton academic, clar, politicos, profesionist. Te adresezi cu "dumneavoastră". Răspunzi EXCLUSIV în limba română.

MODURI DE LUCRU:
1. READ MODE: Explici, cauți, rezumi, orientezi, arăți statusuri, explici fluxuri, oferi linkuri.
2. ACTION MODE: Pregătești acțiuni (cereri concediu, tichete, corecții), CERI CONFIRMARE, execuți doar după confirmare.

REGULI STRICTE:
- NU inventa date. Dacă nu ai informația, spune clar.
- NU expune date ale altor utilizatori (cu excepția HR-ului care accesează dosare angajați).
- Rolul "admin" NU există — doar "super_admin" are acces total.
- NU expune CNP, CI, adresă, telefon — niciodată.
- Orice acțiune write necesită CONFIRMARE explicită.

TOOL-URI DISPONIBILE:
Ai acces la funcții pe care le poți apela. Când AI-ul returnează un rezultat cu "action_required: true", TREBUIE să incluzi blocul de confirmare astfel:
[IRIS_ACTION:{"type":"<action_type>","data":{...datele},"label":"<descriere scurtă>"}]

Utilizatorul va vedea un card de confirmare. După confirmare, acțiunea va fi executată automat.

TIPURI DE ACȚIUNI VALIDE (folosește EXACT aceste valori pentru "type"):
- "create_leave" — Cerere de concediu. Data: { startDate, endDate, replacementName }
- "create_helpdesk_ticket" — Tichet HelpDesk. Data: { subject, message, senderEmail? }
- "create_correction_request" — Corecție date personale. Data: { fieldName, currentValue?, requestedValue, reason? }
- "create_hr_request" — Cerere HR (adeverință, delegație, demisie). Data: { requestType: "adeverinta"|"delegatie"|"demisie"|"concediu", details? }

NU folosi alte tipuri de acțiuni precum "create_request" — acestea nu sunt suportate.

FLUX CONCEDIU:
1. Angajat depune cerere → status: pending_department_head
2. Șef departament aprobă → status: pending_srus
3. SRUS validează → status: approved
Deducerea zilelor se face la pasul 3.

RUTĂRI CERERI:
- Adeverință → HR
- Cerere creare cont → Super Admin
- Concediu odihnă → Șef Departament → SRUS
- Corecție date → HR
- Tichet HelpDesk → Super Admin

PAGINA CURENTĂ: ${currentRoute}
${PLATFORM_ROUTES}
${contextData}

Răspunde concis. Oferă linkuri markdown către pagini relevante. Folosește tool-urile când e nevoie.`;
}

// ---- MAIN HANDLER ----
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
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Neautorizat" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .single();
    const userRole = roleData?.role || "user";

    const ip = getClientIP(req.headers);
    const body = await req.json();

    // ---- EXECUTE ACTION (confirmation flow) ----
    if (body.executeAction) {
      const { type, data } = body.executeAction;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, department, position")
        .eq("user_id", userId)
        .single();

      // Get user email
      const userEmail = user.email || "";
      const profileWithEmail = { ...profile, email: userEmail };

      const result = await executeAction(type, data, supabase, userId, userRole, profileWithEmail, ip);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- CHAT FLOW ----
    const { messages, currentRoute } = body;
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mesaje lipsă" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const context = await getContext(supabase, userId, userRole);
    const systemPrompt = buildSystemPrompt(userRole, context, currentRoute || "/");

    // First call with tools
    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    let finalResponse = await callAIWithTools(lovableApiKey, aiMessages, supabase, userId, userRole, context.profile);

    // Stream the final response
    const streamResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: finalResponse,
        stream: true,
      }),
    });

    if (!streamResp.ok) {
      if (streamResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limită de cereri depășită. Încercați din nou." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (streamResp.status === 402) {
        return new Response(JSON.stringify({ error: "Credite insuficiente pentru AI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await streamResp.text();
      console.error("AI gateway error:", streamResp.status, errText);
      return new Response(JSON.stringify({ error: "Eroare AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(streamResp.body, {
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

// ---- AI TOOL-CALLING LOOP ----
async function callAIWithTools(
  apiKey: string,
  messages: any[],
  supabase: any,
  userId: string,
  userRole: string,
  profile: any,
  depth = 0,
): Promise<any[]> {
  if (depth > 5) return messages; // safety limit

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      tools: IRIS_TOOLS,
      tool_choice: "auto",
    }),
  });

  if (!resp.ok) {
    console.error("Tool call AI error:", resp.status);
    return messages;
  }

  const data = await resp.json();
  const choice = data.choices?.[0];
  if (!choice) return messages;

  const msg = choice.message;
  messages.push(msg);

  // If no tool calls, return messages as-is for streaming
  if (!msg.tool_calls || msg.tool_calls.length === 0) {
    // Remove the last message (non-streamed) and return for re-streaming
    messages.pop();
    return messages;
  }

  // Execute each tool call
  for (const tc of msg.tool_calls) {
    const fn = tc.function;
    let args: Record<string, any> = {};
    try {
      args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments || {};
    } catch {
      args = {};
    }

    console.log(`IRIS tool call: ${fn.name}`, args);
    const result = await executeTool(fn.name, args, supabase, userId, userRole, profile);

    messages.push({
      role: "tool",
      tool_call_id: tc.id,
      content: JSON.stringify(result),
    });
  }

  // Recurse in case AI wants to call more tools
  return callAIWithTools(apiKey, messages, supabase, userId, userRole, profile, depth + 1);
}
