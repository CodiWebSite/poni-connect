const url = 'https://intranet.icmpp.ro/programari-vizite';

export function buildGuideMessage(mode: 'test' | 'distribute') {
const subject = `${mode === 'test' ? '[TEST] ' : ''}Programări vizite ICMPP — prezentare și ghid complet de utilizare`;
const html = `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;color:#202b3a;font-family:Arial,Helvetica,sans-serif;line-height:1.65">
<div style="max-width:700px;margin:0 auto;padding:28px 22px">
  <div style="padding-bottom:20px;border-bottom:3px solid #c69a35">
    <p style="margin:0 0 6px;font-size:12px;color:#526479;letter-spacing:1px">INTRANET ICMPP · INFORMARE INTERNĂ</p>
    <h1 style="font-family:Georgia,'Times New Roman',serif;color:#173a63;font-size:28px;line-height:1.25;margin:0">Programări vizite ICMPP</h1>
    <p style="margin:8px 0 0;color:#526479;font-size:14px">Institutul de Chimie Macromoleculară „Petru Poni” Iași</p>
  </div>
  ${mode === 'test' ? '<p style="background:#f7f9fc;border-left:4px solid #c69a35;padding:12px 16px;font-size:13px"><strong>Exemplar de test pentru Codrin Condrea.</strong> Acest mesaj este trimis doar la condrea.codrin@icmpp.ro, pentru verificarea conținutului și aspectului. Nu a fost distribuit celorlalți administratori.</p>' : ''}
  <p>Stimate colege, stimați colegi,</p>
  <p>În Intranet ICMPP este disponibilă secțiunea <strong>„Programări vizite”</strong>, destinată evidenței și organizării vizitelor școlilor și universităților la institut. În aceeași pagină pot fi consultate, completate și actualizate programările, inclusiv înregistrările preluate din tabelul Excel inițial.</p>

  <h2 style="color:#173a63;font-size:20px;margin-top:28px">1. Pentru ce ne ajută</h2>
  <ul>
    <li>Avem o evidență comună și actualizabilă, în locul mai multor copii ale aceluiași Excel.</li>
    <li>Vedem rapid ce vizite sunt programate, când vin grupurile și câți elevi sau studenți participă.</li>
    <li>Urmărim solicitările, numerele de înregistrare și situația aprobărilor.</li>
    <li>Identificăm zilele cu mai multe grupuri și putem pregăti din timp primirea acestora.</li>
    <li>Exportăm programările în Excel și păstrăm în evidență vizitele anulate, fără ștergere definitivă.</li>
  </ul>

  <h2 style="color:#173a63;font-size:20px;margin-top:28px">2. Unde se accesează și cine are acces</h2>
  <p>După autentificarea în <a href="https://intranet.icmpp.ro" style="color:#173a63">intranet.icmpp.ro</a>, selectați <strong>„Programări vizite” din meniul principal</strong>. Intrarea este disponibilă atât pe calculator, cât și în meniul de pe telefon.</p>
  <p style="text-align:center;margin:24px 0"><a href="${url}" style="display:inline-block;background:#173a63;color:#ffffff;padding:13px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Deschide Programări vizite ICMPP</a></p>
  <p style="font-size:13px">Link direct: <a href="${url}" style="color:#173a63;overflow-wrap:anywhere">${url}</a><br>Linkul nu ocolește autentificarea sau verificarea drepturilor de acces.</p>
  <p>Secțiunea nu este disponibilă tuturor angajaților. Accesul este acordat administratorilor super-admin și persoanelor desemnate pentru programări: <strong>Valeria Harabagiu, Petrișor Samoilă, Mihaela Dascălu, Mirela Fernanda Zaltariov și Dragoș Tofan</strong>. Persoanele autorizate pot consulta, edita și exporta evidența.</p>
  <p>Lista persoanelor autorizate poate fi gestionată de super-admin din <strong>Administrare → Roluri &amp; Acces → Programări vizite</strong>, prin căutarea persoanei și acordarea sau retragerea accesului.</p>

  <h2 style="color:#173a63;font-size:20px;margin-top:28px">3. Ce informații cuprinde o vizită</h2>
  <p>Tabelul păstrează informațiile de lucru din evidența inițială:</p>
  <ul>
    <li><strong>Data și ora</strong> vizitei;</li>
    <li><strong>Unitatea de învățământ</strong> — școala sau universitatea;</li>
    <li><strong>Numărul solicitării</strong> unității de învățământ;</li>
    <li><strong>Aprobarea / numărul de înregistrare ICMPP</strong>;</li>
    <li><strong>Numărul de elevi / studenți</strong>, clasa și cadrele didactice;</li>
    <li><strong>Starea</strong> vizitei și opțiunea de afișare a mesajului „Bine ați venit” pe ecranul din hol.</li>
  </ul>

  <h2 style="color:#173a63;font-size:20px;margin-top:28px">4. Cum adăugăm sau modificăm o programare</h2>
  <ol>
    <li>Apăsați <strong>„Adaugă vizită”</strong>. Se creează un rând nou cu data curentă și ora implicită 10:00.</li>
    <li>Completați denumirea instituției și toate informațiile necesare; schimbați data și ora conform programării reale.</li>
    <li>Pentru corectarea unei vizite existente, apăsați direct în căsuța dorită și modificați valoarea.</li>
    <li>Modificarea se salvează când ieșiți din căsuță. Pentru câmpurile pe o singură linie, puteți apăsa și Enter. Verificați mesajul <strong>„Salvat”</strong>; dacă apare „Nu s-a salvat”, corectați problema și reîncercați.</li>
  </ol>
  <p>Pot fi modificate și datele preluate inițial din Excel. Crearea și actualizările se înregistrează în jurnalul de audit al platformei.</p>

  <h2 style="color:#173a63;font-size:20px;margin-top:28px">5. Cum folosim stările</h2>
  <p>În coloana „Stare” puteți alege <strong>„Automat (după aprobare)”</strong> sau seta manual: <strong>Aprobată, În semnare, Intenție transmisă, Fără aprobare</strong>.</p>
  <p>În modul automat, starea este dedusă din informația introdusă la aprobare: numărul de înregistrare, mențiunea de semnare, intenția transmisă ori lipsa aprobării. Selectați manual starea atunci când evidența necesită o precizare explicită.</p>
  <p><strong>Important:</strong> această rubrică este o evidență a situației documentelor; nu reprezintă un circuit nou de aprobare electronică și nu înlocuiește aprobările instituționale necesare.</p>

  <h2 style="color:#173a63;font-size:20px;margin-top:28px">6. Tabel, calendar, căutare și indicatori</h2>
  <ul>
    <li><strong>„Tabel pe luni”</strong> grupează programările cronologic, pe luni.</li>
    <li><strong>„Calendar”</strong> oferă vederea lunară; săgețile permit trecerea la luna anterioară sau următoare.</li>
    <li><strong>Căutarea</strong> găsește programările după instituție sau cadrul didactic; filtrul de stare restrânge lista. Aceste filtre se aplică și calendarului.</li>
    <li>Sus apar <strong>vizitele din luna curentă, totalul elevilor/studenților din lună, vizitele care așteaptă aprobare și următoarea vizită</strong>. Vizitele anulate sunt excluse din acești indicatori.</li>
    <li>Dacă sunt mai multe vizite active în aceeași zi, tabelul afișează avertizarea <strong>„grupuri în ziua asta”</strong>. Avertizarea nu blochează programarea și nu verifică intervale orare de ocupare.</li>
  </ul>

  <h2 style="color:#173a63;font-size:20px;margin-top:28px">7. Anularea și reactivarea</h2>
  <p>Folosiți pictograma <strong>„Anulează vizita”</strong> și confirmați anularea. Vizita rămâne în evidență, marcată „Anulată”; nu este ștearsă definitiv. Pentru a o repune în activitate, folosiți <strong>„Reactivează”</strong>.</p>
  <p>Vizitele anulate nu mai intră în indicatorii de sus, în exportul Excel sau în mesajele de întâmpinare de pe ecranul din hol.</p>

  <h2 style="color:#173a63;font-size:20px;margin-top:28px">8. Mesajul „Bine ați venit” pe ecranul din hol</h2>
  <p>Fiecare vizită are opțiunea <strong>„Bine ați venit” pe ecranul din hol</strong>. Bifați-o dacă doriți întâmpinarea grupului și debifați-o dacă nu doriți afișarea.</p>
  <ul>
    <li>Se afișează <strong>„Bine ați venit la ICMPP · Welcome”</strong>, numele instituției, clasa, numărul participanților și ora vizitei. <strong>Numele cadrelor didactice nu se afișează public.</strong></li>
    <li>Pentru vizitele cu oră completată, mesajul apare <strong>15 minute înainte și 15 minute după</strong>, adică 30 de minute în total. Exemplu: ora 10:00 → aproximativ 09:45–10:15.</li>
    <li>Dacă în intervalul respectiv sunt mai multe grupuri, mesajele se schimbă între ele la <strong>15 secunde</strong>.</li>
    <li>Vizitele anulate sunt eliminate la următoarea verificare a ecranului, în aproximativ <strong>30 de secunde</strong>, în condiții normale de conexiune.</li>
    <li>Completați întotdeauna ora reală pentru limitarea la 30 de minute: o vizită fără oră poate fi afișată pe tot parcursul zilei. Ecranul trebuie să fie pornit și conectat.</li>
  </ul>
  <p style="font-size:13px;color:#526479">Cele mai recente corecții ale mesajului de întâmpinare se aplică pe televizor după publicarea versiunii și reîncărcarea paginii acestuia.</p>

  <h2 style="color:#173a63;font-size:20px;margin-top:28px">9. Exportul Excel</h2>
  <p>Apăsați <strong>„Export Excel”</strong> pentru a descărca <strong>programari_vizite_ICMPP.xlsx</strong>, cu antet, coloanele evidenței inițiale și grupare pe luni.</p>
  <p>Exportul cuprinde <strong>toate vizitele neanulate</strong>, nu doar rezultatele căutării sau ale filtrului afișat. Vizitele anulate rămân consultabile în platformă.</p>

  <h2 style="color:#173a63;font-size:20px;margin-top:28px">10. Ce este important în utilizarea curentă</h2>
  <ul>
    <li>Actualizați aceeași înregistrare când se schimbă data, ora sau aprobarea, fără a crea inutil o dublură.</li>
    <li>Completați datele reale și verificați salvarea; reîmprospătați pagina dacă doriți să vedeți ultimele modificări făcute de alt administrator.</li>
    <li>Înregistrarea unei vizite <strong>nu rezervă automat o sală</strong> și nu trimite mesaje către școală.</li>
    <li>În prezent nu sunt activate mementouri automate prin e-mail pentru vizite; prezentul mesaj este un ghid de lucru pentru persoanele autorizate.</li>
  </ul>
  <p style="background:#f7f9fc;border-left:4px solid #173a63;padding:14px 16px"><strong>Pe scurt:</strong> intrați în „Programări vizite”, adăugați sau corectați rândul, urmăriți starea și calendarul, activați opțional mesajul din hol și exportați evidența când este necesar.</p>
  <p>Pentru orice problemă sau întrebare, vă rog să îmi trimiteți un e-mail la <a href="mailto:condrea.codrin@icmpp.ro" style="color:#173a63">condrea.codrin@icmpp.ro</a> sau să mă sunați la <a href="tel:0755649856" style="color:#173a63">0755649856</a>, respectiv la <strong>interior 330</strong>.</p>
  <p>Cu stimă,<br><strong>Condrea Codrin Ioan</strong><br>Tehnician IT</p>
  <p style="border-top:1px solid #e7edf5;padding-top:16px;margin-top:28px;font-size:12px;color:#526479">Informare internă pentru administrarea programărilor de vizite${mode === 'test' ? ' · Exemplar de test, fără distribuire către ceilalți destinatari.' : ' · Destinată persoanelor desemnate și administratorilor super-admin.'}</p>
</div></body></html>`;

const text = html
  .replace(/<head>[\s\S]*?<\/head>/, '')
  .replace(/<\/(?:p|h1|h2|li|div)>/g, '\n\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/\n\s*\n\s*\n/g, '\n\n')
  .trim();
return { subject, html, text };
}