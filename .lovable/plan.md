# Fluturași: încărcare stabilă + design nou 2026–2027

## Problema (confirmată în cod)
Acum PDF-ul întreg (~260 fluturași) e trimis într-o singură cerere, iar pagina așteaptă până se termină tot: detectare, potrivire, împărțire și criptare pe rând. Pe un PC mai lent sau cu internet slab cererea durează minute, serverul o poate opri, iar ecranul „mentenanță automată" apare pentru că platforma e ocupată. Totul se pierde și trebuie luat de la capăt.

## Ce schimbăm

### 1. Încărcare care nu se mai pierde
- PDF-ul se urcă întâi ca fișier, cu bară reală de progres (MB urcați).
- Dacă se întrerupe internetul, încărcarea se reia de unde a rămas.
- Imediat după urcare, pagina e liberă: procesarea continuă singură pe server.

### 2. Procesare pe bucăți, în fundal
- Serverul lucrează câte 20 de fluturași pe rând și salvează după fiecare bucată.
- Dacă se oprește la mijloc, continuă automat de unde a rămas (nu de la zero).
- Puteți închide pagina sau calculatorul; la revenire vedeți lotul exact unde a ajuns.
- Buton „Continuă procesarea" pentru loturile oprite.

### 3. Fără „mentenanță automată" falsă
- În timpul procesării fluturașilor, ecranul de mentenanță nu mai apare din cauza aglomerării.
- Dacă platforma chiar e căzută, apare doar un mesaj mic sus: „Reconectare… lotul continuă pe server", nu ecran plin.

### 4. Design nou „Centru digital de salarizare"
```text
+----------------------------------------------------------+
| Salarizare · Noiembrie 2026          [Lună ▾] [Încarcă]  |
+----------------------------------------------------------+
| (O) 248/260 asociați | 12 de revizuit | 236 trimiși | 3 CAR |
+----------------------------------------------------------+
| Traseu lot:  Urcare ● ─ Detectare ● ─ Potrivire ● ─      |
|              Criptare ◐ 62% ─ Distribuire ○ ─ E-mail ○   |
|   „Se criptează fluturașul 162 din 260 · ~1 min rămas"   |
+----------------------------------------------------------+
| Zonă mare de tras PDF-ul (drag & drop), animată          |
+----------------------------------------------------------+
| De rezolvat: carduri cu fluturașii nepotriviți,          |
| sugestie automată de persoană + buton „Confirmă"         |
+----------------------------------------------------------+
| Istoric loturi: cronologie pe luni, stare colorată       |
+----------------------------------------------------------+
```
- Inel de progres și traseu pe etape, cu timp estimat.
- Carduri „De rezolvat" cu sugestia cea mai probabilă (ex. Samoilă: alegere după marcă).
- Cronologie loturi pe luni, cu indicatori: distribuiți, deschiși de angajați, e-mailuri eșuate.
- Notificare când lotul e gata, chiar dacă sunteți pe altă pagină.
- Aceleași culori ICMPP, sticlă/glassmorphism, merge și pe telefon.

## Ce rămâne neschimbat
Criptarea, potrivirea după marcă, distribuirea, trimiterea e-mailurilor în fundal, jurnalul de audit.

## Detalii tehnice
- Upload PDF în bucket privat (TUS resumable, `payslip-sources/`), apoi `process-payslip-batch` primește doar calea și răspunde imediat; munca rulează în `EdgeRuntime.waitUntil`.
- Coloane noi pe `payslip_batches`: `source_path`, `phase`, `processed_count`, `last_heartbeat`, `error`; procesare idempotentă în bucăți de 20, reluare după `processed_count`; job cron la 2 min reia loturile cu heartbeat expirat.
- Progres prin realtime/polling pe `payslip_batches`, nu pe numărare `payslips`.
- `DbHealthOverlay`: suspendat cât un lot e activ; banner discret în loc de overlay.
- `PayslipUploader.tsx` împărțit în componente (stepper, zonă upload, de rezolvat, istoric); test pentru logica de reluare.
