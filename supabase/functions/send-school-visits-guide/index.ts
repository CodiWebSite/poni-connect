import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.10';
import { z } from 'npm:zod@3.25.76';
import { sendMailWithRetry } from '../_shared/smtp-retry.ts';
import { guideRecipientIds, maySendGuideTest, TEST_RECIPIENT } from './recipient-policy.ts';
import { buildGuideMessage } from './message.ts';

const Body = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('test') }).strict(),
  z.object({ mode: z.literal('distribute'), confirmed: z.literal(true), dry_run: z.boolean().default(false) }).strict(),
]);
const DISTRIBUTION_ID = 'school-visits-guide-approved-2026-10-22';
const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Metodă nepermisă.' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Autentificare necesară.' }, 401);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return reply({ error: 'Serviciu indisponibil.' }, 503);
    const admin = createClient(url, key);
    const { data, error } = await admin.auth.getUser(authorization.slice(7));
    if (error || !data.user) return reply({ error: 'Autentificare necesară.' }, 401);
    const { data: role, error: roleError } = await admin.from('user_roles')
      .select('role').eq('user_id', data.user.id).eq('role', 'super_admin').maybeSingle();
    if (roleError || !maySendGuideTest(data.user.email, role?.role)) {
      return reply({ error: 'Nu aveți acces la trimiterea acestui ghid.' }, 403);
    }
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return reply({ error: 'Selectați testul individual sau distribuirea confirmată.' }, 400);

    const { mode } = parsed.data;
    let recipients = [TEST_RECIPIENT];
    const sentBefore = new Set<string>();
    if (mode === 'distribute') {
      const [access, roles, history] = await Promise.all([
        admin.from('school_visits_access').select('user_id'),
        admin.from('user_roles').select('user_id').eq('role', 'super_admin'),
        admin.from('audit_logs').select('details')
          .eq('entity_type', 'school_visits_guide').eq('entity_id', DISTRIBUTION_ID)
          .eq('action', 'school_visits_guide_sent'),
      ]);
      if (access.error || roles.error || history.error) {
        return reply({ error: 'Lista destinatarilor nu a putut fi verificată. Nu s-a trimis niciun mesaj.' }, 503);
      }
      const ids = guideRecipientIds(
        (access.data || []).map(row => row.user_id),
        (roles.data || []).map(row => row.user_id),
      );
      const users = await Promise.all(ids.map(id => admin.auth.admin.getUserById(id)));
      if (users.some(result => result.error || !result.data.user?.email)) {
        return reply({ error: 'Nu au putut fi verificate toate adresele. Nu s-a trimis niciun mesaj.' }, 503);
      }
      const emails = users.map(result => result.data.user?.email?.trim().toLowerCase() || '');
      if (emails.some(email => !z.string().email().safeParse(email).success || !email.endsWith('@icmpp.ro'))) {
        return reply({ error: 'Un destinatar nu are adresă instituțională validă. Nu s-a trimis niciun mesaj.' }, 400);
      }
      recipients = [...new Set(emails)];
      for (const row of history.data || []) {
        if (typeof row.details?.recipient === 'string') sentBefore.add(row.details.recipient);
      }
      if (parsed.data.mode === 'distribute' && parsed.data.dry_run) {
        return reply({ dry_run: true, recipients, already_sent: [...sentBefore], count: recipients.length });
      }
    }

    const host = Deno.env.get('SMTP_HOST');
    const user = Deno.env.get('SMTP_USER');
    const pass = Deno.env.get('SMTP_PASS');
    const port = Number(Deno.env.get('SMTP_PORT') || '587');
    const from = Deno.env.get('SMTP_FROM') || '';
    if (!host || !user || !pass || !Number.isInteger(port)) {
      return reply({ error: 'E-mailul instituțional nu este disponibil.' }, 503);
    }
    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    });
    const { subject, html, text } = buildGuideMessage(mode);
    const sent: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];
    for (const recipient of recipients) {
      if (mode === 'distribute' && sentBefore.has(recipient)) {
        skipped.push(recipient);
        continue;
      }
      let messageId: string;
      try {
        const info = await sendMailWithRetry(transporter, {
          from: from.includes('@') ? from : `"Intranet ICMPP" <${user}>`,
          to: recipient, replyTo: TEST_RECIPIENT, subject, html, text,
        }, { maxAttempts: 2, label: 'send-school-visits-guide' });
        const accepted = (info.accepted || []).map((address: unknown) => String(address).toLowerCase());
        if (!accepted.includes(recipient) || info.rejected?.length) throw new Error('Recipient not accepted');
        messageId = info.messageId;
      } catch {
        failed.push(recipient);
        console.error('school-visits-guide recipient failed', { recipient, mode });
        continue;
      }
      sent.push(recipient);
      const { error: auditError } = await admin.from('audit_logs').insert({
        user_id: data.user.id,
        action: mode === 'distribute' ? 'school_visits_guide_sent' : 'school_visits_guide_test_sent',
        entity_type: 'school_visits_guide',
        entity_id: DISTRIBUTION_ID,
        role_at_time: 'super_admin',
        details: { recipient, message_id: messageId, mode, confirmed: mode === 'distribute' },
      });
      if (auditError) {
        console.error('school-visits-guide audit recording failed');
        return reply({ error: 'Un mesaj a fost trimis, dar istoricul nu s-a salvat. Nu reluați trimiterea fără verificare.', sent, failed, skipped }, 500);
      }
      console.log('school-visits-guide sent', { recipient, mode, message_id: messageId });
    }
    return reply({ success: failed.length === 0, sent, failed, skipped, sent_count: sent.length }, failed.length ? 502 : 200);
  } catch {
    return reply({ error: 'Ghidul nu a putut fi trimis. Verificați istoricul înainte de reîncercare.' }, 500);
  }
});