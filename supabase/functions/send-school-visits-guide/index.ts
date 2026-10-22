import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.10';
import { z } from 'npm:zod@3.25.76';
import { sendMailWithRetry } from '../_shared/smtp-retry.ts';
import { maySendGuideTest, TEST_RECIPIENT } from './recipient-policy.ts';
import { html, subject, text } from './message.ts';

const Body = z.object({ mode: z.literal('test') }).strict();
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
      return reply({ error: 'Nu aveți acces la acest test.' }, 403);
    }
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return reply({ error: 'Este permis numai testul individual.' }, 400);

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
    const info = await sendMailWithRetry(transporter, {
      from: from.includes('@') ? from : `"Intranet ICMPP" <${user}>`,
      to: TEST_RECIPIENT, subject, html, text,
    }, { maxAttempts: 2, label: 'send-school-visits-guide' });
    if (!info.accepted?.length || info.rejected?.length) throw new Error('Recipient not accepted');
    return reply({ success: true, sent_to: TEST_RECIPIENT });
  } catch {
    return reply({ error: 'E-mailul de test nu a putut fi trimis.' }, 500);
  }
});