

# Plan: Prezentare PPTX — Securitatea Platformei Intranet ICMPP

## Rezumat
Voi crea o prezentare profesională PPTX (~15-18 slide-uri) care explică pe înțelesul tuturor măsurile de securitate implementate pe platforma intranet ICMPP. Stilul va fi academic-business, elegant, cu explicații clare pentru audiența non-tehnică.

## Structura Prezentării

### Slide 1 — Pagina de titlu
- Logo ICMPP (`public/logo-icmpp.png`) centrat
- Titlu: "Securitatea Platformei Intranet ICMPP"
- Subtitlu: "Institutul de Chimie Macromoleculară «Petru Poni»"
- Autor: **CONDREA CODRIN IOAN**
- Data: Aprilie 2026

### Slide 2 — Agenda / Cuprins
- Lista subiectelor prezentate vizual

### Slide 3 — Ce este Platforma Intranet?
- Explicație simplă: o aplicație web internă pentru angajați
- Ce face: concedii, documente HR, comunicare, inventar, etc.
- Analogie: "un birou digital securizat"

### Slide 4 — Cu ce este construită platforma (Tehnologia)
- React (interfață), TypeScript (limbaj sigur), Tailwind CSS (design)
- Explicație fiecare acronim RO/EN
- Comparație vizuală: aplicație modernă vs. WordPress

### Slide 5 — WordPress vs. Platforma noastră
- Tabel comparativ vizual: vulnerabilități WordPress (plugin-uri terțe, atacuri cunoscute, 43% din site-urile hackuite sunt WordPress) vs. aplicație custom (suprafață de atac minimă, fără plugin-uri terțe)
- Statistici reale despre vulnerabilitățile WordPress

### Slide 6 — Baza de date: Ce este și unde se află?
- Explicație PostgreSQL vs. MariaDB/MySQL
- Cine administrează: Supabase (companie specializată, certificări SOC2, ISO 27001)
- Criptare la repaus (AES-256) și în tranzit (TLS 1.3)
- Analogie: "seif bancar digital" vs. "dulap cu lacăt"

### Slide 7 — Row Level Security (RLS) — explicat simplu
- Ce înseamnă: fiecare utilizator vede DOAR datele sale
- Analogie vizuală: dulap cu sertare încuiate individual
- Diferența față de o bază clasică unde adminul vede tot

### Slide 8 — Autentificare și Control Acces
- Sistem de roluri (super_admin, hr, angajat, etc.)
- Parole verificate contra bazelor de date de parole sparte (HIBP)
- 2FA/MFA (autentificare în doi pași) — explicat cu iconițe
- Reautentificare pentru acțiuni critice

### Slide 9 — Criptarea datelor — TLS 1.3
- Explicație simplă: "scrisoare sigilată" vs. "carte poștală"
- Toate datele călătoresc criptat între calculator și server
- Certificat SSL activ

### Slide 10 — Protecția datelor personale (GDPR)
- Mascarea automată a CNP-ului, CI, telefon
- Exemplu vizual: `2901XXXXXXX12`
- Cine poate vedea datele complete: doar HR și super admin

### Slide 11 — Monitorizare și Alerte în Timp Real
- Security Dashboard: login-uri eșuate, dispozitive noi, IP-uri suspecte
- Notificări Telegram automate pentru evenimente critice
- Jurnal de audit complet (cine, ce, când, de unde)

### Slide 12 — Protecția împotriva atacurilor
- Content Security Policy (CSP) — ce scripturi pot rula
- CORS — cine poate comunica cu serverul
- Rate Limiting — blocare automată la prea multe încercări
- Filtrare IP — acces doar din rețeaua institutului

### Slide 13 — Ce se întâmplă în caz de atac hacker?
- Pașii de răspuns: detectare automată → alertă Telegram → blocare IP → logout global → investigare
- Niveluri de protecție (apărare în adâncime)
- Comparație: câte straturi de protecție avem vs. un site obișnuit

### Slide 14 — IRIS — Asistentul AI și securitatea sa
- Ce este un LLM (Large Language Model) — explicat simplu: "un program antrenat pe milioane de texte care înțelege și generează limbaj uman"
- Ce este Claude AI — dezvoltat de Anthropic, focusat pe siguranță
- Guardrails IRIS: limită de cereri, clasificare acțiuni, blocare comenzi necunoscute

### Slide 15 — Ce înseamnă AI, LLM, Claude?
- AI = Inteligență Artificială — programe care pot învăța și lua decizii
- LLM = Large Language Model — model de limbaj antrenat pe texte
- Claude = un model AI creat de compania Anthropic (SUA)
- Analogie: "un asistent foarte citit care răspunde la întrebări"

### Slide 16 — Avantajele platformei (rezumat vizual)
- Grid cu iconițe: Securitate multi-strat, Date criptate, Monitorizare 24/7, Alerte instant, GDPR compliant, Fără plugin-uri vulnerabile, Backup automat, Acces controlat

### Slide 17 — Concluzie
- Platforma este construită cu cele mai noi standarde de securitate 2026
- Mesaj de încredere pentru audiență

### Slide 18 — Întrebări?
- Pagină de contact, email

## Design
- **Paletă**: Midnight Executive — navy `#1E2761`, ice blue `#CADCFC`, accent alb
- **Font**: Georgia (titluri) + Calibri (corp)
- **Layout**: alternanță între slide-uri dark (titlu/concluzie) și light (conținut), iconițe, diagrame simple
- **Logo ICMPP** pe fiecare slide în colț

## Implementare Tehnică
1. Copiere script pptxgenjs din skill
2. Instalare `pptxgenjs` global
3. Generare script Node.js cu toate slide-urile
4. Embed logo ca base64
5. Export în `/mnt/documents/Securitate_Platforma_ICMPP.pptx`
6. QA vizual: conversie PDF → imagini → verificare fiecare slide

