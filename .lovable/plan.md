## Modul „Agenda întâlniri"

Modul privat pentru `super_admin`, `director_institut`, `director_adjunct`, `secretariat` — calendar de întâlniri cu remindere pe email.

### Context tehnic verificat
- `profiles` NU conține email → emailurile se iau din `auth.users` printr-o funcție SECURITY DEFINER restrânsă la rolurile permise, sau prin `employee_personal_data.email`.
- `pg_cron` și `pg_net` sunt active → reminderele se planifică direct prin cron.
- SMTP deja configurat (`SMTP_HOST/USER/PASS/PORT/FROM`) → fără secrete noi, fără expunere în frontend.
- Timezone calcul reminder: `Europe/Bucharest` (stocăm `start_at` ca `timestamptz`).

### 1. Bază de date (migrare)

**Helper**
```sql
CREATE FUNCTION can_manage_meetings(_uid uuid) RETURNS boolean
-- super_admin / director_institut / director_adjunct / secretariat
```

**Tabela `meetings`**
- `id`, `title`, `start_at timestamptz`, `end_at timestamptz` (validare end > start),
- `location`, `participants text`, `notes text`,
- `status` enum `meeting_status` (`scheduled` | `cancelled` | `completed`, default `scheduled`),
- `created_by uuid` (auth.users), 
- `reminder_enabled bool default false`,
- `reminder_emails text[] default '{}'`,
- `reminder_offset_minutes int` (10 / 30 / 60 / 1440),
- `reminder_sent_at timestamptz`,
- `created_at`, `updated_at` + trigger.

**RLS** — single policy FOR ALL: `USING/WITH CHECK can_manage_meetings(auth.uid())`. GRANT pe `authenticated` + `service_role`. Fără grant `anon`.

**Funcție emailuri director+secretariat** (SECURITY DEFINER, restrânsă la `can_manage_meetings`):
```
get_meeting_default_recipients() RETURNS text[]
-- join user_roles cu auth.users pe rolurile țintă
```

### 2. Rutare & gardă acces

- Pagină `src/pages/MeetingsAgenda.tsx`, rută `/agenda-intalniri` în `App.tsx`.
- Gardă internă pe pagină: dacă rol neautorizat → redirect `/` + toast „Acces interzis".
- Link Sidebar afișat condiționat în grupul „Administrare" (icon `CalendarClock`).

### 3. UI calendar

Bibliotecă: **`react-big-calendar`** (month / week / day) + `date-fns` (deja prezent) cu locale `ro`.

Layout pagină:
```
[Filtre: status • date range • search]  [+ Întâlnire nouă]
[Tabs Month | Week | Day]
[Calendar]
[Listă compactă întâlniri filtrate — vizibilă pe mobil]
```

- Click pe slot gol → modal „Adăugare rapidă" cu data/ora pre-completată.
- Click pe eveniment → modal Detalii (View → Edit → Delete cu confirmare).
- Badge-uri colorate prin tokens semantice (`primary` / `success` / `destructive`).
- Mobil: default view „Day"; filtrele într-un Sheet.

### 4. Modal întâlnire (react-hook-form + zod)

Câmpuri: titlu, dată, oră început, oră final, locație, participanți (textarea), observații, status.

Bloc reminder:
- Switch „Trimite reminder pe email".
- Când e activ:
  - Multi-input emailuri (chips) — buton „Adaugă director + secretariat" care preia rezultatul din `get_meeting_default_recipients`.
  - Select moment: 10 min / 30 min / 1 oră / 1 zi înainte.

Validare: end > start; dacă reminder activ → cel puțin un email valid.

### 5. Email reminder

**Edge Function `send-meeting-reminder`** (Deno + npm:nodemailer, urmează standardul edge sec):
- Validează JWT, cere `can_manage_meetings` (pentru apel manual) sau acceptă `Authorization` cu service role (pentru cron).
- Input: `{ meeting_id }`.
- Încarcă meeting-ul, trimite email HTML brandate (titlu, dată/oră Europe/Bucharest, locație, participanți, notes), marchează `reminder_sent_at = now()`.
- Buton manual „Trimite reminder acum" în modal pentru test/manual.

**Cron (pg_cron + pg_net)** — job la fiecare 5 minute:
```sql
SELECT cron.schedule('meeting-reminders-5m', '*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/send-meeting-reminder',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <anon>'),
    body := jsonb_build_object('meeting_id', m.id)
  )
  FROM meetings m
  WHERE m.status = 'scheduled'
    AND m.reminder_enabled = true
    AND m.reminder_sent_at IS NULL
    AND now() >= m.start_at - (m.reminder_offset_minutes || ' minutes')::interval
    AND now() <  m.start_at;
$$);
```
Cron-ul se programează prin `supabase--insert` (anon key inline — nu trece prin migration).

**Fallback** dacă cron eșuează la programare: edge function rămâne funcțională manual, plus instrucțiuni în README.

### 6. Filtre & căutare

State local + memoizare:
- Status (Select)
- Date range (DateRangePicker)
- Search debounced (title / location / participants / notes)
Filtrele se aplică deopotrivă pe evenimentele din calendar și pe lista compactă.

### 7. Securitate & confidențialitate

- Nicio expunere SMTP în frontend.
- Funcția de emailuri default e SECURITY DEFINER + verifică rolul apelantului.
- RLS strict — alți useri primesc 0 rânduri și nu pot insera/edita.
- Audit log opțional pe create/update/delete (folosind `log_audit_event`).

### 8. Verificări

- Login `user` → fără link în meniu; `/agenda-intalniri` redirectează.
- CRUD complet cu `secretariat`.
- Salvare cu reminder → câmpurile persistă corect.
- Apel manual al edge function pe un meeting de test → email primit.
- Verificare în DB că `reminder_sent_at` se setează după trimitere.