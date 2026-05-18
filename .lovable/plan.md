
# Plan v2: Securitate, GDPR, Notificări & Roluri — Intranet ICMPP

Implementare **incrementală, reversibilă, GDPR-compliant**, fără reset DB, fără secrete hardcodate, fără ștergere de date.

---

## 0. Pre-flight (verificare înainte de migrare)

Înainte de orice migrare cu impact, rulez audit read-only:
```sql
SELECT count(*), array_agg(user_id) FROM user_roles WHERE role = 'admin';
SELECT user_id, array_agg(role::text) FROM user_roles
  WHERE user_id IN (SELECT user_id FROM user_roles WHERE role='admin')
  GROUP BY user_id;
```
Rezultatul îl prezint user-ului în descriere migrare + îl loghez în `audit_logs` (action `pre_migration_audit`, details cu count și user_ids).

## 1. Migrare rol `admin` — sigură, fără escaladare

**Reguli stricte:**
- **Nu** acord automat `super_admin` nimănui.
- Dacă un user are `admin` + alte roluri (ex. `hr`, `sef`), păstrez celelalte roluri, șterg doar intrarea `admin`.
- Dacă un user are **doar** `admin`, îl convertesc la `user` (rol minim) și-i creez notificare in-app explicativă.
- Fiecare conversie → entry în `audit_logs` (action `role_legacy_migration`, details: `{from: 'admin', to: 'user'|'kept_other_roles', other_roles: [...]}`).
- Enum `app_role` **nu** se modifică (păstrăm compatibilitate). `'admin'` rămâne valid în enum dar devine **legacy**: nu mai apare în UI și nu mai e verificat în nicio funcție de permisiuni.

**Funcții actualizate** (scot `'admin'`): `can_manage_procurement`, `can_manage_content`, `handle_new_user` (label `'Administrator'` eliminat).

**Frontend**: scot `'admin'` din toate dropdown-urile și matricile de roluri; `useUserRole` flagează `admin` ca `LEGACY_ROLE` fără permisiuni.

## 2. Eliminare Telegram — deprecated, fără rupere

**Edge function `notify-telegram`**: devine **no-op deprecated** — returnează `{ok:true, deprecated:true}` cu status 200, **nu citește** `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`, nu face niciun fetch extern. Loghează intern `deprecated_call` dacă cineva o mai apelează.

**DB**: `DROP TRIGGER` pentru `notify_telegram_account_request` și `notify_telegram_security_event` (funcțiile rămân, neapelate). Adaug trigger nou `notify_security_event_internal` care apelează `notify-internal-alert`.

**Apeluri existente** (`backup-data`, `health-check`, `check-medical-expirations`, `notify-leave-email`, `reset-mfa`, `restore-from-drive`) → înlocuite cu `notify-internal-alert` (in-app + email fallback).

**Secrete**: `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` **nu** se șterg din vault (decizie user), dar nu mai sunt citite de niciun cod.

**UI**: zero mențiuni Telegram (verificat prin `rg -i telegram src/`).

## 3. Fără secrete/URL-uri hardcodate

**Problema actuală**: funcțiile `notify_push_on_new_notification`, `notify_telegram_*` au URL Supabase + JWT anon **hardcodate** în corpul funcției (vezi `https://erghywhqrxmwqptusbxd.supabase.co/...` + `Authorization: Bearer eyJ...`).

**Soluție** (migrare): refactoring cu **Vault** Postgres:
```sql
-- One-time setup, fără secret în SQL — valorile sunt deja în secrets/env
SELECT vault.create_secret(current_setting('app.settings.supabase_url'), 'supabase_url');
SELECT vault.create_secret(current_setting('app.settings.anon_key'), 'anon_key');
```
Dacă vault setup-ul nu e fezabil incremental, alternativa sigură: citire prin `current_setting('app.supabase_url', true)` setat la nivel de DB (GUC) sau prin `pg_settings`. Migrarea **nu** include valori — doar referințe.

Funcții refactorate: `notify_push_on_new_notification` și orice trigger care face `net.http_post` → citește URL și auth header din vault/GUC, nu din literal.

**Dacă vault e indisponibil**: las funcția existentă neatinsă (URL/JWT deja acolo) și **NU** introduc noi hardcodări; documentez în notes pentru migrare ulterioară controlată.

**Frontend & edge functions noi**: zero chei/URL-uri literal. Folosesc `import.meta.env.VITE_SUPABASE_*` în frontend și `Deno.env.get(...)` în edge functions.

## 4. Edge function nouă `notify-internal-alert`

```text
supabase/functions/notify-internal-alert/index.ts
```
- Validează JWT (caller = service role sau super_admin).
- Input Zod: `{title, message, severity: 'info'|'warning'|'critical', target: 'super_admin'|'hr'|'user_ids'[], related_type?, related_id?}`.
- Acțiuni: inserează în `notifications` (trigger existent declanșează push), iar pentru `severity>=warning` trimite și email via `send-reminder-email`.
- Audit: log în `audit_logs` action `internal_alert_dispatched`.

## 5. Rute push corectate

`send-push-notification/index.ts` — `getUrlForNotification()`:
| related_type | rută |
|---|---|
| leave_request, leave_approval | `/leave-request` (+ `?request=<id>`) |
| hr_request | `/hr-management` |
| helpdesk_ticket, account_request | `/admin` |
| suggestion | `/sugestii` |
| announcement | `/announcements` |
| incident_report | `/admin?panel=incidents` |
| gdpr_request | `/admin?panel=gdpr` |
| chat_* | `/chat` |
| altele | `/` |

Whitelist strict; fallback `/`.

## 6. Tabele noi cu RLS strict

### `security_incidents`
```sql
CREATE TABLE public.security_incidents (
  id uuid PK default gen_random_uuid(),
  reporter_user_id uuid NOT NULL,
  incident_type text NOT NULL CHECK (incident_type IN
    ('email_phishing','link_suspect','cont_compromis',
     'dispozitiv_pierdut','fisier_suspect','altul')),
  description text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  attachment_path text,         -- path în bucket privat, NU URL public
  status text NOT NULL DEFAULT 'open',
  severity text DEFAULT 'medium',
  assigned_to uuid,             -- user_id (super_admin sau HR desemnat)
  hr_relevant boolean DEFAULT false, -- setat de super_admin/trigger
  created_at, updated_at timestamptz
);
```
**RLS**:
- INSERT: orice user autentificat poate raporta (`auth.uid() = reporter_user_id`).
- SELECT propriile: `auth.uid() = reporter_user_id`.
- SELECT/UPDATE super_admin: `has_role(auth.uid(),'super_admin')`.
- SELECT HR: doar dacă `assigned_to = auth.uid()` OR (`hr_relevant=true` AND `can_manage_hr(auth.uid())`).
- DELETE: doar super_admin, cu motiv obligatoriu (audit).

**Trigger audit**: orice INSERT/UPDATE/SELECT-ul super_admin → `audit_logs`. Pentru SELECT folosim wrapper RPC `read_incident_with_audit(id, reason)`.

### `gdpr_requests`
```sql
CREATE TABLE public.gdpr_requests (
  id uuid PK,
  user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN
    ('access','rectification','restriction','deletion','portability','complaint')),
  description text,
  status text DEFAULT 'open',
  handled_by uuid,
  response text,
  created_at, updated_at, closed_at timestamptz
);
```
**Rol DPO nou** (aditiv, fără modificare enum dacă posibil): introducem o tabelă `gdpr_officers (user_id uuid PK)` în loc să adăugăm la enum (sigur, reversibil).

**RLS**:
- INSERT/SELECT own: `auth.uid()=user_id`.
- SELECT/UPDATE full: `has_role(auth.uid(),'super_admin') OR EXISTS(SELECT 1 FROM gdpr_officers WHERE user_id=auth.uid())`.
- **NU** se acordă acces implicit la tot HR — doar super_admin + DPO desemnat.
- Toate acțiunile super_admin/DPO → `audit_logs` cu motiv obligatoriu.

## 7. Storage incidente — securizat

Bucket nou **privat** `security-incidents`:
- Path obligatoriu: `incidents/{auth.uid()}/...`.
- Storage policy INSERT: `(storage.foldername(name))[1] = 'incidents' AND (storage.foldername(name))[2] = auth.uid()::text`.
- Storage policy SELECT: owner sau super_admin sau (HR cu incident assigned).
- **Limită mărime**: 10 MB (validat client + în policy via `metadata->>'size'`).
- **Allowlist extensii**: `.pdf, .png, .jpg, .jpeg, .txt, .eml`. Validare:
  - Frontend: input `accept=".pdf,.png,.jpg,.jpeg,.txt,.eml"` + verificare MIME.
  - Backend: policy CHECK pe `lower(right(name, 4))` IN (…).
- **Acces fișiere**: doar via `createSignedUrl(path, 60)` — fără linkuri publice, fără `getPublicUrl`.

## 8. Confirmări + motiv obligatoriu pentru acțiuni sensibile

**Componentă reutilizabilă** `RequireReasonDialog` (extinde `ReauthDialog` existent):
- Re-auth password + textarea motiv (min 10 caractere).
- La submit → `log_audit_event(uid, action, entity_type, entity_id, {reason, ...})`.

**Acțiuni protejate**:
| Acțiune | Locație |
|---|---|
| Logout global | AccountSecurity, AdminUsersPanel |
| Restore backup | DriveBackupRestorePanel |
| Export date (PII) | HRExportButton, exportLeaveCalendar |
| Vizualizare date nemascate | PersonalDataEditor, EmployeeDigitalDossier |
| Modificare roluri | AdminUsersPanel, CustomRolesManager |
| Schimbare setări securitate | AppSettingsPanel, SecurityPanel |
| Acces incident neasignat (super_admin) | ReportIncident admin view |
| Acces GDPR request | GDPR admin view |

**Super Admin & date nemascate**: implicit **mascate**, dezvăluire = excepție justificată prin `RequireReasonDialog`. Sesiunea de dezvăluire expiră în 5 min.

## 9. Feature flags / rollback

Tabel nou `feature_flags`:
```sql
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid, updated_at timestamptz
);
```
**RLS**: SELECT public (autentificat), UPDATE doar super_admin (cu audit).

**Seed inițial**:
- `internal_alerts_enabled` = true
- `incident_reporting_enabled` = true
- `audit_reason_required` = true
- `gdpr_requests_enabled` = true
- `legacy_admin_role_visible` = false

**Hook frontend** `useFeatureFlag(key)` cu cache 60s. Edge functions citesc flag înainte de a executa.

**Rollback**: super_admin poate dezactiva flag → comportamentul vechi revine fără deploy.

## 10. Centru utilizator + Privacy + Sidebar

**Pagini noi**:
- `/securitatea-mea` — MFA, ultimele autentificări (`auth_login_log` cu RLS own), alerte cont (`security_events` own), buton logout global cu `RequireReasonDialog`.
- `/raporteaza-incident` — form Zod + ghid „Primele 30 de minute”.
- `/confidentialitate` — date prelucrate, temei legal GDPR, retenție, drepturi (Acces/Rectificare/Restricție/Ștergere/Portabilitate/Plângere), buton „Solicită drept GDPR” → `gdpr_requests`.

**RLS aditiv** (dacă lipsesc):
- `auth_login_log`: SELECT WHERE `auth.uid() = user_id`.
- `security_events`: SELECT WHERE `auth.uid() = user_id` OR super_admin.

**Sidebar** — grup nou „Securitate” în `Sidebar.tsx` + `MobileNav.tsx`, gated de feature flags:
- Securitatea contului meu → `/securitatea-mea`
- Raportează incident → `/raporteaza-incident` (gated `incident_reporting_enabled`)
- Test siguranță digitală → `/security-quiz`
- Confidențialitate & GDPR → `/confidentialitate` (gated `gdpr_requests_enabled`)

Stil glassmorphism existent, iconuri `ShieldCheck`/`ShieldAlert`/`GraduationCap`/`FileLock2`.

## 11. Canale de notificare

**Această etapă**: Web Push (existent) + Email instituțional (`send-reminder-email`).
**Fără WhatsApp** pentru alerte de securitate.
**Pregătire SMS UE critic**: interfață TS `CriticalAlertChannel.sendSMS()` care întoarce `not_configured` — fără provider hardcodat, fără apel real.

## 12. Quiz extins (nedistruptiv)

`SecurityQuizEngine`: extind banca pe categorii (phishing, deepfake/CEO, MFA, Wi-Fi/VPN, backup, raportare). Dacă `security_quiz_questions.category` lipsește → migrare aditivă `ADD COLUMN category text` nullable. Scorurile individuale rămân private (RLS deja existent); admin vede agregat.

## 13. Verificare finală

```bash
rg -i telegram src/ supabase/functions/notify-internal-alert supabase/functions/send-push-notification
rg "'admin'" src/components/admin src/hooks/useUserRole.tsx
rg "supabase\.co" supabase/migrations/  # zero noi hardcodări
```
- Build automat.
- Linter Supabase după fiecare migrare → fix doar issue-urile generate de migrarea curentă.
- Verific manual fiecare rută push.
- Verific RLS pe `security_incidents`, `gdpr_requests`, `auth_login_log`, `security_events`, `feature_flags`, bucket `security-incidents`.
- **Nu** ating: `.env`, `client.ts`, `types.ts`, project URL, `supabase/config.toml` (project-level).

---

## Migrări planificate (toate aditive, reversibile)

```text
M0  read-only pre-flight audit (log în audit_logs)
M1  drop triggers notify_telegram_* (funcțiile rămân)
M2  refactor notify_push_on_new_notification → fără literal URL/JWT (vault/GUC)
M3  create trigger notify_security_event_internal
M4  migrate admin role: păstrare alte roluri, audit per user
M5  update can_manage_procurement, can_manage_content, handle_new_user
M6  create gdpr_officers + gdpr_requests + RLS
M7  create security_incidents + RLS + bucket security-incidents + storage policies
M8  create feature_flags + seed
M9  add column security_quiz_questions.category (dacă lipsește)
M10 add RLS SELECT own pe auth_login_log, security_events (dacă lipsesc)
```

Fiecare migrare: idempotentă (`IF NOT EXISTS`/`IF EXISTS`), fără DROP de tabele/coloane existente, fără ștergere de date utilizator.

## Fișiere noi
```text
src/pages/AccountSecurity.tsx
src/pages/ReportIncident.tsx
src/pages/Privacy.tsx
src/components/security/IncidentReportForm.tsx
src/components/security/First30MinutesGuide.tsx
src/components/privacy/* (DataCategoriesTable, RetentionTable, RightsList, ...)
src/components/shared/RequireReasonDialog.tsx
src/hooks/useFeatureFlag.ts
src/utils/sensitiveActionAudit.ts
supabase/functions/notify-internal-alert/index.ts
```

## Ce NU se face
- Fără reset DB, fără DROP table, fără ștergere date.
- Fără modificări la `client.ts`/`types.ts`/`.env`/project URL/Lovable Cloud config.
- Fără secrete/URL-uri noi hardcodate; cele existente refactorate **doar dacă** vault e disponibil (altfel rămân neatinse + notez).
- Fără WhatsApp, fără provider SMS hardcodat.
- Fără escaladare automată a vreunui user la `super_admin`.
- Fără acces implicit pentru tot HR la GDPR/incidente sensibile.
