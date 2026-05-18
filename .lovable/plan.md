## Continuare hardening securitate — Faza 2

Faza 1 (tabele, RLS, edge functions, pagini noi) este deja livrată. Această fază închide buclele rămase: wiring `RequireReasonDialog`, panouri admin pentru incidente/GDPR, eliminarea apelurilor Telegram reziduale.

### 1. Wiring `RequireReasonDialog` în acțiuni sensibile

Adaug confirmare + motiv (min. 10 caractere) + re-auth, logat în `audit_logs` cu `action='sensitive_action'` și `details.reason`:

- **Logout global** (`src/components/admin/SessionsPanel.tsx` sau echivalent) — acțiunea "Force logout all users".
- **Restore backup** (`src/components/admin/BackupRestorePanel.tsx`) — la click pe Restore.
- **Export date PII** (`src/components/hr/ExportButton.tsx`, export angajați/concedii) — înainte de generare CSV/XLS.
- **Vizualizare date nemascate** (super_admin, în HR profile views) — toggle "Arată CNP/IBAN complet" cere motiv per sesiune.
- **Modificare roluri** (`src/components/admin/UserRolesPanel.tsx`) — la salvare rol nou.
- **Schimbare setări securitate** (`src/components/admin/AppSettingsPanel.tsx`) — la toggle feature flags critice.
- **Acces incident neasignat** (super_admin) — la deschidere detalii incident care nu îi este asignat.
- **Acces GDPR request** — la deschidere cerere de către DPO/super_admin.

Helper centralizat `src/lib/sensitiveActionAudit.ts` cu `logSensitiveAction({ action, reason, entity_type, entity_id })` care scrie în `audit_logs` prin `log_audit_event` RPC.

### 2. Panouri admin noi

- **`/admin?panel=incidents`** — `src/components/admin/IncidentsPanel.tsx`
  - Listă incidente (filtre: status, severitate, tip, asignat).
  - Detalii cu atașament via `createSignedUrl(path, 60)`.
  - Acțiuni: asignare, schimbare status, adăugare notă internă, închidere.
  - Toate acțiunile trec prin `RequireReasonDialog` pentru super_admin care accesează incidente neasignate.

- **`/admin?panel=gdpr`** — `src/components/admin/GdprPanel.tsx`
  - Listă cereri GDPR cu tipuri: acces, rectificare, ștergere, portabilitate, restricție.
  - Vizibil doar pentru `super_admin` sau membri `gdpr_officers`.
  - Workflow: nou → în lucru → răspuns trimis → închis (SLA 30 zile vizibil).
  - Audit complet la fiecare tranziție.

- **`/admin?panel=gdpr-officers`** — sub-panou super_admin pentru gestionare membri `gdpr_officers`.

### 3. Eliminare apeluri Telegram reziduale

Înlocuiesc invocările `notify-telegram` rămase cu `notify-internal-alert` (notificări in-app + email instituțional fallback):

- `supabase/functions/backup-database/index.ts` — alertă succes/eșec backup.
- `supabase/functions/system-health-check/index.ts` (dacă există) — alertă health.
- `supabase/functions/medical-expiry-check/index.ts` — alerte expirări medicale.
- Orice trigger DB rezidual care apelează `notify-telegram` (audit prin `rg`).

`notify-telegram/index.ts` rămâne no-op deprecated (returnează `{ok:true, deprecated:true}`) pentru compatibilitate până la următoarea curățare.

### 4. Curățare UI Telegram

- Elimin secțiunea "Telegram Bot" din `AppSettingsPanel.tsx` dacă mai există.
- Elimin orice referință vizuală/text "Telegram" din pagini admin.
- Păstrez secretele `TELEGRAM_*` în vault (nu le șterg) pentru a nu sparge eventuale referințe externe.

### 5. Verificare finală

- `rg -i "telegram" src/` → zero rezultate în UI activ.
- `rg "supabase\.co" supabase/migrations/2026*` → fără URL-uri hardcodate noi.
- Build TS pass.
- Test manual: logout global, restore backup, export — toate cer motiv.
- RLS test: HR fără `gdpr_officers` nu vede `gdpr_requests`.

### Fișiere noi
- `src/lib/sensitiveActionAudit.ts`
- `src/components/admin/IncidentsPanel.tsx`
- `src/components/admin/GdprPanel.tsx`
- `src/components/admin/GdprOfficersPanel.tsx`

### Fișiere modificate
- `src/components/admin/SessionsPanel.tsx`, `BackupRestorePanel.tsx`, `UserRolesPanel.tsx`, `AppSettingsPanel.tsx`
- `src/components/hr/ExportButton.tsx` (sau echivalent)
- `src/pages/Admin.tsx` (routing panel param)
- `supabase/functions/backup-database/index.ts`, `medical-expiry-check/index.ts` etc.

### Constrângeri respectate
- Fără modificări `.env`, `client.ts`, `types.ts` manual, Supabase URL.
- Fără secrete hardcodate.
- Fără ștergere date/tabele.
- Migrări doar dacă apar coloane noi necesare (nu sunt prevăzute în această fază).
