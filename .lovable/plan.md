# Plan de Securizare — Platforma Intranet ICMPP

## Status: ✅ Toate cele 3 faze implementate

---

## FAZA 1 — ✅ Completă
- Security headers (CSP Report-Only, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Leaked password protection (HIBP) — activat manual
- Edge functions hardening (error-handler, rate-limiter, auth-helpers, input validation)
- Security events table + audit extins (user_agent, role_at_time, trigger pe user_roles)
- Signed URLs pe storage (documents, employee-documents, medical-documents, archive-documents)
- Public profile fix + search_path fix pe funcții DB
- JWT + rol validation în edge functions sensibile

## FAZA 2 — ✅ Completă
- Sesiuni active + logout global (SecurityPanel)
- Reautentificare acțiuni critice (ReauthDialog în AdminUsersPanel)
- Data masking (CNP, CI în EmployeeDigitalDossier)
- Preferințe alerte securitate (push_subscriptions, security_alert_preferences)
- CORS hardening pe edge functions (cors.ts shared)
- DB functions search_path fix

## FAZA 3 — ✅ Completă
- IRIS guardrails: rate limit 20req/min, read/write tool classification, unknown tool blocking, sanitized errors
- Export controlat: audit logging pe toate exporturile HR (exportAudit.ts)
- 2FA/MFA UI: TOTP enrollment/verify/unenroll în SecurityPanel, recomandat pentru roluri sensibile
- Security Dashboard admin: real-time events, failed logins 24h, new devices, suspicious IPs, acknowledge alerts
