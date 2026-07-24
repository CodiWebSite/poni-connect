
# Modul Salarizare — Fluturași electronici (Fază pilot)

## Ce livrează planul

1. **Salarizare** încarcă lunar un PDF centralizator (formatul primit — vezi f-108.pdf).
2. Sistemul **sparge automat PDF-ul** în fluturași individuali, identifică fiecare angajat **după nume + prenume** (matching principal), criptează fiecare fișier cu **ultimele 6 cifre din CNP** și îl atașează la contul angajatului.
3. Angajatul vede în profil o secțiune nouă **„Fluturașii mei"**, cu istoric lună-cu-lună; descarcă doar PDF-ul propriu, protejat cu parolă.
4. **Toate accesările și descărcările** sunt logate în audit.
5. **Faza pilot strict închisă**: modulul este vizibil **doar** pentru cei 4 angajați propuși (condrea.codrin, isache.marius, hogas.anca, tofan.dragos). Pentru toți ceilalți angajați, secțiunea „Fluturașii mei" nu apare deloc în profil — nici măcar goală — până la go-live.

---

## Fluxul complet

```text
    ┌──────────────────────────┐
    │ Salarizare încarcă PDF   │
    │ centralizator (o lună)   │
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Edge Function split      │
    │  1. detectează           │
    │     "ICMPP-<Luna Anul>"  │
    │  2. extrage NUME+PRENUME │
    │     (linia după marcă)   │
    │  3. mapează la angajat   │
    │     după nume în         │
    │     employee_personal_   │
    │     data (marca ignorată │
    │     — poate fi diferită) │
    │  4. criptează cu CNP     │
    │     ultimele 6 cifre     │
    └──────────┬───────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
  ✓ matched      ⚠ unmatched
  → salvat în     → raport în UI
    storage         cu combobox
  → notificare     „Asociază manual"
    angajat        (admin alege
                    angajatul corect)
               │
               ▼
    ┌──────────────────────────┐
    │ Angajat pilot →          │
    │  /my-profile             │
    │  → tab „Fluturașii mei"  │
    │  → istoric luni          │
    │  → download PDF criptat  │
    │  → audit log             │
    └──────────────────────────┘
```

---

## Matching angajat — logică (revizuită)

**Matching principal: nume + prenume**, nu marcă. Marca poate diferi între programe/proiecte, deci nu e o cheie fiabilă.

Algoritm de match, în ordine:

1. **Normalizare** ambele părți: uppercase, elimină diacritice (`Ș→S`, `Ț→T`, `Ă→A`, `Â→A`, `Î→I`), colapsează spații.
2. Din PDF extrage linia după marcă (ex: `BALAN CATALINA`, `BUZDUGAN CATALIN VALENTIN`, `HOGAS ANCA MARIANA`).
3. În `employee_personal_data` construiește doi candidați normalizați:
   - `LAST_NAME + ' ' + FIRST_NAME` (majoritatea cazurilor: „HOGAS ANCA MARIANA")
   - `FIRST_NAME + ' ' + LAST_NAME` (fallback pentru înregistrări inversate)
4. **Egalitate exactă** pe una din variantele de mai sus → match.
5. Dacă niciun match exact, aplică **fuzzy match** cu Levenshtein distance ≤ 2 și scor ≥ 0.9 → propus ca „match cu confirmare" în UI (nu se aplică automat, admin confirmă).
6. Dacă tot nu găsește nimic → **unmatched**, apare în raport cu combobox de asociere manuală.

**Marca**: se salvează pe fluturaș ca metadată informativă (pentru istoric/audit), dar **nu** e folosită pentru match. Nu o mai auto-populăm pe `employee_personal_data`.

**Salvgardă anti-eroare**: dacă în același lot mai mult de un angajat mapează pe același nume normalizat (omonime), toate rândurile aferente devin `unmatched` cu tag „duplicat de nume — asociere manuală obligatorie". Nu distribuim niciodată automat pentru omonime.

---

## Ce apare vizual

### /salarizare — pentru rol `salarizare` + `super_admin`
- Card **„Încărcare fluturași lunari"** cu selector lună/an + drop-zone PDF.
- Tabel cu rezultatele split-ului: `nume detectat | angajat asociat | status`. Statusurile:
  - ✅ **matched** — asociere directă după nume.
  - 🟡 **needs_confirm** — fuzzy match, admin confirmă cu 1 click.
  - ❌ **unmatched** — combobox căutare angajat pentru asociere manuală.
  - 🟠 **duplicate_name** — omonim, obligatoriu manual.
- Buton **„Confirmă distribuția"** — abia atunci fluturașii criptați sunt puși la dispoziția angajaților (și doar celor 4 pilot în această fază).
- Tab **„Istoric loturi"** — luni procesate, autor, buton re-procesare, buton „Șterge lot".

### /my-profile — tab „Fluturașii mei"
- **Ascuns complet** dacă emailul utilizatorului nu e în whitelist-ul pilot. Nu apare nici tab-ul, nici link-ul.
- Pentru cei 4 pilot: listă cronologică cu carduri per lună + buton Download + hint parolă („parola = ultimele 6 cifre din CNP-ul dvs.").
- La prima deschidere, dialog explicativ + confirmare GDPR.

### /admin — panou nou mic „Fluturași pilot"
- Doar `super_admin`. Listă simplă cu whitelist-ul de email-uri pilot + Add/Remove. La go-live golim tabelul sau schimbăm flag-ul global.

---

## Detalii tehnice

**Bază de date (migrație nouă):**

- `payslip_batches` — un rând per încărcare lunară: `month`, `year`, `uploaded_by`, `original_filename`, `total_slips`, `matched_count`, `unmatched_count`, `status` (`processing`/`ready`/`failed`), `notes`.
- `payslips` — un rând per fluturaș individual: `batch_id`, `employee_epd_id` (FK către `employee_personal_data`), `marca_detected` (informativ), `name_detected`, `month`, `year`, `file_path` (bucket privat), `net_amount` (opțional, extras din text), `distributed_at`, `first_downloaded_at`, `download_count`.
- `payslip_pilot_users` — whitelist email-uri cu acces în faza pilot. **Populat inițial cu**: `condrea.codrin@icmpp.ro`, `isache.marius@icmpp.ro`, `hogas.anca@icmpp.ro`, `tofan.dragos@icmpp.ro`.
- `payslip_audit_log` — `user_id`, `payslip_id`, `action` (`view`/`download`/`upload`/`admin_view`), `ip`, `user_agent`, `at`.

**RLS strict (faza pilot):**
- Angajatul vede rânduri din `payslips` **numai** dacă:
  `employee_epd_id` mapează la CNP-ul/emailul lui **ȘI** emailul lui e în `payslip_pilot_users`.
- `salarizare` + `super_admin` văd toate loturile (ca să poată procesa), dar nu pot descărca PDF-uri individuale ca angajat în faza pilot.
- Ceilalți useri: zero acces la nicio linie.
- Storage: bucket privat, orice acces trece printr-un endpoint care re-verifică pilot + ownership înainte să genereze URL semnat.

**Storage:**
- Bucket privat nou `payslips`. Path: `payslips/{year}/{month}/{epd_id}.pdf`.
- Acces exclusiv prin URL semnat cu TTL 60s, generat după verificare RLS + logare audit.

**Split & criptare** — Edge Function nouă `process-payslip-batch`:
- Biblioteci Deno: `pdfjs-dist` (extracție text pentru identificare nume) + `@cantoo/pdf-lib` (split + **encriptare AES-256 cu parolă**).
- Algoritm:
  1. Extrage text per pagină, delimitează pe `PRIMIT FLUTURASUL`.
  2. Identifică `LUNA : MM.YYYY` și pentru fiecare bloc, linia `<marca> - <NUME PRENUME>` (marcă doar informativ).
  3. Normalizează numele și aplică algoritmul de match descris mai sus.
  4. Reconstruiește PDF-ul aferent angajatului (unele fluturași pot ocupa mai multe pagini).
  5. Criptează cu `userPassword = last6(cnp)`, `ownerPassword = random`, permisiuni doar print+read.
  6. Upload storage + insert `payslips` cu status corespunzător (matched/needs_confirm/unmatched).
- Return: raport JSON detaliat pentru UI.

**Notificări:**
- La `Confirmă distribuția`, un `notification` in-app per angajat pilot matched. Fără email în faza pilot.
- Alertă pentru admin la unmatched > 0.

**Audit:**
- Upload lot → `audit_logs` + `payslip_audit_log(upload)`.
- View/download angajat → `payslip_audit_log(view/download)` cu IP + user-agent. URL semnat TTL 60s per descărcare.
- Admin access la fluturaș individual (pentru debug) → `payslip_audit_log(admin_view)`.

**Feature flag:** `feature.payslips.pilot` (bool, default `true`). Cât timp e `true`, tab-ul „Fluturașii mei" apare **exclusiv** pentru email-urile din `payslip_pilot_users`. La go-live: fie mutăm flag-ul pe `false` (deschidere tuturor), fie ștergem whitelistul.

---

## Ce NU face acest pas

- Fără trimitere email cu link — totul în intranet.
- Fără OCR pentru scan-uri — presupunem PDF text (cum e f-108.pdf).
- Fără integrare directă cu programul de salarizare — upload manual în faza pilot.
- Fără istoric retroactiv — începem cu prima încărcare a Salarizării.
- Fără afișare tab „Fluturașii mei" pentru non-pilot — nici măcar gol.

---

Confirmați planul cu **Aprobă** și trec la implementare direct pe această structură.
