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

    const subject = "Propunere — Fluturași de salariu în format electronic prin Intranet ICMPP";

    const html = `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 0 auto; padding: 24px; color: #1a202c; line-height: 1.65;">
  <div style="text-align:center; border-bottom: 2px solid #1F4E79; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color:#1F4E79; margin:0; font-size: 24px;">Fluturași de salariu electronici</h1>
    <p style="color:#6b7280; margin: 6px 0 0; font-size: 14px;">Propunere de implementare în Intranet ICMPP</p>
  </div>

  <p>Stimate coleg,</p>

  <p>În data de 06.07.2026 am primit pe modulul „Sugestii" al intranetului următoarea propunere din partea unui coleg:</p>

  <blockquote style="border-left: 4px solid #1F4E79; background:#f1f5f9; padding: 12px 16px; margin: 16px 0; font-style: italic; color:#334155;">
    „Ar fi bine ca angajații să primească fluturașii de salariu în format electronic, poate chiar în această platformă. Nu s-ar mai irosi hârtie inutil și ne-am alinia la practicile actuale (angajații unor companii sau instituții primesc deja fluturașii în format electronic)."
  </blockquote>

  <p>Considerăm oportună această idee și, din perspectivă tehnică, este pe deplin realizabilă în cadrul Intranet ICMPP. Vă prezentăm mai jos câteva variante de implementare, împreună cu observațiile necesare pentru colegii de la salarizare.</p>

  <h2 style="color:#1F4E79; font-size: 18px; margin-top: 28px;">1. Ce trebuie să aflăm de la salarizare</h2>
  <p>Pentru a alege soluția potrivită, avem nevoie de câteva informații despre programul folosit în prezent pentru calculul salariilor:</p>
  <ul>
    <li>În ce format generează programul fluturașii — <strong>PDF</strong>, <strong>Word (.doc/.docx)</strong>, <strong>Excel</strong> sau tipărire directă?</li>
    <li>Programul permite <strong>export individual</strong> (câte un fișier pentru fiecare angajat) sau doar un centralizator cu toți angajații într-un singur fișier?</li>
    <li>Fișierul rezultat conține un identificator clar al angajatului (CNP, marcă, e-mail, nume complet) care ne permite să potrivim automat fluturașul cu contul din intranet?</li>
    <li>Există posibilitatea unui export lunar automat (ex. un folder de rețea) sau se face manual, de fiecare dată, de către colegele de la salarizare?</li>
  </ul>
  <p>În funcție de răspunsuri, alegem una dintre variantele de mai jos.</p>

  <h2 style="color:#1F4E79; font-size: 18px; margin-top: 28px;">2. Variante de implementare în intranet</h2>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Varianta A — Cea mai simplă (upload manual lunar)</h3>
  <p style="margin-top:0;">Colegele de la salarizare încarcă lunar în intranet arhiva cu fluturași (PDF-uri individuale). Platforma îi distribuie automat fiecărui angajat pe baza CNP-ului sau a numelui din fișier, iar angajatul îi vede într-o nouă secțiune <em>„Fluturașii mei"</em> din profil. Nu necesită integrare cu programul de salarizare — doar un import lunar.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Varianta B — Notificare prin e-mail</h3>
  <p style="margin-top:0;">În plus față de varianta A, când un fluturaș nou este disponibil, angajatul primește automat un e-mail pe adresa instituțională cu un link securizat către intranet pentru descărcare (fluturașul nu se atașează la e-mail, ci se accesează după autentificare — pentru confidențialitate).</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Varianta C — Extragere automată dintr-un centralizator</h3>
  <p style="margin-top:0;">Dacă programul de salarizare exportă un singur fișier PDF/Excel cu toți angajații (centralizator), intranetul îl poate <strong>împărți automat pe pagini</strong> și îl poate distribui fiecărui angajat pe baza identificatorului (CNP/marcă). Practic, salarizarea încarcă un singur fișier lunar, restul se face automat.</p>

  <h3 style="color:#1f2937; font-size: 16px; margin-bottom: 4px;">Varianta D — Integrare directă cu programul de salarizare</h3>
  <p style="margin-top:0;">Dacă programul permite export automat sau are un API/folder de rețea, se poate configura o preluare automată lunară — fără nicio intervenție manuală. Aceasta este soluția ideală pe termen lung, dar depinde de posibilitățile programului actual.</p>

  <h2 style="color:#1F4E79; font-size: 18px; margin-top: 28px;">3. Elemente de siguranță și confidențialitate</h2>
  <ul>
    <li>Acces strict prin autentificare cu contul instituțional (parolă + 2FA acolo unde este activat).</li>
    <li>Fiecare angajat vede <strong>doar fluturașii proprii</strong> — la nivel de bază de date, prin politici RLS.</li>
    <li>Fluturașii nu se atașează niciodată în e-mailuri — se accesează exclusiv din intranet.</li>
    <li>Fișierele sunt stocate criptat, cu link-uri semnate temporar (expiră după descărcare).</li>
    <li>Se păstrează un istoric complet: fiecare angajat își poate consulta oricând fluturașii din lunile anterioare.</li>
    <li>Se generează jurnal de audit — cine, când și ce fluturaș a descărcat.</li>
  </ul>

  <h2 style="color:#1F4E79; font-size: 18px; margin-top: 28px;">4. Beneficii</h2>
  <ul>
    <li>Eliminarea completă a consumului de hârtie pentru fluturași (~250 pagini/lună × 12 luni ≈ 3.000 pagini/an).</li>
    <li>Reducerea timpului petrecut de salarizare cu tipărirea, semnarea și distribuirea plicurilor.</li>
    <li>Acces rapid al angajaților la istoricul propriu, oriunde și oricând (util pentru dosare bancare, adeverințe etc.).</li>
    <li>Aliniere la practicile moderne din alte institute și companii.</li>
    <li>Trasabilitate mai bună decât la varianta pe hârtie (confirmări de vizualizare/descărcare).</li>
  </ul>

  <h2 style="color:#1F4E79; font-size: 18px; margin-top: 28px;">5. Propunere de următor pas</h2>
  <ol>
    <li>Discuție scurtă cu colegele de la salarizare pentru a răspunde la întrebările de la punctul 1.</li>
    <li>Alegerea variantei (recomandăm <strong>A sau B</strong> pentru prima etapă — implementare rapidă, fără dependență de programul de salarizare).</li>
    <li>Rulare pilot pentru o lună, cu 5–10 colegi voluntari.</li>
    <li>Extindere la întreg institutul odată ce fluxul este validat.</li>
    <li>Ulterior, dacă programul de salarizare permite, se poate trece la varianta D (integrare automată).</li>
  </ol>

  <p style="margin-top: 24px;">Vă mulțumim și așteptăm cu interes discuția pe acest subiect.</p>

  <p style="margin-top: 8px;">Cu stimă,<br><strong>Echipa Intranet ICMPP</strong></p>

  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align:center;">
    Mesaj generat din modulul „Sugestii" al platformei <a href="https://intranet.icmpp.ro" style="color:#1F4E79;">intranet.icmpp.ro</a>
  </div>
</div>`;

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });

    return new Response(JSON.stringify({ ok: true, to }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
