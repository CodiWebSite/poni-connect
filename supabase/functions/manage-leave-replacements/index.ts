import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { trySendMail } from "../_shared/smtp-retry.ts";

const ACTIVE_STATUSES = ["pending_director", "pending_department_head", "pending_srus", "approved"];
const CROSS_DEPARTMENT_PAIRS = new Set([
  "ebcea4c3-bed6-4960-bb27-4f43303094b3:50c33275-d49f-48a4-a9f9-ad6f36b70d4b",
  "50c33275-d49f-48a4-a9f9-ad6f36b70d4b:ebcea4c3-bed6-4960-bb27-4f43303094b3",
]);
const APPROVAL_URL = "https://intranet.icmpp.ro/leave-request?tab=approve";
const DELEGATION_URL = "https://intranet.icmpp.ro/leave-request?tab=delegate";

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check-replacement"), replacement_epd_id: z.string().uuid(), start_date: dateField, end_date: dateField }),
  z.object({ action: z.literal("check-delegate"), delegate_user_id: z.string().uuid(), start_date: dateField, end_date: dateField, source_delegation_id: z.string().uuid().optional() }),
  z.object({ action: z.literal("create"), delegate_user_id: z.string().uuid(), start_date: dateField, end_date: dateField, reason: z.enum(["concediu", "delegatie", "altele"]).default("concediu") }),
  z.object({ action: z.literal("transfer"), source_delegation_id: z.string().uuid(), new_delegate_user_id: z.string().uuid() }),
  z.object({ action: z.literal("deactivate"), delegation_id: z.string().uuid() }),
  z.object({ action: z.literal("send-preview") }),
]);
const PREVIEW_RECIPIENT = "condrea.codrin@icmpp.ro";

type MailKind = "create" | "transfer" | "deactivate";
const buildMail = (kind: MailKind, isNewDelegate: boolean, p: { scope: string; period: string; delegatorName: string; delegateName: string; actorName: string }) => {
  const { scope, period, delegatorName, delegateName, actorName } = p;
  const subject = kind === "deactivate" ? `Înlocuire dezactivată — ${scope}`
    : isNewDelegate ? `Ai fost desemnat înlocuitor pentru aprobări — ${scope}`
    : kind === "transfer" ? `Ștafeta pentru aprobări a fost transferată — ${scope}`
    : `Înlocuitor desemnat pentru aprobări — ${scope}`;
  const actionText = kind === "deactivate"
    ? `Înlocuirea pentru aprobări a fost dezactivată de <strong>${escapeHtml(actorName)}</strong>.`
    : isNewDelegate
      ? kind === "transfer"
        ? `<strong>${escapeHtml(actorName)}</strong> ți-a transferat ștafeta primită de la <strong>${escapeHtml(delegatorName)}</strong>.`
        : `<strong>${escapeHtml(delegatorName)}</strong> te-a desemnat ca înlocuitor pentru aprobarea cererilor de concediu.`
      : `<strong>${escapeHtml(delegateName)}</strong> ${kind === "transfer" ? `preia ștafeta de la <strong>${escapeHtml(actorName)}</strong>` : "a fost desemnat înlocuitor pentru aprobări"}.`;
  const html = `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;color:#172554">
            <h2 style="color:#3a3b8d">Intranet ICMPP — înlocuitor pentru aprobări</h2>
            <p>Bună ziua,</p><p>${actionText}</p>
            <div style="background:#f5f7ff;border:1px solid #dbe2ff;border-radius:10px;padding:16px;margin:20px 0">
              <p><strong>Compartiment:</strong> ${escapeHtml(scope)}</p>
              <p><strong>Perioada:</strong> ${escapeHtml(period)}</p>
              <p><strong>Șef original:</strong> ${escapeHtml(delegatorName)}</p>
              <p><strong>Înlocuitor:</strong> ${escapeHtml(delegateName)}</p>
            </div>
            ${isNewDelegate ? `<p>Poți vedea și aproba cererile de concediu ale colegilor din compartimentul menționat, numai în perioada înlocuirii. Propriile cereri trebuie aprobate de alt coleg.</p>` : ""}
            <p><a href="${kind === "deactivate" ? DELEGATION_URL : APPROVAL_URL}" style="display:inline-block;background:#3a3b8d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">Deschide Intranet ICMPP</a></p>
            <p style="font-size:12px;color:#64748b;margin-top:28px">Mesaj automat trimis de Intranet ICMPP. Nu răspundeți la acest mesaj.</p>
          </div>`;
  return { subject, html };
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character] || character));
const formatDate = (value: string) => value.split("-").reverse().join(".");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Autentificare necesară." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const actorId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (claimsError || !actorId) return json({ error: "Autentificare necesară." }, 401);

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datele trimise nu sunt valide.", fields: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;
    if ("start_date" in body && body.end_date < body.start_date) return json({ error: "Perioada selectată nu este validă." });

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const getProfile = async (userId: string) => {
      const { data } = await admin.from("profiles").select("user_id, full_name, department").eq("user_id", userId).maybeSingle();
      return data;
    };
    const getEpdForUser = async (userId: string) => {
      const { data: record } = await admin.from("employee_records").select("id").eq("user_id", userId).maybeSingle();
      if (!record) return null;
      const { data } = await admin.from("employee_personal_data")
        .select("id, first_name, last_name, department, employee_record_id")
        .eq("employee_record_id", record.id).eq("is_archived", false).maybeSingle();
      return data;
    };
    const isHr = async () => {
      const { data } = await admin.from("user_roles").select("role").eq("user_id", actorId).in("role", ["hr", "sef_srus", "super_admin"]);
      return (data || []).length > 0;
    };
    const findConflicts = async (epdId: string, startDate: string, endDate: string) => {
      const [{ data: requests }, { data: hrRequests }] = await Promise.all([
        admin.from("leave_requests").select("request_number, start_date, end_date, status")
          .eq("epd_id", epdId).in("status", ACTIVE_STATUSES)
          .or("is_demo.eq.false,is_demo.is.null")
          .lte("start_date", endDate).gte("end_date", startDate),
        admin.from("hr_requests").select("id, details").eq("request_type", "concediu").eq("status", "approved").eq("details->>epd_id", epdId),
      ]);
      const hrConflicts = (hrRequests || []).filter((row: any) => {
        const start = row.details?.startDate;
        const end = row.details?.endDate;
        return start && end && start <= endDate && end >= startDate;
      }).map((row: any) => ({
        request_number: row.id,
        start_date: row.details.startDate,
        end_date: row.details.endDate,
        status: "approved",
      }));
      return [...(requests || []), ...hrConflicts];
    };
    const findUserConflicts = async (userId: string, startDate: string, endDate: string) => {
      const epd = await getEpdForUser(userId);
      return epd ? findConflicts(epd.id, startDate, endDate) : [];
    };
    const getDelegation = async (id: string) => {
      const { data } = await admin.from("leave_approval_delegates").select("*").eq("id", id).maybeSingle();
      return data;
    };
    const canTransfer = (source: any) => source
      && source.delegate_user_id === actorId
      && source.is_active
      && source.end_date >= new Date().toISOString().slice(0, 10);

    const canSelectReplacement = async (epdId: string) => {
      if (await isHr()) return true;
      const [{ data: target }, requester] = await Promise.all([
        admin.from("employee_personal_data").select("id, department").eq("id", epdId).maybeSingle(),
        getEpdForUser(actorId),
      ]);
      if (!target || !requester) return false;
      if (target.department === requester.department) return true;
      const { data: override } = await admin.from("leave_replacement_overrides").select("employee_epd_id")
        .eq("employee_epd_id", requester.id).eq("replacement_epd_id", epdId).maybeSingle();
      return Boolean(override);
    };

    const canSelectDelegate = async (delegateId: string, source: any | null) => {
      if (delegateId === actorId) return false;
      const [actorProfile, delegateProfile] = await Promise.all([getProfile(actorId), getProfile(delegateId)]);
      if (!delegateProfile) return false;
      if (source) return delegateProfile.department === source.department && delegateId !== source.delegator_user_id;
      if (await isHr()) return true;
      return Boolean(actorProfile?.department && actorProfile.department === delegateProfile.department)
        || CROSS_DEPARTMENT_PAIRS.has(`${actorId}:${delegateId}`);
    };

    const sendDelegationMessages = async (
      kind: "create" | "transfer" | "deactivate",
      delegation: any,
    ) => {
      const [delegator, delegate, actor] = await Promise.all([
        getProfile(delegation.delegator_user_id),
        getProfile(delegation.delegate_user_id),
        getProfile(actorId),
      ]);
      const recipients = kind === "transfer"
        ? [delegator?.user_id, delegate?.user_id, actorId]
        : [delegator?.user_id, delegate?.user_id];
      const uniqueRecipients = [...new Set(recipients.filter(Boolean))] as string[];
      const scope = delegation.department || "compartimentul desemnat";
      const period = `${formatDate(delegation.start_date)} – ${formatDate(delegation.end_date)}`;
      const delegatorName = delegator?.full_name || "Șeful compartimentului";
      const delegateName = delegate?.full_name || "Noul înlocuitor";
      const actorName = actor?.full_name || "Colegul anterior";

      const notifications = uniqueRecipients.map((userId) => {
        const isNewDelegate = userId === delegate?.user_id && kind !== "deactivate";
        const title = kind === "create" ? "Desemnare ca înlocuitor pentru aprobări"
          : kind === "transfer" ? "Transferul înlocuirii pentru aprobări"
          : "Înlocuire pentru aprobări dezactivată";
        const message = kind === "deactivate"
          ? `Înlocuirea pentru ${scope}, perioada ${period}, a fost dezactivată.`
          : isNewDelegate
            ? `${kind === "transfer" ? actorName + " ți-a transferat înlocuirea primită de la" : delegatorName + " te-a desemnat înlocuitor pentru"} ${kind === "transfer" ? delegatorName : "aprobări"}. Poți aproba cererile pentru ${scope}, în perioada ${period}.`
            : `${delegateName} ${kind === "transfer" ? `preia ștafeta de la ${actorName}` : "este înlocuitor"} pentru ${scope}, în perioada ${period}.`;
        return { user_id: userId, title, message, type: "info", related_type: "leave_delegation", related_id: delegation.id };
      });
      if (notifications.length) {
        const { error } = await admin.from("notifications").insert(notifications);
        if (error) console.warn("[manage-leave-replacements] notifications failed", error.message);
      }

      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPass = Deno.env.get("SMTP_PASS");
      const smtpFrom = Deno.env.get("SMTP_FROM") || "";
      if (!smtpHost || !smtpUser || !smtpPass) return { sent: 0, failed: uniqueRecipients.length };
      const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPass } });
      const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"${smtpFrom}" <${smtpUser}>`;

      let sent = 0;
      let failed = 0;
      for (const userId of uniqueRecipients) {
        const { data: { user } } = await admin.auth.admin.getUserById(userId);
        if (!user?.email) { failed++; continue; }
        const isNewDelegate = userId === delegate?.user_id && kind !== "deactivate";
        const { subject, html } = buildMail(kind, isNewDelegate, { scope, period, delegatorName, delegateName, actorName });
        const result = await trySendMail(transporter, { from: fromAddress, to: user.email, subject, html }, { label: "manage-leave-replacements" });
        if (result.ok) sent++; else failed++;
      }
      return { sent, failed };
    };

    if (body.action === "send-preview") {
      const { data: sa } = await admin.from("user_roles").select("role").eq("user_id", actorId).eq("role", "super_admin").limit(1);
      if (!sa?.length) return json({ error: "Doar super-adminii pot trimite e-mailuri de test." }, 403);
      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPass = Deno.env.get("SMTP_PASS");
      const smtpFrom = Deno.env.get("SMTP_FROM") || "";
      if (!smtpHost || !smtpUser || !smtpPass) return json({ error: "SMTP indisponibil." }, 500);
      const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPass } });
      const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"${smtpFrom}" <${smtpUser}>`;
      const sample = { scope: "Laborator exemplu", period: "02.12.2026 – 07.12.2026", delegatorName: "Ciornei Cezar", delegateName: "Tabără Lucian", actorName: "Coleg anterior" };
      const variants: [MailKind, boolean][] = [["create", true], ["create", false], ["transfer", true], ["transfer", false], ["deactivate", false]];
      let sent = 0;
      for (const [kind, isNew] of variants) {
        const { subject, html } = buildMail(kind, isNew, kind === "transfer" ? { ...sample, actorName: "Tabără Lucian", delegateName: "Noul înlocuitor" } : sample);
        const r = await trySendMail(transporter, { from: fromAddress, to: PREVIEW_RECIPIENT, subject: `[TEST] ${subject}`, html }, { label: "manage-leave-replacements-preview" });
        if (r.ok) sent++;
      }
      return json({ success: true, sent, total: variants.length });
    }

    if (body.action === "check-replacement") {
      if (!await canSelectReplacement(body.replacement_epd_id)) return json({ error: "Nu puteți selecta acest înlocuitor." }, 403);
      return json({ conflicts: await findConflicts(body.replacement_epd_id, body.start_date, body.end_date) });
    }

    if (body.action === "check-delegate") {
      const source = body.source_delegation_id ? await getDelegation(body.source_delegation_id) : null;
      if (body.source_delegation_id && !canTransfer(source)) return json({ error: "Această delegare nu mai poate fi transferată." }, 403);
      if (!await canSelectDelegate(body.delegate_user_id, source)) return json({ error: "Colegul nu este eligibil pentru acest compartiment." }, 403);
      return json({ conflicts: await findUserConflicts(body.delegate_user_id, body.start_date, body.end_date) });
    }

    if (body.action === "create") {
      const [deptMappings, individualMappings, roles] = await Promise.all([
        admin.from("leave_department_approvers").select("id").eq("approver_user_id", actorId).limit(1),
        admin.from("leave_approvers").select("id").eq("approver_user_id", actorId).limit(1),
        admin.from("user_roles").select("role").eq("user_id", actorId).in("role", ["sef", "sef_srus", "super_admin"]).limit(1),
      ]);
      if (!(deptMappings.data?.length || individualMappings.data?.length || roles.data?.length)) return json({ error: "Nu aveți drepturi de aprobare care pot fi delegate." }, 403);
      if (!await canSelectDelegate(body.delegate_user_id, null)) return json({ error: "Colegul nu este eligibil pentru acest compartiment." }, 403);
      const conflicts = await findUserConflicts(body.delegate_user_id, body.start_date, body.end_date);
      if (conflicts.length) return json({ error: "Colegul selectat are un concediu aprobat sau în așteptare în această perioadă.", conflicts });
      const actorProfile = await getProfile(actorId);
      const { data: delegation, error } = await admin.from("leave_approval_delegates").insert({
        delegator_user_id: actorId,
        delegate_user_id: body.delegate_user_id,
        department: actorProfile?.department || null,
        start_date: body.start_date,
        end_date: body.end_date,
        reason: body.reason,
        is_active: true,
      }).select("*").single();
      if (error) return json({ error: error.message.includes("concediu") ? error.message : "Înlocuirea nu a putut fi salvată." });
      const emails = await sendDelegationMessages("create", delegation);
      const { error: auditError } = await admin.from("audit_logs").insert({ user_id: actorId, action: "leave_delegation_created", entity_type: "leave_delegation", entity_id: delegation.id, details: { delegate_user_id: body.delegate_user_id } });
      if (auditError) console.warn("[manage-leave-replacements] audit failed", auditError.message);
      return json({ success: true, delegation, emails });
    }

    if (body.action === "transfer") {
      const source = await getDelegation(body.source_delegation_id);
      if (!canTransfer(source)) return json({ error: "Această delegare nu mai poate fi transferată." }, 403);
      if (!await canSelectDelegate(body.new_delegate_user_id, source)) return json({ error: "Noul înlocuitor trebuie să fie din compartimentul original și nu poate fi șeful original sau dumneavoastră." }, 403);
      const conflicts = await findUserConflicts(body.new_delegate_user_id, source.start_date, source.end_date);
      if (conflicts.length) return json({ error: "Noul înlocuitor are un concediu aprobat sau în așteptare în această perioadă.", conflicts });
      const now = new Date().toISOString();
      const { data: delegation, error } = await admin.from("leave_approval_delegates").insert({
        delegator_user_id: source.delegator_user_id,
        delegate_user_id: body.new_delegate_user_id,
        department: source.department,
        start_date: source.start_date,
        end_date: source.end_date,
        reason: source.reason,
        is_active: true,
        transferred_from_delegation_id: source.id,
        transferred_by_user_id: actorId,
        transferred_at: now,
      }).select("*").single();
      if (error) return json({ error: error.message.includes("concediu") ? error.message : "Ștafeta nu a putut fi salvată." });
      const { error: deactivateError } = await admin.from("leave_approval_delegates").update({
        is_active: false,
        deactivated_by_user_id: actorId,
        deactivated_at: now,
      }).eq("id", source.id).eq("delegate_user_id", actorId).eq("is_active", true);
      if (deactivateError) {
        await admin.from("leave_approval_delegates").delete().eq("id", delegation.id);
        return json({ error: "Ștafeta nu a putut fi finalizată. Înlocuirea anterioară a rămas activă." });
      }
      const emails = await sendDelegationMessages("transfer", delegation);
      const { error: auditError } = await admin.from("audit_logs").insert({ user_id: actorId, action: "leave_delegation_transferred", entity_type: "leave_delegation", entity_id: delegation.id, details: { source_delegation_id: source.id, original_delegator_user_id: source.delegator_user_id } });
      if (auditError) console.warn("[manage-leave-replacements] audit failed", auditError.message);
      return json({ success: true, delegation, emails });
    }

    const delegation = await getDelegation(body.delegation_id);
    if (!delegation || !delegation.is_active) return json({ error: "Înlocuirea nu mai este activă." });
    if (delegation.delegator_user_id !== actorId && !await isHr()) return json({ error: "Nu puteți dezactiva această înlocuire." }, 403);
    const now = new Date().toISOString();
    const { error } = await admin.from("leave_approval_delegates").update({ is_active: false, deactivated_by_user_id: actorId, deactivated_at: now }).eq("id", delegation.id).eq("is_active", true);
    if (error) return json({ error: "Înlocuirea nu a putut fi dezactivată." });
    const emails = await sendDelegationMessages("deactivate", { ...delegation, is_active: false });
    const { error: auditError } = await admin.from("audit_logs").insert({ user_id: actorId, action: "leave_delegation_deactivated", entity_type: "leave_delegation", entity_id: delegation.id, details: {} });
    if (auditError) console.warn("[manage-leave-replacements] audit failed", auditError.message);
    return json({ success: true, emails });
  } catch (error) {
    console.error("[manage-leave-replacements]", error);
    return json({ error: "A apărut o eroare. Vă rugăm să încercați din nou." }, 500);
  }
});
