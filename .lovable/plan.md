# Spațiul Doctoranzilor ICMPP

## Obiectiv
O zonă separată în aceeași platformă, cu meniu și pagină principală proprii, destinată doctoranzilor ICMPP. Doctoranzii folosesc adresa instituțională `@icmpp.ro`, dar primesc acces numai după verificarea adresei și aprobarea cererii.

## Cum va arăta înregistrarea

În pagina actuală de acces, secțiunea „Înregistrare” începe cu o alegere clară:

```text
Creez cont ca
┌──────────────────────┐  ┌──────────────────────┐
│ Angajat ICMPP        │  │ Doctorand ICMPP      │
│ Acces pentru personal│  │ Spațiu academic      │
└──────────────────────┘  └──────────────────────┘
```

Pentru „Doctorand ICMPP” se afișează un formular în pași scurți:

1. **Identitate** — nume complet, adresă `@icmpp.ro`, telefon și parolă.
2. **Date academice** — coordonator, școală doctorală, titlul/tema tezei, anul de studiu, data începerii și termenul estimat.
3. **Confirmare** — rezumatul informațiilor și trimiterea cererii.

După confirmarea adresei de e-mail, cererea intră în starea „În așteptarea aprobării”. Utilizatorul vede un ecran dedicat și nu primește accesul obișnuit de angajat. Administratorul verifică cererea, o aprobă sau o respinge și poate corecta datele academice înainte de aprobare.

## Experiența doctorandului

După aprobare, doctorandul intră direct într-un tablou de bord simplificat:

```text
Bun venit, Andrei                         Anul doctoral III
──────────────────────────────────────────────────────────
Următorul termen        Progres teză       Coordonator
Raport anual · 18 zile  65%                Prof. ...

De făcut în perioada următoare
[ Încarcă raportul ] [ Completează progresul ] [ Vezi calendarul ]

Noutăți pentru doctoranzi     Documente recente
```

Meniul dedicat va conține numai:
- **Acasă doctoral** — termene apropiate, progres, activități și anunțuri relevante;
- **Parcursul meu** — etape, rapoarte, progres și observații;
- **Documente și termene** — încărcare documente, status și calendar;
- **Coordonator** — date de contact și mesagerie directă;
- **Comunitatea doctoranzilor** — spațiu social separat, plus comunitățile în care este invitat;
- **Mesagerie**;
- **Resurse ICMPP** — bibliotecă, rezervări de săli, echipamente, proceduri și formulare permise;
- **Anunțuri** și **Profilul meu**.

Nu va vedea salarizare, concedii, gestiune HR, medicina muncii, administrare, rapoarte interne sau datele angajaților.

## Administrare

În zona de administrare apare „Doctoranzi”, cu:
- cereri noi și indicator numeric;
- aprobare, respingere și solicitare de completări;
- asocierea coordonatorului;
- filtrare după coordonator, an, statut și termen;
- vedere centralizată a documentelor lipsă și termenelor apropiate;
- suspendarea accesului la finalizarea/retragerea doctoratului, fără ștergerea istoricului.

Coordonatorii vor avea o vedere „Doctoranzii mei”, limitată strict la persoanele asociate lor, cu termene, documente și posibilitatea de a adăuga observații.

## Notificări utile

- confirmarea depunerii și aprobării cererii;
- termen apropiat la 30, 14, 7 și 1 zi;
- document acceptat, respins sau care necesită completări;
- mesaj nou de la coordonator;
- anunț nou destinat doctoranzilor;
- notificările vor deschide direct elementul relevant.

## Siguranță și acces

- rol separat **Doctorand**, fără a reutiliza rolul de angajat;
- numai adrese `@icmpp.ro` confirmate pot primi rolul;
- alegerea „Doctorand” la înscriere creează doar o cerere, nu acordă automat acces;
- rolul este acordat numai la aprobarea unui administrator;
- datele academice și documentele sunt vizibile doar doctorandului, coordonatorului asociat și persoanelor autorizate;
- toate aprobările și schimbările importante rămân în istoric.

## Implementare

1. Extinderea înregistrării cu alegerea Angajat/Doctorand și formularul academic în pași.
2. Introducerea rolului Doctorand, a cererilor de înscriere și a profilului academic separat de profilul personal.
3. Ecranul „Cererea este în verificare” și fluxul de aprobare administrativă.
4. Meniu, restricții de acces și tablou de bord dedicate doctorandului.
5. Parcurs doctoral, termene, documente, progres și legătura cu coordonatorul.
6. „Doctoranzii mei” pentru coordonatori și panoul central de administrare.
7. Comunitate, mesagerie, resurse permise și notificări cu acces direct.
8. Testarea completă a separării datelor și a afișării pe telefon și calculator.

## Ordinea recomandată de lansare

- **Etapa 1:** înscriere, aprobare, rol limitat, profil academic și tablou de bord;
- **Etapa 2:** documente, termene, progres și coordonatori;
- **Etapa 3:** rapoarte centralizate, automatizări și extinderea resurselor.

Astfel putem lansa rapid o variantă sigură, apoi completa funcțiile academice fără să afectăm zona angajaților.
