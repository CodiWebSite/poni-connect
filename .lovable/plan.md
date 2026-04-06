

# Plan de Securizare — Platforma Intranet ICMPP

## Rezumat

Hardening complet al platformei interne pe 3 faze, acoperind: security headers, autentificare, autorizare, edge functions, storage, audit, alerte real-time și protecție IRIS. Toate măsurile sunt compatibile cu Supabase + Lovable, fără a afecta fluxurile existente.

---

## Starea curentă (constatări din audit)

- **IP guard** funcțional (193.138.98.0/24 + bypass)
- **Turnstile** activ pe login/signup
- **RLS** activat pe toate cele 69 de tabele
- **Probleme identificate**: storage `getPublicUrl()` pe bucket privat, edge functions cu error leakage, `public_profile_settings` expune date cu USING(true), funcții fără `search_path`, leaked password protection dezactivat, security definer views

---

## FAZA 1 — Critic (implementare imediată)

### 1.1 Security Headers
**Fișiere**: `index.html`, eventual un edge function `security-headers` sau configurare Vite

- Adăugare `<meta>` CSP în `index.html` (Report-Only inițial):
  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com;
  img-src 'self' data: https://*.supabase.co; frame-src https://challenges.cloudflare.com;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  ```
- `X-Content-Type-Options: nosniff` — meta tag
- `Referrer-Policy: strict-origin-when-cross-origin` — meta tag
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — meta tag

### 1.2 Leaked Password Protection
- Activare HIBP check via `cloud--configure_auth`

### 1.3 Edge Functions Hardening
**Fișiere**: toate edge functions din `supabase/functions/`

- **Modul shared `_shared/error-handler.ts`**: mapare erori generice, fără detalii tehnice în răspunsuri
- **Validare JWT explicită** în `create-user`, `delete-user`, `log-auth-event`, `iris-chat`:
  ```typescript
  const { data, error } = await supabase.auth.getClaims(token);
  if (error) return 401;
  ```
- **Validare rol** în funcțiile sensibile (super_admin check prin service role query)
- **Input validation cu Zod** pe toate body-urile
- **Rate limiting simplu**: counter per IP/user în memorie cu window de 60s
- **Timeout protection**: AbortController cu 30s max pe operații externe
- **Răspunsuri sanitizate**: niciun `error.message` raw expus clientului

### 1.4 Storage — Signed URLs
**Fișiere**: componentele care folosesc `getPublicUrl()` pe bucket-uri private

- Înlocuire `getPublicUrl()` → `createSignedUrl(path, 3600)` pentru:
  - `documents` (1h)
  - `employee-documents` (30min)
  - `medical-documents` (15min)
  - `archive-documents` (15min)
  - `secretariat-documents` (1h)
- Bucket-urile publice (`avatars`, `announcement-attachments`, `chat-attachments`, `email-assets`, `kiosk-images`) rămân cu `getPublicUrl()`
- Adăugare audit log la download documente sensibile

### 1.5 Audit Extins
**Fișiere**: migrare SQL + componente frontend

- Extindere tabelul `audit_logs` cu coloanele: `user_agent`, `role_at_time`
- Edge function `log-auth-event` actualizat să captureze user_agent și IP
- Audit automat pentru: login/logout, schimbări rol, CRUD utilizatori, aprobări, download documente
- Trigger DB pe `user_roles` care loghează orice UPDATE/INSERT/DELETE

### 1.6 Security Events Table + Alerte Inițiale
**Migrare SQL**: tabel `security_events`

```sql
CREATE TABLE security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL, -- login_suspect, new_device, new_ip, failed_login, role_change, critical_action
  severity text NOT NULL DEFAULT 'info', -- info, warning, critical
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}',
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
```

- RLS: super_admin vede tot, user-ul vede doar ale sale
- Edge function `log-auth-event` populează automat la login (detectare IP nou, device nou prin comparație cu istoricul)

### 1.7 Public Profile Fix
- Creare view `public_profiles_masked` care maschează câmpurile conform flag-urilor `show_phone`, `show_email`
- RLS pe view sau restricționare acces anon la tabela originală

---

## FAZA 2 — Important

### 2.1 Sesiuni Active & Logout Global
- Afișare sesiuni active în `SecurityPanel.tsx` (bazat pe `auth_login_log`)
- Buton „Deconectare din toate sesiunile" → `supabase.auth.signOut({ scope: 'global' })`
- Invalidare sesiuni compromise prin admin panel

### 2.2 Reautentificare Acțiuni Critice
**Fișier nou**: `src/components/shared/ReauthDialog.tsx`

- Dialog modal care cere parola curentă înainte de:
  - Schimbare rol utilizator
  - Ștergere utilizator
  - Modificare setări globale
  - Export date sensibile
  - Modificare rutări/fluxuri
- Verificare prin `supabase.auth.signInWithPassword()` temporar

### 2.3 Data Masking
- CNP: afișare `29xxxxx****xx` (primele 2 + ultimele 2 vizibile)
- Serie CI: `XX****` 
- Implementare funcție `maskSensitiveField(value, type)` în `src/utils/dataMasking.ts`
- Aplicare în `EmployeeHub`, `PersonalDataEditor`, `EmployeeDigitalDossier`
- Acces la date complete doar pentru HR/super_admin cu audit log

### 2.4 Push Notifications de Securitate
- Integrare Web Push API (Service Worker deja existent via PWA)
- Tabel `push_subscriptions` pentru stocarea endpoint-urilor
- Edge function `send-security-alert` care trimite push + notificare in-app + email fallback (critical)
- Preferințe per utilizator în Settings → Securitate

### 2.5 DB Functions — Fix search_path
- Migrare care adaugă `SET search_path TO 'public'` pe funcțiile identificate ca vulnerabile

### 2.6 CORS Hardening pe Edge Functions
- Înlocuire `Access-Control-Allow-Origin: *` cu origin-uri specifice:
  ```
  https://intranet.icmpp.ro, https://*.lovable.app, https://*.lovableproject.com
  ```

---

## FAZA 3 — Avansat

### 3.1 IRIS Guardrails
- Separare clară read-only tools vs write tools în `iris-chat`
- Rate limit: max 20 req/min per user pe IRIS
- Audit complet deja existent (`initiated_via: iris`) — extindere cu tool_name și parametri
- Filtrare strictă: IRIS nu poate accesa tabele în afara tool-urilor definite
- Confirmare obligatorie deja implementată (IrisConfirmationCard) — verificare edge case-uri

### 3.2 Export Controlat
- Buton export (CSV/PDF) doar pentru roluri autorizate
- Audit log la fiecare export cu: user, rol, tip export, nr. înregistrări, timestamp
- Watermark pe PDF-uri exportate cu numele utilizatorului + timestamp

### 3.3 2FA pentru Roluri Sensibile (pregătire)
- Supabase Auth suportă MFA nativ
- Implementare `supabase.auth.mfa.enroll()` / `verify()` / `challenge()`
- Obligatoriu pentru: super_admin, hr, sef_srus
- Recomandat pentru: director_institut, director_adjunct, salarizare
- UI în Settings → Securitate pentru configurare TOTP

### 3.4 Monitorizare Operațională
- Dashboard securitate în Admin cu:
  - Login-uri eșuate (ultimele 24h)
  - Dispozitive noi detectate
  - Alerte neacknowledge-uite
  - Top IP-uri suspecte
- Auto-refresh la 30s cu Supabase Realtime pe `security_events`

---

## Detalii Tehnice de Implementare

### Fișiere noi de creat:
1. `supabase/functions/_shared/error-handler.ts` — error mapping
2. `supabase/functions/_shared/rate-limiter.ts` — rate limiting simplu
3. `supabase/functions/_shared/auth-helpers.ts` — JWT + rol validation helpers
4. `src/utils/dataMasking.ts` — mascare date sensibile
5. `src/components/shared/ReauthDialog.tsx` — dialog reautentificare
6. `src/components/admin/SecurityDashboard.tsx` — dashboard securitate admin

### Fișiere de modificat:
1. `index.html` — security headers meta tags
2. `supabase/functions/create-user/index.ts` — error sanitization + input validation
3. `supabase/functions/delete-user/index.ts` — idem
4. `supabase/functions/invite-user/index.ts` — idem
5. `supabase/functions/iris-chat/index.ts` — rate limit + audit extins
6. `supabase/functions/log-auth-event/index.ts` — device fingerprint + security events
7. `supabase/functions/check-ip-access/index.ts` — CORS restricționat
8. Toate componentele care folosesc `getPublicUrl()` pe bucket-uri private
9. `src/components/settings/SecurityPanel.tsx` — sesiuni active, 2FA UI
10. `src/components/hr/EmployeeHub.tsx` — data masking

### Migrări SQL necesare:
1. Tabel `security_events` + RLS
2. Tabel `push_subscriptions` + RLS  
3. Trigger pe `user_roles` pentru audit automat
4. Extindere `audit_logs` cu `user_agent`, `role_at_time`
5. View `public_profiles_masked`
6. Fix `search_path` pe funcții vulnerabile

### Ordine de implementare recomandată (în cadrul Fazei 1):
1. Security headers (risc 0 de a strica ceva)
2. Error handler shared + sanitizare edge functions
3. Leaked password protection (un click)
4. Security events table + audit extins
5. Signed URLs pe storage
6. Public profile fix
7. JWT + rol validation în edge functions

