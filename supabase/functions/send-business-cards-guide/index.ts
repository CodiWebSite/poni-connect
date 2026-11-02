import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.10';
import { sendMailWithRetry } from '../_shared/smtp-retry.ts';

// Test-only guide: the recipient is fixed and cannot be changed by the caller.
const RECIPIENT = 'condrea.codrin@icmpp.ro';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const step = (n: number, title: string, body: string) => `
<tr><td style="vertical-align:top;padding:8px 14px 8px 0"><div style="width:30px;height:30px;border-radius:50%;background:#3a3b8d;color:#fff;font-weight:bold;text-align:center;line-height:30px">${n}</div></td>
<td style="padding:8px 0"><strong style="color:#3a3b8d">${title}</strong><br>${body}</td></tr>`;

const html = `<!doctype html><html lang="ro"><body style="margin:0;background:#ffffff;font-family:Georgia,'Times New Roman',serif;color:#1f2937">
<div style="max-width:660px;margin:0 auto;padding:28px 24px;line-height:1.65;font-size:15px">
<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#3a3b8d;margin:0">Institutul de Chimie Macromoleculară „Petru Poni” · Intranet ICMPP</p>
<h1 style="font-size:24px;color:#3a3b8d;margin:8px 0 4px">Cărțile de vizită instituționale</h1>
<p style="margin:0 0 20px;color:#6b7280;font-style:italic">Ghid de utilizare – identitate vizuală unitară pentru întreaga comunitate academică</p>
<hr style="border:none;border-top:2px solid #c69a35;margin:0 0 22px">
<p>Stimate coleg,</p>
<p>Avem deosebita plăcere de a vă prezenta modulul <strong>Cărți de vizită</strong> al Intranetului ICMPP — un instrument conceput pentru a oferi fiecărui membru al Institutului posibilitatea de a-și realiza, în câteva minute, o carte de vizită elegantă, conformă identității vizuale a instituției și pregătită pentru tipar.</p>

<h2 style="font-size:18px;color:#3a3b8d;margin-top:26px">I. La ce folosește</h2>
<ul style="padding-left:20px">
<li><strong>Reprezentare instituțională unitară</strong> la conferințe, colaborări științifice, întâlniri cu parteneri și vizite oficiale.</li>
<li><strong>Prezentare bilingvă</strong> – română și engleză – potrivită contextului academic internațional.</li>
<li><strong>Cod QR</strong> care direcționează către site-ul institutului sau către profilul profesional al fiecăruia.</li>
<li><strong>Fișier PDF gata de tipar</strong>, în format standard 85 × 55 mm, cu diacriticele redate corect.</li>
</ul>

<h2 style="font-size:18px;color:#3a3b8d;margin-top:26px">II. Cum se accesează</h2>
<p>Modulul este disponibil oricărui angajat cu cont activ, pe calculator și pe telefon, pe trei căi:</p>
<ul style="padding-left:20px">
<li>din <strong>Profilul meu</strong>, prin butonul <em>„Cărți de vizită”</em>;</li>
<li>din <strong>căutarea din partea de sus</strong> a paginii, scriind <em>„cărți de vizită”</em> și apăsând pe rezultat;</li>
<li>direct, la adresa <a href="https://intranet.icmpp.ro/carti-vizita" style="color:#3a3b8d">intranet.icmpp.ro/carti-vizita</a>.</li>
</ul>

<h2 style="font-size:18px;color:#3a3b8d;margin-top:26px">III. Pașii de realizare</h2>
<table role="presentation" style="border-collapse:collapse;width:100%">
${step(1, 'Autentificarea', 'Intrați pe <a href="https://intranet.icmpp.ro" style="color:#3a3b8d">intranet.icmpp.ro</a> cu adresa de e-mail, parola și codul de 6 cifre din aplicația de autentificare.')}
${step(2, 'Deschiderea modulului', 'Accesați <strong>Profilul meu → Cărți de vizită</strong> sau căutați „cărți de vizită” în bara de sus.')}
${step(3, 'Alegerea limbii', 'Selectați varianta dorită: <em>Față română · Verso engleză</em>, <em>Doar română</em> sau <em>Doar engleză</em>.')}
${step(4, 'Titulatura', 'Completați, după caz, titlul academic sau științific care precedă numele (de exemplu: Dr., Acad., Prof. univ. dr., CS I).')}
${step(5, 'Funcția și departamentul', 'Verificați funcția și, opțional, departamentul, în română și în engleză. Câmpul de departament poate rămâne necompletat.')}
${step(6, 'Codul QR', 'Implicit, codul trimite la <strong>icmpp.ro</strong>. Puteți introduce un link propriu (pagină personală, ORCID, Google Scholar etc.) sau încărca o imagine cu un cod QR existent; sub cod apare atunci mențiunea „Profil profesional”.')}
${step(7, 'Verificarea', 'Examinați previzualizarea: sigla, numele, datele de contact și codul QR sunt așezate automat, cu alinieri uniforme.')}
${step(8, 'Descărcarea', 'Apăsați <strong>Descarcă PDF</strong>. Fișierul (o pagină sau două, în funcție de limba aleasă) poate fi trimis direct la tipografie.')}
</table>

<h2 style="font-size:18px;color:#3a3b8d;margin-top:26px">IV. Recomandări</h2>
<ul style="padding-left:20px">
<li>Verificați corectitudinea numărului de telefon și a adresei de e-mail înainte de tipar.</li>
<li>Pentru tipar profesional, solicitați hârtie mată de 300–350 g/m².</li>
<li>Testați codul QR cu telefonul înainte de trimiterea la tipografie.</li>
</ul>

<p style="margin-top:26px">Pentru orice întrebare sau sugestie, vă stau cu plăcere la dispoziție la <a href="mailto:condrea.codrin@icmpp.ro" style="color:#3a3b8d">condrea.codrin@icmpp.ro</a>, la telefon <a href="tel:0755649856" style="color:#3a3b8d">0755649856</a> sau la <strong>interior 330</strong>.</p>
<p style="margin-top:22px">Cu stimă,<br><strong>Condrea Codrin Ioan</strong><br>Tehnician IT<br>Institutul de Chimie Macromoleculară „Petru Poni” Iași</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 10px">
<p style="font-size:12px;color:#9ca3af">Exemplar de test trimis exclusiv către condrea.codrin@icmpp.ro.</p>
</div></body></html>`;

const text = `Cărțile de vizită instituționale – Intranet ICMPP

La ce folosește: carte de vizită unitară, bilingvă, cu cod QR, PDF 85x55 mm gata de tipar.
Acces: Profilul meu → Cărți de vizită; căutarea de sus („cărți de vizită”); intranet.icmpp.ro/carti-vizita.
Pași: 1. Autentificare. 2. Deschideți modulul. 3. Alegeți limba (RO/EN, doar RO, doar EN). 4. Titulatura. 5. Funcția și departamentul (opțional). 6. Codul QR (implicit icmpp.ro, sau link/imagine proprie). 7. Verificați previzualizarea. 8. Descarcă PDF.
Contact: condrea.codrin@icmpp.ro, 0755649856, interior 330.

Cu stimă,
Condrea Codrin Ioan, Tehnician IT`;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return reply({ error: 'Autentificare necesară.' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data } = await admin.auth.getUser(auth.slice(7));
    const { data: role } = data.user
      ? await admin.from('user_roles').select('role').eq('user_id', data.user.id).eq('role', 'super_admin').maybeSingle()
      : { data: null };
    if (!role) return reply({ error: 'Acces interzis.' }, 403);
    const user = Deno.env.get('SMTP_USER')!;
    const port = Number(Deno.env.get('SMTP_PORT') || '587');
    const from = Deno.env.get('SMTP_FROM') || '';
    const t = nodemailer.createTransport({ host: Deno.env.get('SMTP_HOST'), port, secure: port === 465, auth: { user, pass: Deno.env.get('SMTP_PASS') } });
    const info = await sendMailWithRetry(t, {
      from: from.includes('@') ? from : `"Intranet ICMPP" <${user}>`,
      to: RECIPIENT, subject: 'Cărțile de vizită instituționale – ghid de utilizare', html, text,
    }, { maxAttempts: 2, label: 'send-business-cards-guide' });
    return reply({ success: true, accepted: info.accepted });
  } catch (e) {
    console.error('business-cards-guide failed', String(e));
    return reply({ error: 'Trimiterea a eșuat.' }, 500);
  }
});
