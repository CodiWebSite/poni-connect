import nodemailer from "nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"Intranet ICMPP" <${smtpUser}>`;
    const to = "condrea.codrin@icmpp.ro";

    const transporter = nodemailer.createTransport({
      host: smtpHost, port: smtpPort, secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const subject = "Ghid de utilizare — Intranet Social ICMPP";

    const html = `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 0 auto; padding: 24px; color: #1a202c; line-height: 1.65;">
  <div style="text-align:center; border-bottom: 2px solid #6d28d9; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color:#4c1d95; margin:0; font-size: 24px;">Intranet Social ICMPP</h1>
    <p style="color:#6b7280; margin: 6px 0 0; font-size: 14px;">Ghid de utilizare pentru colegii Institutului „Petru Poni"</p>
  </div>

  <p>Stimate coleg, stimată colegă,</p>

  <p>Ne face plăcere să vă prezentăm <strong>Intranet Social</strong>, o componentă nouă a platformei Intranet ICMPP, dedicată comunicării, colaborării și vieții comunitare a institutului nostru. Vă rugăm să acordați câteva minute pentru parcurgerea acestui ghid, astfel încât să vă familiarizați cu funcționalitățile disponibile.</p>

  <h2 style="color:#4c1d95; font-size: 18px; margin-top: 28px;">1. Cum accesați Intranet Social</h2>
  <ol>
    <li>Deschideți platforma la adresa <a href="https://intranet.icmpp.ro" style="color:#6d28d9;">https://intranet.icmpp.ro</a> și autentificați-vă cu contul instituțional.</li>
    <li>În colțul din dreapta sus al ecranului, lângă avatarul dumneavoastră, veți observa o pictogramă formată din patru pătrate — <strong>comutatorul de HUB</strong>.</li>
    <li>La apăsarea acesteia se deschide un panou cu două opțiuni: <em>Intranet Core HR</em> (modulul de resurse umane, cel folosit până acum) și <em>Intranet Social</em>. Selectați „Intranet Social".</li>
    <li>Veți fi direcționat automat către Feed-ul social, iar meniul lateral se va schimba pentru a afișa secțiunile specifice acestei zone.</li>
  </ol>

  <h2 style="color:#4c1d95; font-size: 18px; margin-top: 28px;">2. La ce folosește Intranet Social</h2>
  <p>Această zonă a platformei este concepută ca un <strong>spațiu de comunicare internă</strong> pentru toți membrii ICMPP. Aici puteți afla noutățile institutului, puteți interacționa cu colegii, puteți participa la comunități tematice, puteți sărbători aniversările colegilor și puteți accesa resurse comune — toate într-un cadru privat, accesibil doar personalului institutului.</p>

  <h2 style="color:#4c1d95; font-size: 18px; margin-top: 28px;">3. Descrierea fiecărei secțiuni</h2>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Feed</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> este pagina de întâmpinare a Intranet Social (primul element din meniul din stânga).<br>
  <em>Rol:</em> aici vedeți ultimele postări publicate de colegi și din comunitățile din care faceți parte. Puteți publica la rândul dumneavoastră un mesaj, o știre, o fotografie sau puteți reacționa și comenta la postările altora. Este echivalentul unui „panou de bord" comun al institutului.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Comunități</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> click pe „Comunități" în meniul lateral.<br>
  <em>Rol:</em> comunitățile sunt grupuri tematice (de exemplu, un laborator, un proiect, un grup de interes). Puteți vedea comunitățile active, comunitățile arhivate și, dacă aveți dreptul, puteți solicita crearea uneia noi. Fiecare comunitate are propriul feed, propriile evenimente și propria listă de membri.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Anunțuri</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> secțiunea „Anunțuri" din meniul lateral.<br>
  <em>Rol:</em> anunțurile oficiale ale institutului — comunicări din partea conducerii, informări administrative, evenimente instituționale. Doar persoanele autorizate pot publica, însă toți colegii le pot consulta.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Aniversări</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> „Aniversări" în meniul lateral.<br>
  <em>Rol:</em> vă permite să vedeți colegii care aniversează în luna curentă atât <strong>ziua de naștere</strong>, cât și <strong>vechimea în muncă</strong> la ICMPP. Este un instrument menit să întărească spiritul colegial din institut.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Colegi de muncă</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> „Colegi de muncă" în meniul lateral.<br>
  <em>Rol:</em> un director intern al personalului ICMPP. Puteți căuta un coleg după nume sau funcție și puteți accesa profilul său public (informații profesionale, e-mail instituțional, laborator/departament).</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Organigramă</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> „Organigramă" în meniul lateral.<br>
  <em>Rol:</em> reprezentarea grafică a structurii ierarhice a institutului. Utilă pentru a înțelege apartenența departamentală și liniile de raportare.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Activități recreative</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> „Activități recreative" în meniul lateral.<br>
  <em>Rol:</em> spațiul dedicat evenimentelor extraprofesionale — ieșiri, sport, activități culturale, întâlniri informale organizate în cadrul institutului.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Mesagerie</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> „Mesagerie" în meniul lateral.<br>
  <em>Rol:</em> sistem intern de comunicare directă cu colegii, în format 1-la-1 sau în grupuri. Vă permite să discutați rapid, fără să folosiți e-mailul, într-un mediu privat, dedicat exclusiv personalului ICMPP.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Arhivă online</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> „Arhivă online" în meniul lateral.<br>
  <em>Rol:</em> depozit centralizat de documente instituționale, materiale de referință și resurse partajate, organizate pe categorii și cu politici de acces conform rolului dumneavoastră.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Securitate digitală</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> „Securitate digitală" în meniul lateral.<br>
  <em>Rol:</em> un modul educațional cu chestionare și materiale privind bunele practici de securitate informatică. Vă recomandăm parcurgerea sa periodică, pentru protejarea datelor institutului.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Setări (doar administratori / SRUS)</h3>
  <p style="margin-top:0;"><em>Cum ajungeți:</em> „Setări" în meniul lateral, vizibil numai pentru rolurile autorizate.<br>
  <em>Rol:</em> permite gestionarea permisiunilor și a configurărilor Intranet Social — calendare publice, dreptul de a publica anunțuri etc.</p>

  <h2 style="color:#4c1d95; font-size: 18px; margin-top: 28px;">4. Reguli de bună folosire</h2>
  <ul>
    <li>Platforma este destinată <strong>exclusiv personalului ICMPP</strong>; nu distribuiți conținutul în afara institutului.</li>
    <li>Vă rugăm să păstrați un ton academic și colegial în toate interacțiunile.</li>
    <li>Datele cu caracter personal sunt protejate conform reglementărilor GDPR — utilizați funcționalitățile cu discernământ.</li>
    <li>Pentru sesizări sau dificultăți tehnice, puteți folosi secțiunea „Idei & Feedback" din Intranet Core HR sau ne puteți contacta direct.</li>
  </ul>

  <h2 style="color:#4c1d95; font-size: 18px; margin-top: 28px;">5. Comutarea între cele două HUB-uri</h2>
  <p>În orice moment, puteți reveni la <strong>Intranet Core HR</strong> (cererile de concediu, profilul personal, calendarul, salarizarea etc.) prin același comutator din colțul dreapta-sus. Cele două zone funcționează independent, dar cu același cont de autentificare.</p>

  <p style="margin-top: 28px;">Vă mulțumim pentru atenția acordată și vă dorim o experiență plăcută în noul Intranet Social ICMPP.</p>

  <p style="margin-top: 20px;">Cu deosebită considerație,<br><strong>Echipa Intranet ICMPP</strong></p>

  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center;">
    Intranet ICMPP · <a href="https://intranet.icmpp.ro" style="color:#6d28d9;">intranet.icmpp.ro</a><br>
    Acest mesaj a fost generat automat. Vă rugăm să nu răspundeți la această adresă.
  </div>
</div>`;

    const info = await transporter.sendMail({ from: fromAddress, to, subject, html });
    return new Response(JSON.stringify({ success: true, messageId: info.messageId, to }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("send-social-guide-email error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
